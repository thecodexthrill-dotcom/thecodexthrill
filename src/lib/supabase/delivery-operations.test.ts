import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  calculateProjectTaskProgress,
  canPortalUserAccessOrganization,
  canPortalUserAccessSupportTicket,
  classifyInvoiceLifecycleStatus,
  extractCanonicalStoragePath,
  formatDeliveryDescription,
  formatMediaBytes,
  parseDeliveryDescription,
  parseInvoiceItems,
  redactInternalNotesForClient,
  resolvePortalTicketOrganizationId,
} from "./delivery-operations-helper.ts";

describe("Phase 3: Client Delivery & Revenue Operations Helpers", () => {
  it("formats and parses milestone, client description, handover checklist, and internal staff notes", () => {
    const raw = formatDeliveryDescription({
      milestone: "Milestone 1: Core Architecture",
      clientDescription: "Deliver multi-tenant RBAC and RLS policies.",
      handoverChecklist: "1. Production SQL deployed\n2. Runbook shared",
      internalNotes: "Target gross margin 68%. Assigned to senior cloud architect.",
    });

    const parsed = parseDeliveryDescription(raw);
    assert.equal(parsed.milestone, "Milestone 1: Core Architecture");
    assert.equal(parsed.clientDescription, "Deliver multi-tenant RBAC and RLS policies.");
    assert.equal(parsed.handoverChecklist, "1. Production SQL deployed\n2. Runbook shared");
    assert.equal(parsed.internalNotes, "Target gross margin 68%. Assigned to senior cloud architect.");
  });

  it("redacts internal staff notes completely for client portal views while preserving milestone and handover checklist", () => {
    const raw = formatDeliveryDescription({
      milestone: "Phase 2: UAT & Handover",
      clientDescription: "Client UAT environment ready for review.",
      handoverChecklist: "UAT credentials uploaded to Files.",
      internalNotes: "CONFIDENTIAL STAFF NOTE: Do not share internal infra cost.",
    });

    const redacted = redactInternalNotesForClient(raw);
    assert.ok(!redacted.includes("CONFIDENTIAL STAFF NOTE"));
    assert.ok(!redacted.includes("INTERNAL STAFF NOTES"));

    const parsedRedacted = parseDeliveryDescription(redacted);
    assert.equal(parsedRedacted.milestone, "Phase 2: UAT & Handover");
    assert.equal(parsedRedacted.clientDescription, "Client UAT environment ready for review.");
    assert.equal(parsedRedacted.handoverChecklist, "UAT credentials uploaded to Files.");
    assert.equal(parsedRedacted.internalNotes, "");
  });

  it("calculates weighted project task completion progress accurately", () => {
    const progress = calculateProjectTaskProgress([
      { status: "done" },
      { status: "done" },
      { status: "review" },
      { status: "in_progress" },
    ]);

    assert.equal(progress.totalTasks, 4);
    assert.equal(progress.completedTasks, 2);
    assert.equal(progress.reviewTasks, 1);
    assert.equal(progress.inProgressTasks, 1);
    // (100 + 100 + 75 + 35) / 4 = 77.5 -> 78%
    assert.equal(progress.computedProgressPct, 78);
  });

  it("parses project-linked line items and verified payment records from invoice items JSONB", () => {
    const items = [
      {
        kind: "line_item",
        description: "Milestone 1: Architecture & Setup",
        amount_cents: 300000,
        project_id: "11111111-2222-3333-4444-555555555555",
        project_name: "Enterprise Cloud Migration",
      },
      {
        kind: "line_item",
        description: "Milestone 2: API Integration",
        amount_cents: 200000,
        project_id: "11111111-2222-3333-4444-555555555555",
        project_name: "Enterprise Cloud Migration",
      },
      {
        kind: "payment_record",
        amount_cents: 200000,
        method: "wire_transfer",
        reference: "FEDWIRE-20261010-001",
        recorded_at: "2026-10-10T10:00:00.000Z",
        recorded_by_email: "admin@thecodexthrill.com",
      },
    ];

    const parsed = parseInvoiceItems(items, 500000);
    assert.equal(parsed.lineItems.length, 2);
    assert.equal(parsed.paymentRecords.length, 1);
    assert.equal(parsed.recordedPaidCents, 200000);
    assert.deepEqual(parsed.linkedProject, {
      id: "11111111-2222-3333-4444-555555555555",
      name: "Enterprise Cloud Migration",
    });
  });

  it("distinguishes draft, issued, partially paid, overdue, and settled invoices", () => {
    const futureDate = "2099-12-31";
    const pastDate = "2020-01-01";

    const draft = classifyInvoiceLifecycleStatus({
      status: "draft",
      amount_cents: 500000,
      due_date: futureDate,
      items: [],
    });
    assert.equal(draft.displayStatus, "draft");
    assert.equal(draft.balanceDueCents, 500000);

    const issued = classifyInvoiceLifecycleStatus({
      status: "sent",
      amount_cents: 500000,
      due_date: futureDate,
      items: [],
    });
    assert.equal(issued.displayStatus, "issued");
    assert.equal(issued.balanceDueCents, 500000);
    assert.equal(issued.isOverdue, false);

    const overdue = classifyInvoiceLifecycleStatus({
      status: "sent",
      amount_cents: 500000,
      due_date: pastDate,
      items: [],
    });
    assert.equal(overdue.displayStatus, "overdue");
    assert.equal(overdue.isOverdue, true);
    assert.equal(overdue.balanceDueCents, 500000);

    const partiallyPaid = classifyInvoiceLifecycleStatus({
      status: "sent",
      amount_cents: 500000,
      due_date: futureDate,
      items: [
        {
          kind: "payment_record",
          amount_cents: 200000,
          method: "ach",
          reference: "ACH-99881",
          recorded_at: "2026-10-10T10:00:00.000Z",
        },
      ],
    });
    assert.equal(partiallyPaid.displayStatus, "partially_paid");
    assert.equal(partiallyPaid.paidAmountCents, 200000);
    assert.equal(partiallyPaid.balanceDueCents, 300000);
    assert.equal(partiallyPaid.hasVerifiedPaymentRecord, true);

    const settled = classifyInvoiceLifecycleStatus({
      status: "paid",
      amount_cents: 500000,
      due_date: futureDate,
      paid_at: "2026-10-10T12:00:00.000Z",
      items: [
        {
          kind: "payment_record",
          amount_cents: 500000,
          method: "wire_transfer",
          reference: "WIRE-FULL-5000",
          recorded_at: "2026-10-10T12:00:00.000Z",
        },
      ],
    });
    assert.equal(settled.displayStatus, "settled");
    assert.equal(settled.paidAmountCents, 500000);
    assert.equal(settled.balanceDueCents, 0);
    assert.equal(settled.hasVerifiedPaymentRecord, true);
  });

  it("enforces strict portal organization and support ticket access isolation", () => {
    const activeOrgs = new Set(["org-alpha", "org-beta"]);

    assert.equal(canPortalUserAccessOrganization("org-alpha", activeOrgs), true);
    assert.equal(canPortalUserAccessOrganization("org-gamma", activeOrgs), false);
    assert.equal(canPortalUserAccessOrganization(null, activeOrgs), false);

    // Ticket belonging to an active organization of the user is accessible
    assert.equal(
      canPortalUserAccessSupportTicket(
        { organization_id: "org-alpha", customer_id: "other-user" },
        "user-1",
        activeOrgs,
      ),
      true,
    );

    // Ticket with null organization_id is ONLY accessible if customer_id matches userId
    assert.equal(
      canPortalUserAccessSupportTicket(
        { organization_id: null, customer_id: "user-1" },
        "user-1",
        activeOrgs,
      ),
      true,
    );
    assert.equal(
      canPortalUserAccessSupportTicket(
        { organization_id: null, customer_id: "other-user" },
        "user-1",
        activeOrgs,
      ),
      false,
    );

    // Ticket belonging to a different organization is blocked
    assert.equal(
      canPortalUserAccessSupportTicket(
        { organization_id: "org-foreign", customer_id: "other-user" },
        "user-1",
        activeOrgs,
      ),
      false,
    );

    // Portal ticket organization resolution prevents cross-tenant spoofing
    assert.equal(
      resolvePortalTicketOrganizationId("org-beta", activeOrgs),
      "org-beta",
    );
    assert.equal(
      resolvePortalTicketOrganizationId("org-foreign", activeOrgs),
      "org-alpha",
    );
    assert.equal(resolvePortalTicketOrganizationId(null, activeOrgs), "org-alpha");
    assert.equal(resolvePortalTicketOrganizationId("org-alpha", []), null);
  });

  it("normalizes document storage paths and protects external links", () => {
    // Legacy full signed URL with query params
    const signedUrl = "https://isgoypmebtoipfvtaflg.supabase.co/storage/v1/object/sign/tenant-documents/org-123/1728900-deliverable.pdf?token=eyJhbGciOi...";
    assert.equal(extractCanonicalStoragePath(signedUrl), "org-123/1728900-deliverable.pdf");

    // URL with URI encoded spaces and characters
    const encodedUrl = "https://isgoypmebtoipfvtaflg.supabase.co/storage/v1/object/public/tenant-documents/org-456/Architecture%20Deck%20v2.pdf";
    assert.equal(extractCanonicalStoragePath(encodedUrl), "org-456/Architecture Deck v2.pdf");

    // Canonical relative path
    assert.equal(extractCanonicalStoragePath("org-789/spec.docx"), "org-789/spec.docx");

    // External links (Figma, GitHub, external Google Drive) return null for bucket storage
    assert.equal(extractCanonicalStoragePath("https://www.figma.com/file/abcdef123/Design-System"), null);
    assert.equal(extractCanonicalStoragePath("https://github.com/client-org/repo"), null);

    // Empty or undefined values
    assert.equal(extractCanonicalStoragePath(""), null);
    assert.equal(extractCanonicalStoragePath(null), null);
    assert.equal(extractCanonicalStoragePath(undefined), null);
  });

  it("formats media and document byte sizes to human-readable units", () => {
    assert.equal(formatMediaBytes(0), "0 B");
    assert.equal(formatMediaBytes(-100), "0 B");
    assert.equal(formatMediaBytes(500), "500 B");
    assert.equal(formatMediaBytes(1024), "1 KB");
    assert.equal(formatMediaBytes(1536), "1.5 KB");
    assert.equal(formatMediaBytes(1048576), "1 MB");
    assert.equal(formatMediaBytes(26214400), "25 MB");
    assert.equal(formatMediaBytes(1073741824), "1 GB");
  });

  it("enforces tenant document organization isolation for client portal users", () => {
    const userActiveOrgs = new Set(["org-corp-a", "org-corp-b"]);

    // User can access documents for their active organizations
    assert.equal(canPortalUserAccessOrganization("org-corp-a", userActiveOrgs), true);
    assert.equal(canPortalUserAccessOrganization("org-corp-b", userActiveOrgs), true);

    // User CANNOT access documents from another tenant
    assert.equal(canPortalUserAccessOrganization("org-foreign-c", userActiveOrgs), false);
    assert.equal(canPortalUserAccessOrganization(null, userActiveOrgs), false);
    assert.equal(canPortalUserAccessOrganization(undefined, userActiveOrgs), false);
    assert.equal(canPortalUserAccessOrganization("org-corp-a", []), false);
  });
});



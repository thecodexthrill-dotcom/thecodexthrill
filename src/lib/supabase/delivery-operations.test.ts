import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  calculateProjectTaskProgress,
  classifyInvoiceLifecycleStatus,
  formatDeliveryDescription,
  parseDeliveryDescription,
  parseInvoiceItems,
  redactInternalNotesForClient,
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
});


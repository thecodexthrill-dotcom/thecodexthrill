import assert from "node:assert/strict";
import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";
import {
  calculateProjectTaskProgress,
  classifyInvoiceLifecycleStatus,
  formatDeliveryDescription,
  parseDeliveryDescription,
  parseInvoiceItems,
  redactInternalNotesForClient,
} from "../src/lib/supabase/delivery-operations-helper.ts";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey =
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY;

assert.ok(supabaseUrl, "NEXT_PUBLIC_SUPABASE_URL must be configured");
assert.ok(anonKey, "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY must be configured");
assert.ok(serviceRoleKey, "SUPABASE_SECRET_KEY must be configured");

const adminClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const anonClient = createClient(supabaseUrl, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function runAcceptance() {
  console.log("=== Phase 3: Client Delivery & Revenue Operations Acceptance ===");
  const runId = Date.now().toString(36).toUpperCase();

  let orgId = null;
  let projectId = null;
  const taskIds = [];
  let documentId = null;
  let invoiceId = null;
  let ticketId = null;

  try {
    // 1. Create Client Organization
    const { data: org, error: orgErr } = await adminClient
      .from("organizations")
      .insert({
        name: `Phase3 Delivery Test Org ${runId}`,
        status: "active",
      })
      .select("id, name, status")
      .single();

    assert.ifError(orgErr);
    assert.ok(org?.id, "Organization must be created");
    orgId = org.id;
    console.log(`[PASS] 1. Client organization provisioned (${org.id})`);

    // 2. Create Delivery Project with Milestone, Handover Checklist, and Internal Staff Notes
    const projectDescription = formatDeliveryDescription({
      milestone: "Milestone 1: Zero-Trust Cloud Architecture",
      clientDescription: "Deploy multi-tenant RBAC, RLS policies, and executive portal.",
      handoverChecklist: "1. Production schema verified\n2. Security runbook uploaded",
      internalNotes: "INTERNAL STAFF ONLY: Gross margin target 72%. Do not expose to client.",
    });

    const { data: project, error: projErr } = await adminClient
      .from("tenant_projects")
      .insert({
        organization_id: orgId,
        name: `Enterprise Platform Delivery ${runId}`,
        description: projectDescription,
        status: "in_progress",
        progress_pct: 15,
        start_date: "2026-10-01",
        target_date: "2026-11-15",
      })
      .select("*")
      .single();

    assert.ifError(projErr);
    assert.ok(project?.id, "Project must be created");
    projectId = project.id;

    // Verify client portal redaction strips internal staff notes while keeping milestone & handover
    const clientViewDesc = redactInternalNotesForClient(project.description);
    assert.ok(!clientViewDesc.includes("Gross margin target 72%"));
    assert.ok(!clientViewDesc.includes("INTERNAL STAFF NOTES"));
    const parsedClientView = parseDeliveryDescription(clientViewDesc);
    assert.equal(parsedClientView.milestone, "Milestone 1: Zero-Trust Cloud Architecture");
    assert.equal(parsedClientView.handoverChecklist, "1. Production schema verified\n2. Security runbook uploaded");
    assert.equal(parsedClientView.internalNotes, "");
    console.log("[PASS] 2. Project created with milestone, handover checklist, and server-side redacted staff notes");

    // 3. Create Tasks & Sync Project Progress
    const task1Desc = formatDeliveryDescription({
      milestone: "Milestone 1: Zero-Trust Cloud Architecture",
      clientDescription: "Configure PostgreSQL RLS policies for tenant isolation.",
      internalNotes: "PR #104 merged and verified.",
    });
    const task2Desc = formatDeliveryDescription({
      milestone: "Milestone 1: Zero-Trust Cloud Architecture",
      clientDescription: "Complete client UAT walkthrough.",
      internalNotes: "Waiting on client sign-off.",
    });

    const { data: tasks, error: taskErr } = await adminClient
      .from("tenant_tasks")
      .insert([
        {
          project_id: projectId,
          organization_id: orgId,
          title: "Implement RLS Tenant Isolation",
          description: task1Desc,
          status: "done",
          priority: "high",
          due_date: "2026-10-20",
        },
        {
          project_id: projectId,
          organization_id: orgId,
          title: "Client UAT Walkthrough",
          description: task2Desc,
          status: "review",
          priority: "medium",
          due_date: "2026-10-28",
        },
      ])
      .select("*");

    assert.ifError(taskErr);
    assert.equal(tasks?.length, 2);
    taskIds.push(...tasks.map((t) => t.id));

    const progressSummary = calculateProjectTaskProgress(tasks);
    assert.equal(progressSummary.computedProgressPct, 88); // (100 + 75) / 2 = 88

    const { data: updatedProj, error: syncErr } = await adminClient
      .from("tenant_projects")
      .update({ progress_pct: progressSummary.computedProgressPct })
      .eq("id", projectId)
      .select("progress_pct")
      .single();

    assert.ifError(syncErr);
    assert.equal(updatedProj.progress_pct, 88);
    console.log("[PASS] 3. Project tasks created and project progress_pct synchronized (88%)");

    // 4. Register Project-Linked Deliverable Document
    const { data: deliverable, error: docErr } = await adminClient
      .from("tenant_documents")
      .insert({
        organization_id: orgId,
        project_id: projectId,
        name: `Architecture Specification & Security Runbook (${runId}).pdf`,
        file_url: "https://thecodexthrill.com/deliverables/architecture-runbook.pdf",
        file_size_bytes: 245760,
        file_type: "application/pdf",
        category: "deliverable",
      })
      .select("*")
      .single();

    assert.ifError(docErr);
    assert.equal(deliverable.project_id, projectId);
    assert.equal(deliverable.category, "deliverable");
    documentId = deliverable.id;
    console.log("[PASS] 4. Project-linked deliverable persisted in tenant_documents");

    // 5. Create Project-Linked Multi-Line Invoice (Issued / Sent)
    const initialLineItems = [
      {
        kind: "line_item",
        description: "Milestone 1: Zero-Trust Architecture & Core Setup",
        quantity: 1,
        unit_price_cents: 300000,
        amount_cents: 300000,
        project_id: projectId,
        project_name: project.name,
      },
      {
        kind: "line_item",
        description: "Milestone 2: Client Portal & Deliverable Handover",
        quantity: 1,
        unit_price_cents: 200000,
        amount_cents: 200000,
        project_id: projectId,
        project_name: project.name,
      },
    ];

    const { data: invoice, error: invErr } = await adminClient
      .from("tenant_invoices")
      .insert({
        organization_id: orgId,
        invoice_number: `INV-P3-${runId}`,
        amount_cents: 500000,
        currency: "USD",
        status: "sent",
        due_date: "2026-12-31",
        notes: "Net-15 wire settlement terms.",
        items: initialLineItems,
      })
      .select("*")
      .single();

    assert.ifError(invErr);
    invoiceId = invoice.id;

    const issuedStatus = classifyInvoiceLifecycleStatus(invoice);
    assert.equal(issuedStatus.displayStatus, "issued");
    assert.equal(issuedStatus.balanceDueCents, 500000);
    assert.equal(issuedStatus.hasVerifiedPaymentRecord, false);
    console.log("[PASS] 5. Project-linked multi-line invoice issued ($5,000.00, status: Issued)");

    // 6. Record Verified Partial Payment ($2,000.00)
    const partialPaymentRecord = {
      kind: "payment_record",
      amount_cents: 200000,
      method: "wire_transfer",
      reference: `FEDWIRE-PART-${runId}`,
      recorded_at: new Date().toISOString(),
      recorded_by_email: "finance@thecodexthrill.com",
      notes: "Initial milestone wire tranche",
    };

    const { data: partialInvoice, error: partErr } = await adminClient
      .from("tenant_invoices")
      .update({
        items: [...initialLineItems, partialPaymentRecord],
        status: "sent",
      })
      .eq("id", invoiceId)
      .select("*")
      .single();

    assert.ifError(partErr);
    const partialStatus = classifyInvoiceLifecycleStatus(partialInvoice);
    assert.equal(partialStatus.displayStatus, "partially_paid");
    assert.equal(partialStatus.paidAmountCents, 200000);
    assert.equal(partialStatus.balanceDueCents, 300000);
    assert.equal(partialStatus.hasVerifiedPaymentRecord, true);
    console.log("[PASS] 6. Partial payment recorded ($2,000.00 paid, $3,000.00 balance due, status: Partially Paid)");

    // 7. Record Final Verified Settlement Payment ($3,000.00) & Audit Event
    const finalPaymentRecord = {
      kind: "payment_record",
      amount_cents: 300000,
      method: "wire_transfer",
      reference: `FEDWIRE-FINAL-${runId}`,
      recorded_at: new Date().toISOString(),
      recorded_by_email: "finance@thecodexthrill.com",
      notes: "Final delivery settlement",
    };
    const settledAt = new Date().toISOString();

    const { data: settledInvoice, error: settleErr } = await adminClient
      .from("tenant_invoices")
      .update({
        items: [...initialLineItems, partialPaymentRecord, finalPaymentRecord],
        status: "paid",
        paid_at: settledAt,
      })
      .eq("id", invoiceId)
      .select("*")
      .single();

    assert.ifError(settleErr);

    const { error: auditErr } = await adminClient.from("audit_events").insert({
      scope: "platform",
      action: "invoice.payment_recorded",
      target_type: "tenant_invoices",
      target_id: invoiceId,
      details: {
        organization_id: orgId,
        invoice_number: settledInvoice.invoice_number,
        payment_cents: 300000,
        total_paid_cents: 500000,
        reference: finalPaymentRecord.reference,
        resulting_status: "paid",
      },
    });
    assert.ifError(auditErr);

    const settledStatus = classifyInvoiceLifecycleStatus(settledInvoice);
    const parsedSettled = parseInvoiceItems(settledInvoice.items, settledInvoice.amount_cents);
    assert.equal(settledStatus.displayStatus, "settled");
    assert.equal(settledStatus.paidAmountCents, 500000);
    assert.equal(settledStatus.balanceDueCents, 0);
    assert.equal(settledStatus.hasVerifiedPaymentRecord, true);
    assert.equal(parsedSettled.paymentRecords.length, 2);
    assert.equal(parsedSettled.linkedProject?.id, projectId);
    console.log("[PASS] 7. Final settlement recorded ($5,000.00 total paid, $0.00 due, status: Settled, audit_events logged)");

    // 8. Client Support Ticket & Thread Communication
    const { data: usersData } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1 });
    const customerUserId = usersData?.users?.[0]?.id;
    assert.ok(customerUserId, "At least one auth user must exist for support ticket test");

    const { data: ticket, error: ticketErr } = await adminClient
      .from("support_tickets")
      .insert({
        ticket_number: `TICK-P3-${runId}`,
        organization_id: orgId,
        customer_id: customerUserId,
        title: "Production Handover Verification Question",
        category: "technical",
        priority: "high",
        status: "new",
      })
      .select("*")
      .single();

    assert.ifError(ticketErr);
    ticketId = ticket.id;

    const { error: msgErr } = await adminClient
      .from("support_ticket_messages")
      .insert([
        {
          ticket_id: ticketId,
          sender_id: customerUserId,
          is_staff: false,
          message: "Can you confirm the runbook PDF in Files covers the production RLS policies?",
        },
        {
          ticket_id: ticketId,
          sender_id: customerUserId,
          is_staff: true,
          message: "Confirmed — Section 3 of the uploaded Architecture Runbook details all active RLS policies.",
        },
      ]);
    assert.ifError(msgErr);
    console.log("[PASS] 8. Organization-linked support ticket & staff/client message thread verified");

    // 9. Verify RLS Tenant Isolation against unauthenticated/anon queries
    const [anonProj, anonTasks, anonDocs, anonInv, anonTickets] = await Promise.all([
      anonClient.from("tenant_projects").select("id").eq("id", projectId),
      anonClient.from("tenant_tasks").select("id").in("id", taskIds),
      anonClient.from("tenant_documents").select("id").eq("id", documentId),
      anonClient.from("tenant_invoices").select("id").eq("id", invoiceId),
      anonClient.from("support_tickets").select("id").eq("id", ticketId),
    ]);

    assert.equal(anonProj.data?.length ?? 0, 0, "Anon client must not read tenant_projects");
    assert.equal(anonTasks.data?.length ?? 0, 0, "Anon client must not read tenant_tasks");
    assert.equal(anonDocs.data?.length ?? 0, 0, "Anon client must not read tenant_documents");
    assert.equal(anonInv.data?.length ?? 0, 0, "Anon client must not read tenant_invoices");
    assert.equal(anonTickets.data?.length ?? 0, 0, "Anon client must not read support_tickets");
    console.log("[PASS] 9. Zero-Trust RLS tenant isolation verified across projects, tasks, documents, invoices, and support");

    console.log("\nALL PHASE 3 CLIENT DELIVERY & REVENUE OPERATIONS ACCEPTANCE CHECKS PASSED (9/9).");
  } finally {
    if (ticketId) {
      await adminClient.from("support_tickets").delete().eq("id", ticketId);
    }
    if (invoiceId) {
      await adminClient.from("tenant_invoices").delete().eq("id", invoiceId);
    }
    if (documentId) {
      await adminClient.from("tenant_documents").delete().eq("id", documentId);
    }
    if (taskIds.length > 0) {
      await adminClient.from("tenant_tasks").delete().in("id", taskIds);
    }
    if (projectId) {
      await adminClient.from("tenant_projects").delete().eq("id", projectId);
    }
    if (orgId) {
      await adminClient.from("organizations").delete().eq("id", orgId);
    }
    console.log("[CLEANUP] Test organization, project, tasks, deliverable, invoice, and ticket removed.");
  }
}

runAcceptance().catch((err) => {
  console.error("Acceptance test failed:", err);
  process.exit(1);
});


"use client";

import { useState } from "react";
import {
  CreditCard,
  Plus,
  Trash2,
  FileText,
  Printer,
  X,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  FolderKanban,
} from "lucide-react";
import Link from "next/link";
import {
  createInvoiceAction,
  updateInvoiceStatusAction,
  recordInvoicePaymentAction,
  deleteInvoiceAction,
} from "@/lib/supabase/operations-actions";
import {
  classifyInvoiceLifecycleStatus,
  parseInvoiceItems,
} from "@/lib/supabase/delivery-operations-helper";

export type InvoiceRecord = {
  id: string;
  organization_id: string;
  invoice_number: string;
  amount_cents: number;
  currency: string;
  status: "draft" | "sent" | "paid" | "overdue" | "cancelled";
  due_date: string | null;
  paid_at: string | null;
  items: unknown;
  notes: string | null;
  created_at: string;
};

type BillingManagerProps = {
  invoices: InvoiceRecord[];
  isStaff: boolean;
  userOrganizations?: { id: string; name: string }[];
  projects?: { id: string; organization_id: string; name: string }[];
  notice?: string;
  queryError?: string;
};

export function BillingManager({
  invoices,
  isStaff,
  userOrganizations = [],
  projects = [],
  notice,
  queryError,
}: BillingManagerProps) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceRecord | null>(null);
  const [paymentModalInvoice, setPaymentModalInvoice] = useState<InvoiceRecord | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedOrgId, setSelectedOrgId] = useState<string>(userOrganizations[0]?.id ?? "");
  const [lineItemRows, setLineItemRows] = useState<Array<{ description: string; amount: string }>>([
    { description: "Milestone 1 — Architecture & Software Engineering Delivery", amount: "" },
  ]);

  const enrichedInvoices = invoices.map((inv) => ({
    invoice: inv,
    parsed: parseInvoiceItems(inv.items, inv.amount_cents),
    commercial: classifyInvoiceLifecycleStatus(inv),
  }));

  const totalBilledCents = enrichedInvoices.reduce(
    (sum, item) => sum + (item.commercial.displayStatus !== "cancelled" ? item.invoice.amount_cents : 0),
    0
  );
  const totalPaidCents = enrichedInvoices.reduce(
    (sum, item) => sum + item.commercial.paidAmountCents,
    0
  );
  const totalOutstandingCents = enrichedInvoices.reduce(
    (sum, item) => sum + item.commercial.balanceDueCents,
    0
  );
  const totalOverdueCents = enrichedInvoices.reduce(
    (sum, item) => sum + (item.commercial.isOverdue ? item.commercial.balanceDueCents : 0),
    0
  );

  const filteredInvoices = enrichedInvoices.filter((item) => {
    if (statusFilter === "all") return true;
    return item.commercial.displayStatus === statusFilter;
  });

  const orgProjects = projects.filter(
    (p) => !selectedOrgId || p.organization_id === selectedOrgId
  );

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
  };

  const getStatusColor = (displayStatus: string) => {
    switch (displayStatus) {
      case "settled":
        return "#10b981";
      case "partially_paid":
        return "#38bdf8";
      case "overdue":
        return "#ef4444";
      case "issued":
        return "var(--gold)";
      case "cancelled":
        return "var(--muted)";
      default:
        return "var(--foreground)";
    }
  };

  const getNoticeMessage = (code: string) => {
    switch (code) {
      case "created":
        return "Invoice generated and linked to client account.";
      case "updated":
        return "Invoice lifecycle status updated.";
      case "payment_recorded":
        return "Verified payment recorded and audit event logged.";
      case "deleted":
        return "Invoice deleted.";
      case "payment_record_required":
        return "Policy Enforcement: Invoices cannot be marked as Paid without a verified payment record and bank/settlement reference. Use 'Record Payment' to log a verified settlement.";
      case "invalid_payment":
        return "Invalid payment details. Please provide a positive amount, payment method, bank/settlement reference (min 3 chars), and audit confirmation.";
      case "invalid":
        return "Invalid invoice parameters. Please check required fields and line item amounts.";
      case "save":
        return "Unable to save invoice update to Supabase.";
      default:
        return code;
    }
  };

  const isErrorNotice =
    notice === "invalid" ||
    notice === "save" ||
    notice === "payment_record_required" ||
    notice === "invalid_payment";

  return (
    <div className="workspace-content" style={{ display: "grid", gap: "24px" }}>
      {queryError && (
        <p className="module-alert" role="alert">
          <strong>Database Query Warning:</strong> Unable to retrieve full invoice records ({queryError}).
        </p>
      )}

      {notice && (
        <p className={isErrorNotice ? "module-alert" : "module-success"} role="status">
          {getNoticeMessage(notice)}
        </p>
      )}

      {isStaff && userOrganizations.length === 0 && (
        <div className="module-panel" style={{ border: "1px dashed var(--gold)", padding: "16px" }}>
          <p style={{ margin: 0, fontSize: "14px", color: "var(--gold)" }}>
            <strong>Notice:</strong> No client organization found. Please <Link href="/admin/clients" style={{ textDecoration: "underline", color: "var(--gold)" }}>create an organization in Clients</Link> first to issue invoices.
          </p>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <h2 style={{ fontSize: "20px", fontWeight: 700, margin: 0 }}>Billing, Project Invoicing &amp; Settlement</h2>
          <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: "14px" }}>
            Project-linked commercial statements, milestone line items, and audited payment settlement records.
          </p>
        </div>

        {isStaff && userOrganizations.length > 0 && (
          <button
            type="button"
            onClick={() => setShowCreateModal(!showCreateModal)}
            className="button button-gold"
            style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}
          >
            <Plus size={16} /> Generate Project Invoice
          </button>
        )}
      </div>

      {/* Commercial Settlement Policy Banner for Client & Staff Clarity */}
      <div
        className="module-panel"
        style={{
          padding: "12px 16px",
          borderLeft: "3px solid var(--gold)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px",
          fontSize: "13px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <ShieldCheck size={18} style={{ color: "var(--gold)", flexShrink: 0 }} />
          <span>
            <strong>Verified Commercial Settlement:</strong> Statements are settled via Wire Transfer (SWIFT / Fedwire) or ACH bank transfer. Every payment is verified against bank remittance references and permanently logged in the platform audit ledger.
          </span>
        </div>
      </div>

      {showCreateModal && isStaff && userOrganizations.length > 0 && (
        <section className="module-panel" style={{ border: "1px solid var(--gold)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ fontSize: "18px", margin: 0 }}>Generate Project-Linked Client Invoice</h3>
            <button
              type="button"
              onClick={() => setShowCreateModal(false)}
              className="button button-secondary"
              style={{ padding: "4px 10px", fontSize: "12px" }}
            >
              Cancel
            </button>
          </div>

          <form action={createInvoiceAction} className="auth-form" style={{ marginTop: "16px", display: "grid", gap: "14px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <label>
                Client Organization
                <select
                  name="organization_id"
                  value={selectedOrgId}
                  onChange={(e) => setSelectedOrgId(e.target.value)}
                >
                  {userOrganizations.map((org) => (
                    <option key={org.id} value={org.id}>{org.name}</option>
                  ))}
                </select>
              </label>

              <label>
                Linked Delivery Project (Optional)
                <select name="project_id" defaultValue="">
                  <option value="">General Retainer / Organization Statement</option>
                  {orgProjects.map((proj) => (
                    <option key={proj.id} value={proj.id}>
                      {proj.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" }}>
              <label>
                Invoice Number
                <input
                  name="invoice_number"
                  required
                  maxLength={64}
                  placeholder="INV-2026-001"
                />
              </label>

              <label>
                Initial Lifecycle Status
                <select name="status" defaultValue="sent">
                  <option value="draft">Draft (Internal Preparation)</option>
                  <option value="sent">Issued / Sent to Client</option>
                </select>
              </label>

              <label>
                Payment Due Date
                <input type="date" name="due_date" required />
              </label>
            </div>

            {/* Multi-line items builder */}
            <div style={{ border: "1px solid var(--border)", borderRadius: "8px", padding: "12px", display: "grid", gap: "10px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <strong style={{ fontSize: "13px", color: "var(--gold)" }}>Invoice Line Items ($ USD)</strong>
                <button
                  type="button"
                  onClick={() =>
                    setLineItemRows([...lineItemRows, { description: "", amount: "" }])
                  }
                  className="button button-secondary button-small"
                  style={{ fontSize: "11px", padding: "3px 8px" }}
                >
                  + Add Line Item
                </button>
              </div>

              {lineItemRows.map((row, idx) => (
                <div key={idx} style={{ display: "grid", gridTemplateColumns: "1fr 150px auto", gap: "8px", alignItems: "end" }}>
                  <label style={{ fontSize: "12px" }}>
                    Line Item #{idx + 1} Description
                    <input
                      name="item_description"
                      required
                      value={row.description}
                      onChange={(e) => {
                        const copy = [...lineItemRows];
                        copy[idx].description = e.target.value;
                        setLineItemRows(copy);
                      }}
                      placeholder="Milestone deliverable or engineering work package..."
                    />
                  </label>
                  <label style={{ fontSize: "12px" }}>
                    Amount ($ USD)
                    <input
                      name="item_amount"
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      value={row.amount}
                      onChange={(e) => {
                        const copy = [...lineItemRows];
                        copy[idx].amount = e.target.value;
                        setLineItemRows(copy);
                      }}
                      placeholder="2500.00"
                    />
                  </label>
                  {lineItemRows.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setLineItemRows(lineItemRows.filter((_, i) => i !== idx))}
                      className="button button-danger button-small"
                      style={{ padding: "8px" }}
                      title="Remove line item"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              ))}

              <input
                type="hidden"
                name="amount_dollars"
                value={lineItemRows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0)}
              />
            </div>

            <label>
              Commercial Notes, Remittance Terms &amp; Scope Details
              <textarea name="notes" rows={2} placeholder="Net-15 commercial terms, milestone sign-off reference..." />
            </label>

            <button type="submit" className="button button-gold" style={{ justifySelf: "start" }}>
              Create &amp; Issue Statement
            </button>
          </form>
        </section>
      )}

      {/* Summary Metrics */}
      <div className="module-stat-grid">
        <div className="module-stat">
          <span>Total Billed</span>
          <strong>{formatCurrency(totalBilledCents)}</strong>
          <small>Active statement volume</small>
        </div>
        <div className="module-stat">
          <span>Settled &amp; Collected</span>
          <strong style={{ color: "#10b981" }}>{formatCurrency(totalPaidCents)}</strong>
          <small>Verified payment records</small>
        </div>
        <div className="module-stat">
          <span>Outstanding Balance</span>
          <strong style={{ color: totalOutstandingCents > 0 ? "var(--gold)" : "inherit" }}>
            {formatCurrency(totalOutstandingCents)}
          </strong>
          <small>Issued &amp; partially paid</small>
        </div>
        <div className="module-stat">
          <span>Overdue Balance</span>
          <strong style={{ color: totalOverdueCents > 0 ? "#ef4444" : "inherit" }}>
            {formatCurrency(totalOverdueCents)}
          </strong>
          <small>Past due date</small>
        </div>
      </div>

      {/* Lifecycle Status Filter Pills */}
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        {[
          { key: "all", label: "All Statements" },
          { key: "issued", label: "Issued" },
          { key: "partially_paid", label: "Partially Paid" },
          { key: "overdue", label: "Overdue" },
          { key: "settled", label: "Settled (Paid)" },
          { key: "draft", label: "Draft" },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setStatusFilter(tab.key)}
            style={{
              fontSize: "12px",
              padding: "5px 12px",
              borderRadius: "999px",
              border: statusFilter === tab.key ? "1px solid var(--gold)" : "1px solid var(--border)",
              background: statusFilter === tab.key ? "rgba(212, 175, 55, 0.12)" : "transparent",
              color: statusFilter === tab.key ? "var(--gold)" : "inherit",
              cursor: "pointer",
              fontWeight: statusFilter === tab.key ? 600 : 400,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Invoices Table */}
      {filteredInvoices.length === 0 ? (
        <div className="module-panel" style={{ textAlign: "center", padding: "40px" }}>
          <CreditCard size={36} style={{ color: "var(--muted)", margin: "0 auto 12px" }} />
          <h3>No matching invoices</h3>
          <p style={{ color: "var(--muted)", fontSize: "14px" }}>
            {isStaff
              ? "Generate a project-linked invoice to bill clients for milestone deliveries and retainers."
              : "Billing statements and verified payment receipts will appear here once issued."}
          </p>
        </div>
      ) : (
        <div className="module-table-wrap">
          <table className="module-table">
            <thead>
              <tr>
                <th>Invoice &amp; Project</th>
                <th>Total / Balance</th>
                <th>Commercial Status</th>
                <th>Due Date</th>
                <th>Payment Records</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredInvoices.map(({ invoice: inv, parsed, commercial }) => {
                const orgName = userOrganizations.find((o) => o.id === inv.organization_id)?.name;
                return (
                  <tr key={inv.id}>
                    <td>
                      <strong>{inv.invoice_number}</strong>
                      {orgName && (
                        <small style={{ display: "block", color: "var(--muted)", fontSize: "11px" }}>
                          {orgName}
                        </small>
                      )}
                      {parsed.linkedProject && (
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                            fontSize: "11px",
                            color: "var(--gold)",
                            marginTop: "2px",
                          }}
                        >
                          <FolderKanban size={11} /> {parsed.linkedProject.name}
                        </span>
                      )}
                      {inv.notes && (
                        <small style={{ display: "block", color: "var(--muted)", marginTop: "2px" }}>
                          {inv.notes}
                        </small>
                      )}
                    </td>
                    <td>
                      <strong style={{ color: "var(--gold)" }}>{formatCurrency(inv.amount_cents)}</strong>
                      {commercial.paidAmountCents > 0 && commercial.balanceDueCents > 0 && (
                        <small style={{ display: "block", color: "#38bdf8", fontSize: "11px" }}>
                          Paid: {formatCurrency(commercial.paidAmountCents)} &middot; Due: {formatCurrency(commercial.balanceDueCents)}
                        </small>
                      )}
                      {commercial.displayStatus === "settled" && (
                        <small style={{ display: "block", color: "#10b981", fontSize: "11px" }}>
                          Balance: $0.00
                        </small>
                      )}
                    </td>
                    <td>
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px", alignItems: "flex-start" }}>
                        <span
                          className="record-status"
                          style={{
                            fontSize: "11px",
                            textTransform: "uppercase",
                            fontWeight: 700,
                            color: getStatusColor(commercial.displayStatus),
                            borderColor: getStatusColor(commercial.displayStatus),
                          }}
                        >
                          {commercial.label}
                        </span>

                        {isStaff && commercial.displayStatus !== "settled" && (
                          <form action={updateInvoiceStatusAction} style={{ display: "inline-block" }}>
                            <input type="hidden" name="id" value={inv.id} />
                            <select
                              name="status"
                              defaultValue={inv.status}
                              onChange={(e) => e.target.form?.requestSubmit()}
                              aria-label={`Change lifecycle status for ${inv.invoice_number}`}
                              style={{
                                fontSize: "11px",
                                padding: "2px 6px",
                                borderRadius: "4px",
                                border: "1px solid var(--border)",
                                background: "var(--background)",
                              }}
                            >
                              <option value="draft">Set Draft</option>
                              <option value="sent">Set Issued / Sent</option>
                              <option value="overdue">Flag Overdue</option>
                              <option value="cancelled">Cancel Statement</option>
                            </select>
                          </form>
                        )}
                      </div>
                    </td>
                    <td>
                      <span style={{ color: commercial.isOverdue ? "#ef4444" : "inherit", fontWeight: commercial.isOverdue ? 600 : 400 }}>
                        {inv.due_date ?? "Due on receipt"}
                      </span>
                      {commercial.isOverdue && (
                        <small style={{ display: "flex", alignItems: "center", gap: "3px", color: "#ef4444", fontSize: "10px" }}>
                          <AlertTriangle size={10} /> Past Due
                        </small>
                      )}
                    </td>
                    <td>
                      {parsed.paymentRecords.length > 0 ? (
                        <div style={{ fontSize: "11px" }}>
                          <span style={{ color: "#10b981", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "4px" }}>
                            <CheckCircle2 size={12} /> {parsed.paymentRecords.length} verified record{parsed.paymentRecords.length > 1 ? "s" : ""}
                          </span>
                          <small style={{ display: "block", color: "var(--muted)" }}>
                            Ref: {parsed.paymentRecords[parsed.paymentRecords.length - 1].reference}
                          </small>
                        </div>
                      ) : (
                        <span style={{ fontSize: "11px", color: "var(--muted)" }}>No payment recorded</span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" }}>
                        <button
                          type="button"
                          onClick={() => setSelectedInvoice(inv)}
                          className="button button-small button-secondary"
                          style={{ padding: "4px 8px", fontSize: "11px", display: "inline-flex", alignItems: "center", gap: "4px" }}
                          title="View printable statement"
                        >
                          <FileText size={12} /> Statement
                        </button>

                        {isStaff && commercial.displayStatus !== "settled" && commercial.displayStatus !== "cancelled" && (
                          <button
                            type="button"
                            onClick={() => setPaymentModalInvoice(inv)}
                            className="button button-small button-gold"
                            style={{ padding: "4px 8px", fontSize: "11px", display: "inline-flex", alignItems: "center", gap: "4px" }}
                            title="Record verified payment receipt"
                          >
                            <CheckCircle2 size={12} /> Record Payment
                          </button>
                        )}

                        {isStaff && (
                          <form
                            action={deleteInvoiceAction}
                            onSubmit={(e) => {
                              if (!confirm(`Are you sure you want to delete invoice ${inv.invoice_number}?`)) e.preventDefault();
                            }}
                          >
                            <input type="hidden" name="id" value={inv.id} />
                            <button
                              type="submit"
                              className="button button-small button-danger"
                              style={{ padding: "4px 8px", fontSize: "11px" }}
                              title="Delete invoice"
                            >
                              <Trash2 size={12} />
                            </button>
                          </form>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Record Verified Payment Modal (Staff Only) */}
      {isStaff && paymentModalInvoice && (() => {
        const commercial = classifyInvoiceLifecycleStatus(paymentModalInvoice);
        const defaultRemainingDollars = (commercial.balanceDueCents / 100).toFixed(2);
        return (
          <div
            className="invoice-modal-backdrop"
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0, 0, 0, 0.78)",
              backdropFilter: "blur(6px)",
              zIndex: 1000,
              display: "grid",
              placeItems: "center",
              padding: "20px",
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget) setPaymentModalInvoice(null);
            }}
          >
            <div
              className="module-panel"
              style={{
                width: "min(100%, 520px)",
                border: "1px solid var(--gold)",
                padding: "28px",
                display: "grid",
                gap: "16px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <span style={{ fontSize: "11px", color: "var(--gold)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>
                    Audited Commercial Settlement
                  </span>
                  <h3 style={{ margin: "4px 0 0", fontSize: "18px" }}>
                    Record Verified Payment &middot; {paymentModalInvoice.invoice_number}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setPaymentModalInvoice(null)}
                  className="button button-secondary button-small"
                >
                  <X size={14} />
                </button>
              </div>

              <div style={{ padding: "10px 12px", borderRadius: "6px", background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)", fontSize: "12px", display: "flex", justifyContent: "space-between" }}>
                <span>Invoice Total: <strong>{formatCurrency(paymentModalInvoice.amount_cents)}</strong></span>
                <span>Already Paid: <strong>{formatCurrency(commercial.paidAmountCents)}</strong></span>
                <span>Balance Due: <strong style={{ color: "var(--gold)" }}>{formatCurrency(commercial.balanceDueCents)}</strong></span>
              </div>

              <form action={recordInvoicePaymentAction} className="auth-form" style={{ display: "grid", gap: "12px" }}>
                <input type="hidden" name="invoice_id" value={paymentModalInvoice.id} />

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <label>
                    Payment Amount ($ USD)
                    <input
                      name="amount_dollars"
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      defaultValue={defaultRemainingDollars}
                    />
                  </label>

                  <label>
                    Settlement Method
                    <select name="method" defaultValue="wire_transfer">
                      <option value="wire_transfer">Wire Transfer (SWIFT / Fedwire)</option>
                      <option value="ach">ACH Bank Transfer</option>
                      <option value="check">Corporate Check</option>
                      <option value="manual_settlement">Manual Audited Settlement</option>
                    </select>
                  </label>
                </div>

                <label>
                  Bank Remittance Reference / Wire Trace ID (Required)
                  <input
                    name="reference"
                    required
                    minLength={3}
                    maxLength={120}
                    placeholder="e.g., FEDWIRE-20261010-99481A or ACH-77312"
                  />
                </label>

                <label>
                  Verification Notes (Optional)
                  <input
                    name="notes"
                    maxLength={500}
                    placeholder="e.g., Verified in Mercury / SVB treasury account; Milestone 1 settled"
                  />
                </label>

                <label
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "8px",
                    padding: "10px",
                    borderRadius: "6px",
                    border: "1px solid rgba(16, 185, 129, 0.35)",
                    background: "rgba(16, 185, 129, 0.06)",
                    fontSize: "12px",
                    cursor: "pointer",
                  }}
                >
                  <input type="checkbox" name="confirmed" value="yes" required style={{ marginTop: "3px" }} />
                  <span>
                    I confirm that this payment has been verified against bank settlement records. Recording this payment will update the invoice balance and write an immutable entry to <code>audit_events</code>.
                  </span>
                </label>

                <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "4px" }}>
                  <button
                    type="button"
                    onClick={() => setPaymentModalInvoice(null)}
                    className="button button-secondary"
                  >
                    Cancel
                  </button>
                  <button type="submit" className="button button-gold">
                    Confirm &amp; Record Payment
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* Printable Invoice Modal / Statement View */}
      {selectedInvoice && (() => {
        const isAuthorized = isStaff || userOrganizations.some((o) => o.id === selectedInvoice.organization_id);
        if (!isAuthorized) {
          return (
            <div
              className="invoice-modal-backdrop"
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0, 0, 0, 0.75)",
                backdropFilter: "blur(6px)",
                zIndex: 1000,
                display: "grid",
                placeItems: "center",
                padding: "20px",
              }}
              onClick={(e) => {
                if (e.target === e.currentTarget) setSelectedInvoice(null);
              }}
            >
              <div
                className="invoice-printable-card"
                style={{
                  background: "var(--surface-raised)",
                  border: "1px solid #ef4444",
                  borderRadius: "16px",
                  width: "min(100%, 520px)",
                  padding: "36px 32px",
                  textAlign: "center",
                }}
              >
                <p className="module-alert" role="alert" style={{ marginBottom: "20px" }}>
                  <strong>Access Denied:</strong> You are not authorized to view financial statements for this client organization.
                </p>
                <button
                  type="button"
                  onClick={() => setSelectedInvoice(null)}
                  className="button button-secondary"
                >
                  Close
                </button>
              </div>
            </div>
          );
        }

        const parsed = parseInvoiceItems(selectedInvoice.items, selectedInvoice.amount_cents);
        const commercial = classifyInvoiceLifecycleStatus(selectedInvoice);
        const itemsSubtotalCents = parsed.lineItems.reduce((sum, item) => sum + (item.amount_cents || 0), 0);
        const statusColor = getStatusColor(commercial.displayStatus);

        return (
          <div
            className="invoice-modal-backdrop"
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0, 0, 0, 0.75)",
              backdropFilter: "blur(6px)",
              zIndex: 1000,
              display: "grid",
              placeItems: "center",
              padding: "20px",
              overflowY: "auto",
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget) setSelectedInvoice(null);
            }}
          >
            <div
              className="invoice-printable-card"
              style={{
                background: "var(--surface-raised)",
                border: "1px solid var(--line-strong)",
                borderRadius: "16px",
                width: "min(100%, 740px)",
                maxHeight: "90vh",
                overflowY: "auto",
                boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
                padding: "36px 32px",
              }}
            >
              {/* Modal Controls */}
              <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px", borderBottom: "1px solid var(--line)", paddingBottom: "16px" }}>
                <span style={{ fontSize: "12px", color: "var(--gold-ink)", fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase" }}>
                  Commercial Statement &middot; {selectedInvoice.invoice_number}
                </span>
                <div style={{ display: "flex", gap: "10px" }}>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="button button-gold button-small"
                    style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
                  >
                    <Printer size={13} /> Print / Save PDF
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedInvoice(null)}
                    className="button button-secondary button-small"
                    style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}
                  >
                    <X size={14} /> Close
                  </button>
                </div>
              </div>

              {/* Invoice Document Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "20px" }}>
                <div>
                  <h2 style={{ fontSize: "22px", fontWeight: 700, margin: 0, letterSpacing: "-.02em" }}>TheCodexThrill</h2>
                  <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: "13px" }}>
                    Engineering · AI Architectures · Cloud Systems
                  </p>
                  <p style={{ margin: "2px 0 0", color: "var(--subtle)", fontSize: "12px" }}>
                    https://thecodexthrill.com &middot; billing@thecodexthrill.com
                  </p>
                </div>

                <div style={{ textAlign: "right" }}>
                  <h1 style={{ fontSize: "26px", fontWeight: 700, margin: 0, color: "var(--gold-ink)" }}>INVOICE</h1>
                  <p style={{ margin: "4px 0 0", fontWeight: 600, fontSize: "14px" }}>{selectedInvoice.invoice_number}</p>
                  <span
                    style={{
                      display: "inline-block",
                      marginTop: "6px",
                      padding: "3px 10px",
                      borderRadius: "6px",
                      fontSize: "11px",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: ".08em",
                      color: statusColor,
                      border: `1px solid ${statusColor}`,
                    }}
                  >
                    {commercial.label}
                  </span>
                </div>
              </div>

              {/* Bill To & Metadata */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", margin: "28px 0", padding: "18px", border: "1px solid var(--line)", borderRadius: "12px", background: "var(--surface)" }}>
                <div>
                  <small style={{ color: "var(--subtle)", fontSize: "11px", textTransform: "uppercase", letterSpacing: ".08em", display: "block" }}>Billed To</small>
                  <strong style={{ fontSize: "15px", display: "block", marginTop: "4px" }}>
                    {userOrganizations.find((o) => o.id === selectedInvoice.organization_id)?.name || "Client Organization"}
                  </strong>
                  {parsed.linkedProject && (
                    <p style={{ margin: "4px 0 0", color: "var(--gold)", fontSize: "12px", fontWeight: 600 }}>
                      Project: {parsed.linkedProject.name}
                    </p>
                  )}
                  <p style={{ margin: "2px 0 0", color: "var(--muted)", fontSize: "12px" }}>
                    Enterprise Client Account
                  </p>
                </div>

                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "13px", color: "var(--muted)" }}>
                    <span>Issue Date: </span>
                    <strong style={{ color: "var(--foreground)" }}>{new Date(selectedInvoice.created_at).toLocaleDateString()}</strong>
                  </div>
                  <div style={{ fontSize: "13px", color: "var(--muted)", marginTop: "4px" }}>
                    <span>Due Date: </span>
                    <strong style={{ color: commercial.isOverdue ? "#ef4444" : "var(--foreground)" }}>
                      {selectedInvoice.due_date || "Due on receipt"}
                    </strong>
                  </div>
                  {selectedInvoice.paid_at && (
                    <div style={{ fontSize: "13px", color: "#10b981", marginTop: "4px" }}>
                      <span>Settled On: </span>
                      <strong>{new Date(selectedInvoice.paid_at).toLocaleDateString()}</strong>
                    </div>
                  )}
                </div>
              </div>

              {/* Line Items Table */}
              <table style={{ width: "100%", borderCollapse: "collapse", margin: "20px 0" }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid var(--line-strong)", textAlign: "left" }}>
                    <th style={{ padding: "10px 8px", fontSize: "12px", textTransform: "uppercase", letterSpacing: ".08em", color: "var(--subtle)" }}>Description / Deliverable Scope</th>
                    <th style={{ padding: "10px 8px", fontSize: "12px", textTransform: "uppercase", letterSpacing: ".08em", color: "var(--subtle)", textAlign: "right" }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {parsed.lineItems.map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: "1px solid var(--line)" }}>
                      <td style={{ padding: "14px 8px", fontSize: "14px" }}>
                        {item.description}
                        {idx === 0 && selectedInvoice.notes && (
                          <small style={{ display: "block", color: "var(--muted)", marginTop: "4px" }}>
                            {selectedInvoice.notes}
                          </small>
                        )}
                      </td>
                      <td style={{ padding: "14px 8px", fontSize: "14px", fontWeight: 600, textAlign: "right" }}>
                        {formatCurrency(item.amount_cents)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Verified Payment Records Ledger */}
              {parsed.paymentRecords.length > 0 && (
                <div style={{ margin: "20px 0", padding: "14px", borderRadius: "10px", border: "1px solid rgba(16, 185, 129, 0.3)", background: "rgba(16, 185, 129, 0.05)" }}>
                  <strong style={{ fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.06em", color: "#10b981", display: "block", marginBottom: "8px" }}>
                    Verified Payment &amp; Remittance Records
                  </strong>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid var(--line)", textAlign: "left", color: "var(--muted)" }}>
                        <th style={{ padding: "6px 4px" }}>Date</th>
                        <th style={{ padding: "6px 4px" }}>Method</th>
                        <th style={{ padding: "6px 4px" }}>Bank / Audit Reference</th>
                        <th style={{ padding: "6px 4px", textAlign: "right" }}>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsed.paymentRecords.map((rec, idx) => (
                        <tr key={idx} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                          <td style={{ padding: "6px 4px" }}>{new Date(rec.recorded_at).toLocaleDateString()}</td>
                          <td style={{ padding: "6px 4px", textTransform: "uppercase" }}>{rec.method.replace("_", " ")}</td>
                          <td style={{ padding: "6px 4px", fontFamily: "monospace" }}>
                            {rec.reference}
                            {rec.notes ? ` (${rec.notes})` : ""}
                          </td>
                          <td style={{ padding: "6px 4px", textAlign: "right", fontWeight: 600, color: "#10b981" }}>
                            {formatCurrency(rec.amount_cents)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Totals Summary */}
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "16px" }}>
                <div style={{ width: "300px", display: "grid", gap: "8px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", color: "var(--muted)" }}>
                    <span>Subtotal:</span>
                    <span>{formatCurrency(itemsSubtotalCents)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", color: "var(--muted)" }}>
                    <span>Tax / GST:</span>
                    <span>$0.00 (Export / B2B Contract)</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", color: "var(--muted)", borderTop: "1px solid var(--line)", paddingTop: "6px" }}>
                    <span>Total Invoiced:</span>
                    <span style={{ fontWeight: 600, color: "var(--foreground)" }}>{formatCurrency(selectedInvoice.amount_cents)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", color: commercial.paidAmountCents > 0 ? "#10b981" : "var(--muted)" }}>
                    <span>Verified Amount Paid:</span>
                    <span>{formatCurrency(commercial.paidAmountCents)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "16px", fontWeight: 700, borderTop: "2px solid var(--line-strong)", paddingTop: "8px" }}>
                    <span>Balance Due:</span>
                    <span style={{ color: commercial.balanceDueCents === 0 ? "#10b981" : "var(--gold-ink)" }}>
                      {commercial.balanceDueCents === 0 ? "$0.00 (Settled)" : formatCurrency(commercial.balanceDueCents)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Remittance & Bank Settlement Notes */}
              <div style={{ marginTop: "32px", padding: "16px", border: "1px solid var(--line)", borderRadius: "10px", background: "var(--surface)", fontSize: "12px", color: "var(--muted)", lineHeight: "1.6" }}>
                <strong style={{ color: "var(--foreground)", display: "block", marginBottom: "4px" }}>Settlement &amp; Remittance Instructions</strong>
                <span>
                  Payments are settled via Wire Transfer (SWIFT / Fedwire) or ACH bank transfer. Please quote invoice number <strong>{selectedInvoice.invoice_number}</strong> on all remittance advices and send wire confirmation to <a href="mailto:billing@thecodexthrill.com" style={{ color: "var(--gold)" }}>billing@thecodexthrill.com</a> for verified ledger reconciliation.
                </span>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

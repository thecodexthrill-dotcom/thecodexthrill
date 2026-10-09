"use client";

import { useState } from "react";
import { CreditCard, Plus, Trash2, FileText, Printer, X } from "lucide-react";
import Link from "next/link";
import {
  createInvoiceAction,
  updateInvoiceStatusAction,
  deleteInvoiceAction,
} from "@/lib/supabase/operations-actions";

export type InvoiceRecord = {
  id: string;
  organization_id: string;
  invoice_number: string;
  amount_cents: number;
  currency: string;
  status: "draft" | "sent" | "paid" | "overdue" | "cancelled";
  due_date: string | null;
  paid_at: string | null;
  items: Array<{ description: string; amount_cents: number }>;
  notes: string | null;
  created_at: string;
};

type BillingManagerProps = {
  invoices: InvoiceRecord[];
  isStaff: boolean;
  userOrganizations?: { id: string; name: string }[];
  notice?: string;
};

export function BillingManager({
  invoices,
  isStaff,
  userOrganizations = [],
  notice,
}: BillingManagerProps) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceRecord | null>(null);

  const totalBilledCents = invoices.reduce((sum, inv) => sum + (inv.status !== "cancelled" ? inv.amount_cents : 0), 0);
  const totalPaidCents = invoices.filter((i) => i.status === "paid").reduce((sum, inv) => sum + inv.amount_cents, 0);
  const totalOutstandingCents = invoices.filter((i) => i.status === "sent" || i.status === "overdue").reduce((sum, inv) => sum + inv.amount_cents, 0);

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
  };

  return (
    <div className="workspace-content" style={{ display: "grid", gap: "24px" }}>
      {notice && (
        <p className={notice === "invalid" || notice === "save" ? "module-alert" : "module-success"} role="status">
          {notice === "created" ? "Invoice generated successfully." : notice === "updated" ? "Invoice status updated." : notice === "deleted" ? "Invoice deleted." : notice}
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
          <h2 style={{ fontSize: "20px", fontWeight: 700, margin: 0 }}>Billing &amp; Invoices</h2>
          <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: "14px" }}>
            Contract statements, engineering milestones, and commercial payment history.
          </p>
        </div>

        {isStaff && userOrganizations.length > 0 && (
          <button
            type="button"
            onClick={() => setShowCreateModal(!showCreateModal)}
            className="button button-gold"
            style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}
          >
            <Plus size={16} /> Generate Invoice
          </button>
        )}
      </div>

      {showCreateModal && isStaff && userOrganizations.length > 0 && (
        <section className="module-panel" style={{ border: "1px solid var(--gold)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ fontSize: "18px", margin: 0 }}>Generate Client Invoice</h3>
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
            <label>
              Client Organization
              <select name="organization_id" defaultValue={userOrganizations[0]?.id}>
                {userOrganizations.map((org) => (
                  <option key={org.id} value={org.id}>{org.name}</option>
                ))}
              </select>
            </label>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
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
                Amount ($ USD)
                <input
                  name="amount_dollars"
                  type="number"
                  step="0.01"
                  required
                  min="0"
                  placeholder="5000.00"
                />
              </label>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <label>
                Status
                <select name="status" defaultValue="draft">
                  <option value="draft">Draft</option>
                  <option value="sent">Sent</option>
                  <option value="paid">Paid</option>
                  <option value="overdue">Overdue</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </label>

              <label>
                Due Date
                <input type="date" name="due_date" />
              </label>
            </div>

            <label>
              Invoice Notes &amp; Scope Details
              <textarea name="notes" rows={3} placeholder="Phase 1 Deliverables completion..." />
            </label>

            <button type="submit" className="button button-gold" style={{ justifySelf: "start" }}>
              Issue Invoice
            </button>
          </form>
        </section>
      )}

      {/* Summary Metrics */}
      <div className="module-stat-grid">
        <div className="module-stat">
          <span>Total Billed</span>
          <strong>{formatCurrency(totalBilledCents)}</strong>
          <small>Statement lifetime</small>
        </div>
        <div className="module-stat">
          <span>Collected</span>
          <strong style={{ color: "var(--gold)" }}>{formatCurrency(totalPaidCents)}</strong>
          <small>Settled accounts</small>
        </div>
        <div className="module-stat">
          <span>Outstanding</span>
          <strong style={{ color: totalOutstandingCents > 0 ? "#f59e0b" : "inherit" }}>
            {formatCurrency(totalOutstandingCents)}
          </strong>
          <small>Pending settlement</small>
        </div>
      </div>

      {/* Invoices Table */}
      {invoices.length === 0 ? (
        <div className="module-panel" style={{ textAlign: "center", padding: "40px" }}>
          <CreditCard size={36} style={{ color: "var(--muted)", margin: "0 auto 12px" }} />
          <h3>No invoices recorded</h3>
          <p style={{ color: "var(--muted)", fontSize: "14px" }}>
            {isStaff
              ? "Generate an invoice to bill clients for milestone deliveries and engineering retainers."
              : "Billing statements and payment confirmations will be listed here once issued."}
          </p>
        </div>
      ) : (
        <div className="module-table-wrap">
          <table className="module-table">
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Due Date</th>
                <th>Issue Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id}>
                  <td>
                    <strong>{inv.invoice_number}</strong>
                    {inv.notes && <small style={{ display: "block", color: "var(--muted)" }}>{inv.notes}</small>}
                  </td>
                  <td>
                    <strong style={{ color: "var(--gold)" }}>{formatCurrency(inv.amount_cents)}</strong>
                  </td>
                  <td>
                    {isStaff ? (
                      <form action={updateInvoiceStatusAction} style={{ display: "inline-block" }}>
                        <input type="hidden" name="id" value={inv.id} />
                        <select
                          name="status"
                          defaultValue={inv.status}
                          onChange={(e) => e.target.form?.requestSubmit()}
                          style={{
                            fontSize: "11px",
                            padding: "3px 6px",
                            borderRadius: "4px",
                            border: "1px solid var(--border)",
                            background: "var(--background)",
                            color: inv.status === "paid" ? "#10b981" : inv.status === "overdue" ? "#ef4444" : "inherit",
                          }}
                        >
                          <option value="draft">Draft</option>
                          <option value="sent">Sent</option>
                          <option value="paid">Paid</option>
                          <option value="overdue">Overdue</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                      </form>
                    ) : (
                      <span
                        className="record-status"
                        style={{
                          fontSize: "11px",
                          textTransform: "uppercase",
                          color: inv.status === "paid" ? "#10b981" : inv.status === "overdue" ? "#ef4444" : "inherit",
                        }}
                      >
                        {inv.status}
                      </span>
                    )}
                  </td>
                  <td>{inv.due_date ?? "Due on receipt"}</td>
                  <td>{new Date(inv.created_at).toLocaleDateString()}</td>
                  <td>
                    <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                      <button
                        type="button"
                        onClick={() => setSelectedInvoice(inv)}
                        className="button button-small button-secondary"
                        style={{ padding: "4px 8px", fontSize: "11px", display: "inline-flex", alignItems: "center", gap: "4px" }}
                        title="View printable statement"
                      >
                        <FileText size={12} /> Statement / PDF
                      </button>

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
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Printable Invoice Modal / Statement View */}
      {selectedInvoice && (
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
              width: "min(100%, 720px)",
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
                    background: selectedInvoice.status === "paid" ? "color-mix(in srgb, #10b981 20%, transparent)" : selectedInvoice.status === "overdue" ? "color-mix(in srgb, #ef4444 20%, transparent)" : "color-mix(in srgb, var(--gold) 20%, transparent)",
                    color: selectedInvoice.status === "paid" ? "#10b981" : selectedInvoice.status === "overdue" ? "#ef4444" : "var(--gold-ink)",
                    border: `1px solid ${selectedInvoice.status === "paid" ? "#10b981" : selectedInvoice.status === "overdue" ? "#ef4444" : "var(--gold)"}`,
                  }}
                >
                  Status: {selectedInvoice.status}
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
                  <strong style={{ color: "var(--foreground)" }}>{selectedInvoice.due_date || "Due on receipt"}</strong>
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
                  <th style={{ padding: "10px 8px", fontSize: "12px", textTransform: "uppercase", letterSpacing: ".08em", color: "var(--subtle)" }}>Description / Scope</th>
                  <th style={{ padding: "10px 8px", fontSize: "12px", textTransform: "uppercase", letterSpacing: ".08em", color: "var(--subtle)", textAlign: "right" }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {selectedInvoice.items && selectedInvoice.items.length > 0 ? (
                  selectedInvoice.items.map((item: { description: string; amount_cents: number }, idx: number) => (
                    <tr key={idx} style={{ borderBottom: "1px solid var(--line)" }}>
                      <td style={{ padding: "14px 8px", fontSize: "14px" }}>{item.description}</td>
                      <td style={{ padding: "14px 8px", fontSize: "14px", fontWeight: 600, textAlign: "right" }}>
                        {formatCurrency(item.amount_cents)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr style={{ borderBottom: "1px solid var(--line)" }}>
                    <td style={{ padding: "14px 8px", fontSize: "14px" }}>
                      Professional Software Engineering &amp; Platform Delivery Services
                      {selectedInvoice.notes && <small style={{ display: "block", color: "var(--muted)", marginTop: "4px" }}>{selectedInvoice.notes}</small>}
                    </td>
                    <td style={{ padding: "14px 8px", fontSize: "14px", fontWeight: 600, textAlign: "right" }}>
                      {formatCurrency(selectedInvoice.amount_cents)}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* Totals Summary */}
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "16px" }}>
              <div style={{ width: "260px", display: "grid", gap: "8px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", color: "var(--muted)" }}>
                  <span>Subtotal:</span>
                  <span>{formatCurrency(selectedInvoice.amount_cents)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", color: "var(--muted)" }}>
                  <span>Tax / GST:</span>
                  <span>0.00 (Export Reverse Charge)</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "16px", fontWeight: 700, borderTop: "2px solid var(--line-strong)", paddingTop: "8px" }}>
                  <span>Total Due:</span>
                  <span style={{ color: "var(--gold-ink)" }}>{formatCurrency(selectedInvoice.amount_cents)}</span>
                </div>
              </div>
            </div>

            {/* Remittance & Bank Settlement Notes */}
            <div style={{ marginTop: "32px", padding: "16px", border: "1px solid var(--line)", borderRadius: "10px", background: "var(--surface)", fontSize: "12px", color: "var(--muted)", lineHeight: "1.6" }}>
              <strong style={{ color: "var(--foreground)", display: "block", marginBottom: "4px" }}>Settlement &amp; Remittance Information</strong>
              <span>Payment is settled via Wire Transfer (SWIFT / ACH) or verified enterprise gateway. Please quote invoice reference <strong>{selectedInvoice.invoice_number}</strong> on all transfer slips. For questions, contact <a href="mailto:billing@thecodexthrill.com" style={{ color: "var(--gold)" }}>billing@thecodexthrill.com</a>.</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

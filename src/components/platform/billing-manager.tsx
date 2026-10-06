"use client";

import { useState } from "react";
import { CreditCard, Plus, Trash2 } from "lucide-react";
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
                {isStaff && <th>Actions</th>}
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
                  {isStaff && (
                    <td>
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
                          style={{ padding: "4px 8px", fontSize: "12px" }}
                          title="Delete invoice"
                        >
                          <Trash2 size={12} />
                        </button>
                      </form>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

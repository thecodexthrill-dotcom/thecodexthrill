"use client";

import { useState } from "react";
import { MessageSquare, Plus, CheckCircle, Trash2 } from "lucide-react";
import {
  createSupportTicketAction,
  addTicketMessageAction,
  updateTicketStatusAction,
  deleteTicketAction,
} from "@/lib/supabase/operations-actions";

export type SupportTicketRecord = {
  id: string;
  ticket_number: string;
  organization_id: string | null;
  customer_id: string;
  title: string;
  category: "technical" | "billing" | "feature_request" | "general";
  priority: "low" | "medium" | "high" | "urgent";
  status: "new" | "in_progress" | "waiting_on_client" | "resolved" | "closed";
  assigned_to: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
  messages?: SupportMessageRecord[];
};

export type SupportMessageRecord = {
  id: string;
  ticket_id: string;
  sender_id: string;
  is_staff: boolean;
  message: string;
  created_at: string;
};

type SupportManagerProps = {
  tickets: SupportTicketRecord[];
  isStaff: boolean;
  userOrganizations?: { id: string; name: string }[];
  notice?: string;
  queryError?: string;
};

export function SupportManager({ tickets, isStaff, userOrganizations = [], notice, queryError }: SupportManagerProps) {
  const [activeTicketId, setActiveTicketId] = useState<string | null>(tickets[0]?.id ?? null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filteredTickets = tickets.filter((t) => {
    if (statusFilter === "all") return true;
    return t.status === statusFilter;
  });

  const activeTicket = tickets.find((t) => t.id === activeTicketId);

  return (
    <div className="workspace-content" style={{ display: "grid", gap: "24px" }}>
      {queryError && (
        <div
          role="alert"
          style={{
            color: "#ef4444",
            background: "rgba(239, 68, 68, 0.1)",
            padding: "12px 16px",
            borderRadius: "6px",
            border: "1px solid rgba(239, 68, 68, 0.25)",
            fontSize: "14px",
          }}
        >
          <strong>Database Notice:</strong> Unable to load support tickets ({queryError}).
        </div>
      )}

      {notice && (
        <p className="module-success" role="status">
          {notice === "created"
            ? "Support ticket submitted successfully."
            : notice === "message_sent"
            ? "Response posted to ticket thread."
            : notice === "deleted"
            ? "Ticket deleted successfully."
            : "Ticket updated successfully."}
        </p>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <h2 style={{ fontSize: "20px", fontWeight: 700, margin: 0 }}>
            {isStaff ? "Support Operations & Queue" : "Customer Support Desk"}
          </h2>
          <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: "14px" }}>
            {isStaff
              ? "Triage customer enquiries, reply to open threads, and manage issue resolution."
              : "Direct support from our engineering and technical team with guaranteed response times."}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowCreateModal(!showCreateModal)}
          className="button button-gold"
          style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}
        >
          <Plus size={16} /> New Support Ticket
        </button>
      </div>

      {showCreateModal && (
        <section className="module-panel" style={{ border: "1px solid var(--gold)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ fontSize: "18px", margin: 0 }}>Open a New Support Ticket</h3>
            <button
              type="button"
              onClick={() => setShowCreateModal(false)}
              className="button button-secondary"
              style={{ padding: "4px 10px", fontSize: "12px" }}
            >
              Cancel
            </button>
          </div>

          <form action={createSupportTicketAction} className="auth-form" style={{ marginTop: "16px", display: "grid", gap: "14px" }}>
            <input type="hidden" name="return_path" value={isStaff ? "admin" : "portal"} />

            {isStaff ? (
              <label>
                Client Organization
                <select name="organization_id" defaultValue="">
                  <option value="">General Support (Internal / No Client Org)</option>
                  {userOrganizations.map((org) => (
                    <option key={org.id} value={org.id}>{org.name}</option>
                  ))}
                </select>
              </label>
            ) : userOrganizations.length > 0 ? (
              <label>
                Organization
                <select name="organization_id" defaultValue={userOrganizations[0]?.id}>
                  {userOrganizations.map((org) => (
                    <option key={org.id} value={org.id}>{org.name}</option>
                  ))}
                </select>
              </label>
            ) : null}

            <label>
              Subject / Title
              <input
                name="title"
                required
                maxLength={200}
                placeholder="e.g., API webhook validation failure in staging"
              />
            </label>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <label>
                Category
                <select name="category" defaultValue="technical">
                  <option value="technical">Technical / Code</option>
                  <option value="billing">Billing &amp; Invoices</option>
                  <option value="feature_request">Feature Request</option>
                  <option value="general">General Support</option>
                </select>
              </label>

              <label>
                Priority
                <select name="priority" defaultValue="medium">
                  <option value="low">Low (General guidance)</option>
                  <option value="medium">Medium (Standard issue)</option>
                  <option value="high">High (Production degraded)</option>
                  <option value="urgent">Urgent (System offline)</option>
                </select>
              </label>
            </div>

            <label>
              Issue Description &amp; Reproduction Steps
              <textarea
                name="message"
                required
                rows={5}
                placeholder="Provide detailed context, reproduction steps, or relevant URLs..."
              />
            </label>

            <button type="submit" className="button button-gold" style={{ justifySelf: "start" }}>
              Submit Ticket to Engineering
            </button>
          </form>
        </section>
      )}

      {/* Ticket List and Detail Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(300px, 1fr) 2fr", gap: "20px" }}>
        {/* Left Column: Ticket List */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {["all", "new", "in_progress", "waiting_on_client", "resolved"].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                style={{
                  fontSize: "12px",
                  padding: "4px 8px",
                  borderRadius: "4px",
                  border: statusFilter === st ? "1px solid var(--gold)" : "1px solid var(--border)",
                  background: statusFilter === st ? "rgba(212, 175, 55, 0.1)" : "transparent",
                  color: statusFilter === st ? "var(--gold)" : "inherit",
                  cursor: "pointer",
                }}
              >
                {st.replace(/_/g, " ").toUpperCase()}
              </button>
            ))}
          </div>

          {filteredTickets.length === 0 ? (
            <p className="module-empty" style={{ margin: 0 }}>No tickets match the filter.</p>
          ) : (
            <div style={{ display: "grid", gap: "10px" }}>
              {filteredTickets.map((t) => {
                const isSelected = t.id === activeTicketId;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setActiveTicketId(t.id)}
                    style={{
                      textAlign: "left",
                      padding: "12px",
                      borderRadius: "6px",
                      border: isSelected ? "1px solid var(--gold)" : "1px solid var(--border)",
                      background: isSelected ? "rgba(212, 175, 55, 0.05)" : "var(--panel-bg, #111)",
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      gap: "6px",
                      color: "inherit",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: "11px", fontFamily: "monospace", color: "var(--muted)" }}>
                        {t.ticket_number}
                      </span>
                      <span
                        className="record-status"
                        style={{
                          fontSize: "10px",
                          padding: "2px 6px",
                          textTransform: "uppercase",
                          color: t.priority === "urgent" ? "#ef4444" : t.priority === "high" ? "#f59e0b" : "inherit",
                        }}
                      >
                        {t.priority}
                      </span>
                    </div>

                    <strong style={{ fontSize: "14px", lineHeight: "1.3" }}>{t.title}</strong>

                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "var(--muted)" }}>
                      <span>Status: {t.status.replace(/_/g, " ")}</span>
                      <span>{new Date(t.created_at).toLocaleDateString()}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Ticket Conversation Thread */}
        <div>
          {activeTicket ? (
            <section className="module-panel" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
                <div>
                  <span style={{ fontSize: "12px", fontFamily: "monospace", color: "var(--gold)" }}>
                    {activeTicket.ticket_number} · {activeTicket.category.toUpperCase()}
                  </span>
                  <h3 style={{ fontSize: "20px", margin: "4px 0 6px" }}>{activeTicket.title}</h3>
                  <small style={{ color: "var(--muted)" }}>
                    Submitted {new Date(activeTicket.created_at).toLocaleString()}
                  </small>
                </div>

                {isStaff && (
                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <form action={updateTicketStatusAction} style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                      <input type="hidden" name="ticket_id" value={activeTicket.id} />
                      <select name="status" defaultValue={activeTicket.status} style={{ fontSize: "12px", padding: "4px 8px" }}>
                        <option value="new">New</option>
                        <option value="in_progress">In Progress</option>
                        <option value="waiting_on_client">Waiting on Client</option>
                        <option value="resolved">Resolved</option>
                        <option value="closed">Closed</option>
                      </select>

                      <select name="priority" defaultValue={activeTicket.priority} style={{ fontSize: "12px", padding: "4px 8px" }}>
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="urgent">Urgent</option>
                      </select>

                      <button type="submit" className="button button-secondary" style={{ padding: "4px 8px", fontSize: "12px" }}>
                        Update Status
                      </button>
                    </form>
                    <form
                      action={deleteTicketAction}
                      onSubmit={(e) => {
                        if (!confirm(`Are you sure you want to delete ticket ${activeTicket.ticket_number}?`)) e.preventDefault();
                      }}
                    >
                      <input type="hidden" name="ticket_id" value={activeTicket.id} />
                      <button
                        type="submit"
                        className="button button-small button-danger"
                        style={{ padding: "4px 8px", fontSize: "12px", display: "inline-flex", alignItems: "center", gap: "4px" }}
                        title="Delete ticket"
                      >
                        <Trash2 size={12} /> Delete
                      </button>
                    </form>
                  </div>
                )}
              </div>

              {/* Messages Thread */}
              <div style={{ display: "flex", flexDirection: "column", gap: "14px", borderTop: "1px solid var(--border)", paddingTop: "16px" }}>
                {activeTicket.messages && activeTicket.messages.length > 0 ? (
                  [...activeTicket.messages]
                    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
                    .map((msg) => (
                      <div
                        key={msg.id}
                        style={{
                          padding: "12px 16px",
                          borderRadius: "8px",
                          border: "1px solid var(--border)",
                          background: msg.is_staff ? "rgba(212, 175, 55, 0.04)" : "rgba(255, 255, 255, 0.02)",
                          alignSelf: msg.is_staff ? "flex-start" : "stretch",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                          <span style={{ fontSize: "12px", fontWeight: 600, color: msg.is_staff ? "var(--gold)" : "inherit" }}>
                            {msg.is_staff ? "TheCodexThrill Engineering" : "Client Message"}
                          </span>
                          <small style={{ color: "var(--muted)", fontSize: "11px" }}>
                            {new Date(msg.created_at).toLocaleString()}
                          </small>
                        </div>
                        <p style={{ margin: 0, fontSize: "14px", lineHeight: "1.6", whiteSpace: "pre-wrap" }}>
                          {msg.message}
                        </p>
                      </div>
                    ))
                ) : (
                  <p className="module-empty">No conversation messages in this thread yet.</p>
                )}
              </div>

              {/* Reply Form */}
              {activeTicket.status !== "closed" ? (
                <form action={addTicketMessageAction} className="auth-form" style={{ borderTop: "1px solid var(--border)", paddingTop: "16px" }}>
                  <input type="hidden" name="ticket_id" value={activeTicket.id} />
                  <input type="hidden" name="return_path" value={isStaff ? "admin" : "portal"} />
                  <label>
                    Post a Response
                    <textarea
                      name="message"
                      required
                      rows={3}
                      placeholder={isStaff ? "Provide an engineering update or request details..." : "Add additional details or reply to the team..."}
                    />
                  </label>
                  <button type="submit" className="button button-gold" style={{ marginTop: "10px" }}>
                    Send Message
                  </button>
                </form>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--muted)", fontSize: "13px" }}>
                  <CheckCircle size={15} /> This ticket is closed. Submit a new ticket if further assistance is needed.
                </div>
              )}
            </section>
          ) : (
            <div className="module-panel" style={{ textAlign: "center", padding: "40px" }}>
              <MessageSquare size={32} style={{ color: "var(--muted)", margin: "0 auto 12px" }} />
              <h3>Select a ticket</h3>
              <p style={{ color: "var(--muted)", fontSize: "14px" }}>
                Choose a support ticket from the list to view its full discussion thread.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


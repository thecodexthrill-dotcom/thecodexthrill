"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, CalendarClock } from "lucide-react";

export type LeadListItem = {
  id: string;
  contact_name: string;
  email: string;
  company_name: string | null;
  stage: string;
  source: string;
  created_at: string;
  follow_up_at: string | null;
};

export function LeadsTable({ leads }: { leads: LeadListItem[] }) {
  const [selectedStage, setSelectedStage] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const stages = ["all", "new", "contacted", "qualified", "converted", "closed"];

  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      const matchesStage = selectedStage === "all" || lead.stage.toLowerCase() === selectedStage;
      const q = searchQuery.toLowerCase().trim();
      const matchesQuery =
        !q ||
        lead.contact_name.toLowerCase().includes(q) ||
        lead.email.toLowerCase().includes(q) ||
        (lead.company_name && lead.company_name.toLowerCase().includes(q));

      return matchesStage && matchesQuery;
    });
  }, [leads, selectedStage, searchQuery]);

  return (
    <div style={{ display: "grid", gap: "16px", marginTop: "20px" }}>
      {/* Search and Stage Filters */}
      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ position: "relative", minWidth: "240px", flex: 1, maxWidth: "420px" }}>
          <Search size={15} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }} />
          <input
            type="search"
            placeholder="Search leads by name, email, or company..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: "100%",
              padding: "9px 12px 9px 36px",
              borderRadius: "10px",
              border: "1px solid var(--line)",
              background: "var(--surface)",
              color: "var(--foreground)",
              fontSize: "14px",
            }}
          />
        </div>

        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: "12px", color: "var(--muted)", marginRight: "4px" }}>Filter:</span>
          {stages.map((stage) => {
            const isActive = selectedStage === stage;
            const count = stage === "all"
              ? leads.length
              : leads.filter((l) => l.stage.toLowerCase() === stage).length;

            return (
              <button
                key={stage}
                type="button"
                onClick={() => setSelectedStage(stage)}
                style={{
                  padding: "4px 10px",
                  borderRadius: "8px",
                  fontSize: "12px",
                  fontWeight: 600,
                  textTransform: "capitalize",
                  cursor: "pointer",
                  border: isActive ? "1px solid var(--gold)" : "1px solid var(--line)",
                  background: isActive ? "color-mix(in srgb, var(--gold-soft) 40%, var(--surface))" : "var(--surface)",
                  color: isActive ? "var(--gold-ink)" : "var(--muted)",
                  transition: "all 140ms ease",
                }}
              >
                {stage} <small style={{ opacity: 0.8, marginLeft: "2px" }}>({count})</small>
              </button>
            );
          })}
        </div>
      </div>

      {/* Table Records */}
      {filteredLeads.length === 0 ? (
        <p className="module-empty">
          No lead records match the active filter ({selectedStage !== "all" ? `stage: ${selectedStage}` : ""}{searchQuery ? ` query: "${searchQuery}"` : ""}).
        </p>
      ) : (
        <div className="module-table-wrap">
          <table className="module-table">
            <thead>
              <tr>
                <th>Contact</th>
                <th>Company</th>
                <th>Stage</th>
                <th>Source</th>
                <th>Follow-up</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredLeads.map((lead) => (
                <tr key={lead.id}>
                  <td>
                    <Link
                      href={`/admin/leads?id=${lead.id}`}
                      style={{ color: "inherit", textDecoration: "none", display: "grid", gap: "2px" }}
                    >
                      <strong style={{ color: "var(--foreground)" }}>{lead.contact_name}</strong>
                      <small style={{ color: "var(--gold)" }}>{lead.email}</small>
                    </Link>
                  </td>
                  <td>{lead.company_name ?? "—"}</td>
                  <td>
                    <span className="record-status">{lead.stage}</span>
                  </td>
                  <td>
                    <span style={{ textTransform: "capitalize" }}>{lead.source}</span>
                  </td>
                  <td>
                    {lead.follow_up_at ? (
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                          fontSize: "12px",
                          color: new Date(lead.follow_up_at) < new Date() ? "#f87171" : "var(--gold-ink)",
                        }}
                      >
                        <CalendarClock size={13} />
                        {new Date(lead.follow_up_at).toLocaleDateString()}
                      </span>
                    ) : (
                      <span style={{ color: "var(--subtle)", fontSize: "12px" }}>None scheduled</span>
                    )}
                  </td>
                  <td>{new Date(lead.created_at).toLocaleDateString()}</td>
                  <td>
                    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                      <Link className="button button-small button-secondary" href={`/admin/leads?id=${lead.id}`}>
                        Open
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}


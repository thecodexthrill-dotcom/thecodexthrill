"use client";

import { useState } from "react";
import { FileText, Plus, ExternalLink, Trash2 } from "lucide-react";
import Link from "next/link";
import {
  createDocumentRecordAction,
  deleteDocumentAction,
} from "@/lib/supabase/operations-actions";

export type DocumentRecord = {
  id: string;
  organization_id: string;
  project_id: string | null;
  name: string;
  file_url: string;
  file_size_bytes: number;
  file_type: string;
  category: "contract" | "deliverable" | "invoice" | "asset" | "specification" | "other";
  uploaded_by: string | null;
  created_at: string;
};

type DocumentManagerProps = {
  documents: DocumentRecord[];
  isStaff: boolean;
  userOrganizations?: { id: string; name: string }[];
  projects?: { id: string; organization_id: string; name: string }[];
  notice?: string;
  queryError?: string;
};

export function DocumentManager({
  documents,
  isStaff,
  userOrganizations = [],
  projects = [],
  notice,
  queryError,
}: DocumentManagerProps) {
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [selectedOrgId, setSelectedOrgId] = useState<string>(userOrganizations[0]?.id ?? "");

  const filteredDocs = documents.filter((d) => {
    if (categoryFilter === "all") return true;
    return d.category === categoryFilter;
  });

  const orgProjects = projects.filter(
    (p) => !selectedOrgId || p.organization_id === selectedOrgId
  );

  const resolveProjectName = (projectId: string | null) => {
    if (!projectId) return null;
    return projects.find((p) => p.id === projectId)?.name ?? null;
  };

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
          <strong>Database Notice:</strong> Unable to load documents from Supabase ({queryError}).
        </div>
      )}

      {notice && (
        <p className={notice === "invalid" || notice === "save" ? "module-alert" : "module-success"} role="status">
          {notice === "created" ? "Document record created and shared with organization." : notice === "deleted" ? "Document record deleted." : notice}
        </p>
      )}

      {isStaff && userOrganizations.length === 0 && (
        <div className="module-panel" style={{ border: "1px dashed var(--gold)", padding: "16px" }}>
          <p style={{ margin: 0, fontSize: "14px", color: "var(--gold)" }}>
            <strong>Notice:</strong> No client organization found. Please <Link href="/admin/clients" style={{ textDecoration: "underline", color: "var(--gold)" }}>create an organization in Clients</Link> first to register deliverable documents.
          </p>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <h2 style={{ fontSize: "20px", fontWeight: 700, margin: 0 }}>Documents &amp; Project Deliverables</h2>
          <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: "14px" }}>
            Secure repository of technical specifications, contracts, architecture decks, and project handover deliverables.
          </p>
        </div>

        {userOrganizations.length > 0 && (
          <button
            type="button"
            onClick={() => setShowUploadModal(!showUploadModal)}
            className="button button-gold"
            style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}
          >
            <Plus size={16} /> Register Deliverable / Document
          </button>
        )}
      </div>


      {showUploadModal && userOrganizations.length > 0 && (
        <section className="module-panel" style={{ border: "1px solid var(--gold)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ fontSize: "18px", margin: 0 }}>Register Deliverable or Document</h3>
            <button
              type="button"
              onClick={() => setShowUploadModal(false)}
              className="button button-secondary"
              style={{ padding: "4px 10px", fontSize: "12px" }}
            >
              Cancel
            </button>
          </div>

          <form action={createDocumentRecordAction} encType="multipart/form-data" className="auth-form" style={{ marginTop: "16px", display: "grid", gap: "14px" }}>
            <input type="hidden" name="return_path" value={isStaff ? "admin" : "portal"} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <label>
                Organization
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
                  <option value="">General Organization Document</option>
                  {orgProjects.map((proj) => (
                    <option key={proj.id} value={proj.id}>
                      {proj.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label>
              Document / Deliverable Name
              <input name="name" required maxLength={255} placeholder="e.g., Phase 1 Architecture Specification & Runbook" />
            </label>

            <div style={{ display: "grid", gap: "8px", background: "rgba(255, 255, 255, 0.02)", padding: "12px", borderRadius: "6px", border: "1px solid var(--border)" }}>
              <label style={{ fontSize: "13px" }}>
                Option A: Upload File to Cloud Storage (PDF, Doc, Image, Zip)
                <input name="file" type="file" style={{ fontSize: "12px", marginTop: "4px" }} />
              </label>
              <div style={{ textAlign: "center", color: "var(--muted)", fontSize: "11px" }}>— OR —</div>
              <label style={{ fontSize: "13px" }}>
                Option B: External Resource URL (Figma, GitHub Release, Shared Cloud Link)
                <input name="file_url" type="url" placeholder="https://..." style={{ fontSize: "12px", marginTop: "4px" }} />
              </label>
            </div>

            <label>
              Category
              <select name="category" defaultValue="deliverable">
                <option value="deliverable">Deliverable</option>
                <option value="specification">Specification / Architecture</option>
                <option value="contract">Contract / Legal</option>
                <option value="invoice">Invoice / Financial</option>
                <option value="asset">Asset / Media</option>
                <option value="other">Other</option>
              </select>
            </label>

            <button type="submit" className="button button-gold" style={{ justifySelf: "start" }}>
              Save Document Record
            </button>
          </form>
        </section>
      )}

      {/* Filter and Table */}
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        {["all", "deliverable", "specification", "contract", "invoice", "asset"].map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setCategoryFilter(cat)}
            style={{
              fontSize: "12px",
              padding: "4px 10px",
              borderRadius: "4px",
              border: categoryFilter === cat ? "1px solid var(--gold)" : "1px solid var(--border)",
              background: categoryFilter === cat ? "rgba(212, 175, 55, 0.1)" : "transparent",
              color: categoryFilter === cat ? "var(--gold)" : "inherit",
              cursor: "pointer",
            }}
          >
            {cat.toUpperCase()}
          </button>
        ))}
      </div>

      {filteredDocs.length === 0 ? (
        <div className="module-panel" style={{ textAlign: "center", padding: "40px" }}>
          <FileText size={36} style={{ color: "var(--muted)", margin: "0 auto 12px" }} />
          <h3>No documents found</h3>
          <p style={{ color: "var(--muted)", fontSize: "14px" }}>
            Shared deliverable documents, architecture diagrams, and signed contracts will appear here.
          </p>
        </div>
      ) : (
        <div className="module-table-wrap">
          <table className="module-table">
            <thead>
              <tr>
                <th>Document / Deliverable</th>
                <th>Project</th>
                <th>Category</th>
                <th>Date Added</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredDocs.map((doc) => {
                const projectName = resolveProjectName(doc.project_id);
                return (
                  <tr key={doc.id}>
                    <td>
                      <strong>{doc.name}</strong>
                    </td>
                    <td>
                      {projectName ? (
                        <span style={{ fontSize: "12px", color: "var(--gold)" }}>{projectName}</span>
                      ) : (
                        <span style={{ fontSize: "12px", color: "var(--muted)" }}>Organization-wide</span>
                      )}
                    </td>
                    <td>
                      <span className="record-status" style={{ fontSize: "11px", textTransform: "uppercase" }}>
                        {doc.category}
                      </span>
                    </td>
                    <td>{new Date(doc.created_at).toLocaleDateString()}</td>
                    <td>
                      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                        <a
                          href={doc.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="button button-secondary"
                          style={{ padding: "4px 8px", fontSize: "12px", display: "inline-flex", alignItems: "center", gap: "6px" }}
                        >
                          Open <ExternalLink size={12} />
                        </a>
                        {isStaff && (
                          <form
                            action={deleteDocumentAction}
                            onSubmit={(e) => {
                              if (!confirm(`Are you sure you want to delete "${doc.name}"?`)) e.preventDefault();
                            }}
                          >
                            <input type="hidden" name="id" value={doc.id} />
                            <input type="hidden" name="return_path" value={isStaff ? "admin" : "portal"} />
                            <button
                              type="submit"
                              className="button button-small button-danger"
                              style={{ padding: "4px 8px", fontSize: "12px" }}
                              title="Delete document"
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
    </div>
  );
}


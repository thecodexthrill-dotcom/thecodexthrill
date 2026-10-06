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
  notice?: string;
};

export function DocumentManager({
  documents,
  isStaff,
  userOrganizations = [],
  notice,
}: DocumentManagerProps) {
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const filteredDocs = documents.filter((d) => {
    if (categoryFilter === "all") return true;
    return d.category === categoryFilter;
  });

  return (
    <div className="workspace-content" style={{ display: "grid", gap: "24px" }}>
      {notice && (
        <p className={notice === "invalid" || notice === "save" ? "module-alert" : "module-success"} role="status">
          {notice === "created" ? "Document record created." : notice === "deleted" ? "Document record deleted." : notice}
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
          <h2 style={{ fontSize: "20px", fontWeight: 700, margin: 0 }}>Documents &amp; Deliverables</h2>
          <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: "14px" }}>
            Secure repository of technical specifications, contracts, architecture decks, and shared project assets.
          </p>
        </div>

        {userOrganizations.length > 0 && (
          <button
            type="button"
            onClick={() => setShowUploadModal(!showUploadModal)}
            className="button button-gold"
            style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}
          >
            <Plus size={16} /> Register Document
          </button>
        )}
      </div>


      {showUploadModal && userOrganizations.length > 0 && (
        <section className="module-panel" style={{ border: "1px solid var(--gold)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ fontSize: "18px", margin: 0 }}>Register Document Record</h3>
            <button
              type="button"
              onClick={() => setShowUploadModal(false)}
              className="button button-secondary"
              style={{ padding: "4px 10px", fontSize: "12px" }}
            >
              Cancel
            </button>
          </div>

          <form action={createDocumentRecordAction} className="auth-form" style={{ marginTop: "16px", display: "grid", gap: "14px" }}>
            <input type="hidden" name="return_path" value={isStaff ? "admin" : "portal"} />
            <label>
              Organization
              <select name="organization_id" defaultValue={userOrganizations[0]?.id}>
                {userOrganizations.map((org) => (
                  <option key={org.id} value={org.id}>{org.name}</option>
                ))}
              </select>
            </label>

            <label>
              Document Name
              <input name="name" required maxLength={255} placeholder="e.g., Master Services Agreement (2026-Q4)" />
            </label>

            <label>
              File URL / Storage Link
              <input name="file_url" type="url" required placeholder="https://..." />
            </label>

            <label>
              Category
              <select name="category" defaultValue="deliverable">
                <option value="contract">Contract / Legal</option>
                <option value="deliverable">Deliverable</option>
                <option value="specification">Specification / Architecture</option>
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
        {["all", "deliverable", "contract", "specification", "invoice", "asset"].map((cat) => (
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
                <th>Document</th>
                <th>Category</th>
                <th>Date Added</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredDocs.map((doc) => (
                <tr key={doc.id}>
                  <td>
                    <strong>{doc.name}</strong>
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
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}


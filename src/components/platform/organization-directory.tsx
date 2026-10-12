"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Archive,
  Building2,
  CheckCircle2,
  FolderKanban,
  RotateCcw,
  Search,
  ShieldAlert,
  Trash2,
  X,
} from "lucide-react";
import {
  createOrganizationAction,
  permanentlyDeleteOrganizationAction,
  updateOrganizationAction,
  type OrganizationActionState,
} from "@/lib/supabase/lead-actions";
import type { OrganizationDirectoryItem } from "@/lib/supabase/organization-lifecycle-service";

const initialActionState: OrganizationActionState = {};
const statuses = ["active", "suspended", "deleted"] as const;

type FilterMode = "all" | "active" | "suspended" | "deleted" | "empty_test";

export function OrganizationDirectory({
  organizations,
  isSuperAdmin,
}: {
  organizations: OrganizationDirectoryItem[];
  isSuperAdmin: boolean;
}) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [editingOrgId, setEditingOrgId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<OrganizationDirectoryItem | null>(null);
  const [step1Name, setStep1Name] = useState("");
  const [step2Phrase, setStep2Phrase] = useState("");
  const [dismissedBannerTimestamp, setDismissedBannerTimestamp] = useState<string | null>(null);

  const [deleteState, deleteFormAction, deletePending] = useActionState(
    permanentlyDeleteOrganizationAction,
    initialActionState,
  );

  useEffect(() => {
    if (deleteState.deletedOrganizationId) {
      router.refresh();
    }
  }, [deleteState.deletedOrganizationId, router]);

  const activeDeleteTarget =
    deleteTarget && deleteTarget.id !== deleteState.deletedOrganizationId
      ? deleteTarget
      : null;

  const bannerMessage =
    deleteState.message && deleteState.timestamp !== dismissedBannerTimestamp
      ? deleteState.message
      : null;

  const visibleOrganizations = useMemo(
    () =>
      organizations.filter(
        (org) => org.id !== deleteState.deletedOrganizationId,
      ),
    [organizations, deleteState.deletedOrganizationId],
  );

  const counts = useMemo(() => {
    let active = 0;
    let suspended = 0;
    let deleted = 0;
    let withRecords = 0;
    let emptyDeletable = 0;
    for (const org of visibleOrganizations) {
      if (org.status === "active") active += 1;
      else if (org.status === "suspended") suspended += 1;
      else if (org.status === "deleted") deleted += 1;
      if (org.eligibility.canPermanentlyDelete) emptyDeletable += 1;
      else withRecords += 1;
    }
    return {
      total: visibleOrganizations.length,
      active,
      suspended,
      deleted,
      withRecords,
      emptyDeletable,
    };
  }, [visibleOrganizations]);

  const filteredOrganizations = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return visibleOrganizations.filter((org) => {
      if (filterMode === "active" && org.status !== "active") return false;
      if (filterMode === "suspended" && org.status !== "suspended") return false;
      if (filterMode === "deleted" && org.status !== "deleted") return false;
      if (filterMode === "empty_test" && !org.eligibility.canPermanentlyDelete) return false;
      if (!q) return true;
      return (
        org.name.toLowerCase().includes(q) ||
        org.id.toLowerCase().includes(q) ||
        org.status.toLowerCase().includes(q)
      );
    });
  }, [visibleOrganizations, filterMode, searchQuery]);

  const expectedName = activeDeleteTarget?.name.trim() ?? "";
  const expectedPhrase = expectedName ? `DELETE ${expectedName}` : "";
  const step1Valid = Boolean(expectedName && step1Name.trim() === expectedName);
  const step2Valid = Boolean(expectedPhrase && step2Phrase.trim() === expectedPhrase);
  const canSubmitDelete = Boolean(
    activeDeleteTarget &&
      isSuperAdmin &&
      activeDeleteTarget.eligibility.canPermanentlyDelete &&
      step1Valid &&
      step2Valid &&
      !deletePending,
  );

  function openDeleteModal(org: OrganizationDirectoryItem) {
    setDeleteTarget(org);
    setStep1Name("");
    setStep2Phrase("");
  }

  function closeDeleteModal() {
    if (deletePending) return;
    setDeleteTarget(null);
    setStep1Name("");
    setStep2Phrase("");
  }

  return (
    <section className="module-panel">
      <div className="module-heading" style={{ marginTop: 0 }}>
        <div>
          <p className="eyebrow">ORGANIZATION DIRECTORY · LIFECYCLE GOVERNANCE</p>
          <h2>Client Organizations</h2>
          <p>
            Manage client organizations, delivery handover records, lifecycle states (Active,
            Suspended, Archived), and Super Admin permanent deletion for empty test records.
          </p>
        </div>
        <details className="module-heading-action" style={{ cursor: "pointer" }}>
          <summary className="button button-gold" style={{ listStyle: "none" }}>
            + Create Organization
          </summary>
          <div
            style={{
              marginTop: "12px",
              padding: "18px",
              border: "1px solid var(--line-strong)",
              borderRadius: "14px",
              background: "var(--surface-raised)",
              minWidth: "280px",
            }}
          >
            <form action={createOrganizationAction} className="auth-form">
              <label>
                Organization name *
                <input
                  maxLength={160}
                  name="name"
                  placeholder="Acme Corporation"
                  required
                />
              </label>
              <button className="button button-gold" type="submit">
                Create organization
              </button>
            </form>
          </div>
        </details>
      </div>

      {bannerMessage && (
        <div
          className="module-success"
          role="status"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            marginBottom: "16px",
          }}
        >
          <span>{bannerMessage}</span>
          <button
            aria-label="Dismiss message"
            className="button button-small button-secondary"
            onClick={() => setDismissedBannerTimestamp(deleteState.timestamp ?? "dismissed")}
            type="button"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="um-summary-grid" style={{ marginBottom: "18px" }}>
        <div className="um-summary-card">
          <span>Total Organizations</span>
          <strong>{counts.total}</strong>
          <small>{counts.active} active · {counts.suspended} suspended · {counts.deleted} archived</small>
        </div>
        <div className="um-summary-card">
          <span>Protected Client Records</span>
          <strong>{counts.withRecords}</strong>
          <small>Protected from deletion by projects, invoices, files, members, or retained audit history</small>
        </div>
        <div className="um-summary-card">
          <span>Empty / Deletable</span>
          <strong>{counts.emptyDeletable}</strong>
          <small>Zero projects, invoices, files, tickets, memberships, or organization audit events</small>
        </div>
      </div>

      <div className="um-toolbar" style={{ marginBottom: "16px" }}>
        <div className="um-search-wrap">
          <Search aria-hidden="true" className="um-search-icon" size={15} />
          <input
            aria-label="Search organizations by name or ID"
            className="um-search-input"
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search organization name or UUID…"
            type="search"
            value={searchQuery}
          />
        </div>
        <div className="um-filter-pills" role="group" aria-label="Filter organizations">
          {(
            [
              ["all", `All (${counts.total})`],
              ["active", `Active (${counts.active})`],
              ["suspended", `Suspended (${counts.suspended})`],
              ["deleted", `Archived (${counts.deleted})`],
              ["empty_test", `Empty / Deletable (${counts.emptyDeletable})`],
            ] as const
          ).map(([key, label]) => (
            <button
              className={`um-filter-pill ${filterMode === key ? "is-active" : ""}`}
              key={key}
              onClick={() => setFilterMode(key)}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {filteredOrganizations.length === 0 ? (
        <p className="module-empty">No organizations match the current filter.</p>
      ) : (
        <div className="module-table-wrap">
          <table className="module-table">
            <thead>
              <tr>
                <th>Organization</th>
                <th>Lifecycle</th>
                <th>Connected Records</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrganizations.map((org) => {
                const deps = org.dependencies;
                const isEditing = editingOrgId === org.id;
                const badgeClass =
                  org.status === "active"
                    ? "um-badge um-badge-green"
                    : org.status === "suspended"
                      ? "um-badge um-badge-amber"
                      : "um-badge um-badge-muted";

                return (
                  <tr key={org.id}>
                    <td>
                      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                          <Link
                            href={`/admin/clients?id=${org.id}`}
                            style={{ color: "var(--foreground)", fontWeight: 600, textDecoration: "none" }}
                          >
                            {org.name}
                          </Link>
                          {org.isLikelyTestOrganization && org.eligibility.canPermanentlyDelete && (
                            <span className="um-badge um-badge-amber" title="Empty test or duplicate organization">
                              Empty Test / Duplicate
                            </span>
                          )}
                        </div>
                        <small style={{ color: "var(--subtle)", fontFamily: "var(--font-mono), monospace", fontSize: "11px" }}>
                          {org.id}
                        </small>
                      </div>
                    </td>
                    <td>
                      <span className={badgeClass}>
                        {org.status === "deleted" ? "archived" : org.status}
                      </span>
                      {org.deleted_at && (
                        <small style={{ display: "block", color: "var(--subtle)", fontSize: "11px", marginTop: "3px" }}>
                          Archived {new Date(org.deleted_at).toLocaleDateString()}
                        </small>
                      )}
                    </td>
                    <td>
                      {org.eligibility.canPermanentlyDelete ? (
                        <span className="um-badge um-badge-muted">0 linked records</span>
                      ) : (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                          {deps.projectsCount > 0 && (
                            <span className="um-badge um-badge-gold">
                              {deps.projectsCount} Project{deps.projectsCount === 1 ? "" : "s"}
                            </span>
                          )}
                          {deps.tasksCount > 0 && (
                            <span className="um-badge um-badge-muted">
                              {deps.tasksCount} Task{deps.tasksCount === 1 ? "" : "s"}
                            </span>
                          )}
                          {deps.documentsCount > 0 && (
                            <span className="um-badge um-badge-gold">
                              {deps.documentsCount} File{deps.documentsCount === 1 ? "" : "s"}
                            </span>
                          )}
                          {deps.invoicesCount > 0 && (
                            <span className="um-badge um-badge-green">
                              {deps.invoicesCount} Invoice{deps.invoicesCount === 1 ? "" : "s"}
                            </span>
                          )}
                          {deps.supportTicketsCount > 0 && (
                            <span className="um-badge um-badge-amber">
                              {deps.supportTicketsCount} Ticket{deps.supportTicketsCount === 1 ? "" : "s"}
                            </span>
                          )}
                          {deps.totalMembershipsCount > 0 && (
                            <span className="um-badge um-badge-green">
                              {deps.activeMembershipsCount}/{deps.totalMembershipsCount} Member{deps.totalMembershipsCount === 1 ? "" : "s"}
                            </span>
                          )}
                          {(deps.auditEventsCount ?? 0) > 0 && (
                            <span
                              className="um-badge um-badge-muted"
                              title="Retained organization-scoped audit history in public.audit_events (audit_events_organization_id_fkey ON DELETE RESTRICT)"
                            >
                              {deps.auditEventsCount} Audit Event{deps.auditEventsCount === 1 ? "" : "s"}
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td>{new Date(org.created_at).toLocaleDateString()}</td>
                    <td>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center" }}>
                        <Link
                          className="button button-small button-secondary"
                          href={`/admin/clients?id=${org.id}`}
                        >
                          Open
                        </Link>
                        <button
                          className="button button-small button-secondary"
                          onClick={() => setEditingOrgId(isEditing ? null : org.id)}
                          type="button"
                        >
                          {isEditing ? "Close" : "Edit"}
                        </button>
                        {org.status !== "deleted" ? (
                          <form action={updateOrganizationAction} style={{ display: "inline" }}>
                            <input name="id" type="hidden" value={org.id} />
                            <input name="name" type="hidden" value={org.name} />
                            <input name="status" type="hidden" value="deleted" />
                            <button
                              className="button button-small button-secondary"
                              title="Archive organization while retaining all projects, invoices, and audit history"
                              type="submit"
                            >
                              <Archive aria-hidden="true" size={13} /> Archive
                            </button>
                          </form>
                        ) : (
                          <form action={updateOrganizationAction} style={{ display: "inline" }}>
                            <input name="id" type="hidden" value={org.id} />
                            <input name="name" type="hidden" value={org.name} />
                            <input name="status" type="hidden" value="active" />
                            <button
                              className="button button-small button-secondary"
                              title="Reactivate organization"
                              type="submit"
                            >
                              <RotateCcw aria-hidden="true" size={13} /> Reactivate
                            </button>
                          </form>
                        )}
                        {isSuperAdmin && (
                          <button
                            className="button button-small button-danger"
                            onClick={() => openDeleteModal(org)}
                            title={
                              org.eligibility.canPermanentlyDelete
                                ? "Permanently delete this empty organization"
                                : "Inspect why permanent deletion is blocked for this organization"
                            }
                            type="button"
                          >
                            <Trash2 aria-hidden="true" size={13} />{" "}
                            {org.eligibility.canPermanentlyDelete ? "Permanent Delete" : "Protected"}
                          </button>
                        )}
                      </div>

                      {isEditing && (
                        <form
                          action={updateOrganizationAction}
                          className="row-edit-form"
                          style={{
                            marginTop: "10px",
                            padding: "12px",
                            border: "1px solid var(--line-strong)",
                            borderRadius: "10px",
                            background: "var(--surface-raised)",
                          }}
                        >
                          <input name="id" type="hidden" value={org.id} />
                          <label>
                            Name
                            <input
                              defaultValue={org.name}
                              maxLength={160}
                              name="name"
                              required
                            />
                          </label>
                          <label>
                            Lifecycle
                            <select defaultValue={org.status} name="status">
                              {statuses.map((item) => (
                                <option key={item} value={item}>
                                  {item === "deleted" ? "archived (deleted)" : item}
                                </option>
                              ))}
                            </select>
                          </label>
                          <button className="button button-small button-gold" type="submit">
                            Save changes
                          </button>
                        </form>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="module-note" style={{ marginTop: "14px" }}>
        Organizations with projects, tasks, documents, invoices, support tickets, memberships, or
        retained organization audit history (<code>public.audit_events.organization_id</code>) are
        protected from permanent deletion; use <strong>Archive</strong> or{" "}
        <strong>Suspend</strong> to deactivate access while preserving historical records.
      </p>

      {activeDeleteTarget && (
        <div
          aria-labelledby="org-delete-modal-title"
          aria-modal="true"
          className="um-modal-backdrop"
          onClick={closeDeleteModal}
          role="dialog"
        >
          <div className="um-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="um-modal-header">
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <Building2 aria-hidden="true" size={20} style={{ color: "var(--gold)" }} />
                <div>
                  <p className="eyebrow" style={{ margin: 0 }}>
                    SUPER ADMIN · ORGANIZATION LIFECYCLE
                  </p>
                  <h3 id="org-delete-modal-title" style={{ margin: "2px 0 0" }}>
                    {activeDeleteTarget.eligibility.canPermanentlyDelete
                      ? "Permanently Delete Empty Organization"
                      : "Permanent Deletion Blocked — Active Dependencies"}
                  </h3>
                </div>
              </div>
              <button
                aria-label="Close modal"
                className="button button-small button-secondary"
                disabled={deletePending}
                onClick={closeDeleteModal}
                type="button"
              >
                <X aria-hidden="true" size={15} />
              </button>
            </div>

            <div className="um-modal-body">
              <div
                style={{
                  padding: "12px 14px",
                  borderRadius: "10px",
                  border: "1px solid var(--line)",
                  background: "var(--surface)",
                  marginBottom: "14px",
                }}
              >
                <strong style={{ display: "block", fontSize: "15px" }}>{activeDeleteTarget.name}</strong>
                <small style={{ color: "var(--subtle)", fontFamily: "var(--font-mono), monospace" }}>
                  ID: {activeDeleteTarget.id} · Status: {activeDeleteTarget.status} · Created{" "}
                  {new Date(activeDeleteTarget.created_at).toLocaleDateString()}
                </small>
              </div>

              {!activeDeleteTarget.eligibility.canPermanentlyDelete ? (
                <div>
                  <div className="module-alert" role="alert" style={{ marginBottom: "14px" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                      <ShieldAlert aria-hidden="true" size={18} style={{ flexShrink: 0, marginTop: "2px" }} />
                      <div>
                        <strong>Cannot permanently delete this organization</strong>
                        <p style={{ margin: "4px 0 0" }}>{activeDeleteTarget.eligibility.recommendation}</p>
                      </div>
                    </div>
                  </div>
                  <p style={{ fontSize: "13px", color: "var(--muted)", marginBottom: "12px" }}>
                    Blocking dependencies detected in Supabase Cloud:
                  </p>
                  <ul style={{ margin: "0 0 16px", paddingLeft: "20px", fontSize: "13px", lineHeight: "1.7" }}>
                    {activeDeleteTarget.eligibility.blockers.map((blocker) => (
                      <li key={blocker}>{blocker}</li>
                    ))}
                  </ul>
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", flexWrap: "wrap" }}>
                    <Link
                      className="button button-small button-secondary"
                      href={`/admin/clients?id=${activeDeleteTarget.id}`}
                    >
                      <FolderKanban aria-hidden="true" size={14} /> Inspect Organization
                    </Link>
                    {activeDeleteTarget.status !== "deleted" && (
                      <form action={updateOrganizationAction}>
                        <input name="id" type="hidden" value={activeDeleteTarget.id} />
                        <input name="name" type="hidden" value={activeDeleteTarget.name} />
                        <input name="status" type="hidden" value="deleted" />
                        <button className="button button-small button-gold" type="submit">
                          <Archive aria-hidden="true" size={14} /> Archive Instead (Recommended)
                        </button>
                      </form>
                    )}
                    <button
                      className="button button-small button-secondary"
                      onClick={closeDeleteModal}
                      type="button"
                    >
                      Close
                    </button>
                  </div>
                </div>
              ) : (
                <form action={deleteFormAction} className="auth-form">
                  <input name="organization-id" type="hidden" value={activeDeleteTarget.id} />

                  <div
                    style={{
                      padding: "12px 14px",
                      borderRadius: "10px",
                      border: "1px solid color-mix(in srgb, #f59e0b 45%, var(--line))",
                      background: "color-mix(in srgb, #f59e0b 10%, var(--surface))",
                      fontSize: "13px",
                      lineHeight: "1.55",
                      marginBottom: "12px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 600 }}>
                      <AlertTriangle aria-hidden="true" size={16} /> Irreversible Super Admin Action
                    </div>
                    <p style={{ margin: "6px 0 0", color: "var(--muted)" }}>
                      This organization has <strong>0 projects, 0 tasks, 0 documents, 0 invoices, 0 tickets, 0 memberships, and 0 organization audit events</strong>.
                      Deleting it permanently removes the row from <code>public.organizations</code> and writes an immutable platform record to <code>audit_events</code>.
                    </p>
                  </div>

                  <label>
                    <span style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
                      <span>Step 1 — Type exact organization name:</span>
                      {step1Valid && (
                        <span className="um-badge um-badge-green" style={{ fontSize: "11px" }}>
                          <CheckCircle2 aria-hidden="true" size={12} /> Verified
                        </span>
                      )}
                    </span>
                    <code
                      style={{
                        display: "block",
                        padding: "6px 10px",
                        borderRadius: "6px",
                        background: "var(--surface)",
                        border: "1px solid var(--line)",
                        fontSize: "12px",
                        userSelect: "all",
                      }}
                    >
                      {expectedName}
                    </code>
                    <input
                      autoComplete="off"
                      disabled={deletePending}
                      name="confirmation-name"
                      onChange={(e) => setStep1Name(e.target.value)}
                      placeholder={expectedName}
                      required
                      value={step1Name}
                    />
                  </label>

                  <label>
                    <span style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
                      <span>Step 2 — Type confirmation phrase:</span>
                      {step2Valid && (
                        <span className="um-badge um-badge-green" style={{ fontSize: "11px" }}>
                          <CheckCircle2 aria-hidden="true" size={12} /> Verified
                        </span>
                      )}
                    </span>
                    <code
                      style={{
                        display: "block",
                        padding: "6px 10px",
                        borderRadius: "6px",
                        background: "var(--surface)",
                        border: "1px solid var(--line)",
                        fontSize: "12px",
                        userSelect: "all",
                      }}
                    >
                      {expectedPhrase}
                    </code>
                    <input
                      autoComplete="off"
                      disabled={deletePending}
                      name="typed-confirmation"
                      onChange={(e) => setStep2Phrase(e.target.value)}
                      placeholder={expectedPhrase}
                      required
                      value={step2Phrase}
                    />
                  </label>

                  {deleteState.error && (
                    <p className="module-alert" role="alert" style={{ margin: "6px 0" }}>
                      {deleteState.error}
                    </p>
                  )}

                  <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "8px" }}>
                    <button
                      className="button button-secondary"
                      disabled={deletePending}
                      onClick={closeDeleteModal}
                      type="button"
                    >
                      Cancel
                    </button>
                    <button
                      className="button button-danger"
                      disabled={!canSubmitDelete}
                      type="submit"
                    >
                      <Trash2 aria-hidden="true" size={14} />{" "}
                      {deletePending ? "Deleting Organization…" : "Permanently Delete Organization"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

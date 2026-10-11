"use client";

import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PlatformRoleActions } from "@/components/platform/platform-role-actions";
import {
  permanentlyDeleteUserAction,
  refreshUserDirectoryAction,
  restoreUserAccessAction,
  revokeUserAccessAction,
  type AuthActionState,
} from "@/lib/supabase/actions";
import {
  filterAndPaginateDirectoryUsers,
  formatExpectedDeleteConfirmation,
  matchesDeleteConfirmationPhrase,
  type SuperAdminDirectoryUser,
  type UserAccessStatus,
  type UserDiagnosticCategory,
  type UserMfaSummaryStatus,
} from "@/lib/supabase/user-management-helper";

const initialActionState: AuthActionState = {};

function formatAccessStatusLabel(status: UserAccessStatus): {
  label: string;
  tone: "gold" | "green" | "red" | "muted";
} {
  switch (status) {
    case "protected_owner":
      return { label: "Protected Owner", tone: "gold" };
    case "active":
      return { label: "Active Access", tone: "green" };
    case "disabled":
      return { label: "Disabled / Revoked", tone: "red" };
    case "pending_verification":
      return { label: "Pending Verification", tone: "muted" };
    case "no_workspace_role":
      return { label: "No Active Role", tone: "muted" };
  }
}

function formatDiagnosticBadge(category: UserDiagnosticCategory): {
  label: string;
  color: string;
  border: string;
  bg: string;
} {
  switch (category) {
    case "real_or_active_account":
      return {
        label: "Verified / Active Account",
        color: "#6ee7b7",
        border: "rgba(16, 185, 129, 0.35)",
        bg: "rgba(16, 185, 129, 0.12)",
      };
    case "confirmed_test_account":
      return {
        label: "Acceptance-Test Artifact",
        color: "#fcd34d",
        border: "rgba(245, 158, 11, 0.4)",
        bg: "rgba(245, 158, 11, 0.12)",
      };
    case "unknown_unassigned_account":
      return {
        label: "Unassigned / Review",
        color: "#93c5fd",
        border: "rgba(59, 130, 246, 0.35)",
        bg: "rgba(59, 130, 246, 0.12)",
      };
  }
}

function formatMfaLabel(user: SuperAdminDirectoryUser): {
  label: string;
  verified: boolean;
} {
  if (user.mfaStatus === "verified_totp") {
    return {
      label: `Verified TOTP (${user.verifiedTotpCount})`,
      verified: true,
    };
  }
  if (user.mfaStatus === "unverified_factor") {
    return {
      label: `Unverified Factor (${user.totalFactorCount})`,
      verified: false,
    };
  }
  if (user.mfaStatus === "unavailable") {
    return { label: "Unavailable", verified: false };
  }
  return { label: "No MFA Enrolled", verified: false };
}

export function UserManagementDirectory({
  users,
  directoryError,
  isSuperAdminActor,
  canAssignPlatformAdmin,
}: {
  users: SuperAdminDirectoryUser[];
  directoryError?: string;
  isSuperAdminActor: boolean;
  canAssignPlatformAdmin: boolean;
}) {
  const router = useRouter();
  const [isRefreshing, startRefreshTransition] = useTransition();
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(null);

  // Filters & Pagination
  const [search, setSearch] = useState("");
  const [accessStatus, setAccessStatus] = useState<"all" | UserAccessStatus>("all");
  const [roleFilter, setRoleFilter] = useState<
    | "all"
    | "super_admin"
    | "platform_admin"
    | "developer"
    | "support_staff"
    | "organization_member"
    | "unassigned"
  >("all");
  const [diagnosticFilter, setDiagnosticFilter] = useState<
    "all" | UserDiagnosticCategory
  >("all");
  const [mfaFilter, setMfaFilter] = useState<"all" | UserMfaSummaryStatus>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Modal state for Revoke Access / Restore Access / Permanent Delete
  const [revokeTarget, setRevokeTarget] = useState<SuperAdminDirectoryUser | null>(
    null,
  );
  const [revokeReason, setRevokeReason] = useState("");
  const [restoreTarget, setRestoreTarget] =
    useState<SuperAdminDirectoryUser | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SuperAdminDirectoryUser | null>(
    null,
  );
  const [confirmationEmail, setConfirmationEmail] = useState("");
  const [typedConfirmation, setTypedConfirmation] = useState("");

  const [revokeState, revokeAction, revokePending] = useActionState(
    revokeUserAccessAction,
    initialActionState,
  );
  const [restoreState, restoreAction, restorePending] = useActionState(
    restoreUserAccessAction,
    initialActionState,
  );
  const [deleteState, deleteAction, deletePending] = useActionState(
    permanentlyDeleteUserAction,
    initialActionState,
  );

  // Close modal and refresh when action succeeds
  useEffect(() => {
    if (revokeState.message) {
      setRevokeTarget(null);
      setRevokeReason("");
      router.refresh();
    }
  }, [revokeState.message, router]);

  useEffect(() => {
    if (restoreState.message) {
      setRestoreTarget(null);
      router.refresh();
    }
  }, [restoreState.message, router]);

  useEffect(() => {
    if (deleteState.message) {
      setDeleteTarget(null);
      setConfirmationEmail("");
      setTypedConfirmation("");
      router.refresh();
    }
  }, [deleteState.message, router]);

  const counts = useMemo(() => {
    let realOrActive = 0;
    let confirmedTest = 0;
    let unknownUnassigned = 0;
    let disabledCount = 0;
    let verifiedMfaCount = 0;
    for (const u of users) {
      if (u.diagnosticCategory === "real_or_active_account") realOrActive += 1;
      if (u.diagnosticCategory === "confirmed_test_account") confirmedTest += 1;
      if (u.diagnosticCategory === "unknown_unassigned_account")
        unknownUnassigned += 1;
      if (u.accessStatus === "disabled") disabledCount += 1;
      if (u.mfaStatus === "verified_totp") verifiedMfaCount += 1;
    }
    return {
      total: users.length,
      realOrActive,
      confirmedTest,
      unknownUnassigned,
      disabledCount,
      verifiedMfaCount,
    };
  }, [users]);

  const pagination = useMemo(
    () =>
      filterAndPaginateDirectoryUsers(users, {
        search,
        accessStatus,
        roleFilter,
        diagnosticFilter,
        mfaFilter,
        page,
        pageSize,
      }),
    [
      users,
      search,
      accessStatus,
      roleFilter,
      diagnosticFilter,
      mfaFilter,
      page,
      pageSize,
    ],
  );

  const handleRefresh = () => {
    startRefreshTransition(async () => {
      const res = await refreshUserDirectoryAction();
      setLastRefreshedAt(res.refreshedAt);
      router.refresh();
    });
  };

  const resetFilters = () => {
    setSearch("");
    setAccessStatus("all");
    setRoleFilter("all");
    setDiagnosticFilter("all");
    setMfaFilter("all");
    setPage(1);
  };

  const isDeleteConfirmationReady = useMemo(() => {
    if (!deleteTarget) return false;
    const emailMatches =
      confirmationEmail.trim().toLowerCase() ===
      deleteTarget.email.trim().toLowerCase();
    const phraseMatches = matchesDeleteConfirmationPhrase(
      deleteTarget.email,
      typedConfirmation,
    );
    return emailMatches && phraseMatches;
  }, [deleteTarget, confirmationEmail, typedConfirmation]);

  return (
    <section className="module-panel">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: "12px",
          marginBottom: "16px",
        }}
      >
        <div>
          <p className="eyebrow">SUPER ADMIN IDENTITY &amp; ACCESS GOVERNANCE</p>
          <h2 style={{ margin: "4px 0 6px" }}>
            Supabase Auth &amp; Platform User Directory
          </h2>
          <p style={{ margin: 0, maxWidth: "78ch" }}>
            Complete inventory of Supabase Auth accounts, global platform roles,
            client organization memberships, MFA posture, and diagnostic
            account classification. Access revocation disables workspace login
            while preserving records; permanent deletion removes the Supabase
            Auth user and requires verified Super Admin MFA (AAL2).
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {lastRefreshedAt && (
            <small style={{ opacity: 0.75 }}>
              Refreshed {new Date(lastRefreshedAt).toLocaleTimeString()}
            </small>
          )}
          <button
            className="button-secondary"
            disabled={isRefreshing}
            onClick={handleRefresh}
            type="button"
          >
            {isRefreshing ? "Refreshing…" : "Refresh Directory"}
          </button>
        </div>
      </div>

      {/* Global action feedback */}
      {revokeState.message && (
        <p className="module-success" role="status" style={{ marginBottom: "12px" }}>
          {revokeState.message}
        </p>
      )}
      {restoreState.message && (
        <p className="module-success" role="status" style={{ marginBottom: "12px" }}>
          {restoreState.message}
        </p>
      )}
      {deleteState.message && (
        <p className="module-success" role="status" style={{ marginBottom: "12px" }}>
          {deleteState.message}
        </p>
      )}

      {/* Summary KPI cards */}
      <div className="module-stat-grid" style={{ marginBottom: "18px" }}>
        <div className="module-stat">
          <span>Total Supabase Auth Users</span>
          <strong>{counts.total}</strong>
          <small>{counts.verifiedMfaCount} with verified TOTP MFA</small>
        </div>
        <div className="module-stat">
          <span>Verified / Active Accounts</span>
          <strong style={{ color: "#6ee7b7" }}>{counts.realOrActive}</strong>
          <small>Protected Owner, Staff &amp; Active Clients</small>
        </div>
        <div className="module-stat">
          <span>Acceptance-Test Artifacts</span>
          <strong style={{ color: "#fcd34d" }}>{counts.confirmedTest}</strong>
          <small>Flagged for review (never auto-deleted)</small>
        </div>
        <div className="module-stat">
          <span>Unassigned / Needs Review</span>
          <strong style={{ color: "#93c5fd" }}>{counts.unknownUnassigned}</strong>
          <small>{counts.disabledCount} disabled / revoked</small>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(185px, 1fr))",
          gap: "10px",
          marginBottom: "16px",
          padding: "14px",
          borderRadius: "10px",
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <div>
          <label
            htmlFor="user-dir-search"
            style={{ display: "block", fontSize: "12px", marginBottom: "4px" }}
          >
            Search email, name, UUID, or org
          </label>
          <input
            id="user-dir-search"
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search directory…"
            style={{ width: "100%" }}
            type="search"
            value={search}
          />
        </div>

        <div>
          <label
            htmlFor="user-dir-access"
            style={{ display: "block", fontSize: "12px", marginBottom: "4px" }}
          >
            Access Status
          </label>
          <select
            id="user-dir-access"
            onChange={(e) => {
              setAccessStatus(e.target.value as "all" | UserAccessStatus);
              setPage(1);
            }}
            style={{ width: "100%" }}
            value={accessStatus}
          >
            <option value="all">All access states</option>
            <option value="protected_owner">Protected Owner</option>
            <option value="active">Active Access</option>
            <option value="disabled">Disabled / Revoked</option>
            <option value="pending_verification">Pending Verification</option>
            <option value="no_workspace_role">No Active Role</option>
          </select>
        </div>

        <div>
          <label
            htmlFor="user-dir-role"
            style={{ display: "block", fontSize: "12px", marginBottom: "4px" }}
          >
            Role / Workspace Scope
          </label>
          <select
            id="user-dir-role"
            onChange={(e) => {
              setRoleFilter(
                e.target.value as
                  | "all"
                  | "super_admin"
                  | "platform_admin"
                  | "developer"
                  | "support_staff"
                  | "organization_member"
                  | "unassigned",
              );
              setPage(1);
            }}
            style={{ width: "100%" }}
            value={roleFilter}
          >
            <option value="all">All roles &amp; scopes</option>
            <option value="super_admin">Global Super Admin</option>
            <option value="platform_admin">Platform Admin</option>
            <option value="developer">Developer</option>
            <option value="support_staff">Support Staff</option>
            <option value="organization_member">Organization Member</option>
            <option value="unassigned">Unassigned (No Role)</option>
          </select>
        </div>

        <div>
          <label
            htmlFor="user-dir-diag"
            style={{ display: "block", fontSize: "12px", marginBottom: "4px" }}
          >
            Diagnostic Classification
          </label>
          <select
            id="user-dir-diag"
            onChange={(e) => {
              setDiagnosticFilter(
                e.target.value as "all" | UserDiagnosticCategory,
              );
              setPage(1);
            }}
            style={{ width: "100%" }}
            value={diagnosticFilter}
          >
            <option value="all">All classifications</option>
            <option value="real_or_active_account">
              Verified / Active Accounts ({counts.realOrActive})
            </option>
            <option value="confirmed_test_account">
              Acceptance-Test Artifacts ({counts.confirmedTest})
            </option>
            <option value="unknown_unassigned_account">
              Unassigned / Review ({counts.unknownUnassigned})
            </option>
          </select>
        </div>

        <div>
          <label
            htmlFor="user-dir-mfa"
            style={{ display: "block", fontSize: "12px", marginBottom: "4px" }}
          >
            MFA Security Posture
          </label>
          <select
            id="user-dir-mfa"
            onChange={(e) => {
              setMfaFilter(e.target.value as "all" | UserMfaSummaryStatus);
              setPage(1);
            }}
            style={{ width: "100%" }}
            value={mfaFilter}
          >
            <option value="all">All MFA states</option>
            <option value="verified_totp">Verified TOTP</option>
            <option value="unverified_factor">Unverified Factor</option>
            <option value="no_mfa">No MFA Enrolled</option>
          </select>
        </div>
      </div>

      {/* Filter summary bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "10px",
          marginBottom: "12px",
        }}
      >
        <small>
          Showing <strong>{pagination.paginatedUsers.length}</strong> of{" "}
          <strong>{pagination.filteredCount}</strong> matching accounts (total{" "}
          {pagination.totalCount} in Supabase Auth)
        </small>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {(search ||
            accessStatus !== "all" ||
            roleFilter !== "all" ||
            diagnosticFilter !== "all" ||
            mfaFilter !== "all") && (
            <button
              className="button-secondary"
              onClick={resetFilters}
              type="button"
            >
              Reset Filters
            </button>
          )}
          <label htmlFor="user-dir-pagesize" style={{ fontSize: "12px" }}>
            Rows:
          </label>
          <select
            id="user-dir-pagesize"
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
            value={pageSize}
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
          </select>
        </div>
      </div>

      {/* Error / Empty / Table States */}
      {directoryError ? (
        <p className="module-alert" role="alert">
          {directoryError}
        </p>
      ) : pagination.paginatedUsers.length === 0 ? (
        <p className="module-empty">
          No user accounts match the current filter criteria.
        </p>
      ) : (
        <div className="module-table-wrap">
          <table className="module-table">
            <thead>
              <tr>
                <th>User &amp; Classification</th>
                <th>Created &amp; Last Sign-In</th>
                <th>Global Platform Role</th>
                <th>Organizations &amp; Roles</th>
                <th>Verification &amp; Invites</th>
                <th>MFA &amp; Access Status</th>
                <th>Role Assignment</th>
                {isSuperAdminActor && <th>Super Admin Actions</th>}
              </tr>
            </thead>
            <tbody>
              {pagination.paginatedUsers.map((u) => {
                const diag = formatDiagnosticBadge(u.diagnosticCategory);
                const accessBadge = formatAccessStatusLabel(u.accessStatus);
                const mfaBadge = formatMfaLabel(u);
                const latestInvite = u.invitations[0] ?? null;

                return (
                  <tr key={u.userId}>
                    <td>
                      <strong>{u.displayName || u.email.split("@")[0]}</strong>
                      <small style={{ display: "block" }}>{u.email}</small>
                      <small
                        style={{
                          display: "block",
                          fontFamily: "monospace",
                          fontSize: "11px",
                          opacity: 0.7,
                        }}
                      >
                        ID: {u.userId.slice(0, 8)}…
                      </small>
                      <span
                        style={{
                          display: "inline-block",
                          marginTop: "6px",
                          padding: "2px 8px",
                          borderRadius: "999px",
                          fontSize: "11px",
                          fontWeight: 600,
                          color: diag.color,
                          border: `1px solid ${diag.border}`,
                          background: diag.bg,
                        }}
                        title={u.diagnosticSignals.join(" • ")}
                      >
                        {diag.label}
                      </span>
                    </td>

                    <td>
                      <small style={{ display: "block" }}>
                        <strong>Created:</strong>{" "}
                        {new Date(u.createdAt).toLocaleDateString()}{" "}
                        {new Date(u.createdAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </small>
                      <small style={{ display: "block", marginTop: "4px" }}>
                        <strong>Last sign-in:</strong>{" "}
                        {u.lastSignInAt
                          ? `${new Date(u.lastSignInAt).toLocaleDateString()} ${new Date(
                              u.lastSignInAt,
                            ).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}`
                          : "Never signed in"}
                      </small>
                    </td>

                    <td>
                      {u.isSuperAdmin ? (
                        <span className="scope-tag scope-platform">
                          Global Super Admin
                        </span>
                      ) : u.platformRoles.length > 0 ? (
                        u.platformRoles.map((role) => (
                          <span
                            className="record-status"
                            key={role}
                            style={{
                              display: "inline-block",
                              marginRight: "4px",
                              textTransform: "capitalize",
                            }}
                          >
                            {role.replaceAll("_", " ")}
                          </span>
                        ))
                      ) : (
                        <small style={{ opacity: 0.75 }}>No platform role</small>
                      )}
                      {u.revokedPlatformRoles.length > 0 && (
                        <small style={{ display: "block", opacity: 0.65 }}>
                          Revoked:{" "}
                          {u.revokedPlatformRoles
                            .map((r) => r.replaceAll("_", " "))
                            .join(", ")}
                        </small>
                      )}
                    </td>

                    <td>
                      {u.organizations.length > 0 ? (
                        u.organizations.map((org) => (
                          <div
                            key={org.organizationId}
                            style={{ marginBottom: "4px" }}
                          >
                            <strong>{org.organizationName}</strong>{" "}
                            <small>({org.membershipStatus})</small>
                            <small
                              style={{
                                display: "block",
                                textTransform: "capitalize",
                              }}
                            >
                              {org.roles.length > 0
                                ? org.roles
                                    .map((r) => r.replaceAll("_", " "))
                                    .join(", ")
                                : "No active role"}
                            </small>
                          </div>
                        ))
                      ) : (
                        <small style={{ opacity: 0.75 }}>
                          No organization memberships
                        </small>
                      )}
                    </td>

                    <td>
                      <span
                        className="record-status"
                        style={{
                          color: u.emailConfirmedAt ? "#6ee7b7" : "#fcd34d",
                        }}
                      >
                        {u.emailConfirmedAt
                          ? "Email Confirmed"
                          : "Email Unconfirmed"}
                      </span>
                      {latestInvite ? (
                        <small style={{ display: "block", marginTop: "4px" }}>
                          Invite: <strong>{latestInvite.status}</strong> (
                          {latestInvite.role.replaceAll("_", " ")})
                        </small>
                      ) : u.invitedAt ? (
                        <small style={{ display: "block", marginTop: "4px" }}>
                          Auth invited{" "}
                          {new Date(u.invitedAt).toLocaleDateString()}
                        </small>
                      ) : (
                        <small
                          style={{
                            display: "block",
                            marginTop: "4px",
                            opacity: 0.7,
                          }}
                        >
                          Direct Auth record
                        </small>
                      )}
                    </td>

                    <td>
                      <span
                        className="record-status"
                        style={{
                          display: "inline-block",
                          marginBottom: "4px",
                          color:
                            accessBadge.tone === "gold"
                              ? "var(--gold)"
                              : accessBadge.tone === "green"
                                ? "#6ee7b7"
                                : accessBadge.tone === "red"
                                  ? "#fca5a5"
                                  : "inherit",
                        }}
                      >
                        {accessBadge.label}
                      </span>
                      <small style={{ display: "block" }}>
                        MFA:{" "}
                        <strong
                          style={{
                            color: mfaBadge.verified ? "#6ee7b7" : "inherit",
                          }}
                        >
                          {mfaBadge.label}
                        </strong>
                      </small>
                      {u.accessRevokedAt && (
                        <small
                          style={{
                            display: "block",
                            color: "#fca5a5",
                            marginTop: "2px",
                          }}
                        >
                          Revoked{" "}
                          {new Date(u.accessRevokedAt).toLocaleDateString()}
                        </small>
                      )}
                    </td>

                    <td>
                      <PlatformRoleActions
                        canAssignPlatformAdmin={canAssignPlatformAdmin}
                        emailConfirmed={Boolean(u.emailConfirmedAt)}
                        roles={u.platformRoles}
                        userId={u.userId}
                      />
                    </td>

                    {isSuperAdminActor && (
                      <td>
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "6px",
                            minWidth: "185px",
                          }}
                        >
                          {u.canRevokeAccess && (
                            <button
                              className="button-secondary"
                              onClick={() => {
                                setRevokeTarget(u);
                                setRevokeReason("");
                              }}
                              type="button"
                            >
                              Revoke Access / Disable
                            </button>
                          )}

                          {u.canRestoreAccess && (
                            <button
                              className="button-secondary"
                              onClick={() => setRestoreTarget(u)}
                              type="button"
                            >
                              Restore Access
                            </button>
                          )}

                          {u.canPermanentlyDelete ? (
                            <button
                              className="button-secondary"
                              onClick={() => {
                                setDeleteTarget(u);
                                setConfirmationEmail("");
                                setTypedConfirmation("");
                              }}
                              style={{
                                borderColor: "rgba(239, 68, 68, 0.55)",
                                color: "#fca5a5",
                              }}
                              type="button"
                            >
                              Permanently Delete User
                            </button>
                          ) : (
                            <small
                              style={{
                                fontSize: "11px",
                                opacity: 0.75,
                                lineHeight: 1.35,
                              }}
                            >
                              {u.permanentDeleteBlockReason}
                            </small>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination Footer */}
      {pagination.totalPages > 1 && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: "14px",
          }}
        >
          <small>
            Page <strong>{pagination.page}</strong> of{" "}
            <strong>{pagination.totalPages}</strong>
          </small>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              className="button-secondary"
              disabled={pagination.page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              type="button"
            >
              Previous
            </button>
            <button
              className="button-secondary"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() =>
                setPage((p) => Math.min(pagination.totalPages, p + 1))
              }
              type="button"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Modal 1: Revoke Access / Disable Account */}
      {revokeTarget && (
        <div
          aria-labelledby="revoke-modal-title"
          aria-modal="true"
          role="dialog"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(5, 8, 15, 0.82)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
            zIndex: 1000,
          }}
        >
          <div
            className="module-panel"
            style={{
              maxWidth: "540px",
              width: "100%",
              border: "1px solid rgba(245, 158, 11, 0.45)",
            }}
          >
            <p className="eyebrow">REVERSIBLE ACCESS REVOCATION</p>
            <h3 id="revoke-modal-title" style={{ marginTop: "4px" }}>
              Revoke Access / Disable Account
            </h3>
            <p>
              You are disabling workspace access for{" "}
              <strong>{revokeTarget.email}</strong>.
            </p>
            <ul style={{ fontSize: "13px", lineHeight: 1.5, paddingLeft: "18px" }}>
              <li>
                Active global platform roles and pending invitations for this
                email will be revoked.
              </li>
              <li>
                The Supabase Auth account will be banned from signing in or
                accessing <code>/admin</code> and <code>/portal</code>.
              </li>
              <li>
                <strong>Preserved:</strong> The Supabase Auth identity,
                organizations, projects, invoices, support tickets, and audit
                history are preserved intact.
              </li>
            </ul>
            <form action={revokeAction}>
              <input
                name="target-user-id"
                type="hidden"
                value={revokeTarget.userId}
              />
              <div style={{ marginTop: "12px" }}>
                <label
                  htmlFor="revoke-reason-input"
                  style={{ display: "block", fontSize: "12px", marginBottom: "4px" }}
                >
                  Audit reason (optional)
                </label>
                <input
                  id="revoke-reason-input"
                  name="reason"
                  onChange={(e) => setRevokeReason(e.target.value)}
                  placeholder="e.g., Access revoked after engagement completion"
                  style={{ width: "100%" }}
                  type="text"
                  value={revokeReason}
                />
              </div>
              {revokeState.error && (
                <p className="module-alert" role="alert" style={{ marginTop: "10px" }}>
                  {revokeState.error}
                </p>
              )}
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "10px",
                  marginTop: "16px",
                }}
              >
                <button
                  className="button-secondary"
                  disabled={revokePending}
                  onClick={() => setRevokeTarget(null)}
                  type="button"
                >
                  Cancel
                </button>
                <button
                  className="button-primary"
                  disabled={revokePending}
                  type="submit"
                >
                  {revokePending
                    ? "Revoking Access…"
                    : "Confirm Revoke & Disable"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Restore Access */}
      {restoreTarget && (
        <div
          aria-labelledby="restore-modal-title"
          aria-modal="true"
          role="dialog"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(5, 8, 15, 0.82)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
            zIndex: 1000,
          }}
        >
          <div className="module-panel" style={{ maxWidth: "480px", width: "100%" }}>
            <p className="eyebrow">RESTORE ACCOUNT SIGN-IN</p>
            <h3 id="restore-modal-title" style={{ marginTop: "4px" }}>
              Restore Account Access
            </h3>
            <p>
              Remove the sign-in ban for <strong>{restoreTarget.email}</strong>?
              Previously revoked platform roles remain unassigned until you
              explicitly grant a role.
            </p>
            <form action={restoreAction}>
              <input
                name="target-user-id"
                type="hidden"
                value={restoreTarget.userId}
              />
              {restoreState.error && (
                <p className="module-alert" role="alert">
                  {restoreState.error}
                </p>
              )}
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "10px",
                  marginTop: "16px",
                }}
              >
                <button
                  className="button-secondary"
                  disabled={restorePending}
                  onClick={() => setRestoreTarget(null)}
                  type="button"
                >
                  Cancel
                </button>
                <button
                  className="button-primary"
                  disabled={restorePending}
                  type="submit"
                >
                  {restorePending ? "Restoring…" : "Restore Sign-In Access"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 3: Permanently Delete Supabase Auth User */}
      {deleteTarget && (
        <div
          aria-labelledby="delete-modal-title"
          aria-modal="true"
          role="dialog"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(5, 8, 15, 0.86)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
            zIndex: 1000,
          }}
        >
          <div
            className="module-panel"
            style={{
              maxWidth: "600px",
              width: "100%",
              border: "1px solid rgba(239, 68, 68, 0.65)",
            }}
          >
            <p className="eyebrow" style={{ color: "#fca5a5" }}>
              IRREVERSIBLE SUPABASE AUTH DELETION
            </p>
            <h3 id="delete-modal-title" style={{ marginTop: "4px" }}>
              Permanently Delete User Account
            </h3>
            <p>
              You are about to permanently delete{" "}
              <strong>{deleteTarget.email}</strong> (
              <code>{deleteTarget.userId}</code>) from{" "}
              <strong>Supabase Auth</strong> (<code>auth.users</code>) and{" "}
              <code>public.profiles</code>.
            </p>

            <div
              style={{
                padding: "12px",
                borderRadius: "8px",
                background: "rgba(239, 68, 68, 0.08)",
                border: "1px solid rgba(239, 68, 68, 0.3)",
                fontSize: "13px",
                marginBottom: "14px",
              }}
            >
              <strong>Consequences of permanent deletion:</strong>
              <ul style={{ margin: "6px 0 0", paddingLeft: "18px", lineHeight: 1.5 }}>
                <li>
                  <strong>Permanently deleted:</strong> Supabase Auth identity (
                  <code>auth.users</code>), <code>public.profiles</code> row,
                  user notifications, and platform role assignments for this
                  user.
                </li>
                <li>
                  <strong>Retained &amp; preserved:</strong> All organizations,
                  projects, tasks, documents, invoices, payments, support
                  records, and <code>audit_events</code> history are preserved
                  (nullable creator/actor references are detached to{" "}
                  <code>NULL</code>).
                </li>
                <li>
                  <strong>Irreversible:</strong> This action cannot be undone.
                  If you only want to block sign-in, cancel and choose{" "}
                  <em>Revoke Access / Disable</em> instead.
                </li>
              </ul>
            </div>

            <form action={deleteAction}>
              <input
                name="target-user-id"
                type="hidden"
                value={deleteTarget.userId}
              />

              <div style={{ marginBottom: "12px" }}>
                <label
                  htmlFor="delete-confirm-email"
                  style={{ display: "block", fontSize: "12px", marginBottom: "4px" }}
                >
                  Step 1 — Enter the target user&apos;s exact email:{" "}
                  <code>{deleteTarget.email}</code>
                </label>
                <input
                  autoComplete="off"
                  id="delete-confirm-email"
                  name="confirmation-email"
                  onChange={(e) => setConfirmationEmail(e.target.value)}
                  placeholder={deleteTarget.email}
                  required
                  style={{ width: "100%" }}
                  type="email"
                  value={confirmationEmail}
                />
              </div>

              <div style={{ marginBottom: "12px" }}>
                <label
                  htmlFor="delete-typed-phrase"
                  style={{ display: "block", fontSize: "12px", marginBottom: "4px" }}
                >
                  Step 2 — Type{" "}
                  <code>{formatExpectedDeleteConfirmation(deleteTarget.email)}</code>{" "}
                  to confirm permanent deletion:
                </label>
                <input
                  autoComplete="off"
                  id="delete-typed-phrase"
                  name="typed-confirmation"
                  onChange={(e) => setTypedConfirmation(e.target.value)}
                  placeholder={formatExpectedDeleteConfirmation(deleteTarget.email)}
                  required
                  style={{ width: "100%" }}
                  type="text"
                  value={typedConfirmation}
                />
              </div>

              {deleteState.error && (
                <p className="module-alert" role="alert" style={{ marginBottom: "12px" }}>
                  {deleteState.error}
                </p>
              )}

              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "10px",
                  marginTop: "16px",
                }}
              >
                <button
                  className="button-secondary"
                  disabled={deletePending}
                  onClick={() => {
                    setDeleteTarget(null);
                    setConfirmationEmail("");
                    setTypedConfirmation("");
                  }}
                  type="button"
                >
                  Cancel
                </button>
                <button
                  className="button-primary"
                  disabled={!isDeleteConfirmationReady || deletePending}
                  style={{
                    background: isDeleteConfirmationReady
                      ? "#dc2626"
                      : "rgba(220, 38, 38, 0.35)",
                    borderColor: "#dc2626",
                    color: "#fff",
                  }}
                  type="submit"
                >
                  {deletePending
                    ? "Permanently Deleting…"
                    : "Permanently Delete Auth User"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}


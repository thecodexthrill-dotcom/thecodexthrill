"use client";

import { type FormEvent, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PlatformRoleActions } from "@/components/platform/platform-role-actions";
import {
  permanentlyDeleteUserAction,
  refreshUserDirectoryAction,
  restoreUserAccessAction,
  revokeUserAccessAction,
} from "@/lib/supabase/actions";
import {
  filterAndPaginateDirectoryUsers,
  formatExpectedDeleteConfirmation,
  matchesConfirmationEmail,
  matchesDeleteConfirmationPhrase,
  type SuperAdminDirectoryUser,
  type UserAccessStatus,
  type UserDiagnosticCategory,
  type UserMfaSummaryStatus,
} from "@/lib/supabase/user-management-helper";

type AccessOverride = {
  accessStatus: UserAccessStatus;
  isBanned: boolean;
  accessRevokedAt: string | null;
  canRevokeAccess: boolean;
  canRestoreAccess: boolean;
  platformRoles?: string[];
  revokedPlatformRoles?: string[];
};

function formatAccessStatusBadge(status: UserAccessStatus): {
  label: string;
  badgeClass: string;
} {
  switch (status) {
    case "protected_owner":
      return { label: "Protected Owner", badgeClass: "um-badge um-badge-gold" };
    case "active":
      return { label: "Active Access", badgeClass: "um-badge um-badge-green" };
    case "disabled":
      return { label: "Disabled / Revoked", badgeClass: "um-badge um-badge-red" };
    case "pending_verification":
      return { label: "Pending Verification", badgeClass: "um-badge um-badge-amber" };
    case "no_workspace_role":
      return { label: "No Active Role", badgeClass: "um-badge um-badge-muted" };
  }
}

function formatDiagnosticBadge(category: UserDiagnosticCategory): {
  label: string;
  badgeClass: string;
} {
  switch (category) {
    case "real_or_active_account":
      return {
        label: "Verified Account",
        badgeClass: "um-badge um-badge-green",
      };
    case "confirmed_test_account":
      return {
        label: "Test Artifact",
        badgeClass: "um-badge um-badge-amber",
      };
    case "unknown_unassigned_account":
      return {
        label: "Needs Review",
        badgeClass: "um-badge um-badge-muted",
      };
  }
}

function formatMfaBadge(user: SuperAdminDirectoryUser): {
  label: string;
  badgeClass: string;
} {
  if (user.mfaStatus === "verified_totp") {
    return {
      label: `MFA: Verified TOTP (${user.verifiedTotpCount})`,
      badgeClass: "um-badge um-badge-green",
    };
  }
  if (user.mfaStatus === "unverified_factor") {
    return {
      label: `MFA: Unverified Factor (${user.totalFactorCount})`,
      badgeClass: "um-badge um-badge-amber",
    };
  }
  if (user.mfaStatus === "unavailable") {
    return {
      label: "MFA: Status Unavailable",
      badgeClass: "um-badge um-badge-muted",
    };
  }
  return {
    label: "MFA: No Factor Enrolled",
    badgeClass: "um-badge um-badge-muted",
  };
}

function formatShortTimestamp(iso: string | null): string {
  if (!iso) return "Never signed in";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
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

  // Optimistic / verified client state overrides so deletions & revocations reflect immediately
  const [deletedUserIds, setDeletedUserIds] = useState<string[]>([]);
  const [accessOverrides, setAccessOverrides] = useState<
    Record<string, AccessOverride>
  >({});
  const [actionBanner, setActionBanner] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Filters & Pagination
  const [search, setSearch] = useState("");
  const [accessStatus, setAccessStatus] = useState<"all" | UserAccessStatus>(
    "all",
  );
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
  const [mfaFilter, setMfaFilter] = useState<"all" | UserMfaSummaryStatus>(
    "all",
  );
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Modal state & submission states
  const [revokeTarget, setRevokeTarget] =
    useState<SuperAdminDirectoryUser | null>(null);
  const [revokeReason, setRevokeReason] = useState("");
  const [isRevoking, setIsRevoking] = useState(false);

  const [restoreTarget, setRestoreTarget] =
    useState<SuperAdminDirectoryUser | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);

  const [deleteTarget, setDeleteTarget] =
    useState<SuperAdminDirectoryUser | null>(null);
  const [confirmationEmail, setConfirmationEmail] = useState("");
  const [typedConfirmation, setTypedConfirmation] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const [modalError, setModalError] = useState<string | null>(null);

  // Effective directory users after applying verified local deletions/revocations
  const effectiveUsers = useMemo(() => {
    const deletedSet = new Set(deletedUserIds);
    return users
      .filter((u) => !deletedSet.has(u.userId))
      .map((u) => {
        const override = accessOverrides[u.userId];
        if (!override) return u;
        return {
          ...u,
          accessStatus: override.accessStatus,
          isBanned: override.isBanned,
          accessRevokedAt: override.accessRevokedAt,
          canRevokeAccess: override.canRevokeAccess,
          canRestoreAccess: override.canRestoreAccess,
          platformRoles: override.platformRoles ?? u.platformRoles,
          revokedPlatformRoles:
            override.revokedPlatformRoles ?? u.revokedPlatformRoles,
        };
      });
  }, [users, deletedUserIds, accessOverrides]);

  const counts = useMemo(() => {
    let realOrActive = 0;
    let confirmedTest = 0;
    let unknownUnassigned = 0;
    let disabledCount = 0;
    let verifiedMfaCount = 0;
    for (const u of effectiveUsers) {
      if (u.diagnosticCategory === "real_or_active_account") realOrActive += 1;
      if (u.diagnosticCategory === "confirmed_test_account") confirmedTest += 1;
      if (u.diagnosticCategory === "unknown_unassigned_account")
        unknownUnassigned += 1;
      if (u.accessStatus === "disabled") disabledCount += 1;
      if (u.mfaStatus === "verified_totp") verifiedMfaCount += 1;
    }
    return {
      total: effectiveUsers.length,
      realOrActive,
      confirmedTest,
      unknownUnassigned,
      disabledCount,
      verifiedMfaCount,
    };
  }, [effectiveUsers]);

  const pagination = useMemo(
    () =>
      filterAndPaginateDirectoryUsers(effectiveUsers, {
        search,
        accessStatus,
        roleFilter,
        diagnosticFilter,
        mfaFilter,
        page,
        pageSize,
      }),
    [
      effectiveUsers,
      search,
      accessStatus,
      roleFilter,
      diagnosticFilter,
      mfaFilter,
      page,
      pageSize,
    ],
  );

  const step1EmailMatched = useMemo(() => {
    if (!deleteTarget) return false;
    return matchesConfirmationEmail(deleteTarget.email, confirmationEmail);
  }, [deleteTarget, confirmationEmail]);

  const step2PhraseMatched = useMemo(() => {
    if (!deleteTarget) return false;
    return matchesDeleteConfirmationPhrase(
      deleteTarget.email,
      typedConfirmation,
    );
  }, [deleteTarget, typedConfirmation]);

  const isDeleteConfirmationReady = step1EmailMatched && step2PhraseMatched;

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

  const openRevokeModal = (u: SuperAdminDirectoryUser) => {
    setModalError(null);
    setRevokeReason("");
    setRevokeTarget(u);
  };

  const closeRevokeModal = () => {
    if (isRevoking) return;
    setModalError(null);
    setRevokeReason("");
    setRevokeTarget(null);
  };

  const openRestoreModal = (u: SuperAdminDirectoryUser) => {
    setModalError(null);
    setRestoreTarget(u);
  };

  const closeRestoreModal = () => {
    if (isRestoring) return;
    setModalError(null);
    setRestoreTarget(null);
  };

  const openDeleteModal = (u: SuperAdminDirectoryUser) => {
    setModalError(null);
    setConfirmationEmail("");
    setTypedConfirmation("");
    setDeleteTarget(u);
  };

  const closeDeleteModal = () => {
    if (isDeleting) return;
    setModalError(null);
    setConfirmationEmail("");
    setTypedConfirmation("");
    setDeleteTarget(null);
  };

  const handleRevokeSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!revokeTarget || isRevoking) return;
    setModalError(null);
    setIsRevoking(true);

    try {
      const formData = new FormData();
      formData.set("target-user-id", revokeTarget.userId);
      formData.set("reason", revokeReason.trim());

      const result = await revokeUserAccessAction({}, formData);
      if (result.error) {
        setModalError(result.error);
        return;
      }

      const targetId = result.revokedUserId ?? revokeTarget.userId;
      setAccessOverrides((prev) => ({
        ...prev,
        [targetId]: {
          accessStatus: "disabled",
          isBanned: true,
          accessRevokedAt: new Date().toISOString(),
          canRevokeAccess: false,
          canRestoreAccess: true,
          platformRoles: [],
          revokedPlatformRoles: Array.from(
            new Set([
              ...revokeTarget.revokedPlatformRoles,
              ...revokeTarget.platformRoles,
            ]),
          ),
        },
      }));
      setActionBanner({
        type: "success",
        text:
          result.message ??
          `Access revoked and account disabled for ${revokeTarget.email}.`,
      });
      setRevokeTarget(null);
      setRevokeReason("");
      router.refresh();
    } catch {
      setModalError(
        "Unable to complete the access revocation request. Verify your network connection and AAL2 session.",
      );
    } finally {
      setIsRevoking(false);
    }
  };

  const handleRestoreSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!restoreTarget || isRestoring) return;
    setModalError(null);
    setIsRestoring(true);

    try {
      const formData = new FormData();
      formData.set("target-user-id", restoreTarget.userId);

      const result = await restoreUserAccessAction({}, formData);
      if (result.error) {
        setModalError(result.error);
        return;
      }

      const targetId = result.restoredUserId ?? restoreTarget.userId;
      const nextStatus: UserAccessStatus = !restoreTarget.emailConfirmedAt
        ? "pending_verification"
        : restoreTarget.platformRoles.length > 0 ||
            restoreTarget.organizations.some(
              (o) => o.membershipStatus === "active",
            )
          ? "active"
          : "no_workspace_role";

      setAccessOverrides((prev) => ({
        ...prev,
        [targetId]: {
          accessStatus: nextStatus,
          isBanned: false,
          accessRevokedAt: null,
          canRevokeAccess: true,
          canRestoreAccess: false,
        },
      }));
      setActionBanner({
        type: "success",
        text:
          result.message ??
          `Sign-in ban removed for ${restoreTarget.email}.`,
      });
      setRestoreTarget(null);
      router.refresh();
    } catch {
      setModalError(
        "Unable to complete the access restoration request. Verify your network connection and AAL2 session.",
      );
    } finally {
      setIsRestoring(false);
    }
  };

  const handlePermanentDeleteSubmit = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    if (!deleteTarget || isDeleting) return;

    if (!step1EmailMatched) {
      setModalError(
        `Step 1 failed: Enter the exact email address (${deleteTarget.email}).`,
      );
      return;
    }

    if (!step2PhraseMatched) {
      setModalError(
        `Step 2 failed: Type ${formatExpectedDeleteConfirmation(deleteTarget.email)} exactly.`,
      );
      return;
    }

    setModalError(null);
    setIsDeleting(true);

    try {
      const formData = new FormData();
      formData.set("target-user-id", deleteTarget.userId);
      formData.set("confirmation-email", confirmationEmail.trim());
      formData.set("typed-confirmation", typedConfirmation.trim());

      const result = await permanentlyDeleteUserAction({}, formData);
      if (result.error) {
        setModalError(result.error);
        return;
      }

      const removedId = result.deletedUserId ?? deleteTarget.userId;
      setDeletedUserIds((prev) =>
        prev.includes(removedId) ? prev : [...prev, removedId],
      );
      setActionBanner({
        type: "success",
        text:
          result.message ??
          `Permanently deleted ${deleteTarget.email} from Supabase Auth.`,
      });
      setDeleteTarget(null);
      setConfirmationEmail("");
      setTypedConfirmation("");
      router.refresh();
    } catch {
      setModalError(
        "Permanent deletion request failed before completion. Verify your AAL2 session and try again.",
      );
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <section className="module-panel um-panel">
      {/* Section Header */}
      <div className="um-header">
        <div className="um-header-copy">
          <p className="eyebrow">SUPER ADMIN IDENTITY &amp; ACCESS GOVERNANCE</p>
          <h2>Supabase Auth &amp; Platform User Directory</h2>
          <p>
            Live inventory of Supabase Auth accounts, global platform roles,
            client organization memberships, and MFA posture. Access revocation
            blocks sign-in while preserving historical records; permanent
            deletion removes the Supabase Auth identity and requires an active
            Super Admin MFA (AAL2) session.
          </p>
        </div>
        <div className="um-header-actions">
          {lastRefreshedAt && (
            <span className="um-refresh-stamp">
              Synced {new Date(lastRefreshedAt).toLocaleTimeString()}
            </span>
          )}
          <button
            className="button-secondary button-small"
            disabled={isRefreshing}
            onClick={handleRefresh}
            type="button"
          >
            {isRefreshing ? "Syncing Directory…" : "Refresh Directory"}
          </button>
        </div>
      </div>

      {/* Dismissible Action Feedback Banner */}
      {actionBanner && (
        <div
          className={
            actionBanner.type === "success" ? "module-success" : "module-alert"
          }
          role={actionBanner.type === "success" ? "status" : "alert"}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
          }}
        >
          <span>{actionBanner.text}</span>
          <button
            className="button-secondary button-small"
            onClick={() => setActionBanner(null)}
            type="button"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Compact KPI Summary Grid */}
      <div className="um-kpi-grid">
        <div className="um-kpi-card um-kpi-card--gold">
          <span className="um-kpi-label">Total Auth Users</span>
          <strong className="um-kpi-value">{counts.total}</strong>
          <span className="um-kpi-sub">
            {counts.verifiedMfaCount} with verified TOTP MFA
          </span>
        </div>
        <div className="um-kpi-card">
          <span className="um-kpi-label">Verified &amp; Active</span>
          <strong className="um-kpi-value" style={{ color: "#6ee7b7" }}>
            {counts.realOrActive}
          </strong>
          <span className="um-kpi-sub">
            Protected Owner, Staff &amp; Active Clients
          </span>
        </div>
        <div className="um-kpi-card">
          <span className="um-kpi-label">Test Artifacts</span>
          <strong className="um-kpi-value" style={{ color: "#fcd34d" }}>
            {counts.confirmedTest}
          </strong>
          <span className="um-kpi-sub">
            Flagged for review (never auto-deleted)
          </span>
        </div>
        <div className="um-kpi-card">
          <span className="um-kpi-label">Pending / Review</span>
          <strong className="um-kpi-value" style={{ color: "var(--gold-bright)" }}>
            {counts.unknownUnassigned}
          </strong>
          <span className="um-kpi-sub">
            {counts.disabledCount} disabled or revoked
          </span>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="um-toolbar">
        <div className="um-filter-field">
          <label htmlFor="user-dir-search">
            Search email, name, UUID, or organization
          </label>
          <input
            id="user-dir-search"
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search directory…"
            type="search"
            value={search}
          />
        </div>

        <div className="um-filter-field">
          <label htmlFor="user-dir-access">Access Status</label>
          <select
            id="user-dir-access"
            onChange={(e) => {
              setAccessStatus(e.target.value as "all" | UserAccessStatus);
              setPage(1);
            }}
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

        <div className="um-filter-field">
          <label htmlFor="user-dir-role">Role / Scope</label>
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

        <div className="um-filter-field">
          <label htmlFor="user-dir-diag">Classification</label>
          <select
            id="user-dir-diag"
            onChange={(e) => {
              setDiagnosticFilter(
                e.target.value as "all" | UserDiagnosticCategory,
              );
              setPage(1);
            }}
            value={diagnosticFilter}
          >
            <option value="all">All classifications</option>
            <option value="real_or_active_account">
              Verified / Active ({counts.realOrActive})
            </option>
            <option value="confirmed_test_account">
              Test Artifacts ({counts.confirmedTest})
            </option>
            <option value="unknown_unassigned_account">
              Pending / Review ({counts.unknownUnassigned})
            </option>
          </select>
        </div>

        <div className="um-filter-field">
          <label htmlFor="user-dir-mfa">MFA Posture</label>
          <select
            id="user-dir-mfa"
            onChange={(e) => {
              setMfaFilter(e.target.value as "all" | UserMfaSummaryStatus);
              setPage(1);
            }}
            value={mfaFilter}
          >
            <option value="all">All MFA states</option>
            <option value="verified_totp">Verified TOTP</option>
            <option value="unverified_factor">Unverified Factor</option>
            <option value="no_mfa">No Factor Enrolled</option>
          </select>
        </div>
      </div>

      {/* Filter Summary Bar */}
      <div className="um-summary-bar">
        <span>
          Showing <strong>{pagination.paginatedUsers.length}</strong> of{" "}
          <strong>{pagination.filteredCount}</strong> matching accounts (total{" "}
          <strong>{pagination.totalCount}</strong> in Supabase Auth)
        </span>
        <div className="um-summary-controls">
          {(search ||
            accessStatus !== "all" ||
            roleFilter !== "all" ||
            diagnosticFilter !== "all" ||
            mfaFilter !== "all") && (
            <button
              className="button-secondary button-small"
              onClick={resetFilters}
              type="button"
            >
              Reset Filters
            </button>
          )}
          <label htmlFor="user-dir-pagesize">Rows:</label>
          <select
            className="um-pagesize-select"
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

      {/* Directory Table */}
      {directoryError ? (
        <p className="module-alert" role="alert">
          {directoryError}
        </p>
      ) : pagination.paginatedUsers.length === 0 ? (
        <div className="module-empty">
          <p>No user accounts match the current filter criteria.</p>
        </div>
      ) : (
        <div
          className="um-table-wrap"
          style={{ opacity: isRefreshing ? 0.65 : 1, transition: "opacity 150ms ease" }}
        >
          <table className="um-table">
            <thead>
              <tr>
                <th>User Identity</th>
                <th>Activity</th>
                <th>Roles &amp; Organizations</th>
                <th>Verification &amp; MFA</th>
                <th>Access &amp; Role Assignment</th>
                {isSuperAdminActor && <th>Governance</th>}
              </tr>
            </thead>
            <tbody>
              {pagination.paginatedUsers.map((u) => {
                const diag = formatDiagnosticBadge(u.diagnosticCategory);
                const accessBadge = formatAccessStatusBadge(u.accessStatus);
                const mfaBadge = formatMfaBadge(u);
                const latestInvite = u.invitations[0] ?? null;

                return (
                  <tr key={u.userId}>
                    {/* Column 1: User Identity */}
                    <td className="um-cell-identity">
                      <span className="um-user-name">
                        {u.displayName || u.email.split("@")[0]}
                      </span>
                      <span className="um-user-email">{u.email}</span>
                      <div className="um-user-meta-row">
                        <span className="um-user-id" title={u.userId}>
                          ID: {u.userId.slice(0, 8)}…
                        </span>
                        <span
                          className={diag.badgeClass}
                          title={u.diagnosticSignals.join(" • ")}
                        >
                          {diag.label}
                        </span>
                      </div>
                    </td>

                    {/* Column 2: Activity */}
                    <td className="um-cell-activity">
                      <span className="um-meta-line">
                        <strong>Created:</strong>{" "}
                        {formatShortTimestamp(u.createdAt)}
                      </span>
                      <span className="um-meta-line">
                        <strong>Last login:</strong>{" "}
                        {formatShortTimestamp(u.lastSignInAt)}
                      </span>
                    </td>

                    {/* Column 3: Roles & Organizations */}
                    <td className="um-cell-roles">
                      <div className="um-badge-stack">
                        {u.isSuperAdmin ? (
                          <span className="um-badge um-badge-gold">
                            Global Super Admin
                          </span>
                        ) : u.platformRoles.length > 0 ? (
                          u.platformRoles.map((role) => (
                            <span
                              className="um-badge um-badge-gold"
                              key={role}
                              style={{ textTransform: "capitalize" }}
                            >
                              {role.replaceAll("_", " ")}
                            </span>
                          ))
                        ) : (
                          <span className="um-meta-line">No platform role</span>
                        )}
                      </div>

                      {u.revokedPlatformRoles.length > 0 && (
                        <span
                          className="um-meta-line"
                          style={{ marginTop: "4px", color: "#fca5a5" }}
                        >
                          Revoked:{" "}
                          {u.revokedPlatformRoles
                            .map((r) => r.replaceAll("_", " "))
                            .join(", ")}
                        </span>
                      )}

                      {u.organizations.length > 0 && (
                        <div style={{ marginTop: "6px" }}>
                          {u.organizations.map((org) => (
                            <div
                              className="um-org-item"
                              key={org.organizationId}
                            >
                              <strong>{org.organizationName}</strong>{" "}
                              <span style={{ color: "var(--subtle)" }}>
                                ({org.membershipStatus})
                              </span>
                              <span
                                className="um-meta-line"
                                style={{ textTransform: "capitalize" }}
                              >
                                {org.roles.length > 0
                                  ? org.roles
                                      .map((r) => r.replaceAll("_", " "))
                                      .join(", ")
                                  : "Member"}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </td>

                    {/* Column 4: Verification & MFA */}
                    <td className="um-cell-security">
                      <div className="um-badge-stack">
                        <span
                          className={
                            u.emailConfirmedAt
                              ? "um-badge um-badge-green"
                              : "um-badge um-badge-amber"
                          }
                        >
                          {u.emailConfirmedAt
                            ? "Email Confirmed"
                            : "Email Unconfirmed"}
                        </span>

                        <span className={mfaBadge.badgeClass}>
                          {mfaBadge.label}
                        </span>

                        {u.isCurrentSessionUser &&
                          u.currentSessionAal === "aal2" && (
                            <span className="um-badge um-badge-gold">
                              Session: AAL2 Verified
                            </span>
                          )}
                      </div>

                      <span className="um-meta-line" style={{ marginTop: "5px" }}>
                        {latestInvite ? (
                          <>
                            Invite: <strong>{latestInvite.status}</strong> (
                            {latestInvite.role.replaceAll("_", " ")})
                          </>
                        ) : u.invitedAt ? (
                          <>
                            Invited{" "}
                            {new Date(u.invitedAt).toLocaleDateString()}
                          </>
                        ) : (
                          "Direct Auth account"
                        )}
                      </span>
                    </td>

                    {/* Column 5: Access Status & Role Assignment */}
                    <td className="um-cell-assignment">
                      <div className="um-badge-stack">
                        <span className={accessBadge.badgeClass}>
                          {accessBadge.label}
                        </span>
                      </div>
                      {u.accessRevokedAt && (
                        <span
                          className="um-meta-line"
                          style={{ color: "#fca5a5", marginTop: "4px" }}
                        >
                          Revoked{" "}
                          {new Date(u.accessRevokedAt).toLocaleDateString()}
                        </span>
                      )}
                      {!u.isSuperAdmin && (
                        <PlatformRoleActions
                          canAssignPlatformAdmin={canAssignPlatformAdmin}
                          emailConfirmed={Boolean(u.emailConfirmedAt)}
                          roles={u.platformRoles}
                          userId={u.userId}
                        />
                      )}
                    </td>

                    {/* Column 6: Super Admin Governance Actions */}
                    {isSuperAdminActor && (
                      <td className="um-cell-actions">
                        <div className="um-action-stack">
                          {u.canRevokeAccess && (
                            <button
                              className="button-secondary button-small"
                              onClick={() => openRevokeModal(u)}
                              type="button"
                            >
                              Revoke Access
                            </button>
                          )}

                          {u.canRestoreAccess && (
                            <button
                              className="button-secondary button-small"
                              onClick={() => openRestoreModal(u)}
                              type="button"
                            >
                              Restore Access
                            </button>
                          )}

                          {u.canPermanentlyDelete ? (
                            <button
                              className="button-danger button-small"
                              onClick={() => openDeleteModal(u)}
                              type="button"
                            >
                              Delete User
                            </button>
                          ) : (
                            <span className="um-protection-note">
                              {u.isProtectedOwner
                                ? "Protected Owner account"
                                : u.isCurrentSessionUser
                                  ? "Active Super Admin session"
                                  : u.permanentDeleteBlockReason}
                            </span>
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
        <div className="um-pagination">
          <span>
            Page <strong>{pagination.page}</strong> of{" "}
            <strong>{pagination.totalPages}</strong>
          </span>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              className="button-secondary button-small"
              disabled={pagination.page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              type="button"
            >
              Previous
            </button>
            <button
              className="button-secondary button-small"
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
          className="workspace-dialog-backdrop"
          onClick={closeRevokeModal}
          onKeyDown={(e) => {
            if (e.key === "Escape") closeRevokeModal();
          }}
          role="dialog"
        >
          <div
            className="um-modal-card um-modal-card--warning"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="eyebrow">REVERSIBLE ACCESS REVOCATION</p>
            <h3 id="revoke-modal-title" style={{ margin: "4px 0 6px" }}>
              Revoke Access / Disable Account
            </h3>
            <div className="um-modal-target">
              <strong>
                {revokeTarget.displayName || revokeTarget.email.split("@")[0]}
              </strong>
              <span>{revokeTarget.email}</span>
              <code>ID: {revokeTarget.userId}</code>
            </div>
            <ul className="um-modal-list">
              <li>
                Revokes active global platform roles and pending invitations.
              </li>
              <li>
                Applies a Supabase Auth sign-in ban blocking{" "}
                <code>/admin</code> and <code>/portal</code> access.
              </li>
              <li>
                <strong>Preserved:</strong> Auth identity, organizations,
                projects, invoices, support records, and audit history remain
                intact.
              </li>
            </ul>
            <form onSubmit={handleRevokeSubmit}>
              <div className="um-step-field">
                <label className="um-step-header" htmlFor="revoke-reason-input">
                  <span>Audit reason (optional)</span>
                </label>
                <input
                  className="um-step-input"
                  disabled={isRevoking}
                  id="revoke-reason-input"
                  name="reason"
                  onChange={(e) => setRevokeReason(e.target.value)}
                  placeholder="e.g., Access revoked after engagement completion"
                  type="text"
                  value={revokeReason}
                />
              </div>

              {modalError && (
                <p className="module-alert" role="alert">
                  {modalError}
                </p>
              )}

              <div className="um-modal-actions">
                <button
                  className="button-secondary"
                  disabled={isRevoking}
                  onClick={closeRevokeModal}
                  type="button"
                >
                  Cancel
                </button>
                <button
                  className="button-gold"
                  disabled={isRevoking}
                  type="submit"
                >
                  {isRevoking ? "Revoking Access…" : "Confirm Revoke & Disable"}
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
          className="workspace-dialog-backdrop"
          onClick={closeRestoreModal}
          onKeyDown={(e) => {
            if (e.key === "Escape") closeRestoreModal();
          }}
          role="dialog"
        >
          <div
            className="um-modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="eyebrow">RESTORE ACCOUNT SIGN-IN</p>
            <h3 id="restore-modal-title" style={{ margin: "4px 0 6px" }}>
              Restore Account Access
            </h3>
            <div className="um-modal-target">
              <strong>
                {restoreTarget.displayName || restoreTarget.email.split("@")[0]}
              </strong>
              <span>{restoreTarget.email}</span>
              <code>ID: {restoreTarget.userId}</code>
            </div>
            <p style={{ color: "var(--muted)", fontSize: "12.5px", lineHeight: 1.55 }}>
              Removes the Supabase Auth sign-in ban for this account. Previously
              revoked platform roles remain unassigned until explicitly granted.
            </p>
            <form onSubmit={handleRestoreSubmit}>
              {modalError && (
                <p className="module-alert" role="alert">
                  {modalError}
                </p>
              )}
              <div className="um-modal-actions">
                <button
                  className="button-secondary"
                  disabled={isRestoring}
                  onClick={closeRestoreModal}
                  type="button"
                >
                  Cancel
                </button>
                <button
                  className="button-gold"
                  disabled={isRestoring}
                  type="submit"
                >
                  {isRestoring ? "Restoring…" : "Restore Sign-In Access"}
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
          className="workspace-dialog-backdrop"
          onClick={closeDeleteModal}
          onKeyDown={(e) => {
            if (e.key === "Escape") closeDeleteModal();
          }}
          role="dialog"
        >
          <div
            className="um-modal-card um-modal-card--danger"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="eyebrow" style={{ color: "#fca5a5" }}>
              IRREVERSIBLE SUPABASE AUTH DELETION
            </p>
            <h3 id="delete-modal-title" style={{ margin: "4px 0 6px" }}>
              Permanently Delete User Account
            </h3>

            <div className="um-modal-target">
              <strong>
                {deleteTarget.displayName || deleteTarget.email.split("@")[0]}
              </strong>
              <span>{deleteTarget.email}</span>
              <code>ID: {deleteTarget.userId}</code>
            </div>

            <ul className="um-modal-list">
              <li>
                <strong>Deleted permanently:</strong> Supabase Auth identity (
                <code>auth.users</code>), <code>public.profiles</code>,
                notifications, and platform role assignments.
              </li>
              <li>
                <strong>Preserved:</strong> Organizations, projects, invoices,
                payments, support tickets, and <code>audit_events</code> history
                remain intact.
              </li>
              <li>
                <strong>Irreversible:</strong> Cannot be undone. Use{" "}
                <em>Revoke Access</em> instead if you only want to block sign-in.
              </li>
            </ul>

            <form noValidate onSubmit={handlePermanentDeleteSubmit}>
              <input
                name="target-user-id"
                type="hidden"
                value={deleteTarget.userId}
              />

              <div className="um-step-field">
                <label
                  className="um-step-header"
                  htmlFor="delete-confirm-email"
                >
                  <span>
                    Step 1 — Enter exact email:{" "}
                    <code>{deleteTarget.email}</code>
                  </span>
                  <span
                    className={
                      step1EmailMatched
                        ? "um-badge um-badge-green"
                        : "um-badge um-badge-muted"
                    }
                  >
                    {step1EmailMatched ? "✓ Matched" : "Required"}
                  </span>
                </label>
                <input
                  autoComplete="off"
                  className={`um-step-input${step1EmailMatched ? " is-matched" : ""}`}
                  disabled={isDeleting}
                  id="delete-confirm-email"
                  inputMode="email"
                  name="confirmation-email"
                  onChange={(e) => {
                    setConfirmationEmail(e.target.value);
                    if (modalError) setModalError(null);
                  }}
                  placeholder={deleteTarget.email}
                  spellCheck={false}
                  type="text"
                  value={confirmationEmail}
                />
              </div>

              <div className="um-step-field">
                <label
                  className="um-step-header"
                  htmlFor="delete-typed-phrase"
                >
                  <span>
                    Step 2 — Type{" "}
                    <code>
                      {formatExpectedDeleteConfirmation(deleteTarget.email)}
                    </code>
                  </span>
                  <span
                    className={
                      step2PhraseMatched
                        ? "um-badge um-badge-green"
                        : "um-badge um-badge-muted"
                    }
                  >
                    {step2PhraseMatched ? "✓ Matched" : "Required"}
                  </span>
                </label>
                <input
                  autoComplete="off"
                  className={`um-step-input${step2PhraseMatched ? " is-matched" : ""}`}
                  disabled={isDeleting}
                  id="delete-typed-phrase"
                  name="typed-confirmation"
                  onChange={(e) => {
                    setTypedConfirmation(e.target.value);
                    if (modalError) setModalError(null);
                  }}
                  placeholder={formatExpectedDeleteConfirmation(
                    deleteTarget.email,
                  )}
                  spellCheck={false}
                  type="text"
                  value={typedConfirmation}
                />
              </div>

              {modalError && (
                <p className="module-alert" role="alert">
                  {modalError}
                </p>
              )}

              <div className="um-modal-actions">
                <button
                  className="button-secondary"
                  disabled={isDeleting}
                  onClick={closeDeleteModal}
                  type="button"
                >
                  Cancel
                </button>
                <button
                  className="button-danger"
                  disabled={!isDeleteConfirmationReady || isDeleting}
                  type="submit"
                >
                  {isDeleting
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

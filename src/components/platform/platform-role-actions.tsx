"use client";

import { useActionState } from "react";
import { setPlatformRoleAction, type AuthActionState } from "@/lib/supabase/actions";

export function PlatformRoleActions({ userId, roles, emailConfirmed, canAssignPlatformAdmin }: {
  userId: string;
  roles: string[];
  emailConfirmed: boolean;
  canAssignPlatformAdmin: boolean;
}) {
  const [state, action, pending] = useActionState(setPlatformRoleAction, {} as AuthActionState);
  const isSuperAdmin = roles.includes("super_admin");
  const platformRole = roles.find((role) => ["platform_admin", "developer", "support_staff"].includes(role)) ?? "";

  if (isSuperAdmin) return <span className="scope-tag scope-platform">Protected Owner</span>;
  return <div className="platform-role-actions">
    <form action={action} className="workspace-shortcuts">
      <input name="user-id" type="hidden" value={userId} />
      <label className="sr-only" htmlFor={`platform-role-${userId}`}>Platform role</label>
      <select id={`platform-role-${userId}`} name="role" defaultValue={platformRole} disabled={!emailConfirmed || pending}>
        <option value="">No platform role</option>
        {canAssignPlatformAdmin && <option value="platform_admin">Platform Admin</option>}
        <option value="developer">Developer</option>
        <option value="support_staff">Support Staff</option>
      </select>
      <button className="button-secondary" disabled={!emailConfirmed || pending} type="submit">{pending ? "Saving…" : "Save role"}</button>
    </form>
    {!emailConfirmed && <small>Confirm the invitation email before assigning access.</small>}
    {state.error && <p className="module-alert" role="alert">{state.error}</p>}
    {state.message && <p className="module-success" role="status">{state.message}</p>}
  </div>;
}
"use client";

import { useActionState } from "react";
import { inviteUserAction, type AuthActionState } from "@/lib/supabase/actions";

const initial: AuthActionState = {};

export function InvitationForm() {
  const [state, action, pending] = useActionState(inviteUserAction, initial);
  return <form action={action} className="auth-form lead-create-form">
    <label>Invite email<input autoComplete="email" name="email" type="email" required maxLength={320} /></label>
    <label>Platform role<select name="role" required defaultValue="developer"><option value="developer">Developer</option><option value="support_staff">Support staff</option><option value="platform_admin">Platform Admin (Super Admin only)</option></select></label>
    <button className="button-gold" disabled={pending} type="submit">{pending ? "Sending..." : "Send invitation"}</button>
    {state.error && <p className="module-alert" role="alert">{state.error}</p>}
    {state.message && <p className="module-success" role="status">{state.message}</p>}
  </form>;
}

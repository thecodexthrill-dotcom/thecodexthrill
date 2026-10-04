"use client";

import { useActionState } from "react";
import { resendPlatformInvitationAction, revokePlatformInvitationAction, type AuthActionState } from "@/lib/supabase/actions";

export function InvitationRowActions({ id, canRevoke }: { id: string; canRevoke: boolean }) {
  const [state, resendAction, pending] = useActionState(resendPlatformInvitationAction, {} as AuthActionState);
  return <div className="workspace-shortcuts">
    <form action={resendAction}><input type="hidden" name="id" value={id} /><button className="button-secondary" disabled={pending} type="submit">{pending ? "Sending…" : "Resend"}</button></form>
    {canRevoke && <form action={revokePlatformInvitationAction}><input type="hidden" name="id" value={id} /><button className="button-secondary" type="submit">Revoke</button></form>}
    {state.error && <p className="module-alert" role="alert">{state.error}</p>}
    {state.message && <p className="module-success" role="status">{state.message}</p>}
  </div>;
}

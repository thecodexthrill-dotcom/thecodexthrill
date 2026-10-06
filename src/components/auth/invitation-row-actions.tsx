"use client";

import { useActionState } from "react";
import { archivePlatformInvitationAction, resendPlatformInvitationAction, revokePlatformInvitationAction, type AuthActionState } from "@/lib/supabase/actions";

const initial: AuthActionState = {};

export function InvitationRowActions({ id, canResend, canRevoke, canArchive }: { id: string; canResend: boolean; canRevoke: boolean; canArchive: boolean }) {
  const [resendState, resendAction, resendPending] = useActionState(resendPlatformInvitationAction, initial);
  const [revokeState, revokeAction, revokePending] = useActionState(revokePlatformInvitationAction, initial);
  const [archiveState, archiveAction, archivePending] = useActionState(archivePlatformInvitationAction, initial);
  return <div className="workspace-shortcuts">
    {canResend && <form action={resendAction}><input type="hidden" name="id" value={id} /><button className="button-secondary" disabled={resendPending || revokePending || archivePending} type="submit">{resendPending ? "Sending…" : "Resend Invitation"}</button></form>}
    {canRevoke && <form action={revokeAction}><input type="hidden" name="id" value={id} /><button className="button-secondary" disabled={resendPending || revokePending || archivePending} type="submit">{revokePending ? "Revoking…" : "Revoke Invitation"}</button></form>}{canArchive && <form action={archiveAction}><input type="hidden" name="id" value={id} /><button className="button-secondary" disabled={resendPending || revokePending || archivePending} type="submit">{archivePending ? "Archiving…" : "Archive Invitation"}</button></form>}
    {resendState.error && <p className="module-alert" role="alert">{resendState.error}</p>}
    {resendState.message && <p className="module-success" role="status">{resendState.message}</p>}
    {revokeState.error && <p className="module-alert" role="alert">{revokeState.error}</p>}
    {revokeState.message && <p className="module-success" role="status">{revokeState.message}</p>}
    {archiveState.error && <p className="module-alert" role="alert">{archiveState.error}</p>}
    {archiveState.message && <p className="module-success" role="status">{archiveState.message}</p>}
  </div>;
}

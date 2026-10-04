"use client";

import { useActionState } from "react";
import { removeAuthenticatorFactorAction, type AuthActionState } from "@/lib/supabase/actions";

export function MfaFactorActions({ factorId }: { factorId: string }) {
  const [state, action, pending] = useActionState(removeAuthenticatorFactorAction, {} as AuthActionState);
  return <div>
    <form action={action} onSubmit={(event) => { if (!window.confirm("Remove this authenticator? Another verified authenticator must remain active.")) event.preventDefault(); }}>
      <input name="factor-id" type="hidden" value={factorId} />
      <button className="button-secondary" disabled={pending} type="submit">{pending ? "Removing…" : "Remove device"}</button>
    </form>
    {state.error && <p className="module-alert" role="alert">{state.error}</p>}
    {state.message && <p className="module-success" role="status">{state.message}</p>}
  </div>;
}
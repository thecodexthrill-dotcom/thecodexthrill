import type { Metadata } from "next";
import { AuthPanel } from "@/components/auth/auth-panel";
import { InvitationSessionBridge } from "@/components/auth/invitation-session-bridge";
import { createClient } from "@/lib/supabase/server";
import { hasAuthFlowMethod } from "@/lib/supabase/auth-flow";
import { cookies } from "next/headers";
import { hasFreshInvitationSession } from "@/lib/supabase/invitation-handoff";

export const metadata: Metadata = { title: "Accept invitation", robots: { index: false, follow: false } };

export default async function AcceptInvitationPage({ searchParams }: { searchParams: Promise<{ invite?: string }> }) {
  const { invite } = await searchParams;
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;
  const cookieStore = await cookies();
  const handoffSubject = cookieStore.get("ctt_invite_verified")?.value;
  const freshInvitationSession = hasFreshInvitationSession(handoffSubject, claims?.sub, claims?.amr);
  const { data: invitationStatus } = freshInvitationSession && claims?.sub && hasAuthFlowMethod(claims.amr, "invite")
    ? await supabase.rpc("get_auth_invitation_status")
    : { data: null };
  const databaseStatus = typeof invitationStatus === "string" ? invitationStatus : null;
  const invitationVerified = databaseStatus === "pending" || databaseStatus === "valid";
  const displayStatus = invite ?? (databaseStatus === "expired" || databaseStatus === "revoked" || databaseStatus === "accepted"
    ? databaseStatus
    : undefined);

  return <>
    <AuthPanel invitationVerified={invitationVerified} mode="invite" />
    <InvitationSessionBridge invitationVerified={invitationVerified} status={displayStatus} />
  </>;
}

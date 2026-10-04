import type { Metadata } from "next";
import { AuthPanel } from "@/components/auth/auth-panel";
import { InvitationSessionBridge } from "@/components/auth/invitation-session-bridge";
import { createClient } from "@/lib/supabase/server";
import { hasAuthFlowMethod } from "@/lib/supabase/auth-flow";

export const metadata: Metadata = { title: "Accept invitation", robots: { index: false, follow: false } };

export default async function AcceptInvitationPage({ searchParams }: { searchParams: Promise<{ invite?: string }> }) {
  const { invite } = await searchParams;
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;
  const { data: invitationValid } = claims?.sub && hasAuthFlowMethod(claims.amr, "invite")
    ? await supabase.rpc("has_valid_auth_invitation")
    : { data: false };
  const invitationVerified = invitationValid === true;

  return <>
    <AuthPanel invitationVerified={invitationVerified} mode="invite" />
    <InvitationSessionBridge invitationVerified={invitationVerified} status={invite} />
  </>;
}

import type { Metadata } from "next";
import { AuthPanel } from "@/components/auth/auth-panel";
import { InvitationSessionBridge } from "@/components/auth/invitation-session-bridge";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Accept invitation", robots: { index: false, follow: false } };

export default async function AcceptInvitationPage({ searchParams }: { searchParams: Promise<{ invite?: string }> }) {
  const { invite } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const invitationVerified = Boolean(user?.invited_at && user.email_confirmed_at);

  return <>
    <AuthPanel invitationVerified={invitationVerified} mode="invite" />
    <InvitationSessionBridge invitationVerified={invitationVerified} status={invite} />
  </>;
}

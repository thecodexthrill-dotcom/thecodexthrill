import type { Metadata } from "next";
import { PasswordSetupPanel } from "@/components/auth/password-setup-panel";
import { RecoverySessionBridge } from "@/components/auth/recovery-session-bridge";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Set Your New Password", robots: { index: false, follow: false } };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ auth?: string }> }) {
  const { auth } = await searchParams;
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  const sessionValid = Boolean(user && !error);

  return <>
    <PasswordSetupPanel sessionValid={sessionValid} linkInvalid={auth === "link-invalid"} sessionUnavailable={auth === "session-unavailable"} />
    <RecoverySessionBridge recoveryVerified={sessionValid} linkInvalid={auth === "link-invalid"} />
  </>;
}
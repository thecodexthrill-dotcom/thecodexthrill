import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PasswordSetupPanel } from "@/components/auth/password-setup-panel";
import { RecoverySessionBridge } from "@/components/auth/recovery-session-bridge";
import { createClient } from "@/lib/supabase/server";
import { hasAuthFlowMethod } from "@/lib/supabase/auth-flow";

export const metadata: Metadata = { title: "Set Your New Password", robots: { index: false, follow: false } };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ auth?: string }> }) {
  const { auth } = await searchParams;
  const linkStatus = auth === "expired" || auth === "used"
    ? auth
    : auth === "link-invalid" ? "invalid" : null;
  const supabase = await createClient();
  const { data: claimsData, error } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;
  const sessionValid = Boolean(!error && claims?.sub && hasAuthFlowMethod(claims.amr, "recovery"));
  if (sessionValid) {
    const [{ data: factors, error: factorsError }, { data: assurance, error: assuranceError }] = await Promise.all([
      supabase.auth.mfa.listFactors(),
      supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    ]);
    if (factorsError || assuranceError) redirect("/setup-required?area=mfa-verification");
    if (factors?.totp.some((factor) => factor.status === "verified") && assurance?.currentLevel !== "aal2") {
      redirect("/mfa?next=%2Freset-password");
    }
  }

  return <>
    <PasswordSetupPanel sessionValid={sessionValid} linkStatus={linkStatus} sessionUnavailable={auth === "session-unavailable"} />
    <RecoverySessionBridge recoveryVerified={sessionValid} linkInvalid={linkStatus !== null} />
  </>;
}

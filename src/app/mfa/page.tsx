import Link from "next/link";
import { redirect } from "next/navigation";
import { ThemeToggle } from "@/components/site/theme-toggle";
import { MfaChallenge } from "@/components/auth/mfa-challenge";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Secure your account", robots: { index: false, follow: false } };

const allowedNext = new Set(["/portal", "/admin", "/bootstrap/initial", "/bootstrap/owner-transfer", "/reset-password", "/account/security"]);

export default async function MfaPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next: requestedNext } = await searchParams;
  const next = requestedNext && allowedNext.has(requestedNext) ? requestedNext : "/auth/continue";
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) redirect("/login");

  const [{ data: assurance, error: assuranceError }, { data: factors, error: factorsError }] = await Promise.all([
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    supabase.auth.mfa.listFactors(),
  ]);
  if (!assuranceError && assurance?.currentLevel === "aal2") redirect(next);

  const factorCheckFailed = Boolean(assuranceError || factorsError || !factors);
  const verifiedFactors = factors?.totp.filter((factor) => factor.status === "verified").map((factor) => ({
    id: factor.id,
    name: factor.friendly_name || "Authenticator app",
  })) ?? [];
  const hasUnverifiedFactor = factors?.all.some((factor) => factor.factor_type === "totp" && factor.status === "unverified") ?? false;
  const hasVerifiedFactor = verifiedFactors.length > 0;

  return <main className="auth-page"><section className="auth-card">
    <div className="auth-topline"><Link className="auth-brand" href="/"><span className="brand-wordmark">THECODEX<span>THRILL</span></span></Link><ThemeToggle /></div>
    <p className="eyebrow"><span />ACCOUNT SECURITY</p>
    <h1>{factorCheckFailed ? "Security status unavailable." : hasVerifiedFactor ? "Verify your authenticator." : "Set up your authenticator."}</h1>
    <p className="auth-description">{factorCheckFailed
      ? "Supabase could not confirm this account’s authenticator status. Try again when the connection is restored; no factor was changed."
      : hasVerifiedFactor
        ? "This account already has a verified authenticator. Enter a current code from one of those devices."
        : "This account has no verified authenticator. Set one up now to continue securely."}</p>
    {factorCheckFailed
      ? <p className="module-alert" role="alert">Authenticator status could not be verified. No authenticator code can be accepted until this check succeeds.</p>
      : <MfaChallenge allowAdditionalEnrollment={false} hasUnverifiedFactor={hasUnverifiedFactor} nextPath={next} verifiedFactors={verifiedFactors} />}
  </section></main>;
}
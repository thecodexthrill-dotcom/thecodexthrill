import Link from "next/link";
import { redirect } from "next/navigation";
import { MfaChallenge } from "@/components/auth/mfa-challenge";
import { MfaFactorActions } from "@/components/auth/mfa-factor-actions";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Account security", robots: { index: false, follow: false } };

export default async function AccountSecurityPage() {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) redirect("/login");
  const [{ data: factors, error: factorsError }, { data: assurance, error: assuranceError }] = await Promise.all([
    supabase.auth.mfa.listFactors(),
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
  ]);

  if (factorsError || assuranceError || !factors) {
    return <main className="auth-page"><section className="auth-card"><h1>Account security unavailable.</h1><p className="auth-description">Supabase could not confirm this account’s authenticator status. No factor was changed.</p><Link className="button button-secondary" href="/auth/continue">Return to your account</Link></section></main>;
  }

  const verifiedFactors = factors.totp.filter((factor) => factor.status === "verified").map((factor) => ({ id: factor.id, name: factor.friendly_name || "Authenticator app" }));
  const hasUnverifiedFactor = factors.all.some((factor) => factor.factor_type === "totp" && factor.status === "unverified");
  const isAal2 = assurance?.currentLevel === "aal2";

  return <main className="auth-page"><section className="auth-card">
    <p className="eyebrow"><span />ACCOUNT SECURITY</p>
    <h1>Manage authenticator devices.</h1>
    <p className="auth-description">Only verified TOTP factors can provide AAL2. The last verified factor cannot be removed from this page.</p>
    {!isAal2 && verifiedFactors.length > 0 && <>
      <p className="module-note">Verify one enrolled factor before managing devices.</p>
      <MfaChallenge allowAdditionalEnrollment={false} hasUnverifiedFactor={hasUnverifiedFactor} nextPath="/account/security" verifiedFactors={verifiedFactors} />
    </>}
    {verifiedFactors.length === 0 && <>
      <p className="module-note">No verified authenticator is enrolled for this account.</p>
      <MfaChallenge allowAdditionalEnrollment={false} hasUnverifiedFactor={hasUnverifiedFactor} nextPath="/account/security" verifiedFactors={verifiedFactors} />
    </>}
    {isAal2 && verifiedFactors.length > 0 && <>
      <section className="module-panel"><h2>Verified authenticators</h2><ul className="mfa-factor-list">{verifiedFactors.map((factor) => <li key={factor.id}><span>{factor.name}</span>{verifiedFactors.length > 1 ? <MfaFactorActions factorId={factor.id} /> : <small>Last verified factor protected</small>}</li>)}</ul>{verifiedFactors.length === 1 && <p className="module-note">Add and verify a replacement before removing an old device. The last verified factor is protected.</p>}</section>
      <details className="module-panel"><summary>Add another authenticator</summary><p>Verify the new factor before it is added to the account. Existing verified factors remain active.</p><MfaChallenge allowAdditionalEnrollment hasUnverifiedFactor={hasUnverifiedFactor} nextPath="/account/security" startEnrollment verifiedFactors={verifiedFactors} /></details>
    </>}
    <Link className="text-link" href="/auth/continue">Return to your account</Link>
  </section></main>;
}
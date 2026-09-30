import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { bootstrapInitialSuperAdminAction } from "@/lib/supabase/actions";

export const metadata: Metadata = { title: "Initial administrator bootstrap", robots: { index: false, follow: false } };

export default async function InitialBootstrapPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error: requestedError } = await searchParams;
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user || !user.invited_at || !user.email_confirmed_at) redirect("/access-denied");
  const { data: operational } = await supabase.rpc("platform_is_operational");
  if (operational) redirect("/auth/continue");
  const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance?.currentLevel !== "aal2") redirect("/mfa?next=%2Fbootstrap%2Finitial");

  return <main className="auth-page"><section className="auth-card">
    <p className="eyebrow"><span />ONE-TIME PLATFORM SETUP</p>
    <h1>Confirm initial administrator designation.</h1>
    <p className="auth-description">This verified invited account can request the one-time Super Admin designation only if its email matches the owner-authorized bootstrap invitation. The database validates that authorization, verified email, invitation, and MFA together in one transaction.</p>
    {requestedError && <p className="module-alert" role="alert">This account is not the owner-authorized bootstrap invite, or bootstrap has already been completed.</p>}
    <form action={bootstrapInitialSuperAdminAction}><button className="button-gold" type="submit">Designate this account as Super Admin</button></form>
  </section></main>;
}

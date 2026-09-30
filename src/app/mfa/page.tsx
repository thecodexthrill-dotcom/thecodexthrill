import Link from "next/link";
import { redirect } from "next/navigation";
import { ThemeToggle } from "@/components/site/theme-toggle";
import { MfaChallenge } from "@/components/auth/mfa-challenge";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Verify your identity", robots: { index: false, follow: false } };

export default async function MfaPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next: requestedNext } = await searchParams;
  const next = requestedNext === "/portal" || requestedNext === "/admin" || requestedNext === "/bootstrap/initial" || requestedNext === "/bootstrap/owner-transfer" ? requestedNext : "/auth/continue";
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (data?.currentLevel === "aal2") redirect(next);
  return <main className="auth-page"><section className="auth-card"><div className="auth-topline"><Link className="auth-brand" href="/"><span className="brand-wordmark">THECODEX<span>THRILL</span></span></Link><ThemeToggle /></div><p className="eyebrow"><span />ACCOUNT SECURITY</p><h1>Verify your identity.</h1><p className="auth-description">This role requires multi-factor authentication. Use an enrolled authenticator or enroll one now.</p><MfaChallenge nextPath={next} /></section></main>;
}

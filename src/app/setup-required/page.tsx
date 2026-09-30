import Link from "next/link";
export default async function SetupRequiredPage({ searchParams }: { searchParams: Promise<{ area?: string }> }) {
  const { area } = await searchParams;
  return <main className="auth-page"><section className="auth-card"><p className="eyebrow"><span />WORKSPACE SETUP</p><h1>Workspace setup is incomplete.</h1><p className="auth-description">The signed-in user could not be checked against the required database authorization schema{area ? ` (${area})` : ""}. No demo access has been granted. The approved migrations must be applied before this workspace can open.</p><Link className="text-link" href="/login">Return to sign in <span aria-hidden="true">→</span></Link></section></main>;
}

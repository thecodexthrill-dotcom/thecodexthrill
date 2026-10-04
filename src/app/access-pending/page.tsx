import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Access pending", robots: { index: false, follow: false } };
export default function AccessPendingPage() {
  return <main className="auth-page"><section className="auth-card"><p className="eyebrow"><span />ACCOUNT ACCESS</p><h1>Access is pending.</h1><p className="auth-description">Your account is signed in, but no active platform or organization role is assigned. Ask your administrator to complete the approved invitation and role assignment.</p><Link className="text-link" href="/login">Return to sign in <span aria-hidden="true">→</span></Link></section></main>;
}

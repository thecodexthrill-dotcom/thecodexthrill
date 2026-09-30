import Link from "next/link";
export default function AccessDeniedPage() {
  return <main className="auth-page"><section className="auth-card"><p className="eyebrow"><span />ACCESS CONTROL</p><h1>This workspace is not available.</h1><p className="auth-description">Your account does not have an active role that permits access to this area.</p><Link className="text-link" href="/auth/continue">Open your assigned workspace <span aria-hidden="true">→</span></Link></section></main>;
}

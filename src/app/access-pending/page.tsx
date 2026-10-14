import type { Metadata } from "next";
import Link from "next/link";
import { Clock, ShieldCheck, Mail, ArrowRight, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { signOutAction } from "@/lib/supabase/actions";
import { ThemeToggle } from "@/components/site/theme-toggle";

export const metadata: Metadata = {
  title: "Access Pending · TheCodexThrill",
  robots: { index: false, follow: false },
};

export default async function AccessPendingPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const { type } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isInvitedClient = type === "client_provisioning" || Boolean(user?.invited_at);

  return (
    <main className="auth-page">
      <section className="auth-card" style={{ maxWidth: "560px", width: "100%" }}>
        <div className="auth-topline">
          <Link className="auth-brand" href="/">
            <span className="brand-wordmark">
              THECODEX<span>THRILL</span>
            </span>
          </Link>
          <ThemeToggle />
        </div>

        {isInvitedClient ? (
          <>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "4px 12px",
                borderRadius: "999px",
                fontSize: "12px",
                fontWeight: 600,
                background: "color-mix(in srgb, var(--gold-soft) 40%, var(--surface))",
                color: "var(--gold-ink)",
                border: "1px solid var(--gold)",
                marginBottom: "16px",
                width: "fit-content",
              }}
            >
              <Clock size={13} />
              <span>INVITATION CONFIRMED · WORKSPACE PROVISIONING</span>
            </div>

            <h1 style={{ fontSize: "24px", margin: "0 0 10px" }}>
              Welcome to the Client Portal
            </h1>

            <p className="auth-description" style={{ fontSize: "14px", lineHeight: "1.6" }}>
              Your account credentials and email verification are confirmed. Your organization
              workspace is currently undergoing final database provisioning by the operations team.
            </p>

            <div
              style={{
                display: "grid",
                gap: "12px",
                padding: "16px 20px",
                borderRadius: "12px",
                background: "var(--surface)",
                border: "1px solid var(--line)",
                margin: "20px 0",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <ShieldCheck size={18} style={{ color: "var(--gold)", flexShrink: 0 }} />
                <span style={{ fontSize: "13px" }}>
                  <strong>Account:</strong> {user?.email ?? "Verified client account"}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <Clock size={18} style={{ color: "var(--gold)", flexShrink: 0 }} />
                <span style={{ fontSize: "13px" }}>
                  <strong>Status:</strong> Awaiting membership role sync in secure database
                </span>
              </div>
            </div>

            <div
              style={{
                fontSize: "13px",
                color: "var(--muted)",
                marginBottom: "24px",
                lineHeight: "1.5",
              }}
            >
              Once activation completes, you will have immediate access to delivery milestones,
              shared deliverables, invoices, and your technical support queue.
            </div>

            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
              <Link
                href="/auth/continue"
                className="button button-gold"
                style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
              >
                Check Access Status <ArrowRight size={14} />
              </Link>
              <a
                href="mailto:contact@thecodexthrill.com"
                className="button button-secondary"
                style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
              >
                <Mail size={14} /> Contact Support
              </a>
              <form action={signOutAction} style={{ marginLeft: "auto" }}>
                <button
                  type="submit"
                  className="button button-secondary"
                  style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "13px" }}
                >
                  <LogOut size={13} /> Sign out
                </button>
              </form>
            </div>
          </>
        ) : (
          <>
            <p className="eyebrow">
              <span />
              ACCOUNT ACCESS
            </p>
            <h1>Access is pending.</h1>
            <p className="auth-description">
              Your account is signed in, but no active platform or organization role is assigned.
              Ask your administrator to complete the approved invitation and role assignment.
            </p>
            <div style={{ display: "flex", gap: "12px", marginTop: "20px", alignItems: "center" }}>
              <Link className="button button-secondary" href="/login">
                Return to sign in
              </Link>
              <form action={signOutAction}>
                <button
                  type="submit"
                  className="button button-secondary"
                  style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
                >
                  <LogOut size={13} /> Sign out
                </button>
              </form>
            </div>
          </>
        )}
      </section>
    </main>
  );
}

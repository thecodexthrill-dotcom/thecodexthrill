"use client";

import { useActionState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/site/theme-toggle";
import {
  requestPasswordResetAction,
  acceptInvitationAction,
  signInAction,
  updatePasswordAction,
  type AuthActionState,
} from "@/lib/supabase/actions";

type AuthMode = "login" | "forgot" | "reset" | "invite";
const initialState: AuthActionState = {};

const copy: Record<AuthMode, { eyebrow: string; title: string; description: string; submit: string }> = {
  login: { eyebrow: "Platform access", title: "Welcome back.", description: "Sign in with your invited account.", submit: "Sign in" },
  forgot: { eyebrow: "Account recovery", title: "Reset your password.", description: "Enter the email address associated with your account.", submit: "Request reset link" },
  reset: { eyebrow: "Account recovery", title: "Choose a new password.", description: "Use at least 12 characters for your new password.", submit: "Save password" },
  invite: { eyebrow: "Invitation only", title: "Accept an invitation.", description: "Open the secure invitation link sent to your email address.", submit: "Accept invitation" },
};

export function AuthPanel({
  mode,
  invitationVerified = false,
  inviteStatus,
  passwordResetVerified = false,
  passwordResetLinkInvalid = false,
  logoutError = false,
}: {
  mode: AuthMode;
  invitationVerified?: boolean;
  inviteStatus?: string;
  passwordResetVerified?: boolean;
  passwordResetLinkInvalid?: boolean;
  logoutError?: boolean;
}) {
  const action = mode === "forgot"
    ? requestPasswordResetAction
    : mode === "invite"
      ? acceptInvitationAction
      : mode === "reset"
        ? updatePasswordAction
        : signInAction;
  const [state, formAction, pending] = useActionState(action, initialState);
  const content = copy[mode];
  const canShowForm = mode === "invite"
    ? invitationVerified
    : mode === "reset" ? passwordResetVerified : true;

  const inviteHoldCopy = inviteStatus === "expired"
    ? {
        title: "Invitation link expired",
        body: "This single-use invitation link has expired. Ask a Super Admin or Platform Admin to resend your invitation from the Team workspace.",
      }
    : inviteStatus === "used"
      ? {
          title: "Invitation link already used",
          body: "This invitation token has already been consumed. If you completed password setup, sign in below; otherwise ask an administrator to resend the invitation.",
        }
      : inviteStatus === "accepted"
        ? {
            title: "Invitation already accepted",
            body: "Your account setup is already complete. Sign in with your email and password to continue.",
          }
        : inviteStatus === "revoked"
          ? {
              title: "Invitation revoked",
              body: "This invitation was revoked by an administrator and can no longer be used.",
            }
          : inviteStatus === "invalid"
            ? {
                title: "Invalid or incomplete invitation link",
                body: "The invitation link could not be verified. Open the latest invitation email and press Continue to verify your invitation before setting a password.",
              }
            : {
                title: "Invitation verification required",
                body: "Invitation issuance is restricted to authorized administrators. Open the secure link in your invitation email and press Continue to set your password.",
              };

  return (
    <main className="auth-page">
      <section aria-labelledby="auth-title" className="auth-card">
        <div className="auth-topline"><Link aria-label="Back to TheCodexThrill" className="auth-brand" href="/"><span className="brand-mark">C<span>.</span></span><span className="brand-wordmark">THECODEX<span>THRILL</span></span></Link><ThemeToggle /></div>
        <p className="eyebrow"><span />{content.eyebrow}</p>
        <h1 id="auth-title">{content.title}</h1>
        <p className="auth-description">{content.description}</p>
        <div className="auth-notice"><ShieldCheck aria-hidden="true" size={18} /><p>No public signup or role switching. Access depends on your verified session and database permissions.</p></div>
        {canShowForm ? (
          <form action={formAction} className="auth-form">
            {(mode === "login" || mode === "forgot") && <label>Email address<input autoComplete="email" name="email" required type="email" /></label>}
            {mode === "login" && <label>Password<input autoComplete="current-password" name="password" required type="password" /></label>}
            {(mode === "reset" || mode === "invite") && <><label>New password<input autoComplete="new-password" minLength={12} name="password" required type="password" /></label><label>Confirm new password<input autoComplete="new-password" minLength={12} name="confirm-password" required type="password" /></label></>}
            <Button className="auth-submit" disabled={pending} type="submit">{pending ? "Please wait..." : content.submit}<ArrowRight aria-hidden="true" size={16} /></Button>
          </form>
        ) : mode === "invite" ? (
          <div className="module-hold"><ShieldCheck aria-hidden="true" size={18} /><div><strong>{inviteHoldCopy.title}</strong><p>{inviteHoldCopy.body}</p></div></div>
        ) : (
          <div className="module-hold"><ShieldCheck aria-hidden="true" size={18} /><div><strong>Password recovery link required</strong><p>{passwordResetLinkInvalid ? "This recovery link expired or was already used. Request a fresh link and open it before choosing a password." : "Open the secure password recovery link from your email before choosing a password."}</p><Link href="/forgot-password">Request a new recovery link</Link></div></div>
        )}
        {logoutError && <p aria-live="polite" className="auth-feedback" role="alert">Sign-out could not be confirmed with Supabase. Try again and close this browser session.</p>}
        {state.error && <p aria-live="polite" className="auth-feedback" role="alert">{state.error}</p>}
        {state.message && <p aria-live="polite" className="auth-feedback" role="status">{state.message}</p>}
        <div className="auth-links">
          {mode === "login" && <Link href="/forgot-password">Forgot your password?</Link>}
          {mode === "login" && <Link href="/invite/accept">Have an invitation? Accept it here</Link>}
          {mode !== "login" && <Link href="/login"><ArrowLeft size={14} /> Return to sign in</Link>}
        </div>
      </section>
    </main>
  );
}

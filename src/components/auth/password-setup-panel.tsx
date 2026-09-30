"use client";

import { useActionState, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Eye, EyeOff, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/site/theme-toggle";
import { updatePasswordAction, type AuthActionState } from "@/lib/supabase/actions";

const initialState: AuthActionState = {};

export function PasswordSetupPanel({ sessionValid, linkInvalid, sessionUnavailable }: { sessionValid: boolean; linkInvalid: boolean; sessionUnavailable: boolean }) {
  const [state, formAction, pending] = useActionState(updatePasswordAction, initialState);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [clientError, setClientError] = useState("");
  const router = useRouter();

  useEffect(() => {
    if (!state.passwordUpdated) return;
    const timeout = window.setTimeout(() => router.replace("/auth/continue"), 1400);
    return () => window.clearTimeout(timeout);
  }, [router, state.passwordUpdated]);

  const lengthValid = password.length >= 12;
  const confirmationMatches = confirmation.length > 0 && password === confirmation;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    setClientError("");
    if (password !== confirmation) {
      event.preventDefault();
      setClientError("The passwords do not match. Check both fields and try again.");
    }
  }

  return (
    <main className="auth-page">
      <section aria-labelledby="password-setup-title" className="auth-card">
        <div className="auth-topline">
          <Link aria-label="Back to TheCodexThrill" className="auth-brand" href="/">
            <span className="brand-mark">C<span>.</span></span>
            <span className="brand-wordmark">THECODEX<span>THRILL</span></span>
          </Link>
          <ThemeToggle />
        </div>
        <p className="eyebrow"><span />ACCOUNT RECOVERY</p>
        <h1 id="password-setup-title">Set Your New Password</h1>
        <p className="auth-description">Choose a new password for your TheCodexThrill account.</p>
        <div className="auth-notice"><ShieldCheck aria-hidden="true" size={18} /><p>Your password is updated securely through Supabase. Account access still follows your assigned permissions and MFA requirements.</p></div>

        {sessionValid ? (
          state.passwordUpdated ? (
            <div aria-live="polite" className="password-result password-result--success" role="status">
              <strong>Password updated successfully.</strong>
              <p>Your account is secure. Continuing to the account security checkâ€¦</p>
            </div>
          ) : (
            <form action={formAction} className="auth-form" onSubmit={handleSubmit}>
              <label htmlFor="new-password">New Password</label>
              <div className="password-input-wrap">
                <input autoComplete="new-password" id="new-password" maxLength={128} minLength={12} name="password" onChange={(event) => setPassword(event.target.value)} required type={showPasswords ? "text" : "password"} value={password} />
                <button aria-label={showPasswords ? "Hide password" : "Show password"} aria-pressed={showPasswords} className="password-toggle" onClick={() => setShowPasswords((value) => !value)} type="button">
                  {showPasswords ? <EyeOff aria-hidden="true" size={18} /> : <Eye aria-hidden="true" size={18} />}
                </button>
              </div>
              <ul aria-label="Password requirements" className="password-requirements">
                <li className={lengthValid ? "is-valid" : ""}>{lengthValid ? "âœ“" : "â€¢"} At least 12 characters</li>
              </ul>

              <label htmlFor="confirm-password">Confirm New Password</label>
              <div className="password-input-wrap">
                <input autoComplete="new-password" id="confirm-password" maxLength={128} minLength={12} name="confirm-password" onChange={(event) => setConfirmation(event.target.value)} required type={showPasswords ? "text" : "password"} value={confirmation} />
                <button aria-label={showPasswords ? "Hide password" : "Show password"} aria-pressed={showPasswords} className="password-toggle" onClick={() => setShowPasswords((value) => !value)} type="button">
                  {showPasswords ? <EyeOff aria-hidden="true" size={18} /> : <Eye aria-hidden="true" size={18} />}
                </button>
              </div>
              {confirmation.length > 0 && <p className={`password-match ${confirmationMatches ? "is-valid" : "is-invalid"}`} aria-live="polite">{confirmationMatches ? "Passwords match." : "Passwords do not match."}</p>}

              {(clientError || state.error) && <p aria-live="polite" className="auth-feedback password-error" role="alert">{clientError || state.error}</p>}
              <Button className="auth-submit" disabled={pending} type="submit">{pending ? "Updating passwordâ€¦" : "Update Password"}<ArrowRight aria-hidden="true" size={16} /></Button>
            </form>
          )
        ) : (
          <div className="module-hold" role="status">
            <ShieldCheck aria-hidden="true" size={18} />
            <div>
              <strong>{linkInvalid ? "This recovery link is invalid or expired" : sessionUnavailable ? "Secure recovery session could not be established" : "Recovery session required"}</strong>
              <p>{linkInvalid ? "Recovery links can expire or be used only once. Request a fresh email, then open its link in this browser." : sessionUnavailable ? "Supabase verified the callback but did not confirm a complete browser session. Request a fresh recovery email and open the newest link." : "Open the password recovery link from your email in this browser. Once Supabase verifies it, the password form will appear here."}</p>
              <Link href="/forgot-password">Request a fresh recovery email</Link>
            </div>
          </div>
        )}
        {state.message && !state.passwordUpdated && <p aria-live="polite" className="auth-feedback" role="status">{state.message}</p>}
        <div className="auth-links"><Link href="/login"><ArrowLeft aria-hidden="true" size={14} /> Return to sign in</Link></div>
      </section>
    </main>
  );
}

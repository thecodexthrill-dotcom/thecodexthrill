"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { getSupabasePublicEnv } from "@/lib/env";

type VerifiedFactor = { id: string; name: string };
type Screen = "setup" | "unfinished" | "enroll" | "challenge";

export function MfaChallenge({
  nextPath,
  verifiedFactors,
  hasUnverifiedFactor,
  allowAdditionalEnrollment = false,
  startEnrollment = false,
}: {
  nextPath: string;
  verifiedFactors: VerifiedFactor[];
  hasUnverifiedFactor: boolean;
  allowAdditionalEnrollment?: boolean;
  startEnrollment?: boolean;
}) {
  const [screen, setScreen] = useState<Screen>(startEnrollment ? (hasUnverifiedFactor ? "unfinished" : "setup") : verifiedFactors.length ? "challenge" : hasUnverifiedFactor ? "unfinished" : "setup");
  const [factorId, setFactorId] = useState(verifiedFactors[0]?.id ?? "");
  const [qrCode, setQrCode] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  function client() {
    const env = getSupabasePublicEnv();
    return createBrowserClient(env.url, env.key);
  }

  async function beginEnrollment(restartUnfinished = false) {
    setBusy(true);
    setMessage("");
    try {
      const supabase = client();
      const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
      if (listError) throw listError;
      const verified = factors.totp.filter((factor) => factor.status === "verified");
      if (verified.length && !allowAdditionalEnrollment) {
        setFactorId(verified[0].id);
        setScreen("challenge");
        setMessage("A verified authenticator already exists. Use its current code; no second factor was created.");
        return;
      }

      const unfinished = factors.all.filter((factor) => factor.factor_type === "totp" && factor.status === "unverified");
      if (unfinished.length && !restartUnfinished) {
        setScreen("unfinished");
        return;
      }
      if (unfinished.length && restartUnfinished) {
        for (const factor of unfinished) {
          const { error } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
          if (error) throw error;
        }
      }

      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "TheCodexThrill authenticator",
      });
      if (error) throw error;
      setFactorId(data.id);
      setQrCode(data.totp.qr_code);
      setSecret(data.totp.secret);
      setCode("");
      setScreen("enroll");
      setMessage("Scan the QR code or enter the setup key, then verify a current six-digit code.");
    } catch {
      setMessage("Authenticator setup could not start. Confirm your connection and retry; existing verified factors were not changed.");
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!/^\d{6}$/.test(code) || !factorId) {
      setMessage("Enter the six-digit code shown by your authenticator app.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const supabase = client();
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
      if (challengeError) throw challengeError;
      const { error: verifyError } = await supabase.auth.mfa.verify({ factorId, challengeId: challenge.id, code });
      if (verifyError) throw verifyError;
      const { data: assurance, error: assuranceError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (assuranceError || assurance.currentLevel !== "aal2") {
        throw new Error("AAL2 was not confirmed");
      }
      setQrCode("");
      setSecret("");
      window.location.assign(nextPath);
    } catch {
      setCode("");
      setMessage("The code could not be verified or Supabase did not confirm AAL2. Check the device time and try a current code.");
    } finally {
      setBusy(false);
    }
  }

  const availableFactors = screen === "challenge" ? verifiedFactors : [];
  const displayedFactorId = availableFactors.some((factor) => factor.id === factorId) ? factorId : availableFactors[0]?.id ?? factorId;

  return <div className="mfa-enrollment-flow">
    {screen === "setup" && <div className="module-panel">
      <h2>Enroll an authenticator</h2>
      <p>Use an authenticator app such as 1Password, Google Authenticator, or Microsoft Authenticator. Enrollment is not complete until a current code is verified.</p>
      <button className="button-gold" disabled={busy} onClick={() => void beginEnrollment()} type="button">{busy ? "Starting setup…" : "Set up authenticator"}</button>
    </div>}

    {screen === "unfinished" && <div className="module-panel">
      <h2>Finish authenticator setup</h2>
      <p>A previous setup left an unverified factor. It cannot be used to sign in, and Supabase cannot show its setup key again. Choose restart to remove only that unverified setup and create a new one. Verified factors are never removed here.</p>
      <button className="button-gold" disabled={busy} onClick={() => void beginEnrollment(true)} type="button">{busy ? "Restarting setup…" : "Restart unfinished setup"}</button>
    </div>}

    {screen === "enroll" && <>
      <div className="mfa-enrollment module-panel">
        <p>Scan this QR code in your authenticator app.</p>
        <Image alt="Authenticator enrollment QR code" height={190} src={qrCode.trimEnd()} unoptimized width={190} />
        <details><summary>Enter setup key manually</summary><p><code className="mfa-secret">{secret}</code></p></details>
        <p>Keep the setup key private. It is shown only during this enrollment and is not saved in the application.</p>
      </div>
      <form className="auth-form" onSubmit={verifyCode}>
        <label>Six-digit authenticator code<input autoComplete="one-time-code" inputMode="numeric" maxLength={6} minLength={6} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} pattern="[0-9]{6}" required value={code} /></label>
        <button className="button-gold" disabled={busy} type="submit">{busy ? "Verifying…" : "Verify and continue"}</button>
      </form>
    </>}

    {screen === "challenge" && <form className="auth-form" onSubmit={verifyCode}>
      {availableFactors.length > 1 && <label>Authenticator device<select onChange={(event) => { setFactorId(event.target.value); setCode(""); }} value={displayedFactorId}>{availableFactors.map((factor) => <option key={factor.id} value={factor.id}>{factor.name}</option>)}</select></label>}
      <label>Six-digit authenticator code<input autoComplete="one-time-code" inputMode="numeric" maxLength={6} minLength={6} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} pattern="[0-9]{6}" required value={code} /></label>
      <button className="button-gold" disabled={busy} type="submit">{busy ? "Verifying…" : "Verify and continue"}</button>
      <p className="module-note">Already enrolled? Use a current code from one of the verified authenticator devices. If you still have a verified device, manage or replace factors at <Link href="/account/security">Account security</Link>.</p>
      <p className="module-note">If you have lost access to every verified device, sign-in recovery requires an identity-verified factor reset by the Supabase project owner. <a href="https://supabase.com/dashboard/project/isgoypmebtoipfvtaflg/auth/users" rel="noreferrer" target="_blank">Open Supabase Auth users</a>. The application will not bypass MFA.</p>
    </form>}

    {message && <p aria-live="polite" className="auth-feedback" role="status">{message}</p>}
  </div>;
}
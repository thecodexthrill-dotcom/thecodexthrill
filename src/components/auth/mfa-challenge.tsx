"use client";

import { useState } from "react";
import Image from "next/image";
import { createBrowserClient } from "@supabase/ssr";
import { getSupabasePublicEnv } from "@/lib/env";

export function MfaChallenge({ nextPath }: { nextPath: string }) {
  const [factorId, setFactorId] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [qrCode, setQrCode] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function run(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const env = getSupabasePublicEnv();
      const supabase = createBrowserClient(env.url, env.key);
      let currentFactor = factorId;
      let currentChallenge = challengeId;
      if (!currentFactor) {
        const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
        if (listError) throw listError;
        const existing = factors.totp.find((factor) => factor.status === "verified");
        if (existing) currentFactor = existing.id;
        else {
          // An interrupted enrollment leaves an unusable unverified factor in Auth.
          // Remove it before retrying so the user can complete a fresh enrollment.
          const unfinished = factors.all.find((factor) => factor.factor_type === "totp" && factor.status === "unverified");
          if (unfinished) {
            const { error: cleanupError } = await supabase.auth.mfa.unenroll({ factorId: unfinished.id });
            if (cleanupError) throw cleanupError;
          }
          const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "TheCodexThrill authenticator" });
          if (error) throw error;
          currentFactor = data.id;
          setFactorId(data.id);
          setQrCode(data.totp.qr_code);
          setSecret(data.totp.secret);
          const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: data.id });
          if (challengeError) throw challengeError;
          currentChallenge = challenge.id;
          setChallengeId(challenge.id);
          setBusy(false);
          setMessage("Scan the authenticator QR code, then enter its current six-digit code.");
          return;
        }
      }
      if (!currentChallenge) {
        const { data, error } = await supabase.auth.mfa.challenge({ factorId: currentFactor });
        if (error) throw error;
        currentChallenge = data.id;
        setChallengeId(data.id);
      }
      const { error: verifyError } = await supabase.auth.mfa.verify({ factorId: currentFactor, challengeId: currentChallenge, code });
      if (verifyError) throw verifyError;
      window.location.assign(nextPath);
    } catch {
      setChallengeId("");
      setMessage("MFA could not be completed. Confirm Auth MFA is enabled for this project and retry.");
    } finally {
      setBusy(false);
    }
  }

  return <form className="auth-form" onSubmit={run}>
    {qrCode && <div className="mfa-enrollment"><p>Scan this code in your authenticator app.</p><Image alt="Authenticator enrollment QR code" height={190} src={qrCode.trimEnd()} unoptimized width={190} /><p>Manual key: <code>{secret}</code></p></div>}
    <label>Authenticator code<input autoComplete="one-time-code" inputMode="numeric" maxLength={8} minLength={6} onChange={(event) => setCode(event.target.value.replace(/\s/g, ""))} required value={code} /></label>
    <button className="button-gold" disabled={busy} type="submit">{busy ? "Verifying…" : "Verify MFA"}</button>
    {message && <p aria-live="polite" className="auth-feedback" role="status">{message}</p>}
  </form>;
}

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { hasAuthFlowMethod } from "@/lib/supabase/auth-flow";
import { classifyAuthLinkError } from "@/lib/supabase/auth-link-status";

let cachedHashTokens: { accessToken: string; refreshToken: string } | null = null;
let inFlightSetSession: Promise<{ error: { code?: string; message?: string } | null }> | null = null;

export function RecoverySessionBridge({ recoveryVerified, linkInvalid }: { recoveryVerified: boolean; linkInvalid: boolean }) {
  const router = useRouter();

  useEffect(() => {
    if (recoveryVerified || linkInvalid || typeof window === "undefined") return;

    if (window.location.hash.length > 1) {
      const hashParams = new URLSearchParams(window.location.hash.slice(1));
      window.history.replaceState(null, "", window.location.pathname + window.location.search);

      if (hashParams.has("error") || hashParams.has("error_code") || hashParams.has("error_description")) {
        const rawError = hashParams.get("error_code") ?? hashParams.get("error") ?? hashParams.get("error_description") ?? "";
        const status = classifyAuthLinkError(rawError);
        router.replace(`/reset-password?auth=${status === "invalid" ? "link-invalid" : status}`);
        return;
      }

      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");
      if (accessToken && refreshToken) {
        cachedHashTokens = { accessToken, refreshToken };
      }
    }

    const supabase = createClient();
    let active = true;

    void (async () => {
      if (cachedHashTokens) {
        window.dispatchEvent(new CustomEvent("ctt:recovery-session", { detail: "verifying" }));
        const tokens = cachedHashTokens;
        if (!inFlightSetSession) {
          inFlightSetSession = supabase.auth.setSession({
            access_token: tokens.accessToken,
            refresh_token: tokens.refreshToken,
          });
        }
        const { error: setSessionError } = await inFlightSetSession;
        cachedHashTokens = null;
        inFlightSetSession = null;
        if (setSessionError) {
          if (!active) return;
          const status = classifyAuthLinkError(setSessionError.code ?? setSessionError.message ?? "");
          router.replace(`/reset-password?auth=${status === "invalid" ? "link-invalid" : status}`);
          return;
        }
      }

      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (!active || sessionError || !sessionData.session) return;
      const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
      const claims = claimsData?.claims;
      if (active && !claimsError && claims?.sub && hasAuthFlowMethod(claims.amr, "recovery")) {
        window.dispatchEvent(new CustomEvent("ctt:recovery-session", { detail: "verified" }));
        router.refresh();
      }
    })();

    return () => { active = false; };
  }, [linkInvalid, recoveryVerified, router]);

  return null;
}

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { hasAuthFlowMethod } from "@/lib/supabase/auth-flow";

export function RecoverySessionBridge({ recoveryVerified, linkInvalid }: { recoveryVerified: boolean; linkInvalid: boolean }) {
  const router = useRouter();

  useEffect(() => {
    if (recoveryVerified || linkInvalid) return;
    const supabase = createClient();
    let active = true;

    void (async () => {
      if (typeof window !== "undefined" && window.location.hash.length > 1) {
        const hashParams = new URLSearchParams(window.location.hash.slice(1));
        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");
        if (accessToken && refreshToken) {
          await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          window.history.replaceState(null, "", window.location.pathname + window.location.search);
        }
      }
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (!active || sessionError || !sessionData.session) return;
      const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
      const claims = claimsData?.claims;
      if (active && !claimsError && claims?.sub && hasAuthFlowMethod(claims.amr, "recovery")) router.refresh();
    })();

    return () => { active = false; };
  }, [linkInvalid, recoveryVerified, router]);

  return null;
}

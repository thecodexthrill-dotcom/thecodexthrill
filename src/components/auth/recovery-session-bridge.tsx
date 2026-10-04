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

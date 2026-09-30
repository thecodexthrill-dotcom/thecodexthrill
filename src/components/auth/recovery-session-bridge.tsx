"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function RecoverySessionBridge({ recoveryVerified, linkInvalid }: { recoveryVerified: boolean; linkInvalid: boolean }) {
  const router = useRouter();

  useEffect(() => {
    if (recoveryVerified || linkInvalid) return;
    const supabase = createClient();
    let active = true;

    void (async () => {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (!active || sessionError || !sessionData.session) return;
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (active && !userError && userData.user) router.refresh();
    })();

    return () => { active = false; };
  }, [linkInvalid, recoveryVerified, router]);

  return null;
}
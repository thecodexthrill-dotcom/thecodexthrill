import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getSupabasePublicEnv } from "@/lib/env";

export function createAdminClient() {
  const { url } = getSupabasePublicEnv();
  const projectUrl = new URL(url);
  const isApprovedCloudProject =
    projectUrl.protocol === "https:" &&
    projectUrl.hostname === "isgoypmebtoipfvtaflg.supabase.co" &&
    projectUrl.port === "" &&
    projectUrl.pathname === "/" &&
    !projectUrl.search &&
    !projectUrl.hash;

  if (!isApprovedCloudProject) {
    throw new Error("Privileged Auth operations are restricted to the approved Cloud project.");
  }
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!secretKey) throw new Error("The server-only SUPABASE_SECRET_KEY is not configured.");
  return createSupabaseClient(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

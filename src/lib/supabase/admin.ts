import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getSupabasePublicEnv } from "@/lib/env";

export function createAdminClient() {
  const { url } = getSupabasePublicEnv();
  const projectUrl = new URL(url);
  const isConfirmedHostedDevelopmentProject =
    projectUrl.protocol === "https:" &&
    projectUrl.hostname === "isgoypmebtoipfvtaflg.supabase.co";
  const isLocalDevelopmentProject =
    projectUrl.protocol === "http:" &&
    ["127.0.0.1", "localhost"].includes(projectUrl.hostname) &&
    projectUrl.port === "54321";

  if (!isConfirmedHostedDevelopmentProject && !isLocalDevelopmentProject) {
    throw new Error("Privileged Auth operations are restricted to the confirmed development project.");
  }
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!secretKey) throw new Error("The server-only SUPABASE_SECRET_KEY is not configured.");
  return createSupabaseClient(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

"use client";

import { createBrowserClient } from "@supabase/ssr";

import { getSupabasePublicEnv } from "@/lib/env";

export function createClient() {
  const { url, key } = getSupabasePublicEnv();
  return createBrowserClient(url, key);
}

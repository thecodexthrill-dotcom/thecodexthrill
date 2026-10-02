import { z } from "zod";

const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional().or(z.literal("")),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().optional(),
});

export function getSupabasePublicEnv() {
  const parsed = publicEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });

  if (!parsed.success) {
    throw new Error("Supabase public environment variables are invalid.");
  }

  const { NEXT_PUBLIC_SUPABASE_URL: url, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: key } =
    parsed.data;

  if (!url || !key) {
    throw new Error(
      "Supabase is not configured. Set the project URL and publishable key in the deployment environment.",
    );
  }

  const projectUrl = new URL(url);
  const isApprovedCloudProject =
    projectUrl.protocol === "https:" &&
    projectUrl.hostname === "isgoypmebtoipfvtaflg.supabase.co" &&
    projectUrl.port === "" &&
    projectUrl.pathname === "/" &&
    !projectUrl.search &&
    !projectUrl.hash;

  if (!isApprovedCloudProject) {
    throw new Error("Supabase URL must target the approved Cloud project.");
  }

  return { url, key };
}

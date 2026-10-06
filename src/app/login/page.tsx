import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthPanel } from "@/components/auth/auth-panel";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Sign in", robots: { index: false, follow: false } };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ auth?: string }>;
}) {
  const { auth } = await searchParams;

  if (auth !== "logout-error") {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      redirect("/auth/continue");
    }
  }

  return <AuthPanel mode="login" logoutError={auth === "logout-error"} />;
}

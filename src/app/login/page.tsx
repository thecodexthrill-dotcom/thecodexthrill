import type { Metadata } from "next";
import { AuthPanel } from "@/components/auth/auth-panel";

export const metadata: Metadata = { title: "Sign in", robots: { index: false, follow: false } };
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ auth?: string }> }) { const { auth } = await searchParams; return <AuthPanel mode="login" logoutError={auth === "logout-error"} />; }

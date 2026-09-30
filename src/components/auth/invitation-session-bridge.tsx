"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { getSupabasePublicEnv } from "@/lib/env";

type InviteStatus = "expired" | "used" | "invalid";

const statusCopy: Record<InviteStatus, string> = {
  expired: "This invitation link has expired or has already been used. If your email is confirmed, use password recovery; otherwise ask an administrator to send a fresh invitation.",
  used: "This invitation link has already been used. Sign in, or request a fresh invitation if password setup was not completed.",
  invalid: "This invitation link is invalid. Open the latest invitation from your email or ask an administrator to resend it.",
};

export function InvitationSessionBridge({
  status,
  invitationVerified,
}: {
  status?: string;
  invitationVerified: boolean;
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const statusMessage = status === "expired" || status === "used" || status === "invalid" ? statusCopy[status] : null;

  useEffect(() => {
    if (invitationVerified || statusMessage) return;

    const hash = new URLSearchParams(window.location.hash.slice(1));
    const errorCode = hash.get("error_code") ?? hash.get("error");
    if (errorCode || hash.has("error_description")) {
      const normalized = (errorCode ?? "").toLowerCase();
      const category: InviteStatus = normalized.includes("expired")
        ? "expired"
        : normalized.includes("used") || normalized.includes("already")
          ? "used"
          : "invalid";
      window.history.replaceState(window.history.state, "", `${window.location.pathname}${window.location.search}`);
      const timeout = window.setTimeout(() => setMessage(statusCopy[category]), 0);
      return () => window.clearTimeout(timeout);
    }

    let active = true;
    const { url, key } = getSupabasePublicEnv();
    // Admin-issued invitation callbacks use an implicit grant with tokens in
    // the URL fragment. The rest of the app keeps using PKCE.
    const supabase = createBrowserClient(url, key, {
      auth: { flowType: "implicit", detectSessionInUrl: true },
    });

    void supabase.auth.getSession().then(async ({ data, error }) => {
      if (!active) return;
      if (error) {
        const errorCode = (error.code ?? error.name).toLowerCase();
        const category: InviteStatus = errorCode.includes("expired")
          ? "expired"
          : errorCode.includes("used") || errorCode.includes("already")
            ? "used"
            : "invalid";
        setMessage(statusCopy[category]);
        return;
      }
      if (!data.session) {
        setMessage("Open the secure invitation link from your email to set your password.");
        return;
      }

      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (!active) return;
      if (userError || !userData.user?.invited_at || !userData.user.email_confirmed_at) {
        await supabase.auth.signOut();
        setMessage("This link did not verify an invitation. Open the latest invitation from your email.");
        return;
      }
      router.refresh();
    });

    return () => {
      active = false;
    };
  }, [invitationVerified, router, statusMessage]);

  const visibleMessage = statusMessage ?? message;
  if (invitationVerified || !visibleMessage) return null;
  return <p aria-live="polite" className="auth-feedback" role="status">{visibleMessage}</p>;
}


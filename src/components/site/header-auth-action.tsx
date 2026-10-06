"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export function HeaderAuthAction({ mobile = false }: { mobile?: boolean }) {
  const [destination, setDestination] = useState<string>("/login");
  const [label, setLabel] = useState<string>("Login");

  useEffect(() => {
    let isMounted = true;
    const supabase = createClient();

    async function checkAuth() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
          if (isMounted) {
            setDestination("/login");
            setLabel("Login");
          }
          return;
        }

        const [superAdminRes, platformRes] = await Promise.all([
          supabase
            .from("platform_super_admin_designation")
            .select("user_id")
            .eq("user_id", session.user.id)
            .maybeSingle(),
          supabase
            .from("platform_role_assignments")
            .select("role")
            .eq("user_id", session.user.id)
            .is("revoked_at", null),
        ]);

        const isSuperAdmin = !!superAdminRes.data;
        const platformRoles = (platformRes.data ?? []).map((r) => r.role);
        const isAdmin = isSuperAdmin || platformRoles.some((r) => ["platform_admin", "developer", "support_staff"].includes(r));

        if (isMounted) {
          setDestination(isAdmin ? "/admin" : "/portal");
          setLabel("Workspace");
        }
      } catch {
        if (isMounted) {
          setDestination("/auth/continue");
          setLabel("Workspace");
        }
      }
    }

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        setDestination("/login");
        setLabel("Login");
      } else {
        checkAuth();
      }
    });

    return () => {
      isMounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  return (
    <Link className={mobile ? "mobile-login-link" : "header-login"} href={destination}>
      {label}
    </Link>
  );
}


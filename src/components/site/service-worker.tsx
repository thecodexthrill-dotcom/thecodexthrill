"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  isProtectedOrSensitivePath,
  isStaleAssetOrChunkLoadError,
  purgeSensitiveClientStateAndCaches,
  shouldTriggerAuthBoundaryReset,
} from "@/lib/pwa/pwa-cache-policy";

const CHUNK_RELOAD_COOLDOWN_MS = 15_000;

function attemptGuardedStaleAssetReload() {
  if (typeof window === "undefined") return;
  try {
    const now = Date.now();
    const lastReloadRaw = window.sessionStorage.getItem("ctt_chunk_reload_at");
    const lastReload = lastReloadRaw ? Number(lastReloadRaw) : 0;
    if (Number.isFinite(lastReload) && now - lastReload < CHUNK_RELOAD_COOLDOWN_MS) {
      return;
    }
    window.sessionStorage.setItem("ctt_chunk_reload_at", String(now));
    window.location.reload();
  } catch {
    // Do not force reload if sessionStorage is unavailable
  }
}

export function ServiceWorkerRegistration() {
  const router = useRouter();
  const pathname = usePathname();
  const previousUserIdRef = useRef<string | null | undefined>(undefined);
  const [isOffline, setIsOffline] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const updateOnlineState = () => {
      setIsOffline(!navigator.onLine);
    };
    updateOnlineState();

    window.addEventListener("online", updateOnlineState);
    window.addEventListener("offline", updateOnlineState);

    const handleRuntimeError = (event: ErrorEvent) => {
      if (isStaleAssetOrChunkLoadError(event.error ?? event.message)) {
        attemptGuardedStaleAssetReload();
      }
    };
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (isStaleAssetOrChunkLoadError(event.reason)) {
        attemptGuardedStaleAssetReload();
      }
    };

    window.addEventListener("error", handleRuntimeError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    let refreshing = false;
    const handleControllerChange = () => {
      if (refreshing) return;
      refreshing = true;
      setWaitingWorker(null);
    };

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener(
        "controllerchange",
        handleControllerChange,
      );

      void navigator.serviceWorker
        .register("/sw.js", { scope: "/", updateViaCache: "none" })
        .then((registration) => {
          if (registration.waiting) {
            setWaitingWorker(registration.waiting);
          }

          registration.addEventListener("updatefound", () => {
            const installing = registration.installing;
            if (!installing) return;
            installing.addEventListener("statechange", () => {
              if (
                installing.state === "installed" &&
                navigator.serviceWorker.controller
              ) {
                setWaitingWorker(installing);
              }
            });
          });
        })
        .catch(() => {
          // PWA features progressively enhance the site; core navigation still works.
        });
    }

    return () => {
      window.removeEventListener("online", updateOnlineState);
      window.removeEventListener("offline", updateOnlineState);
      window.removeEventListener("error", handleRuntimeError);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.removeEventListener(
          "controllerchange",
          handleControllerChange,
        );
      }
    };
  }, []);

  // Enforce zero-trust auth boundary cache eviction on logout, session expiry, or user switch
  useEffect(() => {
    let isMounted = true;
    let subscription: { unsubscribe: () => void } | null = null;

    try {
      const supabase = createClient();

      void supabase.auth.getSession().then(({ data }) => {
        if (!isMounted) return;
        previousUserIdRef.current = data.session?.user?.id ?? null;
      });

      const { data } = supabase.auth.onAuthStateChange((event, session) => {
        const nextUserId = session?.user?.id ?? null;
        const prevUserId = previousUserIdRef.current;
        previousUserIdRef.current = nextUserId;

        if (prevUserId === undefined) {
          return;
        }

        const transition = shouldTriggerAuthBoundaryReset({
          previousUserId: prevUserId,
          nextUserId,
          authEvent: event,
        });

        if (transition.shouldReset) {
          void purgeSensitiveClientStateAndCaches({
            reason: transition.reason,
            clearSupabaseLocalStorage: transition.reason === "signed_out",
          }).then(() => {
            if (isProtectedOrSensitivePath(pathname)) {
              router.refresh();
            }
          });
        }
      });

      subscription = data.subscription;
    } catch {
      // Ignore if public env is not present in isolated test environments
    }

    return () => {
      isMounted = false;
      subscription?.unsubscribe();
    };
  }, [pathname, router]);

  function applyServiceWorkerUpdate() {
    if (!waitingWorker) return;
    waitingWorker.postMessage({ type: "SKIP_WAITING" });
    setWaitingWorker(null);
    window.location.reload();
  }

  if (!isOffline && !waitingWorker) {
    return null;
  }

  return (
    <div
      aria-live="polite"
      role="status"
      style={{
        position: "fixed",
        right: "16px",
        bottom: "16px",
        zIndex: 90,
        display: "grid",
        gap: "8px",
        maxWidth: "min(420px, calc(100vw - 32px))",
      }}
    >
      {isOffline && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            padding: "12px 16px",
            borderRadius: "14px",
            border: "1px solid var(--line-strong)",
            background: "var(--surface-raised)",
            color: "var(--foreground)",
            boxShadow: "0 16px 40px rgba(0, 0, 0, 0.35)",
            fontSize: "13px",
            lineHeight: 1.45,
          }}
        >
          <div>
            <strong style={{ color: "var(--gold-ink)", display: "block" }}>
              Offline mode — Network unavailable
            </strong>
            <span style={{ color: "var(--muted)" }}>
              Private workspace data is never cached offline. Changes require an active connection.
            </span>
          </div>
        </div>
      )}

      {waitingWorker && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            padding: "12px 16px",
            borderRadius: "14px",
            border: "1px solid var(--gold)",
            background: "var(--surface-raised)",
            color: "var(--foreground)",
            boxShadow: "0 16px 40px rgba(0, 0, 0, 0.35)",
            fontSize: "13px",
          }}
        >
          <span>A newer application build is ready.</span>
          <button
            className="button button-small button-gold"
            onClick={applyServiceWorkerUpdate}
            type="button"
          >
            Reload latest
          </button>
        </div>
      )}
    </div>
  );
}

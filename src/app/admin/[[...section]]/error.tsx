"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw, RotateCcw, WifiOff } from "lucide-react";
import { isStaleAssetOrChunkLoadError } from "@/lib/pwa/pwa-cache-policy";

function subscribeToOnlineStatus(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

function getOnlineSnapshot(): boolean {
  return typeof navigator !== "undefined" ? navigator.onLine : true;
}

function getServerOnlineSnapshot(): boolean {
  return true;
}

export default function AdminWorkspaceError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const isOnline = useSyncExternalStore(
    subscribeToOnlineStatus,
    getOnlineSnapshot,
    getServerOnlineSnapshot,
  );
  const isOffline = !isOnline;
  const isStaleChunk = isStaleAssetOrChunkLoadError(error);

  return (
    <div className="platform-shell admin-shell">
      <div className="platform-main" style={{ gridColumn: "1 / -1" }}>
        <main className="platform-page" id="main-content" style={{ maxWidth: "760px", margin: "48px auto" }}>
          <section className="module-panel" role="alert">
            <p className="eyebrow">
              {isOffline
                ? "ADMIN WORKSPACE · OFFLINE MODE"
                : isStaleChunk
                  ? "ADMIN WORKSPACE · UPDATE AVAILABLE"
                  : "ADMIN WORKSPACE · RECOVERABLE ERROR"}
            </p>
            <h1 style={{ fontSize: "24px", margin: "6px 0 10px", display: "flex", alignItems: "center", gap: "10px" }}>
              {isOffline ? (
                <WifiOff aria-hidden="true" size={22} style={{ color: "var(--gold)" }} />
              ) : (
                <AlertTriangle aria-hidden="true" size={22} style={{ color: "var(--gold)" }} />
              )}
              {isOffline
                ? "Network connection required for Admin Workspace"
                : isStaleChunk
                  ? "A newer application build is available"
                  : "Workspace view could not finish loading"}
            </h1>
            <p style={{ color: "var(--muted)", lineHeight: 1.6 }}>
              {isOffline
                ? "Zero-Trust Offline Boundary: privileged admin data, client records, and audit logs are never stored in browser offline caches. Reconnect to the network and retry."
                : isStaleChunk
                  ? "This workspace view references assets from a previous deployment. Reload the latest version to continue safely."
                  : "Supabase Cloud or the server runtime encountered a temporary interruption while rendering this module. Your session and database records remain intact."}
            </p>
            {error?.digest && (
              <p style={{ fontSize: "12px", color: "var(--subtle)", fontFamily: "var(--font-mono), monospace" }}>
                Reference digest: {error.digest}
              </p>
            )}
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "18px" }}>
              <button className="button button-gold" onClick={() => reset()} type="button">
                <RotateCcw aria-hidden="true" size={15} /> Retry loading module
              </button>
              <button
                className="button button-secondary"
                onClick={() => window.location.reload()}
                type="button"
              >
                <RefreshCw aria-hidden="true" size={15} /> Reload latest version
              </button>
              <Link className="button button-secondary" href="/admin">
                Return to Admin Overview
              </Link>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}



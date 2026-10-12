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

export default function PortalWorkspaceError({
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
    <div className="platform-shell portal-shell">
      <div className="platform-main" style={{ gridColumn: "1 / -1" }}>
        <main className="platform-page" id="main-content" style={{ maxWidth: "760px", margin: "48px auto" }}>
          <section className="module-panel" role="alert">
            <p className="eyebrow">
              {isOffline
                ? "CLIENT PORTAL · OFFLINE MODE"
                : isStaleChunk
                  ? "CLIENT PORTAL · UPDATE AVAILABLE"
                  : "CLIENT PORTAL · RECOVERABLE ERROR"}
            </p>
            <h1 style={{ fontSize: "24px", margin: "6px 0 10px", display: "flex", alignItems: "center", gap: "10px" }}>
              {isOffline ? (
                <WifiOff aria-hidden="true" size={22} style={{ color: "var(--gold)" }} />
              ) : (
                <AlertTriangle aria-hidden="true" size={22} style={{ color: "var(--gold)" }} />
              )}
              {isOffline
                ? "Network connection required for Client Portal"
                : isStaleChunk
                  ? "A newer application build is available"
                  : "Portal module could not finish loading"}
            </h1>
            <p style={{ color: "var(--muted)", lineHeight: 1.6 }}>
              {isOffline
                ? "Zero-Trust Offline Boundary: private client projects, deliverables, invoices, and support threads are never stored in browser offline caches. Reconnect to the network and retry."
                : isStaleChunk
                  ? "This portal view references assets from a previous deployment. Reload the latest version to continue safely."
                  : "A temporary network or server interruption prevented this view from completing. Your organization data remains isolated and intact."}
            </p>
            {error?.digest && (
              <p style={{ fontSize: "12px", color: "var(--subtle)", fontFamily: "var(--font-mono), monospace" }}>
                Reference digest: {error.digest}
              </p>
            )}
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "18px" }}>
              <button className="button button-gold" onClick={() => reset()} type="button">
                <RotateCcw aria-hidden="true" size={15} /> Retry loading view
              </button>
              <button
                className="button button-secondary"
                onClick={() => window.location.reload()}
                type="button"
              >
                <RefreshCw aria-hidden="true" size={15} /> Reload latest version
              </button>
              <Link className="button button-secondary" href="/portal">
                Return to Portal Overview
              </Link>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}



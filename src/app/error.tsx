"use client";

import { useSyncExternalStore } from "react";
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

export default function GlobalError({
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
    <div className="container-shell page-loading" role="alert">
      <p className="eyebrow">
        <span />
        {isOffline
          ? "Offline Mode"
          : isStaleChunk
            ? "Application Update Available"
            : "Something went wrong"}
      </p>
      <h1>
        {isOffline
          ? "You’re offline for now."
          : isStaleChunk
            ? "A newer application version is available."
            : "We couldn’t load this page."}
      </h1>
      <p>
        {isOffline
          ? "Check your network connection and try again. Private workspace and client records are never stored in offline caches."
          : isStaleChunk
            ? "This page references assets from a previous deployment. Reload to fetch the latest version."
            : "Please try again. If the problem continues, reload the latest version or come back in a moment."}
      </p>
      {error.digest ? <p>Reference: {error.digest}</p> : null}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", marginTop: "8px" }}>
        <button className="error-retry" onClick={() => reset()} type="button">
          Try again
        </button>
        <button
          className="button button-secondary"
          onClick={() => window.location.reload()}
          type="button"
        >
          Reload latest version
        </button>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { AlertTriangle, RotateCcw } from "lucide-react";

export default function AdminWorkspaceError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="platform-shell admin-shell">
      <div className="platform-main" style={{ gridColumn: "1 / -1" }}>
        <main className="platform-page" id="main-content" style={{ maxWidth: "760px", margin: "48px auto" }}>
          <section className="module-panel" role="alert">
            <p className="eyebrow">ADMIN WORKSPACE · RECOVERABLE ERROR</p>
            <h1 style={{ fontSize: "24px", margin: "6px 0 10px", display: "flex", alignItems: "center", gap: "10px" }}>
              <AlertTriangle aria-hidden="true" size={22} style={{ color: "var(--gold)" }} />
              Workspace view could not finish loading
            </h1>
            <p style={{ color: "var(--muted)", lineHeight: 1.6 }}>
              Supabase Cloud or the server runtime encountered a temporary interruption while rendering this module.
              Your session and database records remain intact.
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


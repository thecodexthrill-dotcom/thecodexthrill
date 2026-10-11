export default function AdminWorkspaceLoading() {
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className="platform-shell admin-shell workspace-loading-shell"
    >
      <aside aria-hidden="true" className="platform-sidebar">
        <div className="sidebar-brand-row">
          <div className="platform-brand">
            <span className="platform-mark">
              T<span>C</span>
            </span>
            <span>
              TheCodex<span>Thrill</span>
            </span>
          </div>
        </div>
        <p className="sidebar-caption">PLATFORM</p>
        <div className="platform-nav">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((item) => (
            <div className="workspace-skeleton-nav-item" key={item}>
              <span className="workspace-skeleton-dot" />
              <span className="workspace-skeleton-bar" style={{ width: `${52 + (item % 3) * 14}%` }} />
            </div>
          ))}
        </div>
        <div className="sidebar-footer">
          <span className="connection-dot" /> Synchronizing workspace…
        </div>
      </aside>

      <div className="platform-main">
        <header className="platform-topbar">
          <div className="platform-brand">
            <span className="platform-mark">
              T<span>C</span>
            </span>
            <span>
              TheCodex<span>Thrill</span>
            </span>
          </div>
          <div className="platform-search" style={{ opacity: 0.7 }}>
            <span className="workspace-skeleton-bar" style={{ width: "160px", height: "12px" }} />
          </div>
          <div className="platform-top-actions">
            <span className="workspace-skeleton-pill" />
            <span className="workspace-skeleton-pill" style={{ width: "120px" }} />
          </div>
        </header>

        <main className="platform-page" id="main-content">
          <div className="platform-page-heading">
            <div style={{ width: "100%" }}>
              <p className="eyebrow">ADMIN WORKSPACE · SYNCHRONIZING</p>
              <div
                className="workspace-skeleton-bar workspace-skeleton-title"
                style={{ width: "240px", height: "28px", marginTop: "8px" }}
              />
              <div
                className="workspace-skeleton-bar"
                style={{ width: "360px", maxWidth: "90%", height: "14px", marginTop: "10px" }}
              />
            </div>
          </div>

          <div className="workspace-content">
            <div className="um-summary-grid">
              {[1, 2, 3, 4].map((slot) => (
                <div className="um-summary-card workspace-skeleton-card" key={slot}>
                  <div className="workspace-skeleton-bar" style={{ width: "45%", height: "11px" }} />
                  <div
                    className="workspace-skeleton-bar"
                    style={{ width: "60%", height: "24px", marginTop: "10px" }}
                  />
                  <div
                    className="workspace-skeleton-bar"
                    style={{ width: "75%", height: "11px", marginTop: "10px" }}
                  />
                </div>
              ))}
            </div>

            <section className="module-panel workspace-skeleton-panel">
              <div className="workspace-skeleton-bar" style={{ width: "140px", height: "11px" }} />
              <div
                className="workspace-skeleton-bar"
                style={{ width: "260px", height: "22px", marginTop: "10px" }}
              />
              <div
                className="workspace-skeleton-bar"
                style={{ width: "420px", maxWidth: "100%", height: "13px", marginTop: "10px" }}
              />
              <div className="workspace-skeleton-table" style={{ marginTop: "20px" }}>
                {[1, 2, 3, 4].map((row) => (
                  <div className="workspace-skeleton-row" key={row}>
                    <span className="workspace-skeleton-bar" style={{ width: "28%" }} />
                    <span className="workspace-skeleton-bar" style={{ width: "18%" }} />
                    <span className="workspace-skeleton-bar" style={{ width: "22%" }} />
                    <span className="workspace-skeleton-bar" style={{ width: "16%" }} />
                  </div>
                ))}
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}

export default function Loading() {
  return (
    <div aria-busy="true" aria-live="polite" className="container-shell page-loading" style={{ minHeight: "65vh" }}>
      <span aria-hidden="true" className="loading-mark" />
      <div className="page-loading-skeleton" style={{ width: "100%" }}>
        <div className="skeleton-shimmer" style={{ width: "140px", height: "14px" }} />
        <div className="skeleton-shimmer" style={{ width: "min(100%, 540px)", height: "42px" }} />
        <div className="skeleton-shimmer" style={{ width: "min(100%, 720px)", height: "18px" }} />
        <div className="skeleton-shimmer" style={{ width: "min(85%, 620px)", height: "18px" }} />
      </div>
    </div>
  );
}

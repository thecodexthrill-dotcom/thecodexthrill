export default function Loading() {
  return (
    <div aria-busy="true" aria-live="polite" className="container-shell page-loading">
      <span aria-hidden="true" className="loading-mark" />
      <p>Preparing the next page…</p>
    </div>
  );
}

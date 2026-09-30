"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="container-shell page-loading" role="alert">
      <p className="eyebrow"><span />Something went wrong</p>
      <h1>We couldn’t load this page.</h1>
      <p>Please try again. If the problem continues, come back in a little while.</p>
      {error.digest ? <p>Reference: {error.digest}</p> : null}
      <button className="error-retry" onClick={() => reset()} type="button">
        Try again
      </button>
    </div>
  );
}

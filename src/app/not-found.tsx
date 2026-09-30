import Link from "next/link";

export default function NotFound() {
  return (
    <div className="container-shell page-loading">
      <p className="eyebrow"><span />404 · Page not found</p>
      <h1>This page isn’t here.</h1>
      <p>The address may have changed, or the page may no longer be available.</p>
      <Link className="text-link" href="/">Return to the homepage</Link>
    </div>
  );
}

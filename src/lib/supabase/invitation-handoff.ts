export function invitationHandoffMatches(cookieNonce: string | undefined, submittedNonce: string | null): boolean {
  return Boolean(cookieNonce && submittedNonce && cookieNonce.length >= 32 && cookieNonce === submittedNonce);
}
export function hasFreshInvitationSession(markerSubject: string | undefined, subject: string | undefined, amr: unknown): boolean {
  if (!markerSubject || !subject || markerSubject !== subject || !Array.isArray(amr)) return false;
  return amr.some((entry) => typeof entry === "object" && entry !== null && "method" in entry && (entry.method === "invite" || entry.method === "otp"));
}
export function escapeInvitationHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
export function invitationVerificationPage(credential: string, nonce: string, field: "token_hash" | "code" = "token_hash"): string {
  const safeCredential = escapeInvitationHtml(credential);
  const safeNonce = escapeInvitationHtml(nonce);
  const styles = "body{margin:0;min-height:100vh;display:grid;place-items:center;background:#080909;color:#f5f4f0;font-family:Arial,Helvetica,sans-serif;padding:24px}main{width:min(100%,440px);border:1px solid #282a29;border-radius:20px;background:#151818;padding:32px;box-shadow:0 24px 80px rgba(0,0,0,.6)}h1{margin:0 0 10px;font-size:26px;font-weight:500;letter-spacing:-.04em}p{margin:0 0 22px;color:#b4b2aa;font-size:14px;line-height:1.6}button{width:100%;min-height:44px;border:1px solid #c9964b;border-radius:999px;background:#c9964b;color:#17130a;font-size:13px;font-weight:700;cursor:pointer}";
  return '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Accept invitation</title><style>' + styles + '</style></head><body><main><h1>Accept your invitation</h1><p>Continue to verify this one-time invitation link and set up your password.</p><form method="post" action="/auth/callback"><input type="hidden" name="' + field + '" value="' + safeCredential + '"><input type="hidden" name="type" value="invite"><input type="hidden" name="next" value="/invite/accept"><input type="hidden" name="handoff" value="' + safeNonce + '"><button type="submit">Continue to accept invitation</button></form></main></body></html>';
}


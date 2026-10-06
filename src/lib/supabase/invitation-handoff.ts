export function invitationHandoffMatches(cookieNonce: string | undefined, submittedNonce: string | null): boolean {
  return Boolean(cookieNonce && submittedNonce && cookieNonce.length >= 32 && cookieNonce === submittedNonce);
}
export function hasFreshInvitationSession(markerSubject: string | undefined, subject: string | undefined, amr: unknown): boolean {
  if (!markerSubject || !subject || markerSubject !== subject || !Array.isArray(amr)) return false;
  return amr.some((entry) => typeof entry === "object" && entry !== null && "method" in entry && entry.method === "invite");
}
export function escapeInvitationHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
export function invitationVerificationPage(credential: string, nonce: string, field: "token_hash" | "code" = "token_hash"): string {
  const safeCredential = escapeInvitationHtml(credential);
  const safeNonce = escapeInvitationHtml(nonce);
  return '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Accept invitation</title></head><body><main><h1>Accept your invitation</h1><p>Continue to verify this one-time invitation link.</p><form method="post" action="/auth/callback"><input type="hidden" name="' + field + '" value="' + safeCredential + '"><input type="hidden" name="type" value="invite"><input type="hidden" name="next" value="/invite/accept"><input type="hidden" name="handoff" value="' + safeNonce + '"><button type="submit">Continue to accept invitation</button></form></main></body></html>';
}

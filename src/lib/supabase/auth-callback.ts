export type AuthOtpType = "invite" | "recovery" | "email" | "magiclink";

const safeDestinations = new Set(["/reset-password", "/invite/accept"]);
const supportedOtpTypes = new Set<AuthOtpType>(["invite", "recovery", "email", "magiclink"]);

export function parseAuthCallbackParams(searchParams: URLSearchParams) {
  let code = searchParams.get("code");
  let tokenHash = searchParams.get("token_hash");
  let rawOtpType = searchParams.get("type");
  let requestedNext = searchParams.get("next");

  // Recover from email templates that appended ?token_hash=... or &token_hash=... inside `next`
  if (requestedNext && (requestedNext.includes("?") || requestedNext.includes("&"))) {
    const separatorIndex = Math.min(
      requestedNext.includes("?") ? requestedNext.indexOf("?") : Infinity,
      requestedNext.includes("&") ? requestedNext.indexOf("&") : Infinity,
    );
    const cleanPath = requestedNext.slice(0, separatorIndex);
    const embeddedQuery = new URLSearchParams(requestedNext.slice(separatorIndex + 1));
    requestedNext = cleanPath;
    if (!tokenHash && embeddedQuery.get("token_hash")) {
      tokenHash = embeddedQuery.get("token_hash");
    }
    if (!code && embeddedQuery.get("code")) {
      code = embeddedQuery.get("code");
    }
    if (!rawOtpType && embeddedQuery.get("type")) {
      rawOtpType = embeddedQuery.get("type");
    }
  }

  const otpType = rawOtpType && supportedOtpTypes.has(rawOtpType as AuthOtpType)
    ? rawOtpType as AuthOtpType
    : null;
  const next = requestedNext && safeDestinations.has(requestedNext)
    ? requestedNext
    : otpType === "invite" ? "/invite/accept" : otpType === "recovery" ? "/reset-password" : "/auth/continue";

  return { code, tokenHash, otpType, next };
}

export function isInvitationCallback(params: ReturnType<typeof parseAuthCallbackParams>): boolean {
  return params.next === "/invite/accept"
    && (params.otpType === "invite" || Boolean(params.code));
}
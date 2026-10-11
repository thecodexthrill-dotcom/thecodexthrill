export type AuthOtpType = "invite" | "recovery" | "email" | "magiclink";

const safeDestinations = new Set(["/reset-password", "/invite/accept"]);
const supportedOtpTypes = new Set<AuthOtpType>(["invite", "recovery", "email", "magiclink"]);

export function parseAuthCallbackParams(searchParams: URLSearchParams) {
  let code = searchParams.get("code");
  let tokenHash = searchParams.get("token_hash") ?? searchParams.get("token");
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
    if (!tokenHash && (embeddedQuery.get("token_hash") ?? embeddedQuery.get("token"))) {
      tokenHash = embeddedQuery.get("token_hash") ?? embeddedQuery.get("token");
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
  const hasAuthError = Boolean(
    searchParams.get("error") ||
    searchParams.get("error_code") ||
    searchParams.get("error_description"),
  );
  const next = requestedNext && safeDestinations.has(requestedNext)
    ? requestedNext
    : otpType === "invite"
      ? "/invite/accept"
      : otpType === "recovery" || hasAuthError
        ? "/reset-password"
        : "/auth/continue";

  return { code, tokenHash, otpType, next };
}

export function isInvitationCallback(params: ReturnType<typeof parseAuthCallbackParams>): boolean {
  return params.next === "/invite/accept"
    && (params.otpType === "invite" || Boolean(params.code));
}

export function buildProxyAuthCallbackRedirect(requestUrl: URL): URL | null {
  const { pathname, searchParams } = requestUrl;
  if (pathname !== "/" && pathname !== "/reset-password" && pathname !== "/invite/accept") {
    return null;
  }

  const tokenHash = searchParams.get("token_hash") ?? searchParams.get("token");
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const errorCode = searchParams.get("error_code");
  const errorDescription = searchParams.get("error_description");

  if (!tokenHash && !code && !error && !errorCode && !errorDescription) {
    return null;
  }

  const rawType = searchParams.get("type");
  const isInvite = pathname === "/invite/accept" || rawType === "invite";
  const next = isInvite ? "/invite/accept" : "/reset-password";
  const resolvedType = rawType ?? (isInvite ? "invite" : "recovery");

  const callbackUrl = new URL("/auth/callback", requestUrl.origin);
  callbackUrl.searchParams.set("next", next);
  if (tokenHash) callbackUrl.searchParams.set("token_hash", tokenHash);
  if (code) callbackUrl.searchParams.set("code", code);
  if (resolvedType) callbackUrl.searchParams.set("type", resolvedType);
  if (error) callbackUrl.searchParams.set("error", error);
  if (errorCode) callbackUrl.searchParams.set("error_code", errorCode);
  if (errorDescription) callbackUrl.searchParams.set("error_description", errorDescription);

  return callbackUrl;
}

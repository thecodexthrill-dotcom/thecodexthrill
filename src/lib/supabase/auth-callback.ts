export type AuthOtpType = "invite" | "recovery" | "email" | "magiclink";

const safeDestinations = new Set(["/reset-password", "/invite/accept"]);
const supportedOtpTypes = new Set<AuthOtpType>(["invite", "recovery", "email", "magiclink"]);

export function parseAuthCallbackParams(searchParams: URLSearchParams) {
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const rawOtpType = searchParams.get("type");
  const otpType = rawOtpType && supportedOtpTypes.has(rawOtpType as AuthOtpType)
    ? rawOtpType as AuthOtpType
    : null;
  const requestedNext = searchParams.get("next");
  const next = requestedNext && safeDestinations.has(requestedNext)
    ? requestedNext
    : otpType === "invite" ? "/invite/accept" : otpType === "recovery" ? "/reset-password" : "/auth/continue";

  return { code, tokenHash, otpType, next };
}
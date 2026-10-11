export function buildAuthCallbackUrl(
  appBase: URL | string,
  options: {
    next: "/invite/accept" | "/reset-password" | "/auth/continue";
    tokenHash?: string;
    otpType?: "invite" | "recovery" | "email" | "magiclink";
    code?: string;
  },
): string {
  const base = typeof appBase === "string" ? new URL(appBase) : appBase;
  const callback = new URL("/auth/callback", base.origin);
  callback.searchParams.set("next", options.next);
  if (options.tokenHash) {
    callback.searchParams.set("token_hash", options.tokenHash);
  }
  if (options.otpType) {
    callback.searchParams.set("type", options.otpType);
  }
  if (options.code) {
    callback.searchParams.set("code", options.code);
  }
  return callback.toString();
}

export function invitationRedirectTo(appBase: URL | string): string {
  return buildAuthCallbackUrl(appBase, { next: "/invite/accept" });
}

export function passwordRecoveryRedirectTo(appBase: URL | string): string {
  return buildAuthCallbackUrl(appBase, { next: "/reset-password" });
}
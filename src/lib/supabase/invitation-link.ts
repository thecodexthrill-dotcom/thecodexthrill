export function invitationRedirectTo(appBase: URL): string {
  const callback = new URL("/auth/callback", appBase.origin);
  callback.searchParams.set("next", "/invite/accept");
  return callback.toString();
}
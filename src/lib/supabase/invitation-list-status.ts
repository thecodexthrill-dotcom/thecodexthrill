const SAFE_DB_ERROR_CODE = /^(?:[A-Z0-9]{5,8}|[0-9]{3})$/;

export function safeInvitationListErrorCode(code: string | undefined): string {
  return code && SAFE_DB_ERROR_CODE.test(code) ? code : "UNKNOWN";
}

export function invitationListFailureMessage(code: string | undefined): string {
  switch (safeInvitationListErrorCode(code)) {
    case "42501":
      return "Supabase denied the invitation list. Sign in again with the Super Admin account and complete MFA, then retry. If the problem continues, verify the invitation-list function grants and role in Supabase.";
    case "PGRST202":
    case "42883":
      return "Supabase could not find the invitation-list function. Apply the existing platform invitations migration and refresh the Supabase API schema cache.";
    case "PGRST301":
    case "401":
      return "The Supabase session was rejected while loading invitations. Sign in again and complete MFA.";
    default:
      return `Supabase could not load invitation records (reference ${safeInvitationListErrorCode(code)}). Retry; if it continues, check the invitation-list RPC and Supabase database logs.`;
  }
}

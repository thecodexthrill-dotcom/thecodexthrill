export type InvitationEmailError = {
  code?: string;
  status?: number;
};

export function safeInvitationEmailCode(code: string | undefined): string {
  return code && /^[a-z0-9_]{1,64}$/i.test(code) ? code : "unknown";
}

export function invitationEmailFailureMessage(error: InvitationEmailError): string {
  switch (error.code) {
    case "email_address_not_authorized":
      return "Supabase Auth rejected this address because its test email service only sends to project team members. Configure production SMTP in Supabase Auth, then send a new invitation.";
    case "smtp_not_configured":
      return "Supabase Auth has no production SMTP provider configured. Configure SMTP in Supabase Auth, then send a new invitation.";
    case "email_provider_disabled":
    case "provider_disabled":
      return "Email invitations are disabled in Supabase Auth. Enable the email provider, then send a new invitation.";
    case "over_email_send_rate_limit":
    case "email_rate_limit_exceeded":
      return "Supabase Auth rate-limited invitation email. Wait for the limit to reset before sending another invitation.";
    default:
      if (error.status === 429) {
        return "Supabase Auth rate-limited invitation email. Wait for the limit to reset before sending another invitation.";
      }
      return "Supabase Auth rejected the invitation email request. Check the Auth email template and SMTP delivery logs before retrying.";
  }
}

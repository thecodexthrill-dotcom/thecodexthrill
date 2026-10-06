"use client";

type InviteStatus = "expired" | "used" | "invalid" | "revoked" | "accepted";

const statusCopy: Record<InviteStatus, string> = {
  expired: "This invitation link has expired. Ask an administrator to resend the invitation.",
  used: "This invitation link has already been used. Sign in, or ask an administrator to resend it if setup did not finish.",
  invalid: "This invitation link is invalid. Open the latest invitation from your email or ask an administrator to resend it.",
  revoked: "This invitation was revoked by an administrator and cannot be accepted.",
  accepted: "This invitation has already been accepted. Sign in to continue.",
};

export function InvitationSessionBridge({
  status,
  invitationVerified,
}: {
  status?: string;
  invitationVerified: boolean;
}) {
  if (invitationVerified) return null;
  const message = status === "expired" || status === "used" || status === "invalid" || status === "revoked" || status === "accepted"
    ? statusCopy[status]
    : "Open the latest invitation email and press Continue to verify it before setting a password.";
  return <p aria-live="polite" className="auth-feedback" role="status">{message}</p>;
}

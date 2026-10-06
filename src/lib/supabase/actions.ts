"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireWorkspace } from "@/lib/supabase/access";
import { resolveAppOrigin } from "@/lib/app-origin";
import { hasAuthFlowMethod } from "@/lib/supabase/auth-flow";
import { invitationRedirectTo } from "@/lib/supabase/invitation-link";
import { invitationEmailFailureMessage, safeInvitationEmailCode } from "@/lib/supabase/invitation-email-status";
import { safeInvitationListErrorCode } from "@/lib/supabase/invitation-list-status";
import { hasFreshInvitationSession } from "@/lib/supabase/invitation-handoff";
import { cookies } from "next/headers";

export type AuthActionState = { error?: string; message?: string; passwordUpdated?: boolean };

const credentialsSchema = z.object({
  email: z.string().trim().email().max(320),
  password: z.string().min(1).max(256),
});

export async function signInAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: "Enter a valid email and password." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: "Sign-in failed. Check your details or contact your administrator." };
  redirect("/auth/continue");
}

export async function requestPasswordResetAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const email = z.string().trim().email().max(320).safeParse(formData.get("email"));
  if (!email.success) return { error: "Enter a valid email address." };

  const appBase = resolveAppOrigin();
  if (!appBase) return { error: "Password recovery is unavailable because the HTTPS app origin is not configured." };

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email.data, {
    redirectTo: new URL("/auth/callback?next=%2Freset-password", appBase.origin).toString(),
  });
  if (error) return { error: "Could not submit the recovery request. Check the connection and try again." };
  return { message: "Supabase accepted the recovery request. Check your inbox and spam folder for the reset link." };
}

export async function updatePasswordAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = z.object({
    password: z.string().min(12).max(128),
    confirmPassword: z.string().min(12).max(128),
  }).safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirm-password"),
  });
  if (!parsed.success) return { error: "Use a password with at least 12 characters." };
  if (parsed.data.password !== parsed.data.confirmPassword) {
    return { error: "The passwords do not match." };
  }

  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;
  const isRecoverySession = hasAuthFlowMethod(claims?.amr, "recovery");
  if (claimsError || !claims?.sub || !isRecoverySession) return { error: "Open a fresh password recovery link before updating your password." };
  const [{ data: factors, error: factorsError }, { data: assurance, error: assuranceError }] = await Promise.all([
    supabase.auth.mfa.listFactors(),
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
  ]);
  if (factorsError || assuranceError) return { error: "MFA status could not be verified. Retry after the connection is restored." };
  if (factors?.totp.some((factor) => factor.status === "verified") && assurance?.currentLevel !== "aal2") {
    redirect("/mfa?next=%2Freset-password");
  }
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: "Password update failed. Request a new recovery link and try again." };
  return { message: "Password updated successfully.", passwordUpdated: true };
}

export async function signOutAction() {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();
  redirect(error ? "/login?auth=logout-error" : "/login");
}
 

export async function acceptInvitationAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = z.object({
    password: z.string().min(12).max(128),
    confirmPassword: z.string().min(12).max(128),
  }).safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirm-password"),
  });
  if (!parsed.success) return { error: "Use a password with at least 12 characters." };
  if (parsed.data.password !== parsed.data.confirmPassword) {
    return { error: "The passwords do not match." };
  }

  const cookieStore = await cookies();
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;
  const handoffSubject = cookieStore.get("ctt_invite_verified")?.value;
  const isInviteSession = hasAuthFlowMethod(claims?.amr, "invite") && hasFreshInvitationSession(handoffSubject, claims?.sub, claims?.amr);
  const { data: invitationValid, error: invitationError } = await supabase.rpc("has_valid_auth_invitation");
  const { data: platformInvitation } = await supabase.rpc("has_valid_platform_invitation");
  if (claimsError || !claims?.sub || !isInviteSession || invitationError || invitationValid !== true) return { error: "Open the latest valid invitation link and use its Continue button before setting the password." };
  const { error: passwordError } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (passwordError) return { error: "Password setup failed. Ask an administrator to review the pending invitation." };
  if (platformInvitation === true) {
    const { error: acceptError } = await supabase.rpc("accept_platform_invitation");
    if (acceptError) return { error: "The invitation could not be accepted. Ask an administrator to review its status." };
  }
  cookieStore.delete("ctt_invite_verified");
  redirect("/auth/continue");
}

export async function inviteUserAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = z.object({
    email: z.string().trim().email().max(320),
    role: z.enum(["platform_admin", "developer", "support_staff"]),
  }).safeParse({ email: formData.get("email"), role: formData.get("role") });
  if (!parsed.success) return { error: "Enter a valid email address and an authorized platform role." };

  const { roles } = await requireWorkspace("admin", ["team"]);
  if (!roles.some((role) => role === "super_admin" || role === "platform_admin")) redirect("/access-denied");

  const appBase = resolveAppOrigin();
  if (!appBase) return { error: "Invitations are unavailable because the HTTPS app origin is not configured." };
  let admin;
  try { admin = createAdminClient(); }
  catch { return { error: "Invitation sending is unavailable until the server-only Supabase secret is configured." }; }

  let userDirectoryComplete = false;
  for (let page = 1; page <= 100; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) return { error: "Could not verify whether this email already has an Auth account; no invitation was created." };
    if (data.users.some((user) => user.email?.toLowerCase() === parsed.data.email.toLowerCase())) {
      return { error: "An Auth account already exists for this email. Use the pending invitation resend flow if applicable." };
    }
    if (data.users.length < 1000) { userDirectoryComplete = true; break; }
  }
  if (!userDirectoryComplete) return { error: "The Auth user directory is too large to verify safely; no invitation was created." };

  const supabase = await createClient();
  const { data: invitationId, error: invitationError } = await supabase.rpc("create_platform_invitation", {
    p_email: parsed.data.email,
    p_role: parsed.data.role,
    p_expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  });
  if (invitationError || typeof invitationId !== "string") {
    return { error: "The invitation could not be recorded. Confirm your role, MFA and that no active invitation already exists." };
  }

  const redirectTo = invitationRedirectTo(appBase);
  const { data: invited, error } = await admin.auth.admin.inviteUserByEmail(parsed.data.email, { redirectTo });
  if (error) {
    await supabase.rpc("revoke_platform_invitation", { p_invitation_id: invitationId });
    console.error("[auth.invitation] Supabase Auth rejected invitation email request", {
      code: safeInvitationEmailCode(error.code),
      status: error.status ?? null,
    });
    return { error: `${invitationEmailFailureMessage(error)} The recorded invitation was revoked.` };
  }
  if (invited.user?.id) {
    const { error: linkError } = await supabase.rpc("link_platform_invitation_auth_user", {
      p_invitation_id: invitationId,
      p_auth_user_id: invited.user.id,
    });
    if (linkError) console.error("[auth.invitation] Auth user linkage failed", { code: safeInvitationListErrorCode(linkError.code) });
  }
  revalidatePath("/admin/team");
  return { message: `Supabase accepted the invitation email request for the ${parsed.data.role.replaceAll("_", " ")} role. Email delivery is handled by Supabase Auth and is not confirmed by this response. The invitation expires in one hour and is single-use.` };
}

export async function resendPlatformInvitationAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const parsed = z.string().uuid().safeParse(formData.get("id"));
  if (!parsed.success) return { error: "Select a valid invitation." };
  const { roles } = await requireWorkspace("admin", ["team"]);
  if (!roles.some((role) => role === "super_admin" || role === "platform_admin")) redirect("/access-denied");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("resend_platform_invitation", { p_invitation_id: parsed.data });
  const invitation = Array.isArray(data) ? data[0] : null;
  if (error || !invitation?.id || !invitation.email || !invitation.role) {
    if (error) console.error("[admin.team.invitations] resend RPC failed", { code: safeInvitationListErrorCode(error.code) });
    return { error: error ? `Supabase rejected the resend request (reference ${safeInvitationListErrorCode(error.code)}). Verify your Super Admin or Platform Admin access and MFA, then retry.` : "The invitation could not be rotated. It may no longer be pending or your role may not authorize it." };
  }
  let admin;
  try { admin = createAdminClient(); }
  catch { await supabase.rpc("revoke_platform_invitation", { p_invitation_id: invitation.id }); return { error: "The server-only Supabase credential is unavailable; the new invitation was revoked." }; }
  let invitedUser = null;
  for (let page = 1; page <= 100; page += 1) {
    const { data: users, error: lookupError } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (lookupError) { await supabase.rpc("revoke_platform_invitation", { p_invitation_id: invitation.id }); return { error: "The existing Auth identity could not be verified; the new invitation was revoked." }; }
    invitedUser = users.users.find((user) => user.email?.toLowerCase() === invitation.email.toLowerCase()) ?? invitedUser;
    if (invitedUser || users.users.length < 1000) break;
  }
  if (!invitedUser?.invited_at || invitedUser.email_confirmed_at) {
    await supabase.rpc("revoke_platform_invitation", { p_invitation_id: invitation.id });
    return { error: "Resend is allowed only for the existing unconfirmed invited Auth account; its new invitation was revoked." };
  }
  const appBase = resolveAppOrigin();
  if (!appBase) { await supabase.rpc("revoke_platform_invitation", { p_invitation_id: invitation.id }); return { error: "The secure application origin is unavailable; the new invitation was revoked." }; }
  const redirectTo = invitationRedirectTo(appBase);
  const { data: resentUser, error: sendError } = await admin.auth.admin.inviteUserByEmail(invitation.email, { redirectTo });
  if (sendError) {
    await supabase.rpc("revoke_platform_invitation", { p_invitation_id: invitation.id });
    console.error("[auth.invitation] Supabase Auth rejected invitation resend", {
      code: safeInvitationEmailCode(sendError.code),
      status: sendError.status ?? null,
    });
    return { error: `${invitationEmailFailureMessage(sendError)} The rotated invitation was revoked.` };
  }
  if (resentUser.user?.id) {
    const { error: linkError } = await supabase.rpc("link_platform_invitation_auth_user", {
      p_invitation_id: invitation.id,
      p_auth_user_id: resentUser.user.id,
    });
    if (linkError) console.error("[auth.invitation] Auth user linkage failed after resend", { code: safeInvitationListErrorCode(linkError.code) });
  }
  revalidatePath("/admin/team");
  return { message: `Supabase accepted a fresh invitation email request for the existing ${invitation.role.replaceAll("_", " ")} account. Email delivery is handled by Supabase Auth and is not confirmed by this response.` };
 }

export async function revokePlatformInvitationAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const parsed = z.string().uuid().safeParse(formData.get("id"));
  if (!parsed.success) return { error: "Select a valid invitation." };
  const { roles } = await requireWorkspace("admin", ["team"]);
  if (!roles.some((role) => role === "super_admin" || role === "platform_admin")) redirect("/access-denied");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("revoke_platform_invitation", { p_invitation_id: parsed.data });
  if (error) {
    console.error("[admin.team.invitations] revoke RPC failed", { code: safeInvitationListErrorCode(error.code) });
    return { error: "Supabase rejected the revoke request (reference " + safeInvitationListErrorCode(error.code) + "). Verify your Super Admin or Platform Admin access and MFA, then retry." };
  }
  if (data !== true) return { error: "This invitation is no longer pending, so it was not revoked." };
  revalidatePath("/admin/team");
  return { message: "Invitation revoked." };
}

export async function archivePlatformInvitationAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const parsed = z.string().uuid().safeParse(formData.get("id"));
  if (!parsed.success) return { error: "Select a valid invitation." };
  const { roles } = await requireWorkspace("admin", ["team"]);
  if (!roles.some((role) => role === "super_admin" || role === "platform_admin")) redirect("/access-denied");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("archive_platform_invitation", { p_invitation_id: parsed.data });
  if (error) {
    console.error("[admin.team.invitations] archive RPC failed", { code: safeInvitationListErrorCode(error.code) });
    return { error: "Supabase rejected the archive request (reference " + safeInvitationListErrorCode(error.code) + "). Verify your administrator access and MFA, then retry." };
  }
  if (data !== true) return { error: "Only expired, accepted, or revoked invitation records can be archived." };
  revalidatePath("/admin/team");
  return { message: "Invitation record archived; user accounts and roles were not changed." };
}
export async function bootstrapInitialSuperAdminAction() {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user || !user.email_confirmed_at || !user.invited_at) redirect("/access-denied");
  const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance?.currentLevel !== "aal2") redirect("/mfa?next=%2Fbootstrap%2Finitial");
  const { error } = await supabase.rpc("bootstrap_initial_super_admin");
  if (error) redirect("/bootstrap/initial?error=not-authorized");
  redirect("/auth/continue");
}


export async function transferSuperAdminSlotToOwnerAction() {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user || !user.email_confirmed_at || !user.invited_at) redirect("/access-denied");
  const { data: candidate, error: candidateError } = await supabase.rpc("is_owner_super_admin_transfer_candidate");
  if (candidateError || !candidate) redirect("/access-denied");
  const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance?.currentLevel !== "aal2") redirect("/mfa?next=%2Fbootstrap%2Fowner-transfer");
  const { error } = await supabase.rpc("claim_owner_super_admin_transfer");
  if (error) redirect("/bootstrap/owner-transfer?error=transfer-failed");
  redirect("/auth/continue");
}

export async function setPlatformRoleAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = z.object({
    userId: z.string().uuid(),
    role: z.union([z.literal(""), z.enum(["platform_admin", "developer", "support_staff"])]),
  }).safeParse({ "userId": formData.get("user-id"), role: formData.get("role") });
  if (!parsed.success) return { error: "Choose a valid invited staff account and platform role." };

  const { roles } = await requireWorkspace("admin", ["team"]);
  const isSuperAdmin = roles.includes("super_admin");
  if (!isSuperAdmin && !roles.includes("platform_admin")) redirect("/access-denied");
  if (parsed.data.role === "platform_admin" && !isSuperAdmin) {
    return { error: "Only the Super Admin can assign the Platform Admin role." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_platform_role", {
    p_user_id: parsed.data.userId,
    p_role: parsed.data.role || null,
  });
  if (error) return { error: "The role change was rejected. Confirm the invitee, role authority, and verified MFA session." };

  revalidatePath("/admin/team");
  revalidatePath("/admin/roles");
  return { message: parsed.data.role ? "Platform role updated." : "Platform role access revoked." };
}

export async function removeAuthenticatorFactorAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const factorId = z.string().uuid().safeParse(formData.get("factor-id"));
  if (!factorId.success) return { error: "Select a valid authenticator device." };

  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return { error: "Sign in before managing authenticator devices." };
  const [{ data: assurance, error: assuranceError }, { data: factors, error: factorsError }] = await Promise.all([
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    supabase.auth.mfa.listFactors(),
  ]);
  if (assuranceError || factorsError || !factors) return { error: "Supabase could not verify your account security state." };
  if (assurance?.currentLevel !== "aal2") return { error: "Verify an enrolled authenticator before changing account security." };

  const verifiedFactors = factors.totp.filter((factor) => factor.status === "verified");
  if (verifiedFactors.length <= 1) return { error: "The last verified authenticator cannot be removed. Add and verify a replacement first." };
  if (!verifiedFactors.some((factor) => factor.id === factorId.data)) return { error: "That verified authenticator was not found on your account." };

  const { error } = await supabase.auth.mfa.unenroll({ factorId: factorId.data });
  if (error) return { error: "Supabase could not remove that authenticator. No other factor was changed." };
  revalidatePath("/account/security");
  revalidatePath("/mfa");
  return { message: "Authenticator removed. At least one verified factor remains active." };
}

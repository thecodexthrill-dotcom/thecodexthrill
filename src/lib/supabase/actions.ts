"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireWorkspace } from "@/lib/supabase/access";
import { resolveAppOrigin } from "@/lib/app-origin";

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

  const appBase = resolveAppOrigin("http://127.0.0.1:3000");
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
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return { error: "Open the password link from your email again." };
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: "Password update failed. Request a new recovery link and try again." };
  return { message: "Password updated successfully.", passwordUpdated: true };
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
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

  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user || !user.email_confirmed_at || !user.invited_at) {
    return { error: "Open the verified invitation email link again. Public account creation is disabled." };
  }
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: "Password setup failed. Ask an administrator to send a fresh invitation." };
  redirect("/auth/continue");
}

export async function inviteUserAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const email = z.string().trim().email().max(320).safeParse(formData.get("email"));
  if (!email.success) return { error: "Enter a valid email address." };

  const { roles } = await requireWorkspace("admin", ["team"]);
  if (!roles.some((role) => role === "super_admin" || role === "platform_admin")) {
    redirect("/access-denied");
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { error: "Invitation sending is unavailable until the server-only Supabase secret is configured." };
  }

  const supabase = await createClient();
  const { error: auditError } = await supabase.rpc("record_platform_invitation_request", {
    p_email: email.data,
  });
  if (auditError) return { error: "The invitation attempt could not be audited; no invitation was sent." };

  const appBase = resolveAppOrigin("http://127.0.0.1:3000");
  if (!appBase) return { error: "Invitations are unavailable because the HTTPS app origin is not configured." };
  const redirectTo = new URL("/auth/callback?next=%2Finvite%2Faccept", appBase).toString();

  const { error } = await admin.auth.admin.inviteUserByEmail(email.data, { redirectTo });
  if (error) return { error: "Supabase did not send the invitation. Confirm the address and configured Auth email delivery." };
  return { message: "Invitation sent. No role was assigned; an authorized administrator must grant access separately." };
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
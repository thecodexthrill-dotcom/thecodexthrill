import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  inspectUserDeletionDependencies,
  loadSuperAdminUserDirectory,
  permanentlyDeleteSupabaseAuthUser,
  restoreUserWorkspaceAccess,
  revokeUserWorkspaceAccess,
} from "../src/lib/supabase/user-management-service.ts";

function loadEnvLocal() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex <= 0) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const rawVal = trimmed.slice(eqIndex + 1).trim();
    const val = rawVal.replace(/^['"]|['"]$/g, "");
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvLocal();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey =
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY");
  process.exit(1);
}

const admin = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function runAcceptance() {
  console.log("=== Super Admin User Management & Safe Permanent Deletion Acceptance ===");

  // 1. Snapshot original Auth user IDs to guarantee zero existing accounts are modified or deleted
  const { data: beforeUsersData, error: beforeErr } =
    await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  assert.ifError(beforeErr);
  const originalUserIds = new Set((beforeUsersData.users ?? []).map((u) => u.id));
  console.log(`[1/7] Verified baseline Auth user count: ${originalUserIds.size}`);

  // Lookup designated Super Admin ID for actor context
  const { data: superAdminRow, error: saErr } = await admin
    .from("platform_super_admin_designation")
    .select("user_id")
    .eq("slot", 1)
    .single();
  assert.ifError(saErr);
  assert.ok(superAdminRow?.user_id, "Super Admin slot 1 must exist");
  const superAdminId = superAdminRow.user_id;

  let disposableUserId = null;

  try {
    // 2. Create a disposable test account specifically for this test
    const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const disposableEmail = `disposable-delete-test-${uniqueSuffix}@example.com`;

    const { data: createdRes, error: createErr } =
      await admin.auth.admin.createUser({
        email: disposableEmail,
        password: `DisposablePass!${uniqueSuffix}`,
        email_confirm: true,
        user_metadata: {
          full_name: "Disposable Delete Verification User",
        },
      });
    assert.ifError(createErr);
    assert.ok(createdRes?.user?.id, "Disposable user must be created");
    disposableUserId = createdRes.user.id;
    console.log(
      `[2/7] Created disposable test user: ${disposableEmail} (${disposableUserId})`,
    );

    // 3. Load Super Admin User Directory and verify classification + presence + MFA factor lookup
    const directory = await loadSuperAdminUserDirectory({
      actorUserId: superAdminId,
      actorCurrentAal: "aal2",
      invitations: [],
      adminClientOverride: admin,
    });
    assert.equal(directory.error, undefined);
    assert.equal(directory.users.length, originalUserIds.size + 1);

    const disposableInDir = directory.users.find(
      (u) => u.userId === disposableUserId,
    );
    assert.ok(disposableInDir, "Disposable user must appear in directory");
    assert.equal(disposableInDir.diagnosticCategory, "confirmed_test_account");
    assert.equal(disposableInDir.canPermanentlyDelete, true);
    assert.equal(disposableInDir.mfaStatus, "no_mfa");

    const protectedOwnerInDir = directory.users.find(
      (u) => u.userId === superAdminId,
    );
    assert.ok(protectedOwnerInDir, "Super Admin must appear in directory");
    assert.equal(protectedOwnerInDir.isSuperAdmin, true);
    assert.equal(protectedOwnerInDir.canPermanentlyDelete, false);
    assert.equal(protectedOwnerInDir.canRevokeAccess, false);
    assert.equal(protectedOwnerInDir.mfaStatus, "verified_totp");
    assert.ok(protectedOwnerInDir.verifiedTotpCount >= 1);
    assert.equal(protectedOwnerInDir.isCurrentSessionUser, true);
    assert.equal(protectedOwnerInDir.currentSessionAal, "aal2");
    console.log(
      `[3/7] Verified directory loader, MFA factor lookup (${protectedOwnerInDir.mfaStatus}, count=${protectedOwnerInDir.verifiedTotpCount}, session=${protectedOwnerInDir.currentSessionAal}), and account classification`,
    );

    // 4. Test Access Revocation & Restoration on the disposable user
    const revokeRes = await revokeUserWorkspaceAccess({
      actorUserId: superAdminId,
      actorRoles: ["super_admin"],
      actorMfaLevel: "aal2",
      targetUserId: disposableUserId,
      reason: "Automated acceptance test access revocation",
      adminClientOverride: admin,
    });
    assert.equal(revokeRes.ok, true, revokeRes.error);

    const { data: afterRevokeUser } =
      await admin.auth.admin.getUserById(disposableUserId);
    assert.equal(
      afterRevokeUser?.user?.user_metadata?.account_access_revoked,
      true,
    );
    assert.ok(afterRevokeUser?.user?.banned_until);

    const restoreRes = await restoreUserWorkspaceAccess({
      actorUserId: superAdminId,
      actorRoles: ["super_admin"],
      actorMfaLevel: "aal2",
      targetUserId: disposableUserId,
      adminClientOverride: admin,
    });
    assert.equal(restoreRes.ok, true, restoreRes.error);

    const { data: afterRestoreUser } =
      await admin.auth.admin.getUserById(disposableUserId);
    assert.equal(
      Boolean(afterRestoreUser?.user?.user_metadata?.account_access_revoked),
      false,
    );
    console.log("[4/7] Verified Revoke Access / Disable & Restore Access flows");

    // 5. Test negative authorization & safety guardrails on permanent deletion
    const nonSuperAdminAttempt = await permanentlyDeleteSupabaseAuthUser({
      actorUserId: superAdminId,
      actorRoles: ["platform_admin"],
      actorMfaLevel: "aal2",
      targetUserId: disposableUserId,
      confirmationEmail: disposableEmail,
      typedConfirmation: `DELETE ${disposableEmail}`,
      adminClientOverride: admin,
    });
    assert.equal(nonSuperAdminAttempt.ok, false);
    assert.equal(nonSuperAdminAttempt.code, "unauthorized_role");

    const missingMfaAttempt = await permanentlyDeleteSupabaseAuthUser({
      actorUserId: superAdminId,
      actorRoles: ["super_admin"],
      actorMfaLevel: "aal1",
      targetUserId: disposableUserId,
      confirmationEmail: disposableEmail,
      typedConfirmation: `DELETE ${disposableEmail}`,
      adminClientOverride: admin,
    });
    assert.equal(missingMfaAttempt.ok, false);
    assert.equal(missingMfaAttempt.code, "mfa_aal2_required");

    const selfDeleteAttempt = await permanentlyDeleteSupabaseAuthUser({
      actorUserId: superAdminId,
      actorRoles: ["super_admin"],
      actorMfaLevel: "aal2",
      targetUserId: superAdminId,
      confirmationEmail: protectedOwnerInDir.email,
      typedConfirmation: `DELETE ${protectedOwnerInDir.email}`,
      adminClientOverride: admin,
    });
    assert.equal(selfDeleteAttempt.ok, false);
    assert.equal(selfDeleteAttempt.code, "self_deletion_forbidden");

    const wrongConfirmationAttempt = await permanentlyDeleteSupabaseAuthUser({
      actorUserId: superAdminId,
      actorRoles: ["super_admin"],
      actorMfaLevel: "aal2",
      targetUserId: disposableUserId,
      confirmationEmail: disposableEmail,
      typedConfirmation: "WRONG PHRASE",
      adminClientOverride: admin,
    });
    assert.equal(wrongConfirmationAttempt.ok, false);
    assert.equal(wrongConfirmationAttempt.code, "typed_confirmation_mismatch");
    console.log(
      "[5/7] Verified RBAC, MFA AAL2, self-delete, and typed confirmation guardrails",
    );

    // 6. Permanently delete the disposable test user and verify absence in Auth & profiles
    const depsBeforeDelete = await inspectUserDeletionDependencies(
      admin,
      disposableUserId,
    );
    assert.equal(depsBeforeDelete.isDesignatedSuperAdmin, false);

    const deleteRes = await permanentlyDeleteSupabaseAuthUser({
      actorUserId: superAdminId,
      actorRoles: ["super_admin"],
      actorMfaLevel: "aal2",
      targetUserId: disposableUserId,
      confirmationEmail: disposableEmail,
      typedConfirmation: `DELETE ${disposableEmail}`,
      adminClientOverride: admin,
    });
    assert.equal(deleteRes.ok, true, deleteRes.error);
    assert.equal(deleteRes.code, "deleted");

    const { data: verifyGone } =
      await admin.auth.admin.getUserById(disposableUserId);
    assert.equal(
      verifyGone?.user ?? null,
      null,
      "Disposable user must be absent from Supabase Auth after permanent deletion",
    );

    const { data: profileGone } = await admin
      .from("profiles")
      .select("id")
      .eq("id", disposableUserId)
      .maybeSingle();
    assert.equal(
      profileGone,
      null,
      "Disposable user profile must be absent from public.profiles after permanent deletion",
    );

    // Verify audit event was written, then clean up the test's own audit rows
    const { data: auditRows, error: auditErr } = await admin
      .from("audit_events")
      .select("id, action, target_id, details")
      .eq("target_id", disposableUserId);
    assert.ifError(auditErr);
    const deleteAudit = (auditRows ?? []).find(
      (r) => r.action === "platform.user.permanently_deleted",
    );
    assert.ok(deleteAudit, "Permanent deletion audit event must be recorded");
    assert.equal(deleteAudit.details?.verified_absent_in_auth, true);

    await admin
      .from("audit_events")
      .delete()
      .eq("target_id", disposableUserId);

    disposableUserId = null;
    console.log(
      "[6/7] Verified permanent Supabase Auth deletion, profile cleanup, and audit event logging",
    );
  } finally {
    if (disposableUserId) {
      await admin.from("profiles").delete().eq("id", disposableUserId);
      await admin.auth.admin.deleteUser(disposableUserId);
      await admin
        .from("audit_events")
        .delete()
        .eq("target_id", disposableUserId);
    }
  }

  // 7. Verify all original baseline users remain untouched
  const { data: afterUsersData, error: afterErr } =
    await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  assert.ifError(afterErr);
  const afterUserIds = new Set((afterUsersData.users ?? []).map((u) => u.id));
  assert.equal(
    afterUserIds.size,
    originalUserIds.size,
    "Original Auth user count must be unchanged",
  );
  for (const id of originalUserIds) {
    assert.ok(afterUserIds.has(id), `Original user ${id} must remain intact`);
  }
  console.log(
    `[7/7] Verified all ${originalUserIds.size} existing Supabase Auth accounts remain untouched.`,
  );
  console.log("=== ALL USER MANAGEMENT ACCEPTANCE CHECKS PASSED ===");
}

runAcceptance().catch((err) => {
  console.error("Acceptance test failed:", err);
  process.exit(1);
});


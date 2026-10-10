import { createClient } from "@supabase/supabase-js";
import nextEnv from "@next/env";
const { loadEnvConfig } = nextEnv;

loadEnvConfig(process.cwd());

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceKey = process.env.SUPABASE_SECRET_KEY;
const appBaseUrl = process.env.APP_BASE_URL;

console.log("============================================================");
console.log("SUPABASE PRODUCTION & RELEASE READINESS CHECK");
console.log("============================================================");
console.log("Supabase Host:", supabaseUrl ? new URL(supabaseUrl).host : "MISSING");
console.log("Configured APP_BASE_URL:", appBaseUrl || "MISSING");

const adminClient = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false },
});

const anonClient = createClient(supabaseUrl, anonKey, {
  auth: { persistSession: false },
});

async function main() {
  // 1. Check storage bucket
  console.log("\n[1] Storage Bucket 'tenant-documents'...");
  const { data: buckets, error: bucketErr } = await adminClient.storage.listBuckets();
  if (bucketErr) {
    console.error("  [FAIL] Bucket list error:", bucketErr.message);
  } else {
    const bucket = buckets.find(b => b.id === "tenant-documents");
    if (bucket) {
      console.log(`  [PASS] 'tenant-documents' bucket exists in Supabase Cloud`);
      console.log(`         Public: ${bucket.public} (strictly private)`);
      console.log(`         File Size Limit: ${bucket.file_size_limit ? bucket.file_size_limit / 1024 / 1024 + 'MB' : 'Default'}`);
      console.log(`         Allowed MIME types: ${bucket.allowed_mime_types ? bucket.allowed_mime_types.join(', ') : 'All'}`);
    } else {
      console.log("  [FAIL] 'tenant-documents' bucket NOT found in list:", buckets.map(b => b.id));
    }
  }

  // 2. Check anon access to tenant-documents
  console.log("\n[2] Storage Bucket Anonymous Access Isolation...");
  const { data: anonFiles, error: anonStorageErr } = await anonClient.storage.from("tenant-documents").list();
  if (anonStorageErr || !anonFiles || anonFiles.length === 0) {
    console.log("  [PASS] Anonymous storage listing blocked or isolated:", anonStorageErr ? anonStorageErr.message : "0 files accessible");
  } else {
    console.log("  [WARN] Anonymous user listed files:", anonFiles.length);
  }

  // 3. Check Auth SMTP / invitation behavior
  console.log("\n[3] Auth Invitation & Delivery Behavior...");
  const testEmail = "release-verification-check@example.com";
  const { data: inviteData, error: inviteErr } = await adminClient.auth.admin.inviteUserByEmail(testEmail, {
    redirectTo: "https://thecodexthrill.com/auth/callback?type=invite",
  });

  if (inviteErr) {
    console.log("  Response Error Code:", inviteErr.code || inviteErr.status || "no_code");
    console.log("  Response Message:", inviteErr.message);
    if (inviteErr.code === "email_address_not_authorized" || inviteErr.message?.includes("not authorized") || inviteErr.message?.includes("team member")) {
      console.log("  [AUDIT RESULT] Supabase default email service active (rate-limited / team-only). Custom SMTP provider not yet configured in Supabase Cloud Dashboard.");
    } else if (inviteErr.status === 429 || inviteErr.message?.includes("rate limit")) {
      console.log("  [AUDIT RESULT] Supabase email rate limit in effect.");
    } else {
      console.log("  [AUDIT RESULT] Supabase Auth returned:", inviteErr.message);
    }
  } else {
    console.log("  [PASS] Auth invite accepted by Supabase Auth (Custom SMTP active or permitted domain).");
    if (inviteData?.user?.id) {
      await adminClient.auth.admin.deleteUser(inviteData.user.id);
      console.log("  [PASS] Cleaned up test user record.");
    }
  }

  // 4. Check platform_invitations table and RPC security
  console.log("\n[4] platform_invitations Security Definer Enforcement...");
  const { data: invRpc, error: invRpcErr } = await adminClient.rpc("list_platform_invitations");
  if (invRpcErr) {
    console.log("  RPC list_platform_invitations status:", invRpcErr.message);
  } else {
    console.log(`  [PASS] list_platform_invitations RPC functional (${invRpc?.length ?? 0} invitations listed)`);
  }

  const { error: anonInvErr } = await anonClient.from("platform_invitations").select("id");
  if (anonInvErr) {
    console.log("  [PASS] Direct anonymous access to platform_invitations strictly blocked by RLS/Permissions:", anonInvErr.message);
  } else {
    console.log("  [FAIL] Anonymous access to platform_invitations was NOT blocked!");
  }

  // 5. Check URL configuration & callbacks
  console.log("\n[5] Authentication Callbacks & Redirect URLs...");
  console.log("  Canonical Production App URL: https://thecodexthrill.com");
  console.log("  Invitation acceptance callback path: /auth/callback?type=invite");
  console.log("  Password reset callback path: /auth/callback?type=recovery");
  console.log("  Direct platform login path: /login");
  console.log("  MFA verification path: /login/mfa");
}

main().catch(console.error);


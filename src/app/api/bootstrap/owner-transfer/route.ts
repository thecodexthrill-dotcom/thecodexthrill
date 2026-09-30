import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyOwnerBootstrapToken } from "@/lib/supabase/bootstrap-token";

export const runtime = "nodejs";

function isLocalEndpoint(value: string | undefined, port: string) {
  try {
    const url = new URL(value ?? "");
    return url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname) && url.port === port;
  } catch { return false; }
}

export async function POST(request: NextRequest) {
  if (!isLocalEndpoint(process.env.NEXT_PUBLIC_SUPABASE_URL, "54321") || !isLocalEndpoint(process.env.APP_BASE_URL, "3000")) {
    return NextResponse.json({ error: "Owner transfer provisioning is restricted to the local development stack." }, { status: 503 });
  }
  const authorization = request.headers.get("authorization");
  const match = authorization?.match(/^Bearer ([A-Za-z0-9_.-]{1,2048})$/);
  const signingSecret = process.env.OWNER_SUPER_ADMIN_TRANSFER_TOKEN;
  const token = signingSecret && match ? verifyOwnerBootstrapToken(match[1], signingSecret) : null;
  if (!token) return NextResponse.json({ error: "Unauthorized or expired local owner token." }, { status: 401 });

  const email = z.string().trim().email().max(320).safeParse(process.env.OWNER_SUPER_ADMIN_EMAIL);
  if (!email.success) return NextResponse.json({ error: "Set OWNER_SUPER_ADMIN_EMAIL in local .env.local first." }, { status: 503 });
  try { await request.json(); } catch {
    return NextResponse.json({ error: "A local owner confirmation request is required." }, { status: 400 });
  }

  let admin;
  try { admin = createAdminClient(); } catch {
    return NextResponse.json({ error: "Local server-only Supabase credentials are unavailable." }, { status: 503 });
  }
  const { data: authorized, error: authorizeError } = await admin.rpc("authorize_owner_super_admin_transfer", {
    p_email: email.data,
    p_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    p_owner_token_nonce_hash: token.nonceHash,
  });
  if (authorizeError || authorized !== true) {
    return NextResponse.json({ error: "The local transfer could not be authorized. Check for an existing account or pending transfer." }, { status: 409 });
  }

  const redirectTo = new URL("/auth/callback?next=%2Finvite%2Faccept", process.env.APP_BASE_URL).toString();
  const { error: invitationError } = await admin.auth.admin.inviteUserByEmail(email.data, { redirectTo });
  if (invitationError) {
    await admin.rpc("revoke_owner_super_admin_transfer", { p_owner_token_nonce_hash: token.nonceHash });
    return NextResponse.json({ error: "The local invitation could not be sent; its pending authorization was revoked." }, { status: 502 });
  }
  return NextResponse.json({ ok: true, message: "Local owner invitation sent. Accept it, set a password, enroll and verify TOTP, then confirm the existing Super Admin slot transfer." });
}
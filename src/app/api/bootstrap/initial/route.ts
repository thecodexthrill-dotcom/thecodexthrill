import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyOwnerBootstrapToken } from "@/lib/supabase/bootstrap-token";

export const runtime = "nodejs";

function getOwnerToken(request: NextRequest) {
  const signingSecret = process.env.INITIAL_SUPER_ADMIN_BOOTSTRAP_TOKEN;
  const authorization = request.headers.get("authorization");
  const match = authorization?.match(/^Bearer ([A-Za-z0-9_.-]{1,2048})$/);
  if (!signingSecret || !match) return null;
  return verifyOwnerBootstrapToken(match[1], signingSecret);
}

export async function POST(request: NextRequest) {
  const ownerToken = getOwnerToken(request);
  if (!ownerToken) return NextResponse.json({ error: "Unauthorized or expired bootstrap token." }, { status: 401 });

  const baseUrl = process.env.APP_BASE_URL;
  if (!baseUrl) return NextResponse.json({ error: "APP_BASE_URL is not configured." }, { status: 503 });
  let redirectTo: string;
  try {
    const base = new URL(baseUrl);
    if (base.protocol !== "https:" && base.hostname !== "127.0.0.1" && base.hostname !== "localhost") {
      return NextResponse.json({ error: "APP_BASE_URL must use HTTPS outside local development." }, { status: 503 });
    }
    redirectTo = new URL("/auth/callback?next=%2Finvite%2Faccept", base).toString();
  } catch {
    return NextResponse.json({ error: "APP_BASE_URL is invalid." }, { status: 503 });
  }

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const parsed = z.object({ email: z.string().trim().email().max(320) }).safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "A valid owner-approved email is required." }, { status: 400 });
  const configuredOwnerEmail = process.env.OWNER_SUPER_ADMIN_EMAIL?.trim().toLowerCase();
  if (!configuredOwnerEmail || parsed.data.email.toLowerCase() !== configuredOwnerEmail) {
    return NextResponse.json({ error: "The requested account does not match the configured Owner identity." }, { status: 403 });
  }

  let admin;
  try { admin = createAdminClient(); } catch {
    return NextResponse.json({ error: "Server-only Supabase credentials are unavailable." }, { status: 503 });
  }

  let existingOwner = null;
  for (let page = 1; page <= 100; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) return NextResponse.json({ error: "The existing Owner identity could not be verified." }, { status: 503 });
    existingOwner = data.users.find((user) => user.email?.toLowerCase() === configuredOwnerEmail) ?? existingOwner;
    if (existingOwner || data.users.length < 1000) break;
  }

  if (existingOwner && (!existingOwner.email_confirmed_at || !existingOwner.invited_at
    || existingOwner.is_anonymous
    || (existingOwner.banned_until && new Date(existingOwner.banned_until).getTime() > Date.now()))) {
    return NextResponse.json({ error: "The existing Owner account is not an eligible verified invitation; no authorization was recorded." }, { status: 409 });
  }

  const authorizationExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const { data: authorized, error: authorizationError } = await admin.rpc("authorize_initial_super_admin", {
    p_email: parsed.data.email,
    p_expires_at: authorizationExpiresAt,
    p_owner_token_nonce_hash: ownerToken.nonceHash,
  });
  if (authorizationError || authorized !== true) {
    return NextResponse.json({ error: "Initial bootstrap authorization is expired, already used, or could not be recorded." }, { status: 409 });
  }

  if (existingOwner) {
    return NextResponse.json({ ok: true, message: "The existing Owner account is already confirmed from an invitation. No duplicate invitation was sent; sign in or request password recovery, then enroll and verify TOTP MFA before explicitly confirming the one-time designation." });
  }

  const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(parsed.data.email, { redirectTo });
  if (inviteError) {
    return NextResponse.json({ error: "The authorization is recorded but Supabase did not send the invitation. The one-time owner token cannot be reused; administrator intervention is required." }, { status: 502 });
  }

  return NextResponse.json({ ok: true, message: "Invitation sent. The user must verify email, set a password, enroll and verify TOTP MFA, then explicitly confirm the one-time designation." });
}

import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const OWNER_TOKEN_MAX_AGE_SECONDS = 15 * 60;

type OwnerTokenClaims = { exp: number; nonce: string };

export function issueOwnerBootstrapToken(
  signingSecret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): string {
  if (Buffer.byteLength(signingSecret, "utf8") < 32) {
    throw new Error("Bootstrap signing secret must contain at least 32 bytes.");
  }
  const payload = Buffer.from(JSON.stringify({
    exp: nowSeconds + OWNER_TOKEN_MAX_AGE_SECONDS,
    nonce: randomBytes(32).toString("base64url"),
  } satisfies OwnerTokenClaims)).toString("base64url");
  const signature = createHmac("sha256", signingSecret).update(payload).digest("base64url");
  return payload + "." + signature;
}

export function verifyOwnerBootstrapToken(
  token: string,
  signingSecret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): { nonceHash: string; expiresAt: Date } | null {
  if (Buffer.byteLength(signingSecret, "utf8") < 32) return null;
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra !== undefined) return null;

  let suppliedSignature: Buffer;
  let claims: OwnerTokenClaims;
  try {
    suppliedSignature = Buffer.from(signature, "base64url");
    claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as OwnerTokenClaims;
  } catch {
    return null;
  }

  const expectedSignature = createHmac("sha256", signingSecret).update(payload).digest();
  if (suppliedSignature.length !== expectedSignature.length || !timingSafeEqual(suppliedSignature, expectedSignature)) {
    return null;
  }
  if (!Number.isSafeInteger(claims.exp) || claims.exp <= nowSeconds || claims.exp > nowSeconds + OWNER_TOKEN_MAX_AGE_SECONDS) {
    return null;
  }
  if (typeof claims.nonce !== "string") return null;

  let nonce: Buffer;
  try {
    nonce = Buffer.from(claims.nonce, "base64url");
  } catch {
    return null;
  }
  if (nonce.length !== 32 || nonce.toString("base64url") !== claims.nonce) return null;

  const nonceHash = createHash("sha256").update(nonce).digest("hex");
  return { nonceHash, expiresAt: new Date(claims.exp * 1000) };
}

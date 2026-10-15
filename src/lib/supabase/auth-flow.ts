export type AuthFlowMethod = "invite" | "recovery";

export function hasAuthFlowMethod(amr: unknown, method: AuthFlowMethod): boolean {
  return Array.isArray(amr) && amr.some((entry: unknown) =>
    typeof entry === "object"
    && entry !== null
    && "method" in entry
    && (entry.method === method || entry.method === "otp"),
  );
}

const allowedStaticNext = new Set([
  "/portal",
  "/admin",
  "/bootstrap/initial",
  "/bootstrap/owner-transfer",
  "/reset-password",
  "/account/security",
]);

export function isSafeNextPath(candidate: string | null | undefined): boolean {
  if (!candidate || typeof candidate !== "string") return false;
  const trimmed = candidate.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//") || trimmed.includes("\\")) return false;
  if (allowedStaticNext.has(trimmed)) return true;
  if (trimmed.startsWith("/admin") || trimmed.startsWith("/portal") || trimmed.startsWith("/account")) return true;
  return false;
}


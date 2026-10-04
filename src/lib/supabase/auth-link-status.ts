export type AuthLinkStatus = "expired" | "used" | "invalid";

export function classifyAuthLinkError(code: string): AuthLinkStatus {
  const normalized = code.toLowerCase();
  if (normalized.includes("expired")) return "expired";
  if (normalized.includes("used") || normalized.includes("already")) return "used";
  return "invalid";
}
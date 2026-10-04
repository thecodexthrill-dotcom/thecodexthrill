export type AuthFlowMethod = "invite" | "recovery";

export function hasAuthFlowMethod(amr: unknown, method: AuthFlowMethod): boolean {
  return Array.isArray(amr) && amr.some((entry: unknown) =>
    typeof entry === "object" && entry !== null && "method" in entry && entry.method === method,
  );
}

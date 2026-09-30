import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));

  const { data: operational, error: operationalError } = await supabase.rpc("platform_is_operational");
  if (operationalError) return NextResponse.redirect(new URL("/setup-required?area=identity-schema", request.url));
  if (!operational) {
    if (user.invited_at && user.email_confirmed_at) {
      const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      const destination = assurance?.currentLevel === "aal2" ? "/bootstrap/initial" : "/mfa?next=%2Fbootstrap%2Finitial";
      return NextResponse.redirect(new URL(destination, request.url));
    }
    return NextResponse.redirect(new URL("/setup-required?area=super-admin-bootstrap", request.url));
  }

  const { data: ownerTransferCandidate, error: transferCheckError } = await supabase.rpc("is_owner_super_admin_transfer_candidate");
  if (transferCheckError) return NextResponse.redirect(new URL("/setup-required?area=identity-schema", request.url));
  if (ownerTransferCandidate) {
    const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    const destination = assurance?.currentLevel === "aal2"
      ? "/bootstrap/owner-transfer"
      : "/mfa?next=%2Fbootstrap%2Fowner-transfer";
    return NextResponse.redirect(new URL(destination, request.url));
  }
  const [platformResult, superAdminResult, membershipResult] = await Promise.all([
    supabase.from("platform_role_assignments").select("role").eq("user_id", user.id).is("revoked_at", null),
    supabase.from("platform_super_admin_designation").select("user_id").eq("user_id", user.id).maybeSingle(),
    supabase.from("organization_memberships").select("organization_id").eq("user_id", user.id).eq("status", "active").limit(1).maybeSingle(),
  ]);
  if (platformResult.error || superAdminResult.error || membershipResult.error) {
    return NextResponse.redirect(new URL("/setup-required?area=identity-schema", request.url));
  }
  const platform = platformResult.data ?? [];
  const superAdmin = superAdminResult.data;
  const member = membershipResult.data;
  if (!member && !superAdmin && platform.length === 0) return NextResponse.redirect(new URL("/access-pending", request.url));
  const destination = superAdmin || platform.some((item) => ["platform_admin", "developer", "support_staff"].includes(item.role))
    ? "/admin"
    : "/portal";
  return NextResponse.redirect(new URL(destination, request.url));
}

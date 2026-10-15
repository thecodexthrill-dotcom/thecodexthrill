import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logSanitizedOperationalEvent } from "@/lib/supabase/platform-health-helper";
import { extractCanonicalStoragePath } from "@/lib/supabase/delivery-operations-helper";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Document ID required" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 1. Fetch document record
  const { data: doc, error: docError } = await supabase
    .from("tenant_documents")
    .select("id, organization_id, name, file_url, file_type")
    .eq("id", id)
    .maybeSingle();

  if (docError || !doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  // 2. Zero-Trust Tenant Authorization Check
  // Platform staff can access all tenant documents.
  // Portal clients can strictly only access documents belonging to their active organizations.
  const [platformRolesRes, superAdminRes] = await Promise.all([
    supabase
      .from("platform_role_assignments")
      .select("role")
      .eq("user_id", user.id)
      .is("revoked_at", null),
    supabase
      .from("platform_super_admin_designation")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  const isStaff = Boolean(
    superAdminRes.data ||
      platformRolesRes.data?.some((r) =>
        [
          "super_admin",
          "platform_admin",
          "operations_admin",
          "support_admin",
          "developer",
          "support_staff",
        ].includes(r.role),
      ),
  );

  if (!isStaff) {
    const { data: memberships } = await supabase
      .from("organization_memberships")
      .select("organization_id")
      .eq("user_id", user.id)
      .eq("status", "active");

    const allowedOrgIds = new Set(memberships?.map((m) => m.organization_id) ?? []);
    if (!allowedOrgIds.has(doc.organization_id)) {
      logSanitizedOperationalEvent({
        level: "warn",
        scope: "api.documents.download",
        action: "unauthorized_document_access_blocked",
        message: "Portal user attempted to download unauthorized organization document",
        metadata: {
          userId: user.id,
          documentId: doc.id,
          documentOrg: doc.organization_id,
        },
      });
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }
  }

  // 3. Resolve destination URL or fresh signed URL
  const rawFileUrl = doc.file_url?.trim() ?? "";

  // If external URL (e.g., Figma design deck, GitHub repository, external asset link)
  if (
    (rawFileUrl.startsWith("http://") || rawFileUrl.startsWith("https://")) &&
    !rawFileUrl.includes("tenant-documents/")
  ) {
    return NextResponse.redirect(rawFileUrl, 302);
  }

  // Extract canonical storage path
  const storagePath = extractCanonicalStoragePath(rawFileUrl, "tenant-documents");

  if (storagePath) {
    try {
      const adminClient = createAdminClient();
      // Generate fresh, time-bounded signed URL (1 hour)
      const { data: signedData, error: signedError } = await adminClient.storage
        .from("tenant-documents")
        .createSignedUrl(storagePath, 3600);

      if (!signedError && signedData?.signedUrl) {
        return NextResponse.redirect(signedData.signedUrl, 302);
      }
    } catch {
      logSanitizedOperationalEvent({
        level: "error",
        scope: "api.documents.download",
        action: "storage_signed_url_failed",
        message: "Failed to generate signed download URL for document",
        metadata: {
          documentId: doc.id,
          storagePath,
        },
      });
    }
  }

  // Fallback: If raw URL is an HTTP link (e.g. existing static link), redirect to it
  if (rawFileUrl.startsWith("http://") || rawFileUrl.startsWith("https://")) {
    return NextResponse.redirect(rawFileUrl, 302);
  }

  return NextResponse.json(
    { error: "The document storage file could not be retrieved. Please contact your administrator." },
    { status: 404 },
  );
}


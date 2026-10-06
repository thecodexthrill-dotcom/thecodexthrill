import type { Metadata } from "next";
import { PlatformShell } from "@/components/platform/platform-shell";
import { WorkspaceContent } from "@/components/platform/workspace-content";
import { requireWorkspace } from "@/lib/supabase/access";

export const metadata: Metadata = { title: "Admin workspace", robots: { index: false, follow: false } };

export default async function AdminPage({
  params,
  searchParams,
}: {
  params: Promise<{ section?: string[] }>;
  searchParams: Promise<{ created?: string; updated?: string; error?: string; id?: string }>;
}) {
  const [{ section = [] }, query] = await Promise.all([params, searchParams]);
  const { user, roles } = await requireWorkspace("admin", section);
  const selectedId = query.id || (section.length > 1 ? section[1] : undefined);
  return (
    <PlatformShell kind="admin" section={section} roles={roles} userEmail={user.email ?? "Account"}>
      <WorkspaceContent
        kind="admin"
        section={section}
        roles={roles}
        notice={query.created ? "created" : query.updated ? "updated" : query.error}
        selectedId={selectedId}
      />
    </PlatformShell>
  );
}

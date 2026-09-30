import type { Metadata } from "next";
import { PlatformShell } from "@/components/platform/platform-shell";
import { WorkspaceContent } from "@/components/platform/workspace-content";
import { requireWorkspace } from "@/lib/supabase/access";

export const metadata: Metadata = { title: "Client workspace", robots: { index: false, follow: false } };

export default async function PortalPage({ params }: { params: Promise<{ section?: string[] }> }) {
  const { section = [] } = await params;
  const { user, roles } = await requireWorkspace("portal", section);
  return <PlatformShell kind="portal" section={section} roles={roles} userEmail={user.email ?? "Account"}>
    <WorkspaceContent kind="portal" section={section} />
  </PlatformShell>;
}

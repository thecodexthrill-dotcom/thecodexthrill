import type { Metadata } from "next";
import { PlatformShell } from "@/components/platform/platform-shell";
import { WorkspaceContent } from "@/components/platform/workspace-content";
import { requireWorkspace } from "@/lib/supabase/access";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Client workspace", robots: { index: false, follow: false } };

export default async function PortalPage({
  params,
  searchParams,
}: {
  params: Promise<{ section?: string[] }>;
  searchParams: Promise<{
    created?: string;
    updated?: string;
    deleted?: string;
    message_sent?: string;
    notice?: string;
    error?: string;
    id?: string;
  }>;
}) {
  const [{ section = [] }, query] = await Promise.all([params, searchParams]);
  const { user, roles } = await requireWorkspace("portal", section);
  const supabase = await createClient();
  const { count: unreadCount } = await supabase
    .from("user_notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("is_read", false);

  const selectedId = query.id || (section.length > 1 ? section[1] : undefined);
  const noticeState =
    query.notice ||
    (query.created
      ? "created"
      : query.updated
        ? "updated"
        : query.deleted
          ? "deleted"
          : query.message_sent
            ? "message_sent"
            : query.error);

  return (
    <PlatformShell
      kind="portal"
      section={section}
      roles={roles}
      userEmail={user.email ?? "Account"}
      unreadNotificationsCount={unreadCount ?? 0}
    >
      <WorkspaceContent
        kind="portal"
        section={section}
        roles={roles}
        notice={noticeState}
        selectedId={selectedId}
      />
    </PlatformShell>
  );
}

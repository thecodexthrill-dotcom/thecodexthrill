import "server-only";
import { createAdminClient } from "./admin";
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  type NotificationCategory,
  type NotificationPreferences,
  buildNotificationDedupeSignature,
  isDuplicateNotificationInWindow,
  isNotificationCategoryEnabled,
  normalizeNotificationPreferences,
  sanitizeNotificationPayload,
} from "./notification-helper";
import {
  type TransactionalEmailStatus,
  sendTransactionalEmail,
} from "./transactional-email";

export type NotificationDispatchOutcome = {
  userId: string;
  inserted: boolean;
  suppressedReason?: "disabled_by_preference" | "duplicate_in_window" | "insert_error";
  emailStatus: TransactionalEmailStatus;
};

export async function getUserNotificationContext(
  userId: string,
): Promise<{ email: string | null; preferences: NotificationPreferences }> {
  try {
    const adminClient = createAdminClient();
    const { data, error } = await adminClient.auth.admin.getUserById(userId);
    if (error || !data?.user) {
      return {
        email: null,
        preferences: { ...DEFAULT_NOTIFICATION_PREFERENCES },
      };
    }
    const rawPrefs = data.user.user_metadata?.notification_preferences;
    return {
      email: data.user.email ?? null,
      preferences: normalizeNotificationPreferences(rawPrefs),
    };
  } catch {
    return {
      email: null,
      preferences: { ...DEFAULT_NOTIFICATION_PREFERENCES },
    };
  }
}

export async function dispatchUserNotification(params: {
  userId: string;
  title: string;
  message: string;
  type: NotificationCategory;
  linkUrl?: string | null;
  recipientWorkspace?: "admin" | "portal";
  dedupeWindowMinutes?: number;
  eventKey?: string;
  sendEmail?: boolean;
}): Promise<NotificationDispatchOutcome> {
  const recipientWorkspace = params.recipientWorkspace ?? "portal";
  const dedupeWindowMinutes = params.dedupeWindowMinutes ?? 15;
  const sanitized = sanitizeNotificationPayload({
    title: params.title,
    message: params.message,
    type: params.type,
    linkUrl: params.linkUrl,
    recipientWorkspace,
  });

  const { email, preferences } = await getUserNotificationContext(params.userId);

  if (!isNotificationCategoryEnabled(preferences, sanitized.type)) {
    return {
      userId: params.userId,
      inserted: false,
      suppressedReason: "disabled_by_preference",
      emailStatus: "skipped_by_preference",
    };
  }

  try {
    const adminClient = createAdminClient();

    if (dedupeWindowMinutes > 0) {
      const { data: existing } = await adminClient
        .from("user_notifications")
        .select("user_id, type, title, created_at")
        .eq("user_id", params.userId)
        .eq("type", sanitized.type)
        .order("created_at", { ascending: false })
        .limit(30);

      if (
        existing &&
        isDuplicateNotificationInWindow({
          existingNotifications: existing,
          userId: params.userId,
          type: sanitized.type,
          title: sanitized.title,
          windowMinutes: dedupeWindowMinutes,
        })
      ) {
        return {
          userId: params.userId,
          inserted: false,
          suppressedReason: "duplicate_in_window",
          emailStatus: "suppressed_duplicate",
        };
      }
    }

    const { error: insertErr } = await adminClient
      .from("user_notifications")
      .insert({
        user_id: params.userId,
        title: sanitized.title,
        message: sanitized.message,
        type: sanitized.type,
        link_url: sanitized.link_url,
      });

    if (insertErr) {
      return {
        userId: params.userId,
        inserted: false,
        suppressedReason: "insert_error",
        emailStatus: "unavailable",
      };
    }

    let emailStatus: TransactionalEmailStatus = "unavailable";
    if (params.sendEmail !== false && email) {
      const idempotencyKey = buildNotificationDedupeSignature({
        userId: params.userId,
        type: sanitized.type,
        title: sanitized.title,
        eventKey: params.eventKey,
      });
      const emailResult = await sendTransactionalEmail({
        recipientEmail: email,
        subject: `[TheCodexThrill] ${sanitized.title}`,
        textBody: `${sanitized.title}\n\n${sanitized.message}\n\nView in workspace: https://thecodexthrill.com${sanitized.link_url}`,
        category: sanitized.type,
        idempotencyKey,
        preferences,
      });
      emailStatus = emailResult.status;
    }

    return {
      userId: params.userId,
      inserted: true,
      emailStatus,
    };
  } catch {
    return {
      userId: params.userId,
      inserted: false,
      suppressedReason: "insert_error",
      emailStatus: "unavailable",
    };
  }
}

export async function dispatchOrganizationClientNotifications(params: {
  organizationId: string;
  title: string;
  message: string;
  type: NotificationCategory;
  linkUrl?: string | null;
  excludeUserId?: string;
  dedupeWindowMinutes?: number;
  eventKey?: string;
  sendEmail?: boolean;
}): Promise<NotificationDispatchOutcome[]> {
  try {
    const adminClient = createAdminClient();
    const { data: members } = await adminClient
      .from("organization_memberships")
      .select("user_id")
      .eq("organization_id", params.organizationId)
      .in("role", ["client_owner", "client_manager", "client_member"])
      .eq("status", "active");

    if (!members || members.length === 0) return [];

    const uniqueUserIds = Array.from(
      new Set(
        members
          .map((m) => m.user_id)
          .filter((uid) => Boolean(uid) && uid !== params.excludeUserId),
      ),
    );

    const results: NotificationDispatchOutcome[] = [];
    for (const uid of uniqueUserIds) {
      const outcome = await dispatchUserNotification({
        userId: uid,
        title: params.title,
        message: params.message,
        type: params.type,
        linkUrl: params.linkUrl ?? "/portal",
        recipientWorkspace: "portal",
        dedupeWindowMinutes: params.dedupeWindowMinutes,
        eventKey: params.eventKey,
        sendEmail: params.sendEmail,
      });
      results.push(outcome);
    }
    return results;
  } catch {
    return [];
  }
}

export async function dispatchPlatformStaffNotifications(params: {
  title: string;
  message: string;
  type: NotificationCategory;
  linkUrl?: string | null;
  roles?: string[];
  excludeUserId?: string;
  dedupeWindowMinutes?: number;
  eventKey?: string;
  sendEmail?: boolean;
}): Promise<NotificationDispatchOutcome[]> {
  try {
    const adminClient = createAdminClient();
    const targetRoles = params.roles ?? [
      "super_admin",
      "platform_admin",
      "operations_admin",
    ];
    const { data: assignments } = await adminClient
      .from("platform_role_assignments")
      .select("user_id")
      .in("role", targetRoles);

    if (!assignments || assignments.length === 0) return [];

    const uniqueUserIds = Array.from(
      new Set(
        assignments
          .map((a) => a.user_id)
          .filter((uid) => Boolean(uid) && uid !== params.excludeUserId),
      ),
    );

    const results: NotificationDispatchOutcome[] = [];
    for (const uid of uniqueUserIds) {
      const outcome = await dispatchUserNotification({
        userId: uid,
        title: params.title,
        message: params.message,
        type: params.type,
        linkUrl: params.linkUrl ?? "/admin/notifications",
        recipientWorkspace: "admin",
        dedupeWindowMinutes: params.dedupeWindowMinutes,
        eventKey: params.eventKey,
        sendEmail: params.sendEmail,
      });
      results.push(outcome);
    }
    return results;
  } catch {
    return [];
  }
}


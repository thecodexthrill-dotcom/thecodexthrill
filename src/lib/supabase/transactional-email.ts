import "server-only";
import {
  type NotificationCategory,
  type NotificationPreferences,
  type TransactionalEmailConfigStatus,
  type TransactionalEmailStatus,
  resolveTransactionalEmailConfig,
  sanitizeEmailErrorMetadata,
} from "./notification-helper";

export type { TransactionalEmailStatus };

export type TransactionalEmailResult = {
  status: TransactionalEmailStatus;
  provider: TransactionalEmailConfigStatus["provider"];
  reason?: string;
  error?: {
    code: string;
    status?: number;
    summary: string;
  };
};

const recentEmailDedupeMap = new Map<string, number>();
const DEDUPE_TTL_MS = 15 * 60 * 1000;
const MAX_CACHE_ENTRIES = 500;

function checkAndRecordIdempotencyKey(key: string): boolean {
  const now = Date.now();
  if (recentEmailDedupeMap.size >= MAX_CACHE_ENTRIES) {
    for (const [k, ts] of recentEmailDedupeMap.entries()) {
      if (now - ts > DEDUPE_TTL_MS) {
        recentEmailDedupeMap.delete(k);
      }
    }
  }
  const existing = recentEmailDedupeMap.get(key);
  if (existing && now - existing <= DEDUPE_TTL_MS) {
    return true;
  }
  recentEmailDedupeMap.set(key, now);
  return false;
}

export function getTransactionalEmailConfigStatus(): TransactionalEmailConfigStatus {
  return resolveTransactionalEmailConfig(
    process.env as Record<string, string | undefined>,
  );
}

/**
 * Dispatches a non-auth business transactional email when an email provider is configured.
 * Never throws or blocks primary business actions or in-app notifications.
 * Clearly distinguishes 'accepted_by_provider', 'unavailable', 'failed',
 * 'skipped_by_preference', and 'suppressed_duplicate'.
 */
export async function sendTransactionalEmail(params: {
  recipientEmail: string;
  subject: string;
  textBody: string;
  category: NotificationCategory;
  idempotencyKey?: string;
  preferences?: NotificationPreferences;
}): Promise<TransactionalEmailResult> {
  const config = getTransactionalEmailConfigStatus();

  if (
    params.preferences &&
    params.category !== "security" &&
    params.preferences.email_enabled === false
  ) {
    return {
      status: "skipped_by_preference",
      provider: config.provider,
      reason: "User disabled transactional email notifications in preferences.",
    };
  }

  const dedupeKey = (
    params.idempotencyKey ||
    `${params.recipientEmail.trim().toLowerCase()}|${params.category}|${params.subject.trim().toLowerCase()}`
  ).slice(0, 200);

  if (checkAndRecordIdempotencyKey(dedupeKey)) {
    return {
      status: "suppressed_duplicate",
      provider: config.provider,
      reason: "Duplicate transactional email suppressed within deduplication window.",
    };
  }

  if (!config.configured || !config.fromAddress) {
    return {
      status: "unavailable",
      provider: "unconfigured",
      reason: config.reason,
    };
  }

  const maxAttempts = 2;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4500);

      let response: Response;
      if (config.provider === "resend") {
        const resendKey = process.env.RESEND_API_KEY?.trim() ?? "";
        response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendKey}`,
            "Content-Type": "application/json",
            "Idempotency-Key": dedupeKey,
          },
          body: JSON.stringify({
            from: config.fromAddress,
            to: [params.recipientEmail.trim()],
            subject: params.subject.slice(0, 180),
            text: params.textBody.slice(0, 4000),
          }),
          signal: controller.signal,
        });
      } else {
        const webhookUrl = process.env.TRANSACTIONAL_EMAIL_WEBHOOK_URL?.trim() ?? "";
        response = await fetch(webhookUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Idempotency-Key": dedupeKey,
          },
          body: JSON.stringify({
            from: config.fromAddress,
            to: params.recipientEmail.trim(),
            subject: params.subject.slice(0, 180),
            text: params.textBody.slice(0, 4000),
            category: params.category,
          }),
          signal: controller.signal,
        });
      }

      clearTimeout(timeout);

      if (response.ok) {
        return {
          status: "accepted_by_provider",
          provider: config.provider,
        };
      }

      const isTransient = response.status === 429 || response.status >= 500;
      if (isTransient && attempt < maxAttempts) {
        continue;
      }

      return {
        status: "failed",
        provider: config.provider,
        error: sanitizeEmailErrorMetadata({
          code: `http_${response.status}`,
          status: response.status,
          message: `Transactional email provider responded with HTTP ${response.status}`,
        }),
      };
    } catch (err) {
      if (attempt < maxAttempts) {
        continue;
      }
      return {
        status: "failed",
        provider: config.provider,
        error: sanitizeEmailErrorMetadata(err),
      };
    }
  }

  return {
    status: "failed",
    provider: config.provider,
    error: {
      code: "exhausted_retries",
      summary: "Transactional email provider did not accept request after retry.",
    },
  };
}

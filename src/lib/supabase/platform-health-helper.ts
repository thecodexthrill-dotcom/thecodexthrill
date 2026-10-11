import { resolveTransactionalEmailConfig } from "./notification-helper.ts";

// ============================================================================
// 1. Sanitized Operational Logging & Secret / PII Redaction
// ============================================================================

const SENSITIVE_KEY_PATTERN =
  /secret|token|password|passwd|api_?key|authorization|cookie|private_?key|service_?role|credential|jwt|signature|webhook_?url/i;

const BOOLEAN_PRESENCE_KEY_PATTERN =
  /^(has|is)_?[a-z0-9_]*$|configured$|enabled$|present$|authorized$|valid$/i;

/**
 * Redacts credentials, bearer tokens, API keys, JWTs, query secrets, and PII emails
 * from operational log messages or error strings.
 */
export function sanitizeOperationalString(
  raw: unknown,
  maxLength = 240,
): string {
  if (raw === null || raw === undefined) return "";
  const str = typeof raw === "string" ? raw : String(raw);

  const redacted = str
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [REDACTED_TOKEN]")
    .replace(/re_[A-Za-z0-9_]{6,}/g, "[REDACTED_KEY]")
    .replace(/sb_secret_[A-Za-z0-9_-]+/g, "[REDACTED_SECRET]")
    .replace(/sb_publishable_[A-Za-z0-9_-]+/g, "[REDACTED_KEY]")
    .replace(/sbp_[A-Za-z0-9_-]+/g, "[REDACTED_SECRET]")
    .replace(
      /eyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}/g,
      "[REDACTED_JWT]",
    )
    .replace(
      /([?&](?:token|key|secret|password|signature|api_key|apikey|access_token|refresh_token)=)[^&\s]+/gi,
      "$1[REDACTED_PARAM]",
    )
    .replace(
      /https?:\/\/[^/\s:@]+:[^/\s@]+@[^\s]+/gi,
      "[REDACTED_CREDENTIAL_URL]",
    )
    .replace(
      /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g,
      "[REDACTED_EMAIL]",
    )
    .replace(/\s+/g, " ")
    .trim();

  return redacted.slice(0, maxLength);
}

function sanitizeValueInternal(value: unknown, depth: number): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string") {
    return sanitizeOperationalString(value);
  }
  if (depth >= 3) {
    return "[TRUNCATED_DEPTH]";
  }
  if (Array.isArray(value)) {
    return value.slice(0, 15).map((item) => sanitizeValueInternal(item, depth + 1));
  }
  if (typeof value === "object") {
    return sanitizeOperationalMetadata(value, depth + 1);
  }
  return sanitizeOperationalString(String(value));
}

/**
 * Recursively sanitizes operational metadata objects so secret values, tokens,
 * and sensitive payloads are never written to logs or audit trails.
 */
export function sanitizeOperationalMetadata(
  input: unknown,
  depth = 0,
): Record<string, unknown> {
  if (!input || typeof input !== "object") {
    if (input === undefined || input === null) return {};
    return { summary: sanitizeOperationalString(input) };
  }

  if (input instanceof Error) {
    const errObj = input as Error & { code?: unknown; status?: unknown };
    const result: Record<string, unknown> = {
      name: sanitizeOperationalString(errObj.name || "Error", 64),
      message: sanitizeOperationalString(errObj.message || "Operation failed"),
    };
    if (typeof errObj.code === "string" || typeof errObj.code === "number") {
      result.code = sanitizeOperationalString(String(errObj.code), 64);
    }
    if (typeof errObj.status === "number") {
      result.status = errObj.status;
    }
    return result;
  }

  const rawObj = input as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  const keys = Object.keys(rawObj).slice(0, 25);

  for (const key of keys) {
    const val = rawObj[key];
    const isBooleanPresenceFlag =
      typeof val === "boolean" && BOOLEAN_PRESENCE_KEY_PATTERN.test(key);

    if (SENSITIVE_KEY_PATTERN.test(key) && !isBooleanPresenceFlag) {
      out[key] = "[REDACTED_SECRET]";
      continue;
    }

    out[key] = sanitizeValueInternal(val, depth);
  }

  return out;
}

// ============================================================================
// 2. Repeated Failure Throttling / Anti-Flood Observability
// ============================================================================

type ThrottleRecord = {
  firstSeenMs: number;
  lastLoggedMs: number;
  suppressedCount: number;
  totalOccurrences: number;
};

const operationalThrottleMap = new Map<string, ThrottleRecord>();
const MAX_THROTTLE_KEYS = 500;
const DEFAULT_THROTTLE_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

export function resetOperationalLogThrottleForTesting(): void {
  operationalThrottleMap.clear();
}

/**
 * Prevents repeated scheduler failures or downstream outages from flooding logs
 * while tracking exact suppressed failure counts for when the cooldown window elapses.
 */
export function shouldThrottleOperationalLog(
  key: string,
  options?: { cooldownMs?: number; nowMs?: number },
): {
  allowed: boolean;
  suppressedCount: number;
  totalOccurrences: number;
} {
  const normalizedKey = key.trim().toLowerCase().slice(0, 180) || "default_op";
  const cooldownMs = options?.cooldownMs ?? DEFAULT_THROTTLE_COOLDOWN_MS;
  const nowMs = options?.nowMs ?? Date.now();

  if (operationalThrottleMap.size >= MAX_THROTTLE_KEYS) {
    for (const [k, rec] of operationalThrottleMap.entries()) {
      if (nowMs - rec.lastLoggedMs > cooldownMs * 2) {
        operationalThrottleMap.delete(k);
      }
    }
    if (operationalThrottleMap.size >= MAX_THROTTLE_KEYS) {
      const oldestKey = operationalThrottleMap.keys().next().value;
      if (oldestKey) operationalThrottleMap.delete(oldestKey);
    }
  }

  const existing = operationalThrottleMap.get(normalizedKey);
  if (!existing) {
    operationalThrottleMap.set(normalizedKey, {
      firstSeenMs: nowMs,
      lastLoggedMs: nowMs,
      suppressedCount: 0,
      totalOccurrences: 1,
    });
    return { allowed: true, suppressedCount: 0, totalOccurrences: 1 };
  }

  existing.totalOccurrences += 1;
  if (nowMs - existing.lastLoggedMs < cooldownMs) {
    existing.suppressedCount += 1;
    return {
      allowed: false,
      suppressedCount: existing.suppressedCount,
      totalOccurrences: existing.totalOccurrences,
    };
  }

  const flushedSuppressed = existing.suppressedCount;
  existing.lastLoggedMs = nowMs;
  existing.suppressedCount = 0;

  return {
    allowed: true,
    suppressedCount: flushedSuppressed,
    totalOccurrences: existing.totalOccurrences,
  };
}

export type SanitizedOperationalLogEntry = {
  timestamp: string;
  level: "info" | "warn" | "error";
  scope: string;
  action: string;
  message: string;
  metadata: Record<string, unknown>;
  suppressedSinceLastLog: number;
  totalOccurrences: number;
};

export function logSanitizedOperationalEvent(params: {
  level: "info" | "warn" | "error";
  scope: string;
  action: string;
  message: string;
  metadata?: unknown;
  throttleKey?: string;
  cooldownMs?: number;
  now?: Date;
  silentConsole?: boolean;
}): {
  logged: boolean;
  suppressedCount: number;
  entry: SanitizedOperationalLogEntry;
} {
  const now = params.now ?? new Date();
  const safeScope = sanitizeOperationalString(params.scope, 64) || "platform";
  const safeAction = sanitizeOperationalString(params.action, 80) || "operation";
  const safeMessage = sanitizeOperationalString(params.message, 240);
  const safeMetadata = sanitizeOperationalMetadata(params.metadata);

  const throttleKey =
    params.throttleKey || `${params.level}:${safeScope}:${safeAction}:${safeMessage}`;

  const throttle = shouldThrottleOperationalLog(throttleKey, {
    cooldownMs: params.cooldownMs,
    nowMs: now.getTime(),
  });

  const entry: SanitizedOperationalLogEntry = {
    timestamp: now.toISOString(),
    level: params.level,
    scope: safeScope,
    action: safeAction,
    message: safeMessage,
    metadata: safeMetadata,
    suppressedSinceLastLog: throttle.suppressedCount,
    totalOccurrences: throttle.totalOccurrences,
  };

  if (throttle.allowed && !params.silentConsole) {
    const prefix = `[${entry.scope}.${entry.action}]`;
    const logPayload =
      entry.suppressedSinceLastLog > 0
        ? {
            ...entry.metadata,
            suppressedRepeatedEvents: entry.suppressedSinceLastLog,
            totalOccurrences: entry.totalOccurrences,
          }
        : entry.metadata;

    if (params.level === "error") {
      console.error(prefix, entry.message, logPayload);
    } else if (params.level === "warn") {
      console.warn(prefix, entry.message, logPayload);
    } else {
      console.info(prefix, entry.message, logPayload);
    }
  }

  return {
    logged: throttle.allowed,
    suppressedCount: throttle.suppressedCount,
    entry,
  };
}

// ============================================================================
// 3. Platform Integration Configuration Presence (No Secret Values Exposed)
// ============================================================================

export type IntegrationStatusItem = {
  id:
    | "supabase_cloud"
    | "transactional_email"
    | "auth_smtp"
    | "workflow_scheduler"
    | "web_push"
    | "storage_bucket";
  name: string;
  status: "configured" | "unconfigured" | "degraded";
  statusLabel: string;
  providerLabel: string;
  configPresence: Record<string, boolean | string>;
  summary: string;
};

export type PlatformIntegrationStatus = {
  supabaseCloud: IntegrationStatusItem;
  transactionalEmail: IntegrationStatusItem;
  authSmtp: IntegrationStatusItem;
  workflowScheduler: IntegrationStatusItem;
  webPush: IntegrationStatusItem;
  storageBucket: IntegrationStatusItem;
  configuredCount: number;
  totalIntegrations: number;
};

/**
 * Evaluates integration configuration presence from environment variables.
 * Strictly reports boolean presence and non-secret identifiers — never secret values.
 */
export function resolvePlatformIntegrationStatus(
  env: Record<string, string | undefined>,
): PlatformIntegrationStatus {
  const hasSupabaseUrl = Boolean(env.NEXT_PUBLIC_SUPABASE_URL?.trim());
  const hasAnonKey = Boolean(
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
      env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim(),
  );
  const hasServiceRoleKey = Boolean(
    env.SUPABASE_SECRET_KEY?.trim() || env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
  );

  const supabaseFullyConfigured =
    hasSupabaseUrl && hasAnonKey && hasServiceRoleKey;
  const supabasePartiallyConfigured = hasSupabaseUrl && hasAnonKey;

  const supabaseCloud: IntegrationStatusItem = {
    id: "supabase_cloud",
    name: "Supabase Cloud Database & RLS",
    status: supabaseFullyConfigured
      ? "configured"
      : supabasePartiallyConfigured
        ? "degraded"
        : "unconfigured",
    statusLabel: supabaseFullyConfigured
      ? "Configured (Active)"
      : supabasePartiallyConfigured
        ? "Degraded (Service Key Missing)"
        : "Unconfigured",
    providerLabel: "Supabase PostgreSQL + Auth",
    configPresence: {
      NEXT_PUBLIC_SUPABASE_URL: hasSupabaseUrl,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: hasAnonKey,
      SUPABASE_SECRET_KEY: hasServiceRoleKey,
    },
    summary: supabaseFullyConfigured
      ? "Database, Row-Level Security, and server administration bindings are configured."
      : "One or more required Supabase Cloud environment keys are missing.",
  };

  const emailConfig = resolveTransactionalEmailConfig(env);
  const hasEmailFrom = Boolean(env.TRANSACTIONAL_EMAIL_FROM?.trim());
  const hasResendKey = Boolean(env.RESEND_API_KEY?.trim());
  const hasWebhookUrl = Boolean(env.TRANSACTIONAL_EMAIL_WEBHOOK_URL?.trim());

  const transactionalEmail: IntegrationStatusItem = {
    id: "transactional_email",
    name: "Transactional Business Email",
    status: emailConfig.configured ? "configured" : "unconfigured",
    statusLabel: emailConfig.configured
      ? `Configured (${emailConfig.provider.toUpperCase()})`
      : "Unavailable (In-App Primary)",
    providerLabel:
      emailConfig.provider === "resend"
        ? "Resend API"
        : emailConfig.provider === "webhook"
          ? "Custom Webhook"
          : "Unconfigured",
    configPresence: {
      TRANSACTIONAL_EMAIL_FROM: hasEmailFrom,
      RESEND_API_KEY: hasResendKey,
      TRANSACTIONAL_EMAIL_WEBHOOK_URL: hasWebhookUrl,
    },
    summary: emailConfig.configured
      ? `Outbound business emails are enabled via ${emailConfig.provider} (sender configured).`
      : "Optional external email provider is not configured. All workspace alerts deliver reliably via in-app Notification Center.",
  };

  const customAuthSmtpFlag =
    env.SUPABASE_CUSTOM_SMTP_CONFIGURED?.trim().toLowerCase() === "true";

  const authSmtp: IntegrationStatusItem = {
    id: "auth_smtp",
    name: "Supabase Auth & Invitation SMTP",
    status: customAuthSmtpFlag ? "configured" : "degraded",
    statusLabel: customAuthSmtpFlag
      ? "Custom Auth SMTP Active"
      : "Supabase Cloud Managed (Default Rate-Limited)",
    providerLabel: customAuthSmtpFlag
      ? "Custom SMTP (Supabase Auth)"
      : "Supabase Built-in Auth Mailer",
    configPresence: {
      SUPABASE_AUTH_ENABLED: hasSupabaseUrl && hasServiceRoleKey,
      SUPABASE_CUSTOM_SMTP_CONFIGURED: customAuthSmtpFlag,
    },
    summary: customAuthSmtpFlag
      ? "Custom SMTP provider is marked active in Supabase Cloud Auth."
      : "Managed in Supabase Dashboard. If custom SMTP is not yet bound in Supabase Auth settings, invitations remain safely tracked in pending state.",
  };

  const cronSecretLen = env.CRON_SECRET?.trim().length ?? 0;
  const workflowSecretLen = env.WORKFLOW_AUTOMATION_SECRET?.trim().length ?? 0;
  const schedulerConfigured = cronSecretLen >= 16 || workflowSecretLen >= 16;
  const secretSource =
    cronSecretLen >= 16
      ? "CRON_SECRET"
      : workflowSecretLen >= 16
        ? "WORKFLOW_AUTOMATION_SECRET"
        : "none";

  const workflowScheduler: IntegrationStatusItem = {
    id: "workflow_scheduler",
    name: "Workflow Automation Scheduler",
    status: schedulerConfigured ? "configured" : "unconfigured",
    statusLabel: schedulerConfigured
      ? `Configured (${secretSource})`
      : "Unconfigured (Manual Sweep Only)",
    providerLabel: "Cron / /api/automation/run",
    configPresence: {
      CRON_SECRET_MIN_16_CHARS: cronSecretLen >= 16,
      WORKFLOW_AUTOMATION_SECRET_MIN_16_CHARS: workflowSecretLen >= 16,
      endpoint: "/api/automation/run",
    },
    summary: schedulerConfigured
      ? "External scheduled cron sweeps are authorized via constant-time bearer secret verification."
      : "External cron endpoint returns HTTP 503 until CRON_SECRET (>= 16 chars) is set. Manual admin sweeps remain operational.",
  };

  const hasVapidPublic = Boolean(env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim());
  const hasVapidPrivate = Boolean(env.VAPID_PRIVATE_KEY?.trim());
  const pushConfigured = hasVapidPublic && hasVapidPrivate;

  const webPush: IntegrationStatusItem = {
    id: "web_push",
    name: "Browser Web Push (Optional)",
    status: pushConfigured ? "configured" : "unconfigured",
    statusLabel: pushConfigured
      ? "Configured (VAPID Ready)"
      : "Not Configured (Disabled)",
    providerLabel: "W3C Web Push / VAPID",
    configPresence: {
      NEXT_PUBLIC_VAPID_PUBLIC_KEY: hasVapidPublic,
      VAPID_PRIVATE_KEY: hasVapidPrivate,
    },
    summary: pushConfigured
      ? "VAPID public and private keys are present in environment configuration."
      : "Optional browser push notifications are disabled until VAPID keys are configured.",
  };

  const storageBucket: IntegrationStatusItem = {
    id: "storage_bucket",
    name: "Deliverables & Document Storage",
    status: supabaseFullyConfigured ? "configured" : "unconfigured",
    statusLabel: supabaseFullyConfigured
      ? "Configured (Private Bucket)"
      : "Unconfigured",
    providerLabel: "Supabase Storage (tenant-documents)",
    configPresence: {
      SUPABASE_STORAGE_BINDING: supabaseFullyConfigured,
      bucket: "tenant-documents",
    },
    summary: supabaseFullyConfigured
      ? "Private tenant-documents bucket with signed URL delivery and RLS isolation."
      : "Requires Supabase Cloud URL and service role configuration.",
  };

  const allItems = [
    supabaseCloud,
    transactionalEmail,
    authSmtp,
    workflowScheduler,
    webPush,
    storageBucket,
  ];
  const configuredCount = allItems.filter(
    (item) => item.status === "configured",
  ).length;

  return {
    supabaseCloud,
    transactionalEmail,
    authSmtp,
    workflowScheduler,
    webPush,
    storageBucket,
    configuredCount,
    totalIntegrations: allItems.length,
  };
}

// ============================================================================
// 4. Workflow Automation Job Health & Failure Observability
// ============================================================================

export type AutomationAuditRecord = {
  id?: string;
  occurred_at: string;
  action: string;
  details?: unknown;
};

export type AutomationJobHealthSummary = {
  healthStatus: "healthy" | "degraded" | "failing" | "idle" | "unavailable";
  statusLabel: string;
  schedulerConfigured: boolean;
  lastRunAt: string | null;
  lastTriggeredBy: "cron_endpoint" | "admin_manual" | null;
  lastRunHadErrors: boolean;
  totalRunsObserved: number;
  failedRunsCount: number;
  consecutiveFailures: number;
  totalInsertedNotifications: number;
  totalSuppressedDuplicates: number;
  totalDispatchErrors: number;
  totalQueryErrors: number;
  lastEvaluatedCounts: {
    leadsChecked: number;
    tasksChecked: number;
    invoicesChecked: number;
    ticketsChecked: number;
    invitationsChecked: number;
    totalCandidates: number;
  } | null;
  lastDispatchSummary: {
    inserted: number;
    duplicatesSuppressed: number;
    skippedByPreference: number;
    errors: number;
    queryErrors: number;
  } | null;
  recentSanitizedErrors: string[];
};

/**
 * Evaluates recent automation audit events (`workflow.automation_sweep` and
 * `workflow.automation_failed`) to surface scheduler failures, partial query errors,
 * and repeated job failures without exposing sensitive payloads.
 */
export function evaluateAutomationJobHealth(
  auditEvents: AutomationAuditRecord[] | null,
  schedulerConfigured: boolean,
): AutomationJobHealthSummary {
  if (auditEvents === null) {
    return {
      healthStatus: "unavailable",
      statusLabel: "Telemetry Unavailable",
      schedulerConfigured,
      lastRunAt: null,
      lastTriggeredBy: null,
      lastRunHadErrors: false,
      totalRunsObserved: 0,
      failedRunsCount: 0,
      consecutiveFailures: 0,
      totalInsertedNotifications: 0,
      totalSuppressedDuplicates: 0,
      totalDispatchErrors: 0,
      totalQueryErrors: 0,
      lastEvaluatedCounts: null,
      lastDispatchSummary: null,
      recentSanitizedErrors: [],
    };
  }

  const relevant = auditEvents
    .filter(
      (e) =>
        e.action === "workflow.automation_sweep" ||
        e.action === "workflow.automation_failed",
    )
    .sort(
      (a, b) =>
        new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime(),
    );

  if (relevant.length === 0) {
    return {
      healthStatus: "idle",
      statusLabel: schedulerConfigured
        ? "Idle (Ready — No Sweeps Recorded Yet)"
        : "Idle (Manual Trigger Mode)",
      schedulerConfigured,
      lastRunAt: null,
      lastTriggeredBy: null,
      lastRunHadErrors: false,
      totalRunsObserved: 0,
      failedRunsCount: 0,
      consecutiveFailures: 0,
      totalInsertedNotifications: 0,
      totalSuppressedDuplicates: 0,
      totalDispatchErrors: 0,
      totalQueryErrors: 0,
      lastEvaluatedCounts: null,
      lastDispatchSummary: null,
      recentSanitizedErrors: [],
    };
  }

  let failedRunsCount = 0;
  let consecutiveFailures = 0;
  let countingConsecutive = true;
  let totalInsertedNotifications = 0;
  let totalSuppressedDuplicates = 0;
  let totalDispatchErrors = 0;
  let totalQueryErrors = 0;
  const recentSanitizedErrors: string[] = [];

  let lastEvaluatedCounts: AutomationJobHealthSummary["lastEvaluatedCounts"] =
    null;
  let lastDispatchSummary: AutomationJobHealthSummary["lastDispatchSummary"] =
    null;
  let lastTriggeredBy: "cron_endpoint" | "admin_manual" | null = null;
  let lastRunHadErrors = false;

  for (let i = 0; i < relevant.length; i++) {
    const ev = relevant[i];
    const details =
      ev.details && typeof ev.details === "object"
        ? (ev.details as Record<string, unknown>)
        : {};

    const isExplicitFailure = ev.action === "workflow.automation_failed";
    const dispatchObj =
      details.dispatchSummary && typeof details.dispatchSummary === "object"
        ? (details.dispatchSummary as Record<string, unknown>)
        : {};
    const evalObj =
      details.evaluatedCounts && typeof details.evaluatedCounts === "object"
        ? (details.evaluatedCounts as Record<string, unknown>)
        : {};

    const runInserted = Number(dispatchObj.inserted) || 0;
    const runSuppressed = Number(dispatchObj.duplicatesSuppressed) || 0;
    const runSkipped = Number(dispatchObj.skippedByPreference) || 0;
    const runDispatchErrors = Number(dispatchObj.errors) || 0;
    const rawQueryErrors = Array.isArray(details.queryErrors)
      ? details.queryErrors
      : [];
    const runQueryErrors =
      Number(dispatchObj.queryErrors) || rawQueryErrors.length;

    totalInsertedNotifications += runInserted;
    totalSuppressedDuplicates += runSuppressed;
    totalDispatchErrors += runDispatchErrors;
    totalQueryErrors += runQueryErrors;

    const runFailed =
      isExplicitFailure || runDispatchErrors > 0 || runQueryErrors > 0;

    if (runFailed) {
      failedRunsCount += 1;
      if (countingConsecutive) {
        consecutiveFailures += 1;
      }
      if (recentSanitizedErrors.length < 5) {
        if (typeof details.errorSummary === "string") {
          recentSanitizedErrors.push(
            sanitizeOperationalString(details.errorSummary, 160),
          );
        } else if (rawQueryErrors.length > 0) {
          for (const qe of rawQueryErrors.slice(0, 2)) {
            if (recentSanitizedErrors.length < 5) {
              recentSanitizedErrors.push(
                sanitizeOperationalString(String(qe), 160),
              );
            }
          }
        } else if (runDispatchErrors > 0) {
          recentSanitizedErrors.push(
            `Sweep at ${ev.occurred_at.slice(0, 19)}Z recorded ${runDispatchErrors} dispatch error(s).`,
          );
        }
      }
    } else {
      countingConsecutive = false;
    }

    if (i === 0) {
      lastRunHadErrors = runFailed;
      const rawTrig = details.triggeredBy;
      lastTriggeredBy =
        rawTrig === "cron_endpoint" || rawTrig === "admin_manual"
          ? rawTrig
          : null;

      if (ev.action === "workflow.automation_sweep") {
        lastEvaluatedCounts = {
          leadsChecked: Number(evalObj.leadsChecked) || 0,
          tasksChecked: Number(evalObj.tasksChecked) || 0,
          invoicesChecked: Number(evalObj.invoicesChecked) || 0,
          ticketsChecked: Number(evalObj.ticketsChecked) || 0,
          invitationsChecked: Number(evalObj.invitationsChecked) || 0,
          totalCandidates: Number(evalObj.totalCandidates) || 0,
        };
        lastDispatchSummary = {
          inserted: runInserted,
          duplicatesSuppressed: runSuppressed,
          skippedByPreference: runSkipped,
          errors: runDispatchErrors,
          queryErrors: runQueryErrors,
        };
      }
    }
  }

  let healthStatus: AutomationJobHealthSummary["healthStatus"] = "healthy";
  let statusLabel = "Healthy (Operational)";

  if (consecutiveFailures >= 2 || (relevant[0]?.action === "workflow.automation_failed")) {
    healthStatus = "failing";
    statusLabel =
      consecutiveFailures >= 2
        ? `Failing (${consecutiveFailures} Consecutive Job Failures)`
        : "Failing (Last Sweep Failed)";
  } else if (lastRunHadErrors || failedRunsCount > 0) {
    healthStatus = "degraded";
    statusLabel = lastRunHadErrors
      ? "Degraded (Last Sweep Recorded Partial Errors)"
      : `Degraded (${failedRunsCount} Recent Error Run${failedRunsCount > 1 ? "s" : ""})`;
  }

  return {
    healthStatus,
    statusLabel,
    schedulerConfigured,
    lastRunAt: relevant[0].occurred_at,
    lastTriggeredBy,
    lastRunHadErrors,
    totalRunsObserved: relevant.length,
    failedRunsCount,
    consecutiveFailures,
    totalInsertedNotifications,
    totalSuppressedDuplicates,
    totalDispatchErrors,
    totalQueryErrors,
    lastEvaluatedCounts,
    lastDispatchSummary,
    recentSanitizedErrors,
  };
}


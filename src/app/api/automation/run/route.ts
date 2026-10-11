import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifySchedulerSecret } from "@/lib/supabase/notification-helper";
import {
  logSanitizedOperationalEvent,
  sanitizeOperationalString,
} from "@/lib/supabase/platform-health-helper";
import { runWorkflowAutomationSweep } from "@/lib/supabase/workflow-automation";

export const dynamic = "force-dynamic";

async function handleAutomationRequest(request: Request) {
  const configuredSecret =
    process.env.CRON_SECRET || process.env.WORKFLOW_AUTOMATION_SECRET || "";
  const providedSecret =
    request.headers.get("authorization") ||
    request.headers.get("x-automation-secret");

  const verification = verifySchedulerSecret(providedSecret, configuredSecret);

  if (!verification.authorized) {
    logSanitizedOperationalEvent({
      level: "warn",
      scope: "automation.scheduler",
      action: verification.reason,
      message:
        verification.reason === "secret_not_configured"
          ? "Rejected scheduled automation call because CRON_SECRET is not configured"
          : "Rejected scheduled automation call with invalid authorization header",
      metadata: {
        reason: verification.reason,
        headerPresent: Boolean(providedSecret),
        secretConfigured: verification.reason !== "secret_not_configured",
      },
      throttleKey: `scheduler.auth.${verification.reason}`,
    });

    if (verification.reason === "secret_not_configured") {
      return NextResponse.json(
        {
          ok: false,
          error: "scheduler_secret_not_configured",
          message:
            "Scheduled workflow automation requires CRON_SECRET or WORKFLOW_AUTOMATION_SECRET (minimum 16 characters) in environment configuration.",
        },
        { status: 503 },
      );
    }

    return NextResponse.json(
      {
        ok: false,
        error: "unauthorized",
        message: "Invalid or missing scheduler authorization header.",
      },
      { status: 401 },
    );
  }

  try {
    const summary = await runWorkflowAutomationSweep({
      triggeredBy: "cron_endpoint",
    });

    const hasPartialErrors =
      (summary.dispatchSummary.errors ?? 0) > 0 ||
      (summary.dispatchSummary.queryErrors ?? 0) > 0;

    return NextResponse.json(
      {
        ok: !hasPartialErrors,
        status: hasPartialErrors ? "degraded" : "healthy",
        summary,
      },
      { status: 200 },
    );
  } catch (err) {
    const logOutcome = logSanitizedOperationalEvent({
      level: "error",
      scope: "automation.scheduler",
      action: "sweep_failed",
      message: "Scheduled workflow automation sweep failed unexpectedly",
      metadata: err,
      throttleKey: "scheduler.sweep_failed",
    });

    // Record failure in audit_events only when not throttled to prevent table flooding
    if (logOutcome.logged) {
      try {
        const adminClient = createAdminClient();
        await adminClient.from("audit_events").insert({
          actor_user_id: null,
          scope: "platform",
          action: "workflow.automation_failed",
          target_type: "workflow_automation",
          target_id: new Date().toISOString().slice(0, 10),
          details: {
            triggeredBy: "cron_endpoint",
            errorSummary: sanitizeOperationalString(
              err instanceof Error ? err.message : "Automation sweep failed",
              160,
            ),
            suppressedRepeatedEvents: logOutcome.suppressedCount,
          },
        });
      } catch {
        // Non-fatal
      }
    }

    return NextResponse.json(
      {
        ok: false,
        error: "automation_sweep_failed",
      },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  return handleAutomationRequest(request);
}

export async function POST(request: Request) {
  return handleAutomationRequest(request);
}


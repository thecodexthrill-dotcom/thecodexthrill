import { NextResponse } from "next/server";
import { verifySchedulerSecret } from "@/lib/supabase/notification-helper";
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

    return NextResponse.json(
      {
        ok: true,
        summary,
      },
      { status: 200 },
    );
  } catch {
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


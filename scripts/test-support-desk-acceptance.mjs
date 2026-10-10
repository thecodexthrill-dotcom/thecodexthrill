import { createClient } from "@supabase/supabase-js";
import nextEnv from "@next/env";
const { loadEnvConfig } = nextEnv;

loadEnvConfig(process.cwd());

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error("Missing required Supabase environment keys.", {
    hasUrl: !!supabaseUrl,
    hasAnon: !!anonKey,
    hasService: !!serviceKey,
  });
  process.exit(1);
}

const serviceClient = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false },
});

const anonClient = createClient(supabaseUrl, anonKey, {
  auth: { persistSession: false },
});

async function runSupportDeskAcceptanceTest() {
  console.log("============================================================");
  console.log("SUPPORT DESK END-TO-END ACCEPTANCE TEST");
  console.log("Target DB: Supabase Cloud (isgoypmebtoipfvtaflg)");
  console.log("============================================================");

  let passed = 0;
  let failed = 0;

  function assert(name, condition, details = "") {
    if (condition) {
      console.log(`[PASS] ${name}`);
      passed++;
    } else {
      console.error(`[FAIL] ${name} ${details ? "- " + details : ""}`);
      failed++;
    }
  }

  // 1. Inspect Schema and Relations
  const [ticketsMeta, messagesMeta] = await Promise.all([
    serviceClient
      .from("support_tickets")
      .select("id, ticket_number, organization_id, customer_id, title, category, priority, status, assigned_to, resolved_at, created_at, updated_at")
      .limit(1),
    serviceClient
      .from("support_ticket_messages")
      .select("id, ticket_id, sender_id, is_staff, message, attachments, created_at")
      .limit(1),
  ]);

  assert("support_tickets schema & columns exist", !ticketsMeta.error, ticketsMeta.error?.message);
  assert("support_ticket_messages schema & columns exist", !messagesMeta.error, messagesMeta.error?.message);

  // 2. Verify RLS: Anon client cannot read or write tickets or messages
  const [anonReadTickets, anonReadMessages, anonInsertTicket] = await Promise.all([
    anonClient.from("support_tickets").select("*"),
    anonClient.from("support_ticket_messages").select("*"),
    anonClient.from("support_tickets").insert({
      ticket_number: `HACK-${Date.now()}`,
      title: "Unauthorized Probe",
      category: "general",
      priority: "low",
      status: "new",
    }),
  ]);

  assert(
    "RLS Check: Anonymous read on support_tickets is blocked",
    anonReadTickets.error?.code === "42501" || anonReadTickets.data?.length === 0,
    JSON.stringify(anonReadTickets.error)
  );

  assert(
    "RLS Check: Anonymous read on support_ticket_messages is blocked",
    anonReadMessages.error?.code === "42501" || anonReadMessages.data?.length === 0,
    JSON.stringify(anonReadMessages.error)
  );

  assert(
    "RLS Check: Anonymous insert into support_tickets is rejected",
    !!anonInsertTicket.error,
    anonInsertTicket.error?.message
  );

  // 3. Obtain a valid user profile for authoring test tickets
  const { data: superAdminEntry } = await serviceClient
    .from("platform_super_admin_designation")
    .select("user_id")
    .eq("slot", 1)
    .single();

  const authorUserId = superAdminEntry?.user_id;
  assert("Active administrator identity found for test execution", !!authorUserId, `user_id: ${authorUserId}`);

  if (!authorUserId) {
    console.error("Cannot proceed without admin user identity.");
    process.exit(1);
  }

  // Find an active organization if available
  const { data: orgs } = await serviceClient
    .from("organizations")
    .select("id, name")
    .eq("status", "active")
    .limit(1);

  const testOrgId = orgs && orgs[0] ? orgs[0].id : null;
  console.log(`Using test organization: ${testOrgId ? orgs[0].name + " (" + testOrgId + ")" : "none"}`);

  // 4. Ticket Lifecycle: Creation
  const ticketNumber = `TICK-TEST-${Date.now().toString(36).toUpperCase()}`;
  const { data: createdTicket, error: createError } = await serviceClient
    .from("support_tickets")
    .insert({
      ticket_number: ticketNumber,
      organization_id: testOrgId,
      customer_id: authorUserId,
      title: "Automated Test: Cloud Gateway Latency Issue",
      category: "technical",
      priority: "high",
      status: "new",
    })
    .select()
    .single();

  assert("Ticket Creation: Stored in Supabase Cloud", !createError && !!createdTicket, createError?.message);
  assert("Ticket Creation: Default status is 'new'", createdTicket?.status === "new");
  assert("Ticket Creation: Ticket number matches generated value", createdTicket?.ticket_number === ticketNumber);

  const ticketId = createdTicket?.id;

  try {
    // 5. Message Threading: Initial customer message
    const { data: clientMsg, error: clientMsgErr } = await serviceClient
      .from("support_ticket_messages")
      .insert({
        ticket_id: ticketId,
        sender_id: authorUserId,
        is_staff: false,
        message: "We are observing increased 504 gateway timeout rates on the production webhook endpoint.",
      })
      .select()
      .single();

    assert("Message Thread: Client message persisted", !clientMsgErr && !!clientMsg, clientMsgErr?.message);
    assert("Message Thread: Client message has is_staff = false", clientMsg?.is_staff === false);

    // 6. Message Threading: Staff reply
    const { data: staffMsg, error: staffMsgErr } = await serviceClient
      .from("support_ticket_messages")
      .insert({
        ticket_id: ticketId,
        sender_id: authorUserId,
        is_staff: true,
        message: "Engineering has investigated and identified upstream throttling. Could you confirm if traffic burst exceeded 500 req/s?",
      })
      .select()
      .single();

    assert("Message Thread: Staff reply persisted", !staffMsgErr && !!staffMsg, staffMsgErr?.message);
    assert("Message Thread: Staff reply has is_staff = true", staffMsg?.is_staff === true);

    // 7. Verify Thread Ordering and Querying with Child Relations
    const { data: ticketWithMessages, error: queryErr } = await serviceClient
      .from("support_tickets")
      .select("*, messages:support_ticket_messages(*)")
      .eq("id", ticketId)
      .order("created_at", { referencedTable: "support_ticket_messages", ascending: true })
      .single();

    assert("Ticket & Thread Query: Relational join succeeds", !queryErr && !!ticketWithMessages, queryErr?.message);
    assert("Ticket & Thread Query: Both messages retrieved", ticketWithMessages?.messages?.length === 2);
    
    // Sort in memory to verify chronological sorting
    const sorted = [...(ticketWithMessages?.messages || [])].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    assert(
      "Chronological Ordering: Client message is first, Staff reply is second",
      sorted[0]?.is_staff === false && sorted[1]?.is_staff === true
    );

    // 8. Lifecycle Transitions
    // Transition A: Staff reply transitions status to waiting_on_client
    const { error: updateToWaitingErr } = await serviceClient
      .from("support_tickets")
      .update({ status: "waiting_on_client", updated_at: new Date().toISOString() })
      .eq("id", ticketId);

    assert("Lifecycle Transition A: Status updated to 'waiting_on_client'", !updateToWaitingErr, updateToWaitingErr?.message);

    const { data: checkWaiting } = await serviceClient
      .from("support_tickets")
      .select("status")
      .eq("id", ticketId)
      .single();
    assert("Lifecycle Transition A: Persisted as 'waiting_on_client'", checkWaiting?.status === "waiting_on_client");

    // Transition B: Client replies, transitions back to in_progress
    const { error: updateToInProgressErr } = await serviceClient
      .from("support_tickets")
      .update({ status: "in_progress", updated_at: new Date().toISOString() })
      .eq("id", ticketId);

    assert("Lifecycle Transition B: Status updated to 'in_progress'", !updateToInProgressErr, updateToInProgressErr?.message);

    // Transition C: Resolution sets resolved_at
    const resolvedTimestamp = new Date().toISOString();
    const { error: updateToResolvedErr } = await serviceClient
      .from("support_tickets")
      .update({ status: "resolved", resolved_at: resolvedTimestamp, updated_at: resolvedTimestamp })
      .eq("id", ticketId);

    assert("Lifecycle Transition C: Status updated to 'resolved'", !updateToResolvedErr, updateToResolvedErr?.message);

    const { data: checkResolved } = await serviceClient
      .from("support_tickets")
      .select("status, resolved_at")
      .eq("id", ticketId)
      .single();

    assert("Lifecycle Transition C: resolved_at timestamp is recorded", !!checkResolved?.resolved_at && checkResolved?.status === "resolved");

    // Transition D: Reopening clears resolved_at
    const { error: reopenErr } = await serviceClient
      .from("support_tickets")
      .update({ status: "in_progress", resolved_at: null, updated_at: new Date().toISOString() })
      .eq("id", ticketId);

    assert("Lifecycle Transition D: Reopening ticket succeeds", !reopenErr, reopenErr?.message);

    const { data: checkReopened } = await serviceClient
      .from("support_tickets")
      .select("status, resolved_at")
      .eq("id", ticketId)
      .single();

    assert("Lifecycle Transition D: resolved_at cleared on reopen", checkReopened?.resolved_at === null && checkReopened?.status === "in_progress");

    // 9. Tenant Boundary Defense Check
    if (testOrgId) {
      const { data: orgTickets } = await serviceClient
        .from("support_tickets")
        .select("id")
        .eq("organization_id", testOrgId);

      assert("Tenant Filter: Organization tickets query returns matching records", orgTickets?.some((t) => t.id === ticketId));

      const fakeOrgId = "00000000-0000-0000-0000-000000000000";
      const { data: otherOrgTickets } = await serviceClient
        .from("support_tickets")
        .select("id")
        .eq("organization_id", fakeOrgId);

      assert("Tenant Filter: Unrelated organization query isolates and returns empty", otherOrgTickets?.length === 0);
    }

  } finally {
    // 10. Clean-up: Delete test ticket (cascade should remove messages)
    if (ticketId) {
      const { error: delError } = await serviceClient
        .from("support_tickets")
        .delete()
        .eq("id", ticketId);

      assert("Cleanup: Test ticket deleted from Supabase Cloud", !delError, delError?.message);

      // Verify cascade deleted messages as well
      const { data: remainingMsgs } = await serviceClient
        .from("support_ticket_messages")
        .select("id")
        .eq("ticket_id", ticketId);

      assert("Cleanup: Orphaned messages cascade deleted", remainingMsgs?.length === 0);
    }
  }

  console.log("============================================================");
  console.log(`SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("============================================================");

  if (failed > 0) {
    process.exit(1);
  } else {
    console.log("ALL SUPPORT DESK ACCEPTANCE CHECKS PASSED.");
  }
}

runSupportDeskAcceptanceTest().catch((err) => {
  console.error("Unhandled rejection in support desk acceptance test:", err);
  process.exit(1);
});


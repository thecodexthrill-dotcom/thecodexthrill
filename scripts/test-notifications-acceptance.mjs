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

async function runNotificationsAcceptanceTest() {
  console.log("============================================================");
  console.log("NOTIFICATIONS & SECURITY FEEDS ACCEPTANCE TEST");
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

  // 1. Schema check
  const { data: schemaProbe, error: schemaErr } = await serviceClient
    .from("user_notifications")
    .select("id, user_id, title, message, type, link_url, is_read, created_at")
    .limit(1);

  assert("user_notifications table exists with all standard columns", !schemaErr, schemaErr?.message);

  // 2. Anonymous access blocked
  const [anonRead, anonInsert, anonUpdate] = await Promise.all([
    anonClient.from("user_notifications").select("*"),
    anonClient.from("user_notifications").insert({
      title: "Exploit probe",
      message: "Blocked",
      user_id: "00000000-0000-0000-0000-000000000000",
    }),
    anonClient.from("user_notifications").update({ is_read: true }).eq("is_read", false),
  ]);

  assert(
    "RLS Check: Anonymous read on user_notifications is blocked",
    anonRead.error?.code === "42501" || anonRead.data?.length === 0,
    JSON.stringify(anonRead.error)
  );
  assert("RLS Check: Anonymous insert into user_notifications is rejected", !!anonInsert.error);
  assert("RLS Check: Anonymous update on user_notifications is rejected", !!anonUpdate.error || anonUpdate.data?.length === 0);

  // 3. User verification
  const { data: adminUser } = await serviceClient
    .from("platform_super_admin_designation")
    .select("user_id")
    .eq("slot", 1)
    .single();

  const userId = adminUser?.user_id;
  assert("Valid user ID available for test execution", !!userId, `user_id: ${userId}`);

  if (!userId) {
    console.error("Cannot proceed without admin user identity.");
    process.exit(1);
  }

  const createdNotifIds = [];

  try {
    // 4. Create sample notifications with distinct types
    const types = ["system", "security", "ticket", "project", "billing"];
    for (const t of types) {
      const { data: notif, error: insErr } = await serviceClient
        .from("user_notifications")
        .insert({
          user_id: userId,
          title: `Test ${t.toUpperCase()} Event`,
          message: `Automated acceptance test notification payload for type ${t}.`,
          type: t,
          link_url: t === "ticket" ? "/admin/support" : t === "billing" ? "/admin/billing" : null,
          is_read: false,
        })
        .select()
        .single();

      assert(`Notification Insert: Stored type '${t}' in Supabase Cloud`, !insErr && !!notif, insErr?.message);
      if (notif) createdNotifIds.push(notif.id);
    }

    assert("All 5 notification types successfully inserted", createdNotifIds.length === 5);

    // 5. Query user notifications
    const { data: userNotifs, error: queryErr } = await serviceClient
      .from("user_notifications")
      .select("*")
      .eq("user_id", userId)
      .in("id", createdNotifIds)
      .order("created_at", { ascending: false });

    assert("Query user notifications succeeds", !queryErr && userNotifs?.length === 5, queryErr?.message);

    // 6. Test Mark Individual Notification as Read
    const targetId = createdNotifIds[0];
    const { error: markReadErr } = await serviceClient
      .from("user_notifications")
      .update({ is_read: true })
      .eq("id", targetId);

    assert("Mark single notification read succeeds", !markReadErr, markReadErr?.message);

    const { data: singleCheck } = await serviceClient
      .from("user_notifications")
      .select("is_read")
      .eq("id", targetId)
      .single();

    assert("Single notification is_read updated to true", singleCheck?.is_read === true);

    // 7. Test Mark All as Read
    const { error: markAllErr } = await serviceClient
      .from("user_notifications")
      .update({ is_read: true })
      .eq("user_id", userId)
      .eq("is_read", false);

    assert("Mark all notifications read succeeds", !markAllErr, markAllErr?.message);

    const { data: unreadRemaining } = await serviceClient
      .from("user_notifications")
      .select("id")
      .eq("user_id", userId)
      .in("id", createdNotifIds)
      .eq("is_read", false);

    assert("All test notifications for user are now marked read", unreadRemaining?.length === 0);

  } finally {
    // 8. Clean up test records
    if (createdNotifIds.length > 0) {
      const { error: cleanErr } = await serviceClient
        .from("user_notifications")
        .delete()
        .in("id", createdNotifIds);

      assert("Cleanup: Test notifications deleted from Supabase Cloud", !cleanErr, cleanErr?.message);
    }
  }

  console.log("============================================================");
  console.log(`SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("============================================================");

  if (failed > 0) {
    process.exit(1);
  } else {
    console.log("ALL NOTIFICATIONS ACCEPTANCE CHECKS PASSED.");
  }
}

runNotificationsAcceptanceTest().catch((err) => {
  console.error("Unhandled rejection in notifications acceptance test:", err);
  process.exit(1);
});


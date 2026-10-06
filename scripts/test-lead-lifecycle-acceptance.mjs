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

async function runLeadAcceptanceTest() {
  console.log("============================================================");
  console.log("LEAD MANAGEMENT LIFECYCLE ACCEPTANCE TEST");
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

  const testEmail = `lead-test-${Date.now()}@thecodexthrill.test`;
  let testLeadId = null;

  try {
    // 1. Verify table accessibility
    const { count, error: tableErr } = await serviceClient
      .from("platform_sales_leads")
      .select("*", { count: "exact", head: true });

    assert(
      "platform_sales_leads table exists and is accessible",
      !tableErr,
      tableErr?.message
    );

    // 2. CREATE / INGEST: Simulate contact form submission
    const insertPayload = {
      contact_name: "Dr. Evelyn Vance",
      email: testEmail,
      company_name: "Vance BioSystems Inc.",
      message: "We need an edge-computing clinical telemetry platform with offline sync capabilities.",
      source: "website",
      stage: "new",
    };

    const { data: inserted, error: insertErr } = await serviceClient
      .from("platform_sales_leads")
      .insert(insertPayload)
      .select()
      .single();

    assert(
      "Lead successfully created via platform_sales_leads ingest",
      !insertErr && inserted?.id,
      insertErr?.message
    );

    if (inserted?.id) {
      testLeadId = inserted.id;

      // 3. READ / DEEP-LINK VERIFICATION: Verify all fields match
      const { data: readRecord, error: readErr } = await serviceClient
        .from("platform_sales_leads")
        .select("*")
        .eq("id", testLeadId)
        .single();

      assert(
        "Lead can be queried by ID (simulating /admin/leads?id=... deep link)",
        !readErr && readRecord?.contact_name === "Dr. Evelyn Vance",
        readErr?.message
      );
      assert("Lead contact email is stored correctly", readRecord?.email === testEmail);
      assert("Lead company name is stored correctly", readRecord?.company_name === "Vance BioSystems Inc.");
      assert("Lead source is website", readRecord?.source === "website");
      assert("Initial stage is 'new'", readRecord?.stage === "new");
      assert("Inquiry message body is preserved", readRecord?.message?.includes("clinical telemetry"));
      assert("Created timestamp exists", !!readRecord?.created_at);

      // 4. UPDATE / STAGE PROGRESSION: Transition from 'new' to 'contacted'
      const followUpDate = new Date(Date.now() + 86400000 * 2).toISOString();
      const { data: updatedContacted, error: updateErr1 } = await serviceClient
        .from("platform_sales_leads")
        .update({
          stage: "contacted",
          follow_up_at: followUpDate,
        })
        .eq("id", testLeadId)
        .select()
        .single();

      assert(
        "Super Admin can update lead stage to 'contacted' with scheduled follow-up",
        !updateErr1 && updatedContacted?.stage === "contacted" && !!updatedContacted?.follow_up_at,
        updateErr1?.message
      );

      // 5. UPDATE / STAGE PROGRESSION: Transition to 'qualified'
      const { data: updatedQualified, error: updateErr2 } = await serviceClient
        .from("platform_sales_leads")
        .update({ stage: "qualified" })
        .eq("id", testLeadId)
        .select()
        .single();

      assert(
        "Super Admin can advance lead stage to 'qualified'",
        !updateErr2 && updatedQualified?.stage === "qualified",
        updateErr2?.message
      );

      // 6. UPDATE / DETAIL EDIT: Update company and notes
      const { data: updatedNotes, error: updateErr3 } = await serviceClient
        .from("platform_sales_leads")
        .update({
          message: "Updated scope: Phase 1 includes 50 field units with local SQLite/IndexedDB sync.",
          company_name: "Vance BioSystems Enterprise",
        })
        .eq("id", testLeadId)
        .select()
        .single();

      assert(
        "Super Admin can edit lead details and notes",
        !updateErr3 &&
          updatedNotes?.company_name === "Vance BioSystems Enterprise" &&
          updatedNotes?.message?.includes("50 field units"),
        updateErr3?.message
      );

      // 7. DELETE / ARCHIVE: Verify deletion capability
      const { error: deleteErr } = await serviceClient
        .from("platform_sales_leads")
        .delete()
        .eq("id", testLeadId);

      assert(
        "Super Admin can delete/clean up lead record",
        !deleteErr,
        deleteErr?.message
      );

      // 8. VERIFY DELETED: Assert record no longer exists
      const { data: postDeleteRecord, error: postDeleteErr } = await serviceClient
        .from("platform_sales_leads")
        .select("id")
        .eq("id", testLeadId)
        .maybeSingle();

      assert(
        "Deleted lead record is confirmed removed from Supabase Cloud",
        !postDeleteErr && postDeleteRecord === null
      );
    }
  } catch (err) {
    console.error("[EXCEPTION] Uncaught error during lead acceptance test:", err);
    failed++;
  }

  console.log("============================================================");
  console.log(`SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("============================================================");

  if (failed > 0) {
    process.exit(1);
  } else {
    console.log("ALL LEAD MANAGEMENT ACCEPTANCE CHECKS PASSED SUCCESSFULLY.");
    process.exit(0);
  }
}

runLeadAcceptanceTest();


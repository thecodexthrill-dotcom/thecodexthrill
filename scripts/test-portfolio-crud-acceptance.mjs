import { createClient } from "@supabase/supabase-js";
import nextEnv from "@next/env";
const { loadEnvConfig } = nextEnv;

loadEnvConfig(process.cwd());

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !anonKey) {
  console.error("Missing required Supabase environment keys.", { hasUrl: !!supabaseUrl, hasAnon: !!anonKey, hasService: !!serviceKey });
  process.exit(1);
}

const anonClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
const serviceClient = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

async function runAcceptanceTest() {
  console.log("============================================================");
  console.log("PORTFOLIO & CASE STUDIES CRUD ACCEPTANCE TEST");
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

  // 1. Verify Public Anon Read on Published Case Studies
  const { data: publicStudies, error: publicReadErr } = await anonClient
    .from("cms_case_studies")
    .select("slug, title, client_name, industry, status")
    .eq("status", "published")
    .order("sort_order", { ascending: true });

  assert(
    "Public Anon can query published case studies without error 42501",
    !publicReadErr && Array.isArray(publicStudies) && publicStudies.length >= 4,
    publicReadErr ? publicReadErr.message : `Found: ${publicStudies?.length}`
  );

  // 2. Verify all 4 required case studies exist in Supabase Cloud
  const slugs = publicStudies ? publicStudies.map((s) => s.slug) : [];
  const requiredSlugs = [
    "apex-capital-engine",
    "omnistream-ai-hub",
    "strata-cloud-deploy",
    "pulse-clinical-field",
  ];
  for (const slug of requiredSlugs) {
    assert(`Required case study '${slug}' exists in Supabase Cloud`, slugs.includes(slug));
  }

  // 3. Verify Rich Fields are populated (Challenge, Solution, Deliverables, Results)
  const { data: apexRecord, error: apexErr } = await anonClient
    .from("cms_case_studies")
    .select("*")
    .eq("slug", "apex-capital-engine")
    .single();

  assert(
    "Apex Capital Engine has rich deliverables, results, challenge, and solution",
    !apexErr &&
      apexRecord &&
      apexRecord.deliverables?.length >= 3 &&
      apexRecord.results?.length >= 2 &&
      apexRecord.challenge?.length > 20 &&
      apexRecord.solution?.length > 20
  );

  // 4. Test RLS Isolation: Insert a draft case study and verify Anon CANNOT see it
  const testDraftSlug = "test-draft-audit-" + Date.now();
  const { data: insertedDraft, error: insertErr } = await serviceClient
    .from("cms_case_studies")
    .insert({
      slug: testDraftSlug,
      title: "Test Draft Under Review",
      client_name: "Internal QA",
      industry: "Quality Assurance",
      category: "Testing",
      summary: "Draft study summary",
      challenge: "Draft challenge",
      solution: "Draft solution",
      status: "draft",
    })
    .select("id")
    .single();

  assert("Service Role can insert test draft record", !insertErr && insertedDraft?.id, insertErr?.message);

  if (insertedDraft) {
    // Anon query must NOT return this draft
    const { data: anonDraftQuery } = await anonClient
      .from("cms_case_studies")
      .select("id")
      .eq("slug", testDraftSlug)
      .maybeSingle();

    assert("RLS correctly prevents Anon users from reading draft case studies", anonDraftQuery === null);

    // 5. Publish the draft and verify Anon CAN see it
    const { error: updateErr } = await serviceClient
      .from("cms_case_studies")
      .update({ status: "published" })
      .eq("id", insertedDraft.id);

    assert("Draft updated to published state", !updateErr, updateErr?.message);

    const { data: anonPubQuery } = await anonClient
      .from("cms_case_studies")
      .select("id")
      .eq("slug", testDraftSlug)
      .maybeSingle();

    assert("Anon users can read newly published case study immediately", anonPubQuery !== null && anonPubQuery.id === insertedDraft.id);

    // 6. Delete test record and verify removal
    const { error: deleteErr } = await serviceClient
      .from("cms_case_studies")
      .delete()
      .eq("id", insertedDraft.id);

    assert("Test record deleted successfully", !deleteErr, deleteErr?.message);
  }

  console.log("============================================================");
  console.log(`TOTAL PASSED: ${passed}`);
  console.log(`TOTAL FAILED: ${failed}`);
  console.log("============================================================");

  if (failed > 0) process.exit(1);
}

runAcceptanceTest();

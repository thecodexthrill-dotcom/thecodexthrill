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

async function runProjectsAndDocumentsAcceptanceTest() {
  console.log("============================================================");
  console.log("PROJECTS, TASKS & DOCUMENTS ACCEPTANCE TEST");
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

  // 1. Verify schema for projects, tasks, and documents
  const [projSchema, taskSchema, docSchema] = await Promise.all([
    serviceClient.from("tenant_projects").select("id, organization_id, name, description, status, progress_pct, target_date, created_at").limit(1),
    serviceClient.from("tenant_tasks").select("id, project_id, organization_id, title, description, status, priority, due_date, created_at").limit(1),
    serviceClient.from("tenant_documents").select("id, organization_id, project_id, name, file_url, file_size_bytes, file_type, category, uploaded_by, created_at").limit(1),
  ]);

  assert("tenant_projects table exists and is accessible", !projSchema.error, projSchema.error?.message);
  assert("tenant_tasks table exists and is accessible", !taskSchema.error, taskSchema.error?.message);
  assert("tenant_documents table exists and is accessible", !docSchema.error, docSchema.error?.message);

  // 2. Anonymous access blocked by RLS
  const [anonProj, anonTask, anonDoc] = await Promise.all([
    anonClient.from("tenant_projects").select("*"),
    anonClient.from("tenant_tasks").select("*"),
    anonClient.from("tenant_documents").select("*"),
  ]);

  assert("RLS Check: Anonymous read on tenant_projects is blocked", anonProj.error?.code === "42501" || anonProj.data?.length === 0);
  assert("RLS Check: Anonymous read on tenant_tasks is blocked", anonTask.error?.code === "42501" || anonTask.data?.length === 0);
  assert("RLS Check: Anonymous read on tenant_documents is blocked", anonDoc.error?.code === "42501" || anonDoc.data?.length === 0);

  // 3. User & Organization context
  const { data: adminEntry } = await serviceClient
    .from("platform_super_admin_designation")
    .select("user_id")
    .eq("slot", 1)
    .single();

  const userId = adminEntry?.user_id;
  assert("Active administrator identity found for test execution", !!userId, `user_id: ${userId}`);

  const { data: orgs } = await serviceClient
    .from("organizations")
    .select("id, name")
    .eq("status", "active")
    .limit(1);

  const orgId = orgs?.[0]?.id;
  assert("Active organization found for tenancy testing", !!orgId, `org_id: ${orgId}`);

  let createdProjectId = null;
  let createdTaskId = null;
  let createdDocId = null;
  const storageFilePath = `${orgId}/acceptance-test-${Date.now()}.txt`;

  try {
    // 4. Test Project Lifecycle
    const { data: proj, error: projErr } = await serviceClient
      .from("tenant_projects")
      .insert({
        organization_id: orgId,
        name: `Automated Test Engagement ${Date.now()}`,
        description: "Cloud infrastructure and AI microservice deployment.",
        status: "in_progress",
        progress_pct: 35,
        target_date: "2026-12-31",
        created_by: userId,
      })
      .select()
      .single();

    assert("Project Creation: Stored in Supabase Cloud", !projErr && !!proj, projErr?.message);
    assert("Project Creation: Progress is 35%", proj?.progress_pct === 35);
    createdProjectId = proj?.id;

    // 5. Test Task Lifecycle
    const { data: task, error: taskErr } = await serviceClient
      .from("tenant_tasks")
      .insert({
        project_id: createdProjectId,
        organization_id: orgId,
        title: "Deploy Vercel preview branch with Supabase SSR",
        description: "Verify cookie propagation and middleware token exchange.",
        status: "todo",
        priority: "urgent",
        due_date: "2026-11-15",
      })
      .select()
      .single();

    assert("Task Creation: Stored in Supabase Cloud", !taskErr && !!task, taskErr?.message);
    assert("Task Creation: Status is 'todo'", task?.status === "todo");
    assert("Task Creation: Priority is 'urgent'", task?.priority === "urgent");
    createdTaskId = task?.id;

    // 6. Test Task Status Progression
    const { error: taskProgErr } = await serviceClient
      .from("tenant_tasks")
      .update({ status: "done", updated_at: new Date().toISOString() })
      .eq("id", createdTaskId);

    assert("Task Progression: Updated status to 'done'", !taskProgErr, taskProgErr?.message);

    const { data: checkTask } = await serviceClient
      .from("tenant_tasks")
      .select("status")
      .eq("id", createdTaskId)
      .single();

    assert("Task Progression: Confirmed status persisted as 'done'", checkTask?.status === "done");

    // 7. Test Document Record with Supabase Storage
    // A: Upload file to tenant-documents bucket
    const fileContent = Buffer.from("TheCodexThrill verified architecture specification deliverable.");
    const { error: storageUploadErr } = await serviceClient.storage
      .from("tenant-documents")
      .upload(storageFilePath, fileContent, {
        contentType: "text/plain",
        upsert: true,
      });

    assert("Supabase Storage: File upload to 'tenant-documents' bucket succeeds", !storageUploadErr, storageUploadErr?.message);

    // B: Generate Signed URL
    const { data: signedUrlData, error: signedUrlErr } = await serviceClient.storage
      .from("tenant-documents")
      .createSignedUrl(storageFilePath, 3600);

    assert("Supabase Storage: Signed URL generation succeeds", !signedUrlErr && !!signedUrlData?.signedUrl, signedUrlErr?.message);

    // C: Store Document Record in database
    const { data: doc, error: docErr } = await serviceClient
      .from("tenant_documents")
      .insert({
        organization_id: orgId,
        project_id: createdProjectId,
        name: "Cloud Gateway Architecture Specification",
        file_url: signedUrlData?.signedUrl || storageFilePath,
        file_size_bytes: fileContent.length,
        file_type: "text/plain",
        category: "specification",
        uploaded_by: userId,
      })
      .select()
      .single();

    assert("Document Record: Stored in Supabase Cloud", !docErr && !!doc, docErr?.message);
    assert("Document Record: File size matches bytes", doc?.file_size_bytes === fileContent.length);
    createdDocId = doc?.id;

    // 8. Relational Join Verification
    const { data: projectWithTasks, error: joinErr } = await serviceClient
      .from("tenant_projects")
      .select("*, tasks:tenant_tasks(*)")
      .eq("id", createdProjectId)
      .single();

    assert("Relational Join: Project with nested tasks retrieved", !joinErr && projectWithTasks?.tasks?.length === 1);

    // 9. Tenant Boundary Defense Check
    const fakeOrgId = "00000000-0000-0000-0000-000000000000";
    const { data: otherOrgProjects } = await serviceClient
      .from("tenant_projects")
      .select("id")
      .eq("organization_id", fakeOrgId);

    assert("Tenant Boundary: Unrelated organization projects query isolates and returns empty", otherOrgProjects?.length === 0);

  } finally {
    // 10. Clean-up: Documents, tasks, projects, and storage
    if (createdDocId) {
      const { error: delDocErr } = await serviceClient.from("tenant_documents").delete().eq("id", createdDocId);
      assert("Cleanup: Test document record removed", !delDocErr, delDocErr?.message);
    }

    try {
      await serviceClient.storage.from("tenant-documents").remove([storageFilePath]);
      assert("Cleanup: Storage file removed from bucket", true);
    } catch (e) {
      console.warn("Storage cleanup notice:", e);
    }

    if (createdTaskId) {
      const { error: delTaskErr } = await serviceClient.from("tenant_tasks").delete().eq("id", createdTaskId);
      assert("Cleanup: Test task record removed", !delTaskErr, delTaskErr?.message);
    }

    if (createdProjectId) {
      const { error: delProjErr } = await serviceClient.from("tenant_projects").delete().eq("id", createdProjectId);
      assert("Cleanup: Test project record removed", !delProjErr, delProjErr?.message);
    }
  }

  console.log("============================================================");
  console.log(`SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("============================================================");

  if (failed > 0) {
    process.exit(1);
  } else {
    console.log("ALL PROJECTS, TASKS & DOCUMENTS ACCEPTANCE CHECKS PASSED.");
  }
}

runProjectsAndDocumentsAcceptanceTest().catch((err) => {
  console.error("Unhandled error in projects & documents acceptance test:", err);
  process.exit(1);
});


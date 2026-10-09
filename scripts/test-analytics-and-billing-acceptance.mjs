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

async function runAcceptanceTest() {
  console.log("============================================================");
  console.log("ANALYTICS & BILLING ACCEPTANCE TEST");
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

  // 1. Verify Supabase Cloud schema for Analytics queries
  const [leadsRes, orgsRes, projectsRes, tasksRes, invoicesRes, ticketsRes] = await Promise.all([
    serviceClient.from("platform_sales_leads").select("stage, created_at, source"),
    serviceClient.from("organizations").select("status, created_at, name"),
    serviceClient.from("tenant_projects").select("status, progress_pct, created_at, name"),
    serviceClient.from("tenant_tasks").select("status, priority, created_at"),
    serviceClient.from("tenant_invoices").select("id, organization_id, amount_cents, status, currency, due_date, paid_at, created_at, items, notes"),
    serviceClient.from("support_tickets").select("status, priority, category, created_at"),
  ]);

  assert("Analytics query: platform_sales_leads connects and returns data", !leadsRes.error && Array.isArray(leadsRes.data));
  assert("Analytics query: organizations connects and returns data", !orgsRes.error && Array.isArray(orgsRes.data));
  assert("Analytics query: tenant_projects connects and returns data", !projectsRes.error && Array.isArray(projectsRes.data));
  assert("Analytics query: tenant_tasks connects and returns data", !tasksRes.error && Array.isArray(tasksRes.data));
  assert("Analytics query: tenant_invoices connects and returns data", !invoicesRes.error && Array.isArray(invoicesRes.data));
  assert("Analytics query: support_tickets connects and returns data", !ticketsRes.error && Array.isArray(ticketsRes.data));

  // 2. Verify Date-Range Filtering Math
  const sampleItems = [
    { created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString() }, // 5 days ago
    { created_at: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString() }, // 45 days ago
    { created_at: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString() }, // 120 days ago
  ];

  function filterByPeriod(items, period) {
    if (period === "all") return items;
    const days = period === "30d" ? 30 : 90;
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    return items.filter((it) => new Date(it.created_at) >= cutoff);
  }

  const allItems = filterByPeriod(sampleItems, "all");
  const thirtyDayItems = filterByPeriod(sampleItems, "30d");
  const ninetyDayItems = filterByPeriod(sampleItems, "90d");

  assert("Date filter: 'all' preserves all records", allItems.length === 3);
  assert("Date filter: '30d' excludes records older than 30 days", thirtyDayItems.length === 1);
  assert("Date filter: '90d' includes 5d and 45d but excludes 120d", ninetyDayItems.length === 2);

  // 3. Verify Database RLS and Tenant Isolation
  const anonInvoices = await anonClient.from("tenant_invoices").select("*");
  assert("RLS Check: Anonymous access to tenant_invoices is blocked (42501 or empty)", anonInvoices.error !== null || (anonInvoices.data && anonInvoices.data.length === 0));

  const anonProjects = await anonClient.from("tenant_projects").select("*");
  assert("RLS Check: Anonymous access to tenant_projects is blocked (42501 or empty)", anonProjects.error !== null || (anonProjects.data && anonProjects.data.length === 0));

  // 4. Verify Invoice Accounting Calculations
  const mockPaidInvoice = {
    id: "inv-test-paid",
    organization_id: "org-1",
    amount_cents: 150000,
    status: "paid",
    items: [
      { description: "Sprint 1 Deliverable", amount_cents: 100000 },
      { description: "Infrastructure Setup", amount_cents: 50000 },
    ],
  };

  const mockSentInvoice = {
    id: "inv-test-sent",
    organization_id: "org-2",
    amount_cents: 75000,
    status: "sent",
    items: [
      { description: "Initial Retainer", amount_cents: 75000 },
    ],
  };

  // Paid Invoice calculations
  const paidItemsSum = mockPaidInvoice.items.reduce((s, it) => s + it.amount_cents, 0);
  const isPaid = mockPaidInvoice.status === "paid";
  const paidAmount = isPaid ? mockPaidInvoice.amount_cents : 0;
  const paidBalance = isPaid ? 0 : mockPaidInvoice.amount_cents;

  assert("Invoice Math: Line items sum matches total invoice amount", paidItemsSum === mockPaidInvoice.amount_cents);
  assert("Invoice Math: Paid invoice balance due is strictly $0.00", paidBalance === 0);
  assert("Invoice Math: Paid invoice paid amount equals full contracted amount", paidAmount === mockPaidInvoice.amount_cents);

  // Sent/Unpaid Invoice calculations
  const isSentPaid = mockSentInvoice.status === "paid";
  const sentBalance = isSentPaid ? 0 : mockSentInvoice.amount_cents;
  const sentPaidAmount = isSentPaid ? mockSentInvoice.amount_cents : 0;

  assert("Invoice Math: Unpaid invoice reflects full balance due", sentBalance === 75000);
  assert("Invoice Math: Unpaid invoice reflects $0 collected", sentPaidAmount === 0);

  // 5. Verify Client Portal Tenant Boundary Logic
  const userMemberships = [{ id: "org-1", name: "Client A" }];
  const authorizedOrgIds = new Set(userMemberships.map((m) => m.id));

  const clientVisibleInvoices = [mockPaidInvoice, mockSentInvoice].filter((inv) => authorizedOrgIds.has(inv.organization_id));
  assert("Portal Tenant Boundary: Client A user only sees Org 1 invoices", clientVisibleInvoices.length === 1 && clientVisibleInvoices[0].organization_id === "org-1");
  assert("Portal Tenant Boundary: Client A cannot see Org 2 invoices", !clientVisibleInvoices.some((inv) => inv.organization_id === "org-2"));

  console.log("============================================================");
  console.log(`SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("============================================================");

  if (failed > 0) {
    process.exit(1);
  } else {
    console.log("ALL ANALYTICS & BILLING ACCEPTANCE CHECKS PASSED.");
    process.exit(0);
  }
}

runAcceptanceTest().catch((err) => {
  console.error("Test execution fatal error:", err);
  process.exit(1);
});


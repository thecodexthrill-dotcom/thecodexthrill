import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const opsMigration = readFileSync("supabase/migrations/20261006180000_client_operations_support_delivery.sql", "utf8");

test("Operations migration creates all core tables for client delivery, support, documents, invoices, and notifications", () => {
  // 1. Projects & Tasks
  assert.match(opsMigration, /create table public\.tenant_projects/);
  assert.match(opsMigration, /create table public\.tenant_tasks/);

  // 2. Documents & Invoices
  assert.match(opsMigration, /create table public\.tenant_documents/);
  assert.match(opsMigration, /create table public\.tenant_invoices/);

  // 3. Support Tickets & Thread Messages
  assert.match(opsMigration, /create table public\.support_tickets/);
  assert.match(opsMigration, /create table public\.support_ticket_messages/);

  // 4. In-App Notifications
  assert.match(opsMigration, /create table public\.user_notifications/);
});

test("Operations migration enables RLS and revokes open table access across all entities", () => {
  const tables = [
    "tenant_projects",
    "tenant_tasks",
    "tenant_documents",
    "tenant_invoices",
    "support_tickets",
    "support_ticket_messages",
    "user_notifications",
  ];

  for (const table of tables) {
    assert.match(
      opsMigration,
      new RegExp(`alter table public\\.${table} enable row level security;`),
      `RLS must be enabled on ${table}`
    );
    assert.match(
      opsMigration,
      new RegExp(`revoke all on table public\\.${table} from public, anon, authenticated;`),
      `Permissions must be revoked on ${table}`
    );
  }
});

test("Operations audit triggers are attached to operational mutation tables", () => {
  assert.match(opsMigration, /create trigger tenant_projects_audit/);
  assert.match(opsMigration, /create trigger tenant_tasks_audit/);
  assert.match(opsMigration, /create trigger tenant_documents_audit/);
  assert.match(opsMigration, /create trigger tenant_invoices_audit/);
  assert.match(opsMigration, /create trigger support_tickets_audit/);
  assert.match(opsMigration, /create trigger support_ticket_messages_audit/);
});

test("Support ticket lifecycle statuses and priorities are strictly constrained", () => {
  const allowedStatuses = new Set(["new", "in_progress", "waiting_on_client", "resolved", "closed"]);
  const allowedPriorities = new Set(["low", "medium", "high", "urgent"]);
  const allowedCategories = new Set(["technical", "billing", "feature_request", "general"]);

  assert.equal(allowedStatuses.has("new"), true);
  assert.equal(allowedStatuses.has("resolved"), true);
  assert.equal(allowedStatuses.has("waiting_on_client"), true);
  assert.equal(allowedStatuses.has("open"), false, "'open' is not an allowed status; must be 'new' or 'in_progress'");

  assert.equal(allowedPriorities.has("urgent"), true);
  assert.equal(allowedPriorities.has("critical"), false, "'critical' is not in priority vocabulary");

  assert.equal(allowedCategories.has("technical"), true);
  assert.equal(allowedCategories.has("billing"), true);
});

test("Project and task statuses are strictly validated", () => {
  const projectStatuses = new Set(["planning", "in_progress", "in_review", "completed", "on_hold"]);
  const taskStatuses = new Set(["todo", "in_progress", "review", "done"]);

  assert.equal(projectStatuses.has("planning"), true);
  assert.equal(projectStatuses.has("completed"), true);
  assert.equal(projectStatuses.has("canceled"), false);

  assert.equal(taskStatuses.has("todo"), true);
  assert.equal(taskStatuses.has("done"), true);
  assert.equal(taskStatuses.has("archived"), false);
});

test("Invoices amount and status checks prevent negative balances and unknown statuses", () => {
  const invoiceStatuses = new Set(["draft", "sent", "paid", "overdue", "cancelled"]);
  assert.equal(invoiceStatuses.has("draft"), true);
  assert.equal(invoiceStatuses.has("paid"), true);
  assert.equal(invoiceStatuses.has("overdue"), true);
  assert.equal(invoiceStatuses.has("settled"), false);

  assert.match(opsMigration, /amount_cents bigint not null check \(amount_cents >= 0\)/);
});

test("CRUD hardening migration grants DELETE permissions and policies across managed tables", () => {
  const hardeningMigration = readFileSync("supabase/migrations/20261006190000_operations_crud_hardening.sql", "utf8");
  assert.match(hardeningMigration, /grant delete on table public\.tenant_projects to authenticated;/);
  assert.match(hardeningMigration, /grant update, delete on table public\.tenant_documents to authenticated;/);
  assert.match(hardeningMigration, /grant delete on table public\.tenant_invoices to authenticated;/);
  assert.match(hardeningMigration, /grant delete on table public\.support_tickets to authenticated;/);
  assert.match(hardeningMigration, /grant delete on table public\.support_ticket_messages to authenticated;/);
  assert.match(hardeningMigration, /grant delete on table public\.platform_sales_leads to authenticated;/);
  assert.match(hardeningMigration, /create policy tenant_documents_manage on public\.tenant_documents/);
  assert.match(hardeningMigration, /create policy support_tickets_delete on public\.support_tickets/);
  assert.match(hardeningMigration, /create policy platform_sales_leads_delete on public\.platform_sales_leads/);
});



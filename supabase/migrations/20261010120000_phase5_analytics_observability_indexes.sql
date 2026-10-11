begin;

-- ============================================================================
-- Phase 5: Executive Intelligence, Business Analytics & Platform Reliability
-- Safe, non-destructive indexes for time-windowed analytics & observability
-- ============================================================================

-- 1. Sales leads: time-windowed funnel & source aggregation + active follow-up queue
create index if not exists platform_sales_leads_analytics_created_lookup
  on public.platform_sales_leads (created_at desc, stage, source);

create index if not exists platform_sales_leads_active_followup_lookup
  on public.platform_sales_leads (follow_up_at asc)
  where follow_up_at is not null and stage not in ('converted', 'closed');

-- 2. Delivery tasks: overdue / upcoming deadline alerts & time-windowed velocity
create index if not exists tenant_tasks_open_due_date_lookup
  on public.tenant_tasks (due_date asc, priority)
  where status <> 'done' and due_date is not null;

create index if not exists tenant_tasks_created_at_lookup
  on public.tenant_tasks (created_at desc, status, priority);

-- 3. Commercial invoices: time-windowed booked value, receivables & aging lookups
create index if not exists tenant_invoices_analytics_created_lookup
  on public.tenant_invoices (created_at desc, status, due_date);

-- 4. Platform observability: automation sweep & failure health checks
create index if not exists audit_events_platform_automation_lookup
  on public.audit_events (action, occurred_at desc)
  where scope = 'platform';

commit;


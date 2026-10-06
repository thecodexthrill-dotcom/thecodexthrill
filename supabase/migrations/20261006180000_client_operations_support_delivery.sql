begin;

-- ============================================================================
-- 1. Tenant Projects
-- ============================================================================
create table public.tenant_projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  name text not null check (length(trim(name)) between 1 and 200),
  description text not null default '',
  status text not null default 'planning'
    check (status in ('planning', 'in_progress', 'in_review', 'completed', 'on_hold')),
  progress_pct int not null default 0 check (progress_pct between 0 and 100),
  start_date date,
  target_date date,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tenant_projects_org_status_lookup
  on public.tenant_projects (organization_id, status, created_at desc);

create trigger tenant_projects_set_updated_at
  before update on public.tenant_projects
  for each row execute function private.set_updated_at();

create trigger tenant_projects_audit
  after insert or update or delete on public.tenant_projects
  for each row execute function private.write_audit_event();

-- ============================================================================
-- 2. Tenant Tasks
-- ============================================================================
create table public.tenant_tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.tenant_projects (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete restrict,
  title text not null check (length(trim(title)) between 1 and 200),
  description text not null default '',
  status text not null default 'todo'
    check (status in ('todo', 'in_progress', 'review', 'done')),
  priority text not null default 'medium'
    check (priority in ('low', 'medium', 'high', 'urgent')),
  assigned_to uuid references public.profiles (id) on delete set null,
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tenant_tasks_project_lookup
  on public.tenant_tasks (project_id, status, priority);
create index tenant_tasks_org_lookup
  on public.tenant_tasks (organization_id, status);

create trigger tenant_tasks_set_updated_at
  before update on public.tenant_tasks
  for each row execute function private.set_updated_at();

create trigger tenant_tasks_audit
  after insert or update or delete on public.tenant_tasks
  for each row execute function private.write_audit_event();

-- ============================================================================
-- 3. Tenant Documents / Shared Deliverables & Assets
-- ============================================================================
create table public.tenant_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  project_id uuid references public.tenant_projects (id) on delete set null,
  name text not null check (length(trim(name)) between 1 and 255),
  file_url text not null check (length(trim(file_url)) >= 1),
  file_size_bytes bigint not null default 0 check (file_size_bytes >= 0),
  file_type text not null default 'application/octet-stream',
  category text not null default 'deliverable'
    check (category in ('contract', 'deliverable', 'invoice', 'asset', 'specification', 'other')),
  uploaded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index tenant_documents_org_lookup
  on public.tenant_documents (organization_id, category, created_at desc);

create trigger tenant_documents_audit
  after insert or update or delete on public.tenant_documents
  for each row execute function private.write_audit_event();

-- ============================================================================
-- 4. Tenant Invoices / Billing
-- ============================================================================
create table public.tenant_invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  invoice_number text not null unique check (length(trim(invoice_number)) between 3 and 64),
  amount_cents bigint not null check (amount_cents >= 0),
  currency text not null default 'USD' check (length(currency) = 3),
  status text not null default 'draft'
    check (status in ('draft', 'sent', 'paid', 'overdue', 'cancelled')),
  due_date date,
  paid_at timestamptz,
  items jsonb not null default '[]'::jsonb check (jsonb_typeof(items) = 'array'),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tenant_invoices_org_status_lookup
  on public.tenant_invoices (organization_id, status, due_date);

create trigger tenant_invoices_set_updated_at
  before update on public.tenant_invoices
  for each row execute function private.set_updated_at();

create trigger tenant_invoices_audit
  after insert or update or delete on public.tenant_invoices
  for each row execute function private.write_audit_event();

-- ============================================================================
-- 5. Support Tickets
-- ============================================================================
create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_number text not null unique check (length(trim(ticket_number)) between 4 and 64),
  organization_id uuid references public.organizations (id) on delete restrict,
  customer_id uuid not null references public.profiles (id) on delete restrict,
  title text not null check (length(trim(title)) between 2 and 200),
  category text not null default 'general'
    check (category in ('technical', 'billing', 'feature_request', 'general')),
  priority text not null default 'medium'
    check (priority in ('low', 'medium', 'high', 'urgent')),
  status text not null default 'new'
    check (status in ('new', 'in_progress', 'waiting_on_client', 'resolved', 'closed')),
  assigned_to uuid references public.profiles (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index support_tickets_status_priority_lookup
  on public.support_tickets (status, priority, created_at desc);
create index support_tickets_customer_lookup
  on public.support_tickets (customer_id, created_at desc);
create index support_tickets_org_lookup
  on public.support_tickets (organization_id, status)
  where organization_id is not null;

create trigger support_tickets_set_updated_at
  before update on public.support_tickets
  for each row execute function private.set_updated_at();

create trigger support_tickets_audit
  after insert or update or delete on public.support_tickets
  for each row execute function private.write_audit_event();

-- ============================================================================
-- 6. Support Ticket Messages / Conversation History
-- ============================================================================
create table public.support_ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete restrict,
  is_staff boolean not null default false,
  message text not null check (length(trim(message)) between 1 and 10000),
  attachments jsonb not null default '[]'::jsonb check (jsonb_typeof(attachments) = 'array'),
  created_at timestamptz not null default now()
);

create index support_ticket_messages_ticket_order
  on public.support_ticket_messages (ticket_id, created_at asc);

create trigger support_ticket_messages_audit
  after insert or update or delete on public.support_ticket_messages
  for each row execute function private.write_audit_event();

-- ============================================================================
-- 7. User Notifications
-- ============================================================================
create table public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 200),
  message text not null check (length(trim(message)) between 1 and 2000),
  type text not null default 'system'
    check (type in ('system', 'security', 'ticket', 'project', 'billing')),
  link_url text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index user_notifications_user_lookup
  on public.user_notifications (user_id, is_read, created_at desc);

-- ============================================================================
-- 8. Row Level Security & Access Grants
-- ============================================================================

alter table public.tenant_projects enable row level security;
alter table public.tenant_tasks enable row level security;
alter table public.tenant_documents enable row level security;
alter table public.tenant_invoices enable row level security;
alter table public.support_tickets enable row level security;
alter table public.support_ticket_messages enable row level security;
alter table public.user_notifications enable row level security;

revoke all on table public.tenant_projects from public, anon, authenticated;
revoke all on table public.tenant_tasks from public, anon, authenticated;
revoke all on table public.tenant_documents from public, anon, authenticated;
revoke all on table public.tenant_invoices from public, anon, authenticated;
revoke all on table public.support_tickets from public, anon, authenticated;
revoke all on table public.support_ticket_messages from public, anon, authenticated;
revoke all on table public.user_notifications from public, anon, authenticated;

grant select on table public.tenant_projects to authenticated;
grant insert, update on table public.tenant_projects to authenticated;

grant select on table public.tenant_tasks to authenticated;
grant insert, update, delete on table public.tenant_tasks to authenticated;

grant select on table public.tenant_documents to authenticated;
grant insert on table public.tenant_documents to authenticated;

grant select on table public.tenant_invoices to authenticated;
grant insert, update on table public.tenant_invoices to authenticated;

grant select on table public.support_tickets to authenticated;
grant insert, update on table public.support_tickets to authenticated;

grant select on table public.support_ticket_messages to authenticated;
grant insert on table public.support_ticket_messages to authenticated;

grant select on table public.user_notifications to authenticated;
grant update (is_read) on table public.user_notifications to authenticated;

-- Policies: Projects
create policy tenant_projects_read on public.tenant_projects
  for select to authenticated using (
    private.has_org_role(organization_id, array['organization_owner', 'organization_admin', 'project_manager', 'client_member'])
    or (private.has_platform_role(array['developer', 'platform_admin']) or private.is_super_admin())
  );

create policy tenant_projects_manage on public.tenant_projects
  for all to authenticated using (
    (
      private.has_org_role(organization_id, array['organization_owner', 'organization_admin', 'project_manager'])
      and (select auth.jwt() ->> 'aal') = 'aal2'
    )
    or (
      (private.has_platform_role(array['platform_admin', 'developer']) or private.is_super_admin())
      and (select auth.jwt() ->> 'aal') = 'aal2'
    )
  );

-- Policies: Tasks
create policy tenant_tasks_read on public.tenant_tasks
  for select to authenticated using (
    private.has_org_role(organization_id, array['organization_owner', 'organization_admin', 'project_manager', 'client_member'])
    or (private.has_platform_role(array['developer', 'platform_admin']) or private.is_super_admin())
  );

create policy tenant_tasks_manage on public.tenant_tasks
  for all to authenticated using (
    private.has_org_role(organization_id, array['organization_owner', 'organization_admin', 'project_manager'])
    or (private.has_platform_role(array['developer', 'platform_admin']) or private.is_super_admin())
  );

-- Policies: Documents
create policy tenant_documents_read on public.tenant_documents
  for select to authenticated using (
    private.has_org_role(organization_id, array['organization_owner', 'organization_admin', 'project_manager', 'client_member'])
    or (private.has_platform_role(array['developer', 'platform_admin']) or private.is_super_admin())
  );

create policy tenant_documents_insert on public.tenant_documents
  for insert to authenticated with check (
    private.has_org_role(organization_id, array['organization_owner', 'organization_admin', 'project_manager'])
    or (private.has_platform_role(array['developer', 'platform_admin']) or private.is_super_admin())
  );

-- Policies: Invoices
create policy tenant_invoices_read on public.tenant_invoices
  for select to authenticated using (
    private.has_org_role(organization_id, array['organization_owner', 'organization_admin', 'client_member'])
    or (private.has_platform_role(array['platform_admin']) or private.is_super_admin())
  );

create policy tenant_invoices_manage on public.tenant_invoices
  for all to authenticated using (
    (private.has_platform_role(array['platform_admin']) or private.is_super_admin())
    and (select auth.jwt() ->> 'aal') = 'aal2'
  );

-- Policies: Support Tickets
create policy support_tickets_read on public.support_tickets
  for select to authenticated using (
    customer_id = (select auth.uid())
    or (
      organization_id is not null
      and private.has_org_role(organization_id, array['organization_owner', 'organization_admin', 'project_manager', 'client_member'])
    )
    or private.has_platform_role(array['support_staff', 'platform_admin', 'developer'])
    or private.is_super_admin()
  );

create policy support_tickets_create on public.support_tickets
  for insert to authenticated with check (
    customer_id = (select auth.uid())
    and (
      organization_id is null
      or private.has_org_role(organization_id, array['organization_owner', 'organization_admin', 'project_manager', 'client_member'])
    )
  );

create policy support_tickets_update on public.support_tickets
  for update to authenticated using (
    customer_id = (select auth.uid())
    or private.has_platform_role(array['support_staff', 'platform_admin', 'developer'])
    or private.is_super_admin()
  );

-- Policies: Ticket Messages
create policy support_ticket_messages_read on public.support_ticket_messages
  for select to authenticated using (
    exists (
      select 1 from public.support_tickets as t
      where t.id = ticket_id
        and (
          t.customer_id = (select auth.uid())
          or (
            t.organization_id is not null
            and private.has_org_role(t.organization_id, array['organization_owner', 'organization_admin', 'project_manager', 'client_member'])
          )
          or private.has_platform_role(array['support_staff', 'platform_admin', 'developer'])
          or private.is_super_admin()
        )
    )
  );

create policy support_ticket_messages_insert on public.support_ticket_messages
  for insert to authenticated with check (
    sender_id = (select auth.uid())
    and exists (
      select 1 from public.support_tickets as t
      where t.id = ticket_id
        and (
          t.customer_id = (select auth.uid())
          or (
            t.organization_id is not null
            and private.has_org_role(t.organization_id, array['organization_owner', 'organization_admin', 'project_manager', 'client_member'])
          )
          or private.has_platform_role(array['support_staff', 'platform_admin', 'developer'])
          or private.is_super_admin()
        )
    )
  );

-- Policies: Notifications
create policy user_notifications_read on public.user_notifications
  for select to authenticated using (
    user_id = (select auth.uid())
  );

create policy user_notifications_update on public.user_notifications
  for update to authenticated using (
    user_id = (select auth.uid())
  ) with check (
    user_id = (select auth.uid())
  );

commit;


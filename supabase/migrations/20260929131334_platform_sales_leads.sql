begin;

create table public.platform_sales_leads (
  id uuid primary key default gen_random_uuid(),
  contact_name text not null check (length(trim(contact_name)) between 1 and 160),
  email text not null check (length(trim(email)) between 3 and 320),
  company_name text check (company_name is null or length(trim(company_name)) <= 160),
  message text check (message is null or length(message) <= 10000),
  source text not null default 'admin'
    check (source in ('website', 'admin', 'referral', 'import', 'other')),
  stage text not null default 'new'
    check (stage in ('new', 'contacted', 'qualified', 'converted', 'closed')),
  assigned_to uuid references public.profiles (id) on delete restrict,
  follow_up_at timestamptz,
  created_by uuid references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index platform_sales_leads_stage_created_lookup
  on public.platform_sales_leads (stage, created_at desc);
create index platform_sales_leads_assignee_stage_lookup
  on public.platform_sales_leads (assigned_to, stage, created_at desc);
create index platform_sales_leads_email_lookup
  on public.platform_sales_leads (lower(email));
create index platform_sales_leads_created_by_lookup
  on public.platform_sales_leads (created_by)
  where created_by is not null;

create trigger platform_sales_leads_set_updated_at
  before update on public.platform_sales_leads
  for each row execute function private.set_updated_at();
create trigger platform_sales_leads_audit
  after insert or update or delete on public.platform_sales_leads
  for each row execute function private.write_audit_event();

alter table public.platform_sales_leads enable row level security;
revoke all on table public.platform_sales_leads from public, anon, authenticated;
grant select on table public.platform_sales_leads to authenticated;
grant insert (contact_name, email, company_name, message, source, stage, assigned_to, follow_up_at, created_by)
  on table public.platform_sales_leads to authenticated;
grant update (contact_name, email, company_name, message, source, stage, assigned_to, follow_up_at)
  on table public.platform_sales_leads to authenticated;

create policy platform_sales_leads_read on public.platform_sales_leads
  for select to authenticated using (
    (private.has_platform_role(array['platform_admin']) or private.is_super_admin())
    and (select auth.jwt() ->> 'aal') = 'aal2'
  );
create policy platform_sales_leads_create on public.platform_sales_leads
  for insert to authenticated with check (
    (private.has_platform_role(array['platform_admin']) or private.is_super_admin())
    and (select auth.jwt() ->> 'aal') = 'aal2'
    and (created_by is null or created_by = (select auth.uid()))
  );
create policy platform_sales_leads_update on public.platform_sales_leads
  for update to authenticated
  using (
    (private.has_platform_role(array['platform_admin']) or private.is_super_admin())
    and (select auth.jwt() ->> 'aal') = 'aal2'
  )
  with check (
    (private.has_platform_role(array['platform_admin']) or private.is_super_admin())
    and (select auth.jwt() ->> 'aal') = 'aal2'
  );

commit;

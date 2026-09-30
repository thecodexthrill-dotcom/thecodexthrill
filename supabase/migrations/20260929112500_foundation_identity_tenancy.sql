begin;

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete restrict,
  display_name text,
  avatar_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 160),
  status text not null default 'active'
    check (status in ('active', 'suspended', 'deleted')),
  created_by uuid references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check ((status = 'deleted') = (deleted_at is not null))
);

create table public.organization_memberships (
  organization_id uuid not null references public.organizations (id) on delete restrict,
  user_id uuid not null references public.profiles (id) on delete restrict,
  status text not null default 'active'
    check (status in ('active', 'suspended', 'removed')),
  created_by uuid references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create table public.organization_role_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  user_id uuid not null,
  role text not null check (role in (
    'organization_owner', 'organization_admin', 'project_manager', 'client_member'
  )),
  assigned_by uuid references public.profiles (id) on delete restrict,
  assigned_at timestamptz not null default now(),
  revoked_at timestamptz,
  foreign key (organization_id, user_id)
    references public.organization_memberships (organization_id, user_id)
    on delete restrict
);

create unique index organization_role_assignments_one_current_role
  on public.organization_role_assignments (organization_id, user_id)
  where revoked_at is null;
create index organization_role_assignments_membership_fk
  on public.organization_role_assignments (organization_id, user_id);
create index organization_role_assignments_user_lookup
  on public.organization_role_assignments (user_id, organization_id)
  where revoked_at is null;
create index organization_role_assignments_assigned_by_lookup
  on public.organization_role_assignments (assigned_by)
  where assigned_by is not null;

create table public.platform_role_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete restrict,
  role text not null check (role in ('platform_admin', 'developer', 'support_staff')),
  assigned_by uuid references public.profiles (id) on delete restrict,
  assigned_at timestamptz not null default now(),
  revoked_at timestamptz
);

create unique index platform_role_assignments_one_active_role
  on public.platform_role_assignments (user_id, role)
  where revoked_at is null;
create index platform_role_assignments_user_history_lookup
  on public.platform_role_assignments (user_id, assigned_at desc);
create index platform_role_assignments_assigned_by_lookup
  on public.platform_role_assignments (assigned_by)
  where assigned_by is not null;

create table public.platform_super_admin_designation (
  slot smallint primary key default 1 check (slot = 1),
  user_id uuid not null unique references public.profiles (id) on delete restrict,
  designated_at timestamptz not null default now(),
  designated_by uuid references public.profiles (id) on delete restrict
);

create function private.assert_super_admin_designation_integrity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.platform_super_admin_designation) <> 1 then
    raise exception 'An established Super Admin designation cannot be removed without replacement';
  end if;
  return null;
end;
$$;
revoke all on function private.assert_super_admin_designation_integrity()
  from public, anon, authenticated;

create constraint trigger super_admin_designation_must_remain_set
  after insert or update or delete on public.platform_super_admin_designation
  deferrable initially deferred
  for each row execute function private.assert_super_admin_designation_integrity();

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  actor_user_id uuid references public.profiles (id) on delete set null,
  organization_id uuid references public.organizations (id) on delete restrict,
  scope text not null check (scope in ('platform', 'organization')),
  action text not null check (length(action) between 1 and 120),
  target_type text not null check (length(target_type) between 1 and 120),
  target_id text,
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  check (
    (scope = 'platform' and organization_id is null)
    or (scope = 'organization' and organization_id is not null)
  )
);

create index organization_memberships_user_status_lookup
  on public.organization_memberships (user_id, status, organization_id);
create index organization_memberships_org_status_lookup
  on public.organization_memberships (organization_id, status, user_id);
create index organization_memberships_created_by_lookup
  on public.organization_memberships (created_by)
  where created_by is not null;
create index organizations_status_created_lookup
  on public.organizations (status, created_at desc);
create index organizations_created_by_lookup
  on public.organizations (created_by)
  where created_by is not null;
create index platform_super_admin_designation_designated_by_lookup
  on public.platform_super_admin_designation (designated_by)
  where designated_by is not null;
create index audit_events_platform_time_lookup
  on public.audit_events (occurred_at desc) where scope = 'platform';
create index audit_events_org_time_lookup
  on public.audit_events (organization_id, occurred_at desc)
  where scope = 'organization';
create index audit_events_actor_time_lookup
  on public.audit_events (actor_user_id, occurred_at desc);

create function private.is_platform_operational()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.platform_super_admin_designation as d
    join auth.users as u on u.id = d.user_id
    where d.slot = 1
      and u.email_confirmed_at is not null
      and (u.banned_until is null or u.banned_until <= statement_timestamp())
  );
$$;

create function private.has_org_role(p_organization_id uuid, p_roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_memberships as m
    join public.organization_role_assignments as r
      on r.organization_id = m.organization_id
      and r.user_id = m.user_id
      and r.revoked_at is null
    join public.organizations as o on o.id = m.organization_id
    where m.organization_id = p_organization_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
      and o.status = 'active'
      and r.role = any (p_roles)
      and private.is_platform_operational()
  );
$$;

create function private.has_platform_role(p_roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.platform_role_assignments as r
    where r.user_id = (select auth.uid())
      and r.revoked_at is null
      and r.role = any (p_roles)
      and private.is_platform_operational()
  );
$$;

create function private.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.platform_super_admin_designation as d
    where d.user_id = (select auth.uid())
      and private.is_platform_operational()
  );
$$;

revoke all on function private.is_platform_operational() from public, anon;
revoke all on function private.has_org_role(uuid, text[]) from public, anon;
revoke all on function private.has_platform_role(text[]) from public, anon;
revoke all on function private.is_super_admin() from public, anon;
grant execute on function private.is_platform_operational() to authenticated;
grant execute on function private.has_org_role(uuid, text[]) to authenticated;
grant execute on function private.has_platform_role(text[]) to authenticated;
grant execute on function private.is_super_admin() to authenticated;

create function public.platform_is_operational()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_platform_operational();
$$;
revoke all on function public.platform_is_operational() from public, anon;
grant execute on function public.platform_is_operational() to authenticated;

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function private.set_updated_at() from public, anon, authenticated;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function private.set_updated_at();
create trigger organizations_set_updated_at
  before update on public.organizations
  for each row execute function private.set_updated_at();
create trigger memberships_set_updated_at
  before update on public.organization_memberships
  for each row execute function private.set_updated_at();

create function private.create_profile_for_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''))
  on conflict (id) do nothing;
  return new;
end;
$$;
revoke all on function private.create_profile_for_auth_user() from public, anon, authenticated;
create trigger on_auth_user_created_create_profile
  after insert on auth.users
  for each row execute function private.create_profile_for_auth_user();

create function private.assert_membership_role_pair_integrity(
  p_organization_id uuid, p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_membership_status text;
  v_current_role_count integer;
begin
  select m.status into v_membership_status
  from public.organization_memberships as m
  where m.organization_id = p_organization_id and m.user_id = p_user_id;

  select count(*) into v_current_role_count
  from public.organization_role_assignments as r
  where r.organization_id = p_organization_id
    and r.user_id = p_user_id
    and r.revoked_at is null;

  if v_membership_status = 'active' and v_current_role_count <> 1 then
    raise exception 'Active organization membership must have exactly one current role assignment';
  end if;
  if v_membership_status is distinct from 'active' and v_current_role_count <> 0 then
    raise exception 'Non-active organization membership cannot have a current role assignment';
  end if;
end;
$$;
revoke all on function private.assert_membership_role_pair_integrity(uuid, uuid)
  from public, anon, authenticated;

create function private.assert_membership_role_integrity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform private.assert_membership_role_pair_integrity(old.organization_id, old.user_id);
    return null;
  end if;
  if tg_op = 'UPDATE' then
    perform private.assert_membership_role_pair_integrity(old.organization_id, old.user_id);
  end if;
  perform private.assert_membership_role_pair_integrity(new.organization_id, new.user_id);
  return null;
end;
$$;
revoke all on function private.assert_membership_role_integrity() from public, anon, authenticated;

create constraint trigger membership_role_integrity_from_membership
  after insert or update or delete on public.organization_memberships
  deferrable initially deferred
  for each row execute function private.assert_membership_role_integrity();
create constraint trigger membership_role_integrity_from_role
  after insert or update or delete on public.organization_role_assignments
  deferrable initially deferred
  for each row execute function private.assert_membership_role_integrity();

create function private.write_audit_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row jsonb;
  v_organization_id uuid;
  v_target_id text;
  v_details jsonb;
begin
  v_row := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  v_organization_id := nullif(v_row ->> 'organization_id', '')::uuid;
  v_target_id := coalesce(v_row ->> 'id', v_row ->> 'user_id');
  v_details := jsonb_build_object('operation', lower(tg_op));

  if v_row ? 'status' then
    v_details := v_details || jsonb_build_object('status', v_row ->> 'status');
  end if;
  if v_row ? 'role' then
    v_details := v_details || jsonb_build_object('role', v_row ->> 'role');
  end if;
  if tg_table_name = 'platform_super_admin_designation' then
    v_target_id := v_row ->> 'user_id';
  end if;

  insert into public.audit_events (
    actor_user_id, organization_id, scope, action, target_type, target_id, details
  ) values (
    (select auth.uid()), v_organization_id,
    case when v_organization_id is null then 'platform' else 'organization' end,
    lower(tg_table_name || '.' || tg_op), tg_table_name, v_target_id, v_details
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;
revoke all on function private.write_audit_event() from public, anon, authenticated;

create trigger organizations_audit
  after insert or update or delete on public.organizations
  for each row execute function private.write_audit_event();
create trigger memberships_audit
  after insert or update or delete on public.organization_memberships
  for each row execute function private.write_audit_event();
create trigger organization_role_assignments_audit
  after insert or update or delete on public.organization_role_assignments
  for each row execute function private.write_audit_event();
create trigger platform_role_assignments_audit
  after insert or update or delete on public.platform_role_assignments
  for each row execute function private.write_audit_event();
create trigger super_admin_designation_audit
  after insert or update or delete on public.platform_super_admin_designation
  for each row execute function private.write_audit_event();

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_memberships enable row level security;
alter table public.organization_role_assignments enable row level security;
alter table public.platform_role_assignments enable row level security;
alter table public.platform_super_admin_designation enable row level security;
alter table public.audit_events enable row level security;

revoke all on table public.profiles from public, anon, authenticated;
revoke all on table public.organizations from public, anon, authenticated;
revoke all on table public.organization_memberships from public, anon, authenticated;
revoke all on table public.organization_role_assignments from public, anon, authenticated;
revoke all on table public.platform_role_assignments from public, anon, authenticated;
revoke all on table public.platform_super_admin_designation from public, anon, authenticated;
revoke all on table public.audit_events from public, anon, authenticated;

grant select on table public.profiles to authenticated;
grant update (display_name, avatar_path) on table public.profiles to authenticated;
grant select on table public.organizations to authenticated;
grant insert, update on table public.organizations to authenticated;
grant select on table public.organization_memberships to authenticated;
grant select on table public.organization_role_assignments to authenticated;
grant select on table public.platform_role_assignments to authenticated;
grant select on table public.platform_super_admin_designation to authenticated;
grant select on table public.audit_events to authenticated;

create policy profiles_read_self on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy organizations_read_member_or_platform on public.organizations
  for select to authenticated using (
    private.has_org_role(id, array['project_manager', 'client_member'])
    or (
      private.has_org_role(id, array['organization_owner', 'organization_admin'])
      and (select auth.jwt() ->> 'aal') = 'aal2'
    )
    or (
      (private.has_platform_role(array['platform_admin']) or private.is_super_admin())
      and (select auth.jwt() ->> 'aal') = 'aal2'
    )
  );
create policy organizations_create_platform_admin on public.organizations
  for insert to authenticated with check (
    (private.has_platform_role(array['platform_admin']) or private.is_super_admin())
    and (select auth.jwt() ->> 'aal') = 'aal2'
    and (created_by is null or created_by = (select auth.uid()))
  );
create policy organizations_update_platform_admin on public.organizations
  for update to authenticated
  using (
    (private.has_platform_role(array['platform_admin']) or private.is_super_admin())
    and (select auth.jwt() ->> 'aal') = 'aal2'
  )
  with check (
    (private.has_platform_role(array['platform_admin']) or private.is_super_admin())
    and (select auth.jwt() ->> 'aal') = 'aal2'
  );
create policy organizations_privileged_mfa_required
  on public.organizations as restrictive for all to authenticated
  using (
    not (
      private.is_super_admin()
      or private.has_platform_role(array['platform_admin'])
      or private.has_org_role(id, array['organization_owner', 'organization_admin'])
    )
    or (select auth.jwt() ->> 'aal') = 'aal2'
  )
  with check (
    not (
      private.is_super_admin()
      or private.has_platform_role(array['platform_admin'])
      or private.has_org_role(id, array['organization_owner', 'organization_admin'])
    )
    or (select auth.jwt() ->> 'aal') = 'aal2'
  );

create policy memberships_read_self_or_org_admin on public.organization_memberships
  for select to authenticated using (
    user_id = (select auth.uid())
    or (
      private.has_org_role(organization_id, array['organization_owner', 'organization_admin'])
      and (select auth.jwt() ->> 'aal') = 'aal2'
    )
  );
create policy org_role_assignments_read_self_or_org_admin on public.organization_role_assignments
  for select to authenticated using (
    user_id = (select auth.uid())
    or (
      private.has_org_role(organization_id, array['organization_owner', 'organization_admin'])
      and (select auth.jwt() ->> 'aal') = 'aal2'
    )
  );
create policy platform_role_assignments_read_self_or_governance on public.platform_role_assignments
  for select to authenticated using (
    user_id = (select auth.uid())
    or (
      (private.has_platform_role(array['platform_admin']) or private.is_super_admin())
      and (select auth.jwt() ->> 'aal') = 'aal2'
    )
  );
create policy super_admin_designation_read_self on public.platform_super_admin_designation
  for select to authenticated using (
    user_id = (select auth.uid())
  );
create policy audit_events_read_governance_scope on public.audit_events
  for select to authenticated using (
    (select auth.jwt() ->> 'aal') = 'aal2'
    and (
      (scope = 'platform' and private.is_super_admin())
      or (
        scope = 'organization'
        and private.has_org_role(
          organization_id, array['organization_owner', 'organization_admin']
        )
      )
    )
  );

commit;

begin;

-- =============================================================================
-- Migration: 20261014120000_provision_organization_membership_rpc.sql
-- Description: Minimal atomic database RPC for organization membership provisioning.
-- Eliminates race conditions and satisfies deferred constraint triggers:
--   - membership_role_integrity_from_membership
--   - membership_role_integrity_from_role
-- which require an active organization membership to have exactly one active
-- role assignment at transaction commit time.
-- =============================================================================

create or replace function public.provision_organization_membership(
  p_organization_id uuid,
  p_user_id uuid,
  p_role text,
  p_actor_user_id uuid default null,
  p_display_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller_role text := coalesce(auth.role(), '');
  v_caller_uid uuid := auth.uid();
  v_org_status text;
  v_target_user_exists boolean;
  v_effective_actor uuid;
  v_existing_membership_status text;
  v_existing_role_id uuid;
  v_existing_role text;
  v_action text := 'none';
begin
  -- 1. Strict role allowlisting
  if p_role is null or p_role not in (
    'organization_owner', 'organization_admin', 'project_manager', 'client_member'
  ) then
    raise exception 'Invalid organization role: %', p_role;
  end if;

  -- 2. Organization existence and status validation
  select o.status into v_org_status
  from public.organizations as o
  where o.id = p_organization_id;

  if v_org_status is null then
    raise exception 'Organization % not found', p_organization_id;
  end if;

  if v_org_status <> 'active' then
    raise exception 'Cannot provision membership for inactive or deleted organization %', p_organization_id;
  end if;

  -- 3. Target auth user existence check
  select exists (
    select 1 from auth.users as u where u.id = p_user_id
  ) into v_target_user_exists;

  if not v_target_user_exists then
    raise exception 'User % not found in auth.users', p_user_id;
  end if;

  -- 4. Authorization enforcement
  if v_caller_role = 'authenticated' then
    if not (
      -- Platform super admin or platform admin with AAL2
      (
        (private.is_super_admin() or private.has_platform_role(array['platform_admin']))
        and coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
      )
      -- Organization owner or admin of target organization with AAL2
      or (
        private.has_org_role(p_organization_id, array['organization_owner', 'organization_admin'])
        and coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
      )
      -- Self-provisioning by invited user during verified invite session
      or (
        v_caller_uid = p_user_id
        and exists (
          select 1 from auth.users as u
          where u.id = v_caller_uid
            and u.email_confirmed_at is not null
            and u.invited_at is not null
            and jsonb_path_exists(
              coalesce(auth.jwt() -> 'amr', '[]'::jsonb),
              '$[*] ? (@.method == "invite" || @.method == "otp")'
            )
        )
      )
    ) then
      raise exception 'Unauthorized to provision organization membership';
    end if;
  elsif v_caller_role <> 'service_role' and session_user not in ('postgres', 'supabase_admin', 'dashboard_user') then
    raise exception 'Unauthorized caller role: %', v_caller_role;
  end if;

  -- 5. Effective actor resolution
  v_effective_actor := coalesce(p_actor_user_id, v_caller_uid, p_user_id);

  if v_effective_actor is not null then
    insert into public.profiles (id, display_name)
    values (v_effective_actor, 'System')
    on conflict (id) do nothing;
  end if;

  -- 6. Profile initialization for target user
  insert into public.profiles (id, display_name)
  values (p_user_id, coalesce(nullif(trim(p_display_name), ''), 'Member'))
  on conflict (id) do nothing;

  -- 7. Query existing membership and active role under row-level lock
  select status into v_existing_membership_status
  from public.organization_memberships
  where organization_id = p_organization_id and user_id = p_user_id
  for update;

  select id, role into v_existing_role_id, v_existing_role
  from public.organization_role_assignments
  where organization_id = p_organization_id
    and user_id = p_user_id
    and revoked_at is null
  for update;

  -- 8. Atomic membership update or insert
  if v_existing_membership_status is null then
    insert into public.organization_memberships (
      organization_id, user_id, status, created_by, created_at, updated_at
    ) values (
      p_organization_id, p_user_id, 'active', v_effective_actor, statement_timestamp(), statement_timestamp()
    );
    v_action := 'created';
  elsif v_existing_membership_status <> 'active' then
    update public.organization_memberships
    set status = 'active', updated_at = statement_timestamp()
    where organization_id = p_organization_id and user_id = p_user_id;
    v_action := 'reactivated';
  else
    v_action := 'unchanged';
  end if;

  -- 9. Atomic role assignment synchronization
  if v_existing_role_id is null then
    insert into public.organization_role_assignments (
      organization_id, user_id, role, assigned_by, assigned_at
    ) values (
      p_organization_id, p_user_id, p_role, v_effective_actor, statement_timestamp()
    );
    if v_action = 'unchanged' then
      v_action := 'role_assigned';
    end if;
  elsif v_existing_role <> p_role then
    update public.organization_role_assignments
    set revoked_at = statement_timestamp()
    where id = v_existing_role_id;

    insert into public.organization_role_assignments (
      organization_id, user_id, role, assigned_by, assigned_at
    ) values (
      p_organization_id, p_user_id, p_role, v_effective_actor, statement_timestamp()
    );
    v_action := 'role_updated';
  else
    -- Idempotent: existing active role matches requested p_role exactly
    null;
  end if;

  -- 10. Audit event logging
  insert into public.audit_events (
    actor_user_id,
    organization_id,
    scope,
    action,
    target_type,
    target_id,
    details
  ) values (
    v_effective_actor,
    p_organization_id,
    'organization',
    'organization.member_provisioned',
    'organization_memberships',
    p_user_id::text,
    jsonb_build_object(
      'organization_id', p_organization_id,
      'user_id', p_user_id,
      'role', p_role,
      'action', v_action
    )
  );

  return jsonb_build_object(
    'ok', true,
    'organization_id', p_organization_id,
    'user_id', p_user_id,
    'role', p_role,
    'action', v_action
  );
end;
$$;

revoke all on function public.provision_organization_membership(uuid, uuid, text, uuid, text) from public, anon;
grant execute on function public.provision_organization_membership(uuid, uuid, text, uuid, text) to service_role, authenticated;

commit;

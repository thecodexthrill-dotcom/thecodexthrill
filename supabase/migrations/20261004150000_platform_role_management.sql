begin;

create function public.list_platform_users()
returns table (
  user_id uuid,
  email text,
  display_name text,
  roles text[],
  created_at timestamptz,
  email_confirmed boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or coalesce(auth.jwt() ->> 'aal', '') <> 'aal2'
    or not (private.is_super_admin() or private.has_platform_role(array['platform_admin'])) then
    raise exception 'Verified platform user administrator required';
  end if;

  return query
    select u.id,
      coalesce(u.email, '')::text,
      p.display_name,
      coalesce(array_agg(distinct case when d.user_id is not null then 'super_admin' else r.role end)
        filter (where d.user_id is not null or r.role is not null), '{}'::text[]),
      u.created_at,
      u.email_confirmed_at is not null
    from auth.users as u
    left join public.profiles as p on p.id = u.id
    left join public.platform_super_admin_designation as d on d.user_id = u.id
    left join public.platform_role_assignments as r on r.user_id = u.id and r.revoked_at is null
    where u.invited_at is not null
    group by u.id, u.email, p.display_name, u.created_at, u.email_confirmed_at
    order by u.created_at desc
    limit 500;
end;
$$;
revoke all on function public.list_platform_users() from public, anon;
grant execute on function public.list_platform_users() to authenticated;

create function public.set_platform_role(p_user_id uuid, p_role text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_has_super_admin boolean := private.is_super_admin();
  v_has_platform_admin boolean := private.has_platform_role(array['platform_admin']);
begin
  if v_actor is null or coalesce(auth.jwt() ->> 'aal', '') <> 'aal2'
    or not (v_has_super_admin or v_has_platform_admin) then
    raise exception 'Verified platform user administrator required';
  end if;
  if p_user_id is null or p_user_id = v_actor then
    raise exception 'A different invited user must be selected';
  end if;
  if p_role is not null and p_role not in ('platform_admin', 'developer', 'support_staff') then
    raise exception 'Role cannot be granted by platform role management';
  end if;
  if p_role = 'platform_admin' and not v_has_super_admin then
    raise exception 'Only the Super Admin may assign a Platform Admin';
  end if;
  if p_role in ('developer', 'support_staff') and not (v_has_super_admin or v_has_platform_admin) then
    raise exception 'Platform role assignment denied';
  end if;
  if exists (select 1 from public.platform_super_admin_designation where user_id = p_user_id) then
    raise exception 'Super Admin access can only be transferred through the atomic Owner transfer';
  end if;
  if not v_has_super_admin and exists (
    select 1 from public.platform_role_assignments
    where user_id = p_user_id and role = 'platform_admin' and revoked_at is null
  ) then
    raise exception 'Only the Super Admin may change a Platform Admin role';
  end if;
  if not exists (
    select 1 from auth.users as u
    where u.id = p_user_id and u.invited_at is not null
      and u.email_confirmed_at is not null and not u.is_anonymous
  ) then
    raise exception 'Only a confirmed invited Auth user can receive a platform role';
  end if;

  if p_role is not null and exists (
    select 1 from public.platform_role_assignments
    where user_id = p_user_id and role = p_role and revoked_at is null
  ) then
    return true;
  end if;

  update public.platform_role_assignments
    set revoked_at = statement_timestamp()
    where user_id = p_user_id and revoked_at is null;

  if p_role is not null then
    insert into public.platform_role_assignments(user_id, role, assigned_by)
    values (p_user_id, p_role, v_actor);
  end if;
  return true;
end;
$$;
revoke all on function public.set_platform_role(uuid, text) from public, anon;
grant execute on function public.set_platform_role(uuid, text) to authenticated;

commit;
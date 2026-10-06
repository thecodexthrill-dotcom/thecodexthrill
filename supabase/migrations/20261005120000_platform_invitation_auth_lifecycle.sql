begin;

alter table public.platform_invitations
  add column auth_user_id uuid references auth.users(id) on delete set null,
  add column resend_count integer not null default 0 check (resend_count >= 0),
  add column last_resent_at timestamptz;

create index platform_invitations_auth_user_id on public.platform_invitations(auth_user_id)
  where auth_user_id is not null;

drop function public.list_platform_invitations();
create function public.list_platform_invitations()
returns table (
  id uuid, email text, role text, status text, created_at timestamptz, expires_at timestamptz,
  auth_user_id uuid, resend_count integer, last_resent_at timestamptz
)
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or coalesce(auth.jwt() ->> 'aal', '') <> 'aal2'
    or not (private.is_super_admin() or private.has_platform_role(array['platform_admin'])) then
    raise exception 'Verified invitation administrator required';
  end if;
  update public.platform_invitations set status = 'expired'
    where status = 'pending' and expires_at <= statement_timestamp();
  return query select i.id, i.email, i.role, i.status, i.created_at, i.expires_at,
      i.auth_user_id, i.resend_count, i.last_resent_at
    from public.platform_invitations i order by i.created_at desc limit 100;
end;
$$;
revoke all on function public.list_platform_invitations() from public, anon;
grant execute on function public.list_platform_invitations() to authenticated;
create or replace function public.revoke_platform_invitation(p_invitation_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_invitation public.platform_invitations%rowtype;
begin
  if v_actor is null or coalesce(auth.jwt() ->> 'aal', '') <> 'aal2'
    or not (private.is_super_admin() or private.has_platform_role(array['platform_admin'])) then
    raise exception 'Verified invitation administrator required';
  end if;
  select * into v_invitation from public.platform_invitations where id = p_invitation_id for update;
  if not found or v_invitation.status <> 'pending' then return false; end if;
  if v_invitation.role = 'platform_admin' and not private.is_super_admin() then
    raise exception 'Only the Super Admin may revoke a Platform Admin invitation';
  end if;
  update public.platform_invitations set status = 'revoked', revoked_at = statement_timestamp()
    where id = p_invitation_id;
  return true;
end;
$$;
revoke all on function public.revoke_platform_invitation(uuid) from public, anon;
grant execute on function public.revoke_platform_invitation(uuid) to authenticated;

create or replace function public.resend_platform_invitation(p_invitation_id uuid)
returns table(id uuid, email text, role text)
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_invitation public.platform_invitations%rowtype;
  v_new_id uuid;
  v_now timestamptz := statement_timestamp();
begin
  if v_actor is null or coalesce(auth.jwt() ->> 'aal', '') <> 'aal2' then
    raise exception 'Verified invitation administrator required';
  end if;
  select * into v_invitation from public.platform_invitations
    where platform_invitations.id = p_invitation_id for update;
  if not found or v_invitation.status not in ('pending', 'expired') then
    raise exception 'Only a pending or expired invitation can be resent';
  end if;
  if v_invitation.role = 'platform_admin' then
    if not private.is_super_admin() then raise exception 'Only the Super Admin may invite a Platform Admin'; end if;
  elsif not (private.is_super_admin() or private.has_platform_role(array['platform_admin'])) then
    raise exception 'Invitation permission denied';
  end if;
  if exists (
    select 1 from public.platform_invitations other_invite
    where other_invite.email = v_invitation.email
      and other_invite.id <> p_invitation_id
      and other_invite.status = 'pending'
      and other_invite.expires_at > v_now
  ) then
    raise exception 'A newer active invitation already exists';
  end if;
  update public.platform_invitations set status = 'expired'
    where email = v_invitation.email and status = 'pending' and expires_at <= v_now
      and id <> p_invitation_id;
  if v_invitation.status = 'pending' then
    update public.platform_invitations set status = 'revoked', revoked_at = v_now
      where platform_invitations.id = p_invitation_id;
  end if;
  insert into public.platform_invitations(
    email, role, invited_by, expires_at, auth_user_id, resend_count, last_resent_at
  ) values (
    v_invitation.email, v_invitation.role, v_actor, v_now + interval '1 hour',
    v_invitation.auth_user_id, v_invitation.resend_count + 1, v_now
  ) returning platform_invitations.id into v_new_id;
  return query select v_new_id, v_invitation.email, v_invitation.role;
end;
$$;
revoke all on function public.resend_platform_invitation(uuid) from public, anon;
grant execute on function public.resend_platform_invitation(uuid) to authenticated;

create function public.link_platform_invitation_auth_user(p_invitation_id uuid, p_auth_user_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_invitation public.platform_invitations%rowtype;
  v_auth_email text;
  v_invited_at timestamptz;
begin
  if auth.uid() is null or coalesce(auth.jwt() ->> 'aal', '') <> 'aal2'
    or not (private.is_super_admin() or private.has_platform_role(array['platform_admin'])) then
    raise exception 'Verified invitation administrator required';
  end if;
  select * into v_invitation from public.platform_invitations
    where id = p_invitation_id and status = 'pending' and expires_at > statement_timestamp()
    for update;
  if not found then return false; end if;
  if v_invitation.role = 'platform_admin' and not private.is_super_admin() then
    raise exception 'Only the Super Admin may manage a Platform Admin invitation';
  end if;
  select lower(u.email), u.invited_at into v_auth_email, v_invited_at
    from auth.users u where u.id = p_auth_user_id;
  if v_auth_email is null or v_auth_email <> v_invitation.email or v_invited_at is null then
    raise exception 'Auth user does not match this invitation';
  end if;
  update public.platform_invitations set auth_user_id = p_auth_user_id
    where id = p_invitation_id;
  return true;
end;
$$;
revoke all on function public.link_platform_invitation_auth_user(uuid, uuid) from public, anon;
grant execute on function public.link_platform_invitation_auth_user(uuid, uuid) to authenticated;

create function public.get_auth_invitation_status()
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_email text;
  v_auth_user auth.users%rowtype;
  v_invitation public.platform_invitations%rowtype;
begin
  if v_user is null
    or not jsonb_path_exists(coalesce(auth.jwt() -> 'amr', '[]'::jsonb), '$[*] ? (@.method == "invite")') then
    return 'invalid';
  end if;
  select * into v_auth_user from auth.users where id = v_user;
  if not found or v_auth_user.email_confirmed_at is null or v_auth_user.invited_at is null
    or v_auth_user.is_anonymous is true then
    return 'invalid';
  end if;
  v_email := lower(v_auth_user.email);
  select * into v_invitation from public.platform_invitations i
    where i.email = v_email and (i.auth_user_id is null or i.auth_user_id = v_user)
    order by i.created_at desc limit 1 for update;
  if found then
    if v_invitation.status = 'pending' and v_invitation.expires_at <= statement_timestamp() then
      update public.platform_invitations set status = 'expired'
        where id = v_invitation.id and status = 'pending';
      return 'expired';
    end if;
    return v_invitation.status;
  end if;
  if exists (
    select 1 from public.initial_super_admin_bootstrap_authorizations a
    where a.slot = 1 and lower(a.authorized_email) = v_email and a.consumed_at is null
      and a.expires_at > statement_timestamp()
      and not exists (select 1 from public.platform_super_admin_designation)
  ) or exists (
    select 1 from public.owner_super_admin_transfer_authorizations a
    where lower(a.authorized_email) = v_email and a.status = 'authorized'
      and a.expires_at > statement_timestamp()
  ) then
    return 'valid';
  end if;
  return 'invalid';
end;
$$;
revoke all on function public.get_auth_invitation_status() from public, anon;
grant execute on function public.get_auth_invitation_status() to authenticated;

create or replace function public.accept_platform_invitation()
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_email text;
  v_role text;
  v_invitation_id uuid;
begin
  if v_user is null or coalesce(auth.jwt() ->> 'aal', '') <> 'aal1'
     or not jsonb_path_exists(coalesce(auth.jwt() -> 'amr', '[]'::jsonb), '$[*] ? (@.method == "invite")') then
    raise exception 'Verified single-use invitation session required';
  end if;
  select lower(u.email) into v_email from auth.users u
   where u.id = v_user and u.email_confirmed_at is not null and u.invited_at is not null
     and u.is_anonymous is not true;
  if v_email is null then raise exception 'Verified invitation identity required'; end if;
  select i.id, i.role into v_invitation_id, v_role
    from public.platform_invitations i
    where i.email = v_email and (i.auth_user_id is null or i.auth_user_id = v_user)
      and i.status = 'pending' and i.expires_at > statement_timestamp()
    for update;
  if v_invitation_id is null then raise exception 'Invitation is missing, expired, revoked, or already accepted'; end if;
  insert into public.platform_role_assignments(user_id, role, assigned_by)
    select v_user, v_role, i.invited_by from public.platform_invitations i where i.id = v_invitation_id;
  update public.platform_invitations set status = 'accepted', accepted_at = statement_timestamp(), auth_user_id = v_user
    where id = v_invitation_id;
  return v_role;
end;
$$;
revoke all on function public.accept_platform_invitation() from public, anon;
grant execute on function public.accept_platform_invitation() to authenticated;

commit;

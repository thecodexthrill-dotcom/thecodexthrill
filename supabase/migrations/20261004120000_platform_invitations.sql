begin;

create table public.platform_invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null check (email = lower(trim(email)) and length(email) between 3 and 320),
  role text not null check (role in ('platform_admin', 'developer', 'support_staff')),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked', 'expired')),
  invited_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  check (expires_at > created_at),
  check ((status = 'accepted') = (accepted_at is not null)),
  check ((status = 'revoked') = (revoked_at is not null))
);
create unique index platform_invitations_one_pending_email
  on public.platform_invitations(email) where status = 'pending';
create index platform_invitations_pending_expiry
  on public.platform_invitations(expires_at) where status = 'pending';
alter table public.platform_invitations enable row level security;
revoke all on table public.platform_invitations from public, anon, authenticated, service_role;

create function private.write_platform_invitation_audit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_action text;
begin
  if tg_op = 'INSERT' then
    v_action := 'platform.invitation.created';
  elsif new.status is distinct from old.status then
    v_action := 'platform.invitation.' || new.status;
  else
    return new;
  end if;
  insert into public.audit_events(actor_user_id, scope, action, target_type, target_id, details)
  values (
    case when tg_op = 'INSERT' then new.invited_by else coalesce((select auth.uid()), new.invited_by) end,
    'platform', v_action, 'platform_invitations', new.id::text,
    jsonb_build_object('email', new.email, 'role', new.role, 'expires_at', new.expires_at)
  );
  return new;
end;
$$;
revoke all on function private.write_platform_invitation_audit() from public, anon, authenticated;
create trigger platform_invitations_audit
  after insert or update on public.platform_invitations
  for each row execute function private.write_platform_invitation_audit();

create function public.create_platform_invitation(p_email text, p_role text, p_expires_at timestamptz)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_email text := lower(trim(p_email));
  v_id uuid;
begin
  if v_actor is null or coalesce(auth.jwt() ->> 'aal', '') <> 'aal2' then
    raise exception 'Verified privileged session required';
  end if;
  if p_role not in ('platform_admin', 'developer', 'support_staff') then
    raise exception 'Role cannot be granted by invitation';
  end if;
  if p_role = 'platform_admin' and not private.is_super_admin() then
    raise exception 'Only the Super Admin may invite a Platform Admin';
  end if;
  if p_role in ('developer', 'support_staff')
     and not (private.is_super_admin() or private.has_platform_role(array['platform_admin'])) then
    raise exception 'Invitation permission denied';
  end if;
  if v_email is null or length(v_email) not between 3 and 320
     or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'A valid email address is required';
  end if;
  if p_expires_at <= statement_timestamp()
     or p_expires_at > statement_timestamp() + interval '1 hour' then
    raise exception 'Invitation expiry must be within one hour';
  end if;
  update public.platform_invitations set status = 'expired'
    where email = v_email and status = 'pending' and expires_at <= statement_timestamp();
  insert into public.platform_invitations(email, role, invited_by, expires_at)
  values(v_email, p_role, v_actor, p_expires_at)
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.create_platform_invitation(text, text, timestamptz) from public, anon;
grant execute on function public.create_platform_invitation(text, text, timestamptz) to authenticated;

create function public.list_platform_invitations()
returns table (id uuid, email text, role text, status text, created_at timestamptz, expires_at timestamptz)
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or coalesce(auth.jwt() ->> 'aal', '') <> 'aal2'
    or not (private.is_super_admin() or private.has_platform_role(array['platform_admin'])) then
    raise exception 'Verified invitation administrator required';
  end if;
  update public.platform_invitations set status = 'expired'
    where status = 'pending' and expires_at <= statement_timestamp();
  return query select i.id, i.email, i.role, i.status, i.created_at, i.expires_at
    from public.platform_invitations i order by i.created_at desc limit 100;
end;
$$;
revoke all on function public.list_platform_invitations() from public, anon;
grant execute on function public.list_platform_invitations() to authenticated;

create function public.revoke_platform_invitation(p_invitation_id uuid)
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
  update public.platform_invitations set status = 'revoked', revoked_at = statement_timestamp()
    where id = p_invitation_id;
  return true;
end;
$$;
revoke all on function public.revoke_platform_invitation(uuid) from public, anon;
grant execute on function public.revoke_platform_invitation(uuid) to authenticated;

create function public.resend_platform_invitation(p_invitation_id uuid)
returns table(id uuid, email text, role text)
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_invitation public.platform_invitations%rowtype;
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
  if v_invitation.status = 'pending' then
    update public.platform_invitations set status = 'revoked', revoked_at = statement_timestamp()
      where platform_invitations.id = p_invitation_id;
  end if;
  insert into public.platform_invitations(email, role, invited_by, expires_at)
    values(v_invitation.email, v_invitation.role, v_actor, statement_timestamp() + interval '1 hour')
    returning platform_invitations.id, platform_invitations.email, platform_invitations.role into id, email, role;
  return next;
end;
$$;
revoke all on function public.resend_platform_invitation(uuid) from public, anon;
grant execute on function public.resend_platform_invitation(uuid) to authenticated;

create function public.has_valid_platform_invitation()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.platform_invitations i
    join auth.users u on lower(u.email) = i.email
    where u.id = auth.uid() and u.email_confirmed_at is not null and u.invited_at is not null
      and u.is_anonymous is not true and i.status = 'pending'
      and i.expires_at > statement_timestamp()
      and jsonb_path_exists(coalesce(auth.jwt() -> 'amr', '[]'::jsonb), '$[*] ? (@.method == "invite")')
  );
$$;
revoke all on function public.has_valid_platform_invitation() from public, anon;
grant execute on function public.has_valid_platform_invitation() to authenticated;
create function public.has_valid_auth_invitation()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from auth.users u
    where u.id = auth.uid() and u.email_confirmed_at is not null and u.invited_at is not null
      and u.is_anonymous is not true
      and jsonb_path_exists(coalesce(auth.jwt() -> 'amr', '[]'::jsonb), '$[*] ? (@.method == "invite")')
      and (
        exists (select 1 from public.platform_invitations i where i.email = lower(u.email)
          and i.status = 'pending' and i.expires_at > statement_timestamp())
        or exists (select 1 from public.initial_super_admin_bootstrap_authorizations a
          where a.slot = 1 and lower(a.authorized_email) = lower(u.email)
            and a.consumed_at is null and a.expires_at > statement_timestamp()
            and not exists (select 1 from public.platform_super_admin_designation))
        or exists (select 1 from public.owner_super_admin_transfer_authorizations a
          where lower(a.authorized_email) = lower(u.email) and a.status = 'authorized'
            and a.expires_at > statement_timestamp())
      )
  );
$$;
revoke all on function public.has_valid_auth_invitation() from public, anon;
grant execute on function public.has_valid_auth_invitation() to authenticated;

create function public.accept_platform_invitation()
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
    where i.email = v_email and i.status = 'pending' and i.expires_at > statement_timestamp()
    for update;
  if v_invitation_id is null then raise exception 'Invitation is missing, expired, revoked, or already accepted'; end if;
  insert into public.platform_role_assignments(user_id, role, assigned_by)
    select v_user, v_role, i.invited_by from public.platform_invitations i where i.id = v_invitation_id;
  update public.platform_invitations set status = 'accepted', accepted_at = statement_timestamp()
    where id = v_invitation_id;
  return v_role;
end;
$$;
revoke all on function public.accept_platform_invitation() from public, anon;
grant execute on function public.accept_platform_invitation() to authenticated;

commit;







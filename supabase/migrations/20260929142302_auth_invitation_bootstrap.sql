begin;

create table public.initial_super_admin_bootstrap_authorizations (
  slot smallint primary key default 1 check (slot = 1),
  authorized_email text not null
    check (length(trim(authorized_email)) between 3 and 320),
  owner_token_nonce_hash text not null unique
    check (owner_token_nonce_hash ~ '^[0-9a-f]{64}$'),
  authorized_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  consumed_user_id uuid references public.profiles (id) on delete restrict,
  check (expires_at > authorized_at),
  check ((consumed_at is null) = (consumed_user_id is null))
);

alter table public.initial_super_admin_bootstrap_authorizations enable row level security;
revoke all on table public.initial_super_admin_bootstrap_authorizations
  from public, anon, authenticated;
revoke all on table public.initial_super_admin_bootstrap_authorizations from service_role;

create function public.authorize_initial_super_admin(
  p_email text,
  p_expires_at timestamptz,
  p_owner_token_nonce_hash text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(trim(p_email));
begin
  if v_email is null or length(v_email) not between 3 and 320
     or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'A valid email address is required';
  end if;

  if p_expires_at is null
     or p_expires_at <= statement_timestamp()
     or p_expires_at > statement_timestamp() + interval '24 hours' then
    raise exception 'Bootstrap authorization expiry must be within the next 24 hours';
  end if;

  if p_owner_token_nonce_hash is null
     or p_owner_token_nonce_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'A valid one-time owner token nonce digest is required';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(81472912061);

  if exists (select 1 from public.platform_super_admin_designation) then
    raise exception 'The initial Super Admin has already been designated';
  end if;

  if exists (
    select 1 from public.initial_super_admin_bootstrap_authorizations
    where slot = 1
  ) then
    raise exception 'Initial bootstrap authorization is already consumed and cannot be replaced or refreshed';
  end if;

  insert into public.initial_super_admin_bootstrap_authorizations (
    slot, authorized_email, owner_token_nonce_hash, expires_at
  ) values (
    1, v_email, p_owner_token_nonce_hash, p_expires_at
  );

  insert into public.audit_events (
    actor_user_id, scope, action, target_type, target_id, details
  ) values (
    null, 'platform', 'super_admin.bootstrap_authorized',
    'auth.users', null, jsonb_build_object(
      'email', v_email,
      'expires_at', p_expires_at,
      'operation', 'owner_authorized_invitation'
    )
  );

  return true;
end;
$$;
revoke all on function public.authorize_initial_super_admin(text, timestamptz, text)
  from public, anon, authenticated;
grant execute on function public.authorize_initial_super_admin(text, timestamptz, text)
  to service_role;

create function public.bootstrap_initial_super_admin()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_email text;
  v_email_confirmed_at timestamptz;
  v_invited_at timestamptz;
  v_is_anonymous boolean;
  v_banned_until timestamptz;
  v_authorized_email text;
  v_expires_at timestamptz;
  v_consumed_at timestamptz;
begin
  if v_user_id is null then
    raise exception 'An authenticated invited user is required';
  end if;

  if coalesce((select auth.jwt() ->> 'aal'), 'aal1') <> 'aal2' then
    raise exception 'A verified MFA session is required';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(81472912061);

  select u.email, u.email_confirmed_at, u.invited_at, u.is_anonymous, u.banned_until
    into v_email, v_email_confirmed_at, v_invited_at, v_is_anonymous, v_banned_until
    from auth.users as u
    where u.id = v_user_id;

  if not found or v_email is null or v_email_confirmed_at is null
     or v_invited_at is null or v_is_anonymous
     or (v_banned_until is not null and v_banned_until > statement_timestamp()) then
    raise exception 'A verified, invited account is required';
  end if;

  if not exists (
    select 1 from auth.mfa_factors as f
    where f.user_id = v_user_id
      and f.factor_type::text = 'totp'
      and f.status::text = 'verified'
  ) then
    raise exception 'A verified authenticator factor is required';
  end if;

  if exists (select 1 from public.platform_super_admin_designation) then
    raise exception 'A Super Admin designation already exists';
  end if;

  select lower(a.authorized_email), a.expires_at, a.consumed_at
    into v_authorized_email, v_expires_at, v_consumed_at
    from public.initial_super_admin_bootstrap_authorizations as a
    where a.slot = 1
    for update;

  if not found or v_consumed_at is not null
     or v_expires_at <= statement_timestamp()
     or v_authorized_email <> lower(v_email) then
    raise exception 'This account is not authorized by a current bootstrap invitation';
  end if;

  insert into public.platform_super_admin_designation (slot, user_id, designated_by)
  values (1, v_user_id, v_user_id);

  update public.initial_super_admin_bootstrap_authorizations
    set consumed_at = statement_timestamp(), consumed_user_id = v_user_id
    where slot = 1;

  return true;
end;
$$;
revoke all on function public.bootstrap_initial_super_admin() from public, anon;
grant execute on function public.bootstrap_initial_super_admin() to authenticated;

create function public.record_platform_invitation_request(p_email text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(trim(p_email));
begin
  if (select auth.uid()) is null
     or coalesce((select auth.jwt() ->> 'aal'), 'aal1') <> 'aal2'
     or not (
       private.is_super_admin()
       or private.has_platform_role(array['platform_admin'])
     ) then
    raise exception 'An authorized MFA-protected platform administrator is required';
  end if;

  if v_email is null or length(v_email) not between 3 and 320
     or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'A valid email address is required';
  end if;

  insert into public.audit_events (
    actor_user_id, scope, action, target_type, target_id, details
  ) values (
    (select auth.uid()), 'platform', 'platform.invitation.requested',
    'auth.users', null, jsonb_build_object('email', v_email, 'operation', 'invite_requested')
  );
  return true;
end;
$$;
revoke all on function public.record_platform_invitation_request(text)
  from public, anon;
grant execute on function public.record_platform_invitation_request(text)
  to authenticated;

commit;

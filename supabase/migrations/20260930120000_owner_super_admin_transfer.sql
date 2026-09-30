begin;

create table public.owner_super_admin_transfer_authorizations (
  id uuid primary key default gen_random_uuid(),
  authorized_email text not null check (length(trim(authorized_email)) between 3 and 320),
  owner_token_nonce_hash text not null unique check (owner_token_nonce_hash ~ '^[0-9a-f]{64}$'),
  status text not null default 'authorized' check (status in ('authorized', 'consumed', 'expired', 'revoked')),
  authorized_at timestamptz not null default statement_timestamp(),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  consumed_user_id uuid references public.profiles (id) on delete restrict,
  check (expires_at > authorized_at),
  check ((status = 'consumed') = (consumed_at is not null and consumed_user_id is not null))
);
create unique index owner_super_admin_transfer_one_pending
  on public.owner_super_admin_transfer_authorizations ((status)) where status = 'authorized';
create index owner_super_admin_transfer_email_lookup
  on public.owner_super_admin_transfer_authorizations (lower(authorized_email), expires_at desc);

alter table public.owner_super_admin_transfer_authorizations enable row level security;
revoke all on table public.owner_super_admin_transfer_authorizations from public, anon, authenticated, service_role;

create function public.authorize_owner_super_admin_transfer(
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
    raise exception 'A valid owner email address is required';
  end if;
  if p_expires_at is null or p_expires_at <= statement_timestamp()
     or p_expires_at > statement_timestamp() + interval '24 hours' then
    raise exception 'Owner transfer authorization expiry must be within the next 24 hours';
  end if;
  if p_owner_token_nonce_hash is null or p_owner_token_nonce_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'A valid one-time owner token nonce digest is required';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(81472912061);
  if not exists (select 1 from public.platform_super_admin_designation where slot = 1) then
    raise exception 'The existing Super Admin designation is missing';
  end if;
  update public.owner_super_admin_transfer_authorizations
    set status = 'expired'
    where status = 'authorized' and expires_at <= statement_timestamp();
  if exists (select 1 from public.owner_super_admin_transfer_authorizations where status = 'authorized') then
    raise exception 'An owner transfer authorization is already pending';
  end if;
  if exists (select 1 from auth.users where lower(email) = v_email) then
    raise exception 'The owner email already has an Auth account; transfer invitation requires a new invited identity';
  end if;

  insert into public.owner_super_admin_transfer_authorizations (
    authorized_email, owner_token_nonce_hash, expires_at
  ) values (v_email, p_owner_token_nonce_hash, p_expires_at);
  insert into public.audit_events (actor_user_id, scope, action, target_type, target_id, details)
  values (null, 'platform', 'super_admin.owner_transfer_authorized',
    'platform_super_admin_designation', '1',
    jsonb_build_object('operation', 'owner_invitation_authorized', 'expires_at', p_expires_at));
  return true;
end;
$$;
revoke all on function public.authorize_owner_super_admin_transfer(text, timestamptz, text) from public, anon, authenticated;
grant execute on function public.authorize_owner_super_admin_transfer(text, timestamptz, text) to service_role;

create function public.revoke_owner_super_admin_transfer(p_owner_token_nonce_hash text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_updated integer;
begin
  perform pg_catalog.pg_advisory_xact_lock(81472912061);
  update public.owner_super_admin_transfer_authorizations
    set status = 'revoked'
    where owner_token_nonce_hash = p_owner_token_nonce_hash and status = 'authorized';
  get diagnostics v_updated = row_count;
  if v_updated = 1 then
    insert into public.audit_events (actor_user_id, scope, action, target_type, target_id, details)
    values (null, 'platform', 'super_admin.owner_transfer_revoked',
      'platform_super_admin_designation', '1', jsonb_build_object('operation', 'invitation_failed'));
  end if;
  return v_updated = 1;
end;
$$;
revoke all on function public.revoke_owner_super_admin_transfer(text) from public, anon, authenticated;
grant execute on function public.revoke_owner_super_admin_transfer(text) to service_role;

create function public.is_owner_super_admin_transfer_candidate()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from auth.users as u
      join public.owner_super_admin_transfer_authorizations as a
        on lower(a.authorized_email) = lower(u.email)
     where u.id = (select auth.uid())
       and u.email_confirmed_at is not null
       and u.invited_at is not null
       and not u.is_anonymous
       and (u.banned_until is null or u.banned_until <= statement_timestamp())
       and a.status = 'authorized'
       and a.expires_at > statement_timestamp()
  );
$$;
revoke all on function public.is_owner_super_admin_transfer_candidate() from public, anon;
grant execute on function public.is_owner_super_admin_transfer_candidate() to authenticated;

create function public.claim_owner_super_admin_transfer()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_email text;
  v_confirmed_at timestamptz;
  v_invited_at timestamptz;
  v_is_anonymous boolean;
  v_banned_until timestamptz;
  v_authorization_id uuid;
begin
  if v_user_id is null then raise exception 'An authenticated owner invitation is required'; end if;
  if coalesce((select auth.jwt() ->> 'aal'), 'aal1') <> 'aal2' then
    raise exception 'A verified MFA session is required';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(81472912061);

  select u.email, u.email_confirmed_at, u.invited_at, u.is_anonymous, u.banned_until
    into v_email, v_confirmed_at, v_invited_at, v_is_anonymous, v_banned_until
    from auth.users as u where u.id = v_user_id;
  if not found or v_email is null or v_confirmed_at is null or v_invited_at is null
     or v_is_anonymous or (v_banned_until is not null and v_banned_until > statement_timestamp()) then
    raise exception 'A verified, invited owner account is required';
  end if;
  if not exists (
    select 1 from auth.mfa_factors as f
     where f.user_id = v_user_id and f.factor_type::text = 'totp' and f.status::text = 'verified'
  ) then raise exception 'A verified authenticator factor is required'; end if;

  select a.id into v_authorization_id
    from public.owner_super_admin_transfer_authorizations as a
   where lower(a.authorized_email) = lower(v_email)
     and a.status = 'authorized' and a.expires_at > statement_timestamp()
   for update;
  if not found then raise exception 'No current owner transfer authorization matches this invitation'; end if;
  if not exists (select 1 from public.platform_super_admin_designation where slot = 1) then
    raise exception 'The existing Super Admin designation is missing';
  end if;

  update public.platform_super_admin_designation
     set user_id = v_user_id, designated_by = v_user_id, designated_at = statement_timestamp()
   where slot = 1;
  if not found then raise exception 'The Super Admin designation could not be transferred'; end if;

  update public.owner_super_admin_transfer_authorizations
     set status = 'consumed', consumed_at = statement_timestamp(), consumed_user_id = v_user_id
   where id = v_authorization_id;
  insert into public.audit_events (actor_user_id, scope, action, target_type, target_id, details)
  values (v_user_id, 'platform', 'super_admin.owner_transfer_completed',
    'platform_super_admin_designation', '1', jsonb_build_object('operation', 'owner_claimed_existing_slot'));
  return true;
end;
$$;
revoke all on function public.claim_owner_super_admin_transfer() from public, anon;
grant execute on function public.claim_owner_super_admin_transfer() to authenticated;

commit;
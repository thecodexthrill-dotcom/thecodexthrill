begin;

create or replace function public.authorize_owner_super_admin_transfer(
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
  v_user_id uuid;
  v_email_confirmed_at timestamptz;
  v_invited_at timestamptz;
  v_banned_until timestamptz;
  v_authorization_id uuid;
  v_is_resend boolean := false;
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

  select u.id, u.email_confirmed_at, u.invited_at, u.banned_until
    into v_user_id, v_email_confirmed_at, v_invited_at, v_banned_until
    from auth.users as u
   where lower(u.email) = v_email;

  if v_user_id is not null then
    if v_email_confirmed_at is not null or v_invited_at is null
       or (v_banned_until is not null and v_banned_until > statement_timestamp()) then
      raise exception 'The existing owner account is not eligible for invitation resend';
    end if;
    if not exists (select 1 from public.profiles where id = v_user_id)
       or exists (select 1 from public.platform_super_admin_designation where user_id = v_user_id) then
      raise exception 'The existing owner identity is not eligible for transfer invitation';
    end if;

    select a.id into v_authorization_id
      from public.owner_super_admin_transfer_authorizations as a
     where lower(a.authorized_email) = v_email
       and a.status = 'authorized'
       and a.expires_at > statement_timestamp()
     for update;
    v_is_resend := true;

    if found then
      update public.owner_super_admin_transfer_authorizations
         set owner_token_nonce_hash = p_owner_token_nonce_hash,
             authorized_at = statement_timestamp(),
             expires_at = p_expires_at
       where id = v_authorization_id;
    else
      if exists (select 1 from public.owner_super_admin_transfer_authorizations where status = 'authorized') then
        raise exception 'Another owner transfer authorization is already pending';
      end if;
      insert into public.owner_super_admin_transfer_authorizations (
        authorized_email, owner_token_nonce_hash, expires_at
      ) values (v_email, p_owner_token_nonce_hash, p_expires_at);
    end if;
  else
    if exists (select 1 from public.owner_super_admin_transfer_authorizations where status = 'authorized') then
      raise exception 'An owner transfer authorization is already pending';
    end if;
    insert into public.owner_super_admin_transfer_authorizations (
      authorized_email, owner_token_nonce_hash, expires_at
    ) values (v_email, p_owner_token_nonce_hash, p_expires_at);
  end if;

  insert into public.audit_events (actor_user_id, scope, action, target_type, target_id, details)
  values (null, 'platform',
    case when v_is_resend then 'super_admin.owner_transfer_invitation_resent'
         else 'super_admin.owner_transfer_authorized' end,
    'platform_super_admin_designation', '1',
    jsonb_build_object(
      'operation', case when v_is_resend then 'owner_invitation_resent' else 'owner_invitation_authorized' end,
      'expires_at', p_expires_at
    ));
  return true;
end;
$$;

revoke all on function public.authorize_owner_super_admin_transfer(text, timestamptz, text)
  from public, anon, authenticated;
grant execute on function public.authorize_owner_super_admin_transfer(text, timestamptz, text)
  to service_role;

commit;

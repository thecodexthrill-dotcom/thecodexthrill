begin;

alter table public.platform_invitations
  add column archived_at timestamptz;

drop function public.list_platform_invitations();
create function public.list_platform_invitations()
returns table (
  id uuid, email text, role text, status text, created_at timestamptz, expires_at timestamptz,
  auth_user_id uuid, resend_count integer, last_resent_at timestamptz, archived_at timestamptz
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
      i.auth_user_id, i.resend_count, i.last_resent_at, i.archived_at
    from public.platform_invitations i order by i.created_at desc limit 100;
end;
$$;
revoke all on function public.list_platform_invitations() from public, anon;
grant execute on function public.list_platform_invitations() to authenticated;

create function public.archive_platform_invitation(p_invitation_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_invitation public.platform_invitations%rowtype;
begin
  if auth.uid() is null or coalesce(auth.jwt() ->> 'aal', '') <> 'aal2'
    or not (private.is_super_admin() or private.has_platform_role(array['platform_admin'])) then
    raise exception 'Verified invitation administrator required';
  end if;
  select * into v_invitation from public.platform_invitations
    where id = p_invitation_id for update;
  if not found or v_invitation.status not in ('expired', 'accepted', 'revoked') then
    return false;
  end if;
  if v_invitation.role = 'platform_admin' and not private.is_super_admin() then
    raise exception 'Only the Super Admin may archive a Platform Admin invitation';
  end if;
  update public.platform_invitations set archived_at = coalesce(archived_at, statement_timestamp())
    where id = p_invitation_id;
  return true;
end;
$$;
revoke all on function public.archive_platform_invitation(uuid) from public, anon;
grant execute on function public.archive_platform_invitation(uuid) to authenticated;

commit;

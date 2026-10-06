begin;

create or replace function public.list_platform_invitations()
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
    from public.platform_invitations i
    where private.is_super_admin() or i.role <> 'platform_admin'
    order by i.created_at desc limit 100;
end;
$$;
revoke all on function public.list_platform_invitations() from public, anon;
grant execute on function public.list_platform_invitations() to authenticated;

commit;

begin;

-- ============================================================================
-- Operations & Support CRUD Hardening Grants & Policies
-- ============================================================================

-- 1. Tenant Projects (enable DELETE for authorized roles)
grant delete on table public.tenant_projects to authenticated;

-- 2. Tenant Documents (enable UPDATE & DELETE for authorized roles)
grant update, delete on table public.tenant_documents to authenticated;

drop policy if exists tenant_documents_insert on public.tenant_documents;

create policy tenant_documents_manage on public.tenant_documents
  for all to authenticated
  using (
    private.has_org_role(organization_id, array['organization_owner', 'organization_admin', 'project_manager'])
    or (private.has_platform_role(array['developer', 'platform_admin']) or private.is_super_admin())
  )
  with check (
    private.has_org_role(organization_id, array['organization_owner', 'organization_admin', 'project_manager'])
    or (private.has_platform_role(array['developer', 'platform_admin']) or private.is_super_admin())
  );

-- 3. Tenant Invoices (enable DELETE for authorized billing roles)
grant delete on table public.tenant_invoices to authenticated;

-- 4. Support Tickets (enable DELETE for platform administration)
grant delete on table public.support_tickets to authenticated;

create policy support_tickets_delete on public.support_tickets
  for delete to authenticated
  using (
    (private.has_platform_role(array['platform_admin']) or private.is_super_admin())
    and (select auth.jwt() ->> 'aal') = 'aal2'
  );

-- 5. Support Ticket Messages (enable DELETE for author or platform administration)
grant delete on table public.support_ticket_messages to authenticated;

create policy support_ticket_messages_delete on public.support_ticket_messages
  for delete to authenticated
  using (
    sender_id = (select auth.uid())
    or (
      (private.has_platform_role(array['platform_admin']) or private.is_super_admin())
      and (select auth.jwt() ->> 'aal') = 'aal2'
    )
  );

-- 6. Platform Sales Leads (enable DELETE for platform administration)
grant delete on table public.platform_sales_leads to authenticated;

create policy platform_sales_leads_delete on public.platform_sales_leads
  for delete to authenticated
  using (
    (private.has_platform_role(array['platform_admin']) or private.is_super_admin())
    and (select auth.jwt() ->> 'aal') = 'aal2'
  );

commit;


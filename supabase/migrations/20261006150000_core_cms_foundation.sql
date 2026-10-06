begin;

-- ============================================================================
-- 1. CMS Pages
-- ============================================================================
create table public.cms_pages (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (length(trim(slug)) >= 1 and slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  title text not null check (length(trim(title)) between 1 and 200),
  content text not null default '',
  featured_image_url text,
  status text not null default 'draft' check (status in ('draft', 'review', 'published', 'archived')),
  seo_title text,
  seo_description text,
  canonical_url text,
  og_image_url text,
  sort_order int not null default 0,
  published_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index cms_pages_status_lookup on public.cms_pages (status, sort_order, published_at desc);
create index cms_pages_slug_lookup on public.cms_pages (slug);

create trigger cms_pages_set_updated_at
  before update on public.cms_pages
  for each row execute function private.set_updated_at();

create trigger cms_pages_audit
  after insert or update or delete on public.cms_pages
  for each row execute function private.write_audit_event();

-- ============================================================================
-- 2. Blog Categories & Posts
-- ============================================================================
create table public.cms_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (length(trim(slug)) >= 1),
  name text not null check (length(trim(name)) between 1 and 100),
  description text,
  created_at timestamptz not null default now()
);

create table public.cms_posts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (length(trim(slug)) >= 1 and slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  title text not null check (length(trim(title)) between 1 and 250),
  excerpt text not null default '',
  content text not null default '',
  category_id uuid references public.cms_categories (id) on delete set null,
  tags text[] not null default '{}',
  author_name text not null default 'TheCodexThrill Team',
  author_id uuid references public.profiles (id) on delete set null,
  featured_image_url text,
  status text not null default 'draft' check (status in ('draft', 'review', 'published', 'scheduled', 'archived')),
  reading_time text default '5 min read',
  scheduled_for timestamptz,
  published_at timestamptz,
  seo_title text,
  seo_description text,
  canonical_url text,
  og_image_url text,
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index cms_posts_status_published on public.cms_posts (status, published_at desc);
create index cms_posts_slug_lookup on public.cms_posts (slug);
create index cms_posts_category_lookup on public.cms_posts (category_id);

create trigger cms_posts_set_updated_at
  before update on public.cms_posts
  for each row execute function private.set_updated_at();

create trigger cms_posts_audit
  after insert or update or delete on public.cms_posts
  for each row execute function private.write_audit_event();

-- ============================================================================
-- 3. Services CMS
-- ============================================================================
create table public.cms_services (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (length(trim(slug)) >= 1 and slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  title text not null check (length(trim(title)) between 1 and 160),
  short_description text not null,
  full_description text not null,
  icon_name text default 'Code2',
  features text[] not null default '{}',
  pricing_overview text,
  cta_label text not null default 'Start a Project',
  cta_url text not null default '/contact',
  status text not null default 'published' check (status in ('draft', 'review', 'published', 'archived')),
  sort_order int not null default 0,
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index cms_services_status_sort on public.cms_services (status, sort_order);

create trigger cms_services_set_updated_at
  before update on public.cms_services
  for each row execute function private.set_updated_at();

create trigger cms_services_audit
  after insert or update or delete on public.cms_services
  for each row execute function private.write_audit_event();

-- ============================================================================
-- 4. Portfolio / Case Studies CMS
-- ============================================================================
create table public.cms_case_studies (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (length(trim(slug)) >= 1 and slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  title text not null check (length(trim(title)) between 1 and 200),
  client_name text not null,
  industry text not null,
  category text not null,
  summary text not null,
  challenge text not null,
  solution text not null,
  deliverables text[] not null default '{}',
  results text[] not null default '{}',
  technologies text[] not null default '{}',
  timeline text not null default '12 weeks',
  featured boolean not null default false,
  cover_image_url text,
  gallery_urls text[] not null default '{}',
  external_url text,
  status text not null default 'published' check (status in ('draft', 'review', 'published', 'archived')),
  sort_order int not null default 0,
  seo_title text,
  seo_description text,
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index cms_case_studies_status_featured on public.cms_case_studies (status, featured, sort_order);

create trigger cms_case_studies_set_updated_at
  before update on public.cms_case_studies
  for each row execute function private.set_updated_at();

create trigger cms_case_studies_audit
  after insert or update or delete on public.cms_case_studies
  for each row execute function private.write_audit_event();

-- ============================================================================
-- 5. Media Library Metadata
-- ============================================================================
create table public.cms_media (
  id uuid primary key default gen_random_uuid(),
  file_name text not null check (length(trim(file_name)) between 1 and 255),
  storage_path text not null unique,
  public_url text not null,
  mime_type text not null,
  file_size_bytes bigint not null check (file_size_bytes > 0),
  category text not null default 'general',
  alt_text text not null default '',
  uploaded_by uuid references public.profiles (id) on delete set null,
  is_archived boolean not null default false,
  created_at timestamptz not null default now()
);

create index cms_media_category_lookup on public.cms_media (category, is_archived, created_at desc);

create trigger cms_media_audit
  after insert or update or delete on public.cms_media
  for each row execute function private.write_audit_event();

-- ============================================================================
-- 6. Navigation / Menus
-- ============================================================================
create table public.cms_menus (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code in ('header', 'footer_services', 'footer_company', 'footer_platform', 'footer_legal')),
  title text not null
);

create table public.cms_menu_items (
  id uuid primary key default gen_random_uuid(),
  menu_id uuid not null references public.cms_menus (id) on delete cascade,
  label text not null check (length(trim(label)) >= 1),
  href text not null check (length(trim(href)) >= 1),
  is_external boolean not null default false,
  sort_order int not null default 0,
  is_visible boolean not null default true,
  parent_item_id uuid references public.cms_menu_items (id) on delete set null
);

create index cms_menu_items_sort on public.cms_menu_items (menu_id, sort_order);

create trigger cms_menus_audit
  after insert or update or delete on public.cms_menus
  for each row execute function private.write_audit_event();

-- ============================================================================
-- 7. Global Site Settings
-- ============================================================================
create table public.cms_site_settings (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (length(trim(key)) between 1 and 80),
  value jsonb not null default '{}'::jsonb check (jsonb_typeof(value) = 'object'),
  description text,
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

create trigger cms_site_settings_set_updated_at
  before update on public.cms_site_settings
  for each row execute function private.set_updated_at();

create trigger cms_site_settings_audit
  after insert or update or delete on public.cms_site_settings
  for each row execute function private.write_audit_event();

-- ============================================================================
-- 8. Content Revisions / Snapshots
-- ============================================================================
create table public.cms_revisions (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('page', 'post', 'service', 'case_study', 'setting', 'menu')),
  entity_id uuid not null,
  action text not null check (action in ('create', 'update', 'publish', 'unpublish', 'archive', 'restore')),
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  actor_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index cms_revisions_entity_history on public.cms_revisions (entity_type, entity_id, created_at desc);

-- ============================================================================
-- 9. Row Level Security & Access Grants
-- ============================================================================

-- Enable RLS across all CMS tables
alter table public.cms_pages enable row level security;
alter table public.cms_categories enable row level security;
alter table public.cms_posts enable row level security;
alter table public.cms_services enable row level security;
alter table public.cms_case_studies enable row level security;
alter table public.cms_media enable row level security;
alter table public.cms_menus enable row level security;
alter table public.cms_menu_items enable row level security;
alter table public.cms_site_settings enable row level security;
alter table public.cms_revisions enable row level security;

-- Revoke raw permissions
revoke all on public.cms_pages from public, anon, authenticated;
revoke all on public.cms_categories from public, anon, authenticated;
revoke all on public.cms_posts from public, anon, authenticated;
revoke all on public.cms_services from public, anon, authenticated;
revoke all on public.cms_case_studies from public, anon, authenticated;
revoke all on public.cms_media from public, anon, authenticated;
revoke all on public.cms_menus from public, anon, authenticated;
revoke all on public.cms_menu_items from public, anon, authenticated;
revoke all on public.cms_site_settings from public, anon, authenticated;
revoke all on public.cms_revisions from public, anon, authenticated;

-- Grants
grant select on public.cms_pages to anon, authenticated;
grant select on public.cms_categories to anon, authenticated;
grant select on public.cms_posts to anon, authenticated;
grant select on public.cms_services to anon, authenticated;
grant select on public.cms_case_studies to anon, authenticated;
grant select on public.cms_media to anon, authenticated;
grant select on public.cms_menus to anon, authenticated;
grant select on public.cms_menu_items to anon, authenticated;
grant select on public.cms_site_settings to anon, authenticated;

grant insert, update, delete on public.cms_pages to authenticated;
grant insert, update, delete on public.cms_categories to authenticated;
grant insert, update, delete on public.cms_posts to authenticated;
grant insert, update, delete on public.cms_services to authenticated;
grant insert, update, delete on public.cms_case_studies to authenticated;
grant insert, update, delete on public.cms_media to authenticated;
grant insert, update, delete on public.cms_menus to authenticated;
grant insert, update, delete on public.cms_menu_items to authenticated;
grant insert, update, delete on public.cms_site_settings to authenticated;
grant select, insert on public.cms_revisions to authenticated;

-- Public Read Policies
create policy cms_pages_public_read on public.cms_pages
  for select to anon, authenticated
  using (
    status = 'published'
    or (
      (private.has_platform_role(array['platform_admin', 'developer']) or private.is_super_admin())
      and (select auth.jwt() ->> 'aal') = 'aal2'
    )
  );

create policy cms_categories_public_read on public.cms_categories
  for select to anon, authenticated
  using (true);

create policy cms_posts_public_read on public.cms_posts
  for select to anon, authenticated
  using (
    (status = 'published' and (scheduled_for is null or scheduled_for <= now()))
    or (
      (private.has_platform_role(array['platform_admin', 'developer']) or private.is_super_admin())
      and (select auth.jwt() ->> 'aal') = 'aal2'
    )
  );

create policy cms_services_public_read on public.cms_services
  for select to anon, authenticated
  using (
    status = 'published'
    or (
      (private.has_platform_role(array['platform_admin', 'developer']) or private.is_super_admin())
      and (select auth.jwt() ->> 'aal') = 'aal2'
    )
  );

create policy cms_case_studies_public_read on public.cms_case_studies
  for select to anon, authenticated
  using (
    status = 'published'
    or (
      (private.has_platform_role(array['platform_admin', 'developer']) or private.is_super_admin())
      and (select auth.jwt() ->> 'aal') = 'aal2'
    )
  );

create policy cms_media_public_read on public.cms_media
  for select to anon, authenticated
  using (
    not is_archived
    or (
      (private.has_platform_role(array['platform_admin', 'developer']) or private.is_super_admin())
      and (select auth.jwt() ->> 'aal') = 'aal2'
    )
  );

create policy cms_menus_public_read on public.cms_menus
  for select to anon, authenticated
  using (true);

create policy cms_menu_items_public_read on public.cms_menu_items
  for select to anon, authenticated
  using (
    is_visible
    or (
      (private.has_platform_role(array['platform_admin', 'developer']) or private.is_super_admin())
      and (select auth.jwt() ->> 'aal') = 'aal2'
    )
  );

create policy cms_site_settings_public_read on public.cms_site_settings
  for select to anon, authenticated
  using (true);

create policy cms_revisions_admin_read on public.cms_revisions
  for select to authenticated
  using (
    (private.has_platform_role(array['platform_admin', 'developer']) or private.is_super_admin())
    and (select auth.jwt() ->> 'aal') = 'aal2'
  );

-- Admin Mutation Policies (AAL2 + Platform Admin/Developer/Super Admin)
create policy cms_pages_admin_write on public.cms_pages
  for all to authenticated
  using (
    (private.has_platform_role(array['platform_admin', 'developer']) or private.is_super_admin())
    and (select auth.jwt() ->> 'aal') = 'aal2'
  )
  with check (
    (private.has_platform_role(array['platform_admin', 'developer']) or private.is_super_admin())
    and (select auth.jwt() ->> 'aal') = 'aal2'
  );

create policy cms_categories_admin_write on public.cms_categories
  for all to authenticated
  using (
    (private.has_platform_role(array['platform_admin', 'developer']) or private.is_super_admin())
    and (select auth.jwt() ->> 'aal') = 'aal2'
  )
  with check (
    (private.has_platform_role(array['platform_admin', 'developer']) or private.is_super_admin())
    and (select auth.jwt() ->> 'aal') = 'aal2'
  );

create policy cms_posts_admin_write on public.cms_posts
  for all to authenticated
  using (
    (private.has_platform_role(array['platform_admin', 'developer']) or private.is_super_admin())
    and (select auth.jwt() ->> 'aal') = 'aal2'
  )
  with check (
    (private.has_platform_role(array['platform_admin', 'developer']) or private.is_super_admin())
    and (select auth.jwt() ->> 'aal') = 'aal2'
  );

create policy cms_services_admin_write on public.cms_services
  for all to authenticated
  using (
    (private.has_platform_role(array['platform_admin', 'developer']) or private.is_super_admin())
    and (select auth.jwt() ->> 'aal') = 'aal2'
  )
  with check (
    (private.has_platform_role(array['platform_admin', 'developer']) or private.is_super_admin())
    and (select auth.jwt() ->> 'aal') = 'aal2'
  );

create policy cms_case_studies_admin_write on public.cms_case_studies
  for all to authenticated
  using (
    (private.has_platform_role(array['platform_admin', 'developer']) or private.is_super_admin())
    and (select auth.jwt() ->> 'aal') = 'aal2'
  )
  with check (
    (private.has_platform_role(array['platform_admin', 'developer']) or private.is_super_admin())
    and (select auth.jwt() ->> 'aal') = 'aal2'
  );

create policy cms_media_admin_write on public.cms_media
  for all to authenticated
  using (
    (private.has_platform_role(array['platform_admin', 'developer']) or private.is_super_admin())
    and (select auth.jwt() ->> 'aal') = 'aal2'
  )
  with check (
    (private.has_platform_role(array['platform_admin', 'developer']) or private.is_super_admin())
    and (select auth.jwt() ->> 'aal') = 'aal2'
  );

create policy cms_menus_admin_write on public.cms_menus
  for all to authenticated
  using (
    (private.has_platform_role(array['platform_admin', 'developer']) or private.is_super_admin())
    and (select auth.jwt() ->> 'aal') = 'aal2'
  )
  with check (
    (private.has_platform_role(array['platform_admin', 'developer']) or private.is_super_admin())
    and (select auth.jwt() ->> 'aal') = 'aal2'
  );

create policy cms_menu_items_admin_write on public.cms_menu_items
  for all to authenticated
  using (
    (private.has_platform_role(array['platform_admin', 'developer']) or private.is_super_admin())
    and (select auth.jwt() ->> 'aal') = 'aal2'
  )
  with check (
    (private.has_platform_role(array['platform_admin', 'developer']) or private.is_super_admin())
    and (select auth.jwt() ->> 'aal') = 'aal2'
  );

create policy cms_site_settings_admin_write on public.cms_site_settings
  for all to authenticated
  using (
    (private.has_platform_role(array['platform_admin', 'developer']) or private.is_super_admin())
    and (select auth.jwt() ->> 'aal') = 'aal2'
  )
  with check (
    (private.has_platform_role(array['platform_admin', 'developer']) or private.is_super_admin())
    and (select auth.jwt() ->> 'aal') = 'aal2'
  );

create policy cms_revisions_admin_insert on public.cms_revisions
  for insert to authenticated
  with check (
    (private.has_platform_role(array['platform_admin', 'developer']) or private.is_super_admin())
    and (select auth.jwt() ->> 'aal') = 'aal2'
  );

-- ============================================================================
-- 10. Seed Initial System Menus and Baseline Site Settings
-- ============================================================================
insert into public.cms_menus (code, title) values
  ('header', 'Main Header Navigation'),
  ('footer_services', 'Footer Services Menu'),
  ('footer_company', 'Footer Company Menu'),
  ('footer_platform', 'Footer Platform Menu'),
  ('footer_legal', 'Footer Legal & Trust Menu')
on conflict (code) do nothing;

insert into public.cms_site_settings (key, value, description) values
  ('branding', '{"name":"TheCodexThrill","tagline":"Build. Innovate. Deploy. Scale.","wordmark":"TheCodexThrill"}'::jsonb, 'Brand lockup and tagline configuration'),
  ('contact', '{"email":"contact@thecodexthrill.com","supportEmail":"support@thecodexthrill.com","slaHours":24}'::jsonb, 'Official contact channels and communication SLA'),
  ('social_links', '{"github":"https://github.com/thecodexthrill","linkedin":"https://linkedin.com/company/thecodexthrill","twitter":"https://x.com/thecodexthrill"}'::jsonb, 'Corporate social profile links'),
  ('global_seo', '{"defaultTitle":"TheCodexThrill — Premium Software & Product Engineering","defaultDescription":"High-performance web applications, enterprise software, and AI solutions engineered for scale.","siteOrigin":"https://thecodexthrill.com"}'::jsonb, 'Global search engine optimization defaults')
on conflict (key) do nothing;

insert into public.cms_categories (slug, name, description) values
  ('product-thinking', 'Product thinking', 'Strategies for defining pragmatic software roadmaps and workflows'),
  ('engineering', 'Engineering', 'Architecture patterns, AI deployment, and systems resilience'),
  ('architecture', 'Architecture', 'Foundation design and extensible software systems')
on conflict (slug) do nothing;

commit;


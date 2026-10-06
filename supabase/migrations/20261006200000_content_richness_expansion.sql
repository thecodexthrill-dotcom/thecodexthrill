begin;

-- ============================================================================
-- 1. Hero Slides CMS
-- ============================================================================
create table public.cms_hero_slides (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'TheCodexThrill Engineering Studio',
  label text not null default 'TheCodexThrill Engineering Studio',
  tagline text not null default 'BUILD | INNOVATE | DEPLOY | SCALE',
  image_url text not null default '/brand/thecodexthrill-banner.jpg',
  alt_text text not null default 'TheCodexThrill — Build, Innovate, Deploy, Scale',
  link_url text default '/contact',
  status text not null default 'published' check (status in ('draft', 'review', 'published', 'archived')),
  sort_order int not null default 0,
  is_featured boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index cms_hero_slides_status_sort on public.cms_hero_slides (status, sort_order);

create trigger cms_hero_slides_set_updated_at
  before update on public.cms_hero_slides
  for each row execute function private.set_updated_at();

create trigger cms_hero_slides_audit
  after insert or update or delete on public.cms_hero_slides
  for each row execute function private.write_audit_event();

-- ============================================================================
-- 2. Capabilities CMS
-- ============================================================================
create table public.cms_capabilities (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (length(trim(slug)) >= 1),
  number_label text not null default '01',
  title text not null check (length(trim(title)) between 1 and 200),
  headline text not null,
  description text not null,
  icon_name text not null default 'Code2',
  deliverables text[] not null default '{}',
  technologies text[] not null default '{}',
  service_slug text not null default 'web-applications',
  status text not null default 'published' check (status in ('draft', 'review', 'published', 'archived')),
  sort_order int not null default 0,
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index cms_capabilities_status_sort on public.cms_capabilities (status, sort_order);

create trigger cms_capabilities_set_updated_at
  before update on public.cms_capabilities
  for each row execute function private.set_updated_at();

create trigger cms_capabilities_audit
  after insert or update or delete on public.cms_capabilities
  for each row execute function private.write_audit_event();

-- ============================================================================
-- 3. Engineering Process Steps CMS
-- ============================================================================
create table public.cms_process_steps (
  id uuid primary key default gen_random_uuid(),
  step_number text not null default '01',
  phase_name text not null,
  name text not null,
  duration text not null default 'Week 1',
  icon_name text not null default 'Compass',
  summary text not null,
  deliverables text[] not null default '{}',
  quality_gate text not null,
  status text not null default 'published' check (status in ('draft', 'review', 'published', 'archived')),
  sort_order int not null default 0,
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index cms_process_steps_status_sort on public.cms_process_steps (status, sort_order);

create trigger cms_process_steps_set_updated_at
  before update on public.cms_process_steps
  for each row execute function private.set_updated_at();

create trigger cms_process_steps_audit
  after insert or update or delete on public.cms_process_steps
  for each row execute function private.write_audit_event();

-- ============================================================================
-- 4. Strategic Industries CMS
-- ============================================================================
create table public.cms_industries (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (length(trim(slug)) >= 1),
  title text not null,
  accent text not null,
  icon_name text not null default 'Landmark',
  challenge text not null,
  solution text not null,
  compliance_tags text[] not null default '{}',
  metrics text not null,
  status text not null default 'published' check (status in ('draft', 'review', 'published', 'archived')),
  sort_order int not null default 0,
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index cms_industries_status_sort on public.cms_industries (status, sort_order);

create trigger cms_industries_set_updated_at
  before update on public.cms_industries
  for each row execute function private.set_updated_at();

create trigger cms_industries_audit
  after insert or update or delete on public.cms_industries
  for each row execute function private.write_audit_event();

-- ============================================================================
-- 5. Technology Stack CMS
-- ============================================================================
create table public.cms_tech_stack (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  name text not null,
  role text not null,
  icon_name text not null default 'Code2',
  status text not null default 'published' check (status in ('draft', 'review', 'published', 'archived')),
  sort_order int not null default 0,
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index cms_tech_stack_status_sort on public.cms_tech_stack (status, category, sort_order);

create trigger cms_tech_stack_set_updated_at
  before update on public.cms_tech_stack
  for each row execute function private.set_updated_at();

create trigger cms_tech_stack_audit
  after insert or update or delete on public.cms_tech_stack
  for each row execute function private.write_audit_event();

-- ============================================================================
-- 6. Engineering FAQs CMS
-- ============================================================================
create table public.cms_faqs (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  answer text not null,
  category text not null default 'general',
  status text not null default 'published' check (status in ('draft', 'review', 'published', 'archived')),
  sort_order int not null default 0,
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index cms_faqs_status_sort on public.cms_faqs (status, sort_order);

create trigger cms_faqs_set_updated_at
  before update on public.cms_faqs
  for each row execute function private.set_updated_at();

create trigger cms_faqs_audit
  after insert or update or delete on public.cms_faqs
  for each row execute function private.write_audit_event();

-- ============================================================================
-- 7. RLS & Permissions
-- ============================================================================

alter table public.cms_hero_slides enable row level security;
alter table public.cms_capabilities enable row level security;
alter table public.cms_process_steps enable row level security;
alter table public.cms_industries enable row level security;
alter table public.cms_tech_stack enable row level security;
alter table public.cms_faqs enable row level security;

revoke all on public.cms_hero_slides from public, anon, authenticated;
revoke all on public.cms_capabilities from public, anon, authenticated;
revoke all on public.cms_process_steps from public, anon, authenticated;
revoke all on public.cms_industries from public, anon, authenticated;
revoke all on public.cms_tech_stack from public, anon, authenticated;
revoke all on public.cms_faqs from public, anon, authenticated;

grant select on public.cms_hero_slides to anon, authenticated;
grant select on public.cms_capabilities to anon, authenticated;
grant select on public.cms_process_steps to anon, authenticated;
grant select on public.cms_industries to anon, authenticated;
grant select on public.cms_tech_stack to anon, authenticated;
grant select on public.cms_faqs to anon, authenticated;

grant insert, update, delete on public.cms_hero_slides to authenticated;
grant insert, update, delete on public.cms_capabilities to authenticated;
grant insert, update, delete on public.cms_process_steps to authenticated;
grant insert, update, delete on public.cms_industries to authenticated;
grant insert, update, delete on public.cms_tech_stack to authenticated;
grant insert, update, delete on public.cms_faqs to authenticated;

-- Public Read Policies
create policy cms_hero_slides_public_read on public.cms_hero_slides
  for select to anon, authenticated
  using (
    status = 'published'
    or (
      (private.has_platform_role(array['platform_admin', 'developer']) or private.is_super_admin())
      and (select auth.jwt() ->> 'aal') = 'aal2'
    )
  );

create policy cms_capabilities_public_read on public.cms_capabilities
  for select to anon, authenticated
  using (
    status = 'published'
    or (
      (private.has_platform_role(array['platform_admin', 'developer']) or private.is_super_admin())
      and (select auth.jwt() ->> 'aal') = 'aal2'
    )
  );

create policy cms_process_steps_public_read on public.cms_process_steps
  for select to anon, authenticated
  using (
    status = 'published'
    or (
      (private.has_platform_role(array['platform_admin', 'developer']) or private.is_super_admin())
      and (select auth.jwt() ->> 'aal') = 'aal2'
    )
  );

create policy cms_industries_public_read on public.cms_industries
  for select to anon, authenticated
  using (
    status = 'published'
    or (
      (private.has_platform_role(array['platform_admin', 'developer']) or private.is_super_admin())
      and (select auth.jwt() ->> 'aal') = 'aal2'
    )
  );

create policy cms_tech_stack_public_read on public.cms_tech_stack
  for select to anon, authenticated
  using (
    status = 'published'
    or (
      (private.has_platform_role(array['platform_admin', 'developer']) or private.is_super_admin())
      and (select auth.jwt() ->> 'aal') = 'aal2'
    )
  );

create policy cms_faqs_public_read on public.cms_faqs
  for select to anon, authenticated
  using (
    status = 'published'
    or (
      (private.has_platform_role(array['platform_admin', 'developer']) or private.is_super_admin())
      and (select auth.jwt() ->> 'aal') = 'aal2'
    )
  );

-- Admin Mutation Policies
create policy cms_hero_slides_admin_write on public.cms_hero_slides
  for all to authenticated
  using (
    (private.has_platform_role(array['platform_admin', 'developer']) or private.is_super_admin())
    and (select auth.jwt() ->> 'aal') = 'aal2'
  )
  with check (
    (private.has_platform_role(array['platform_admin', 'developer']) or private.is_super_admin())
    and (select auth.jwt() ->> 'aal') = 'aal2'
  );

create policy cms_capabilities_admin_write on public.cms_capabilities
  for all to authenticated
  using (
    (private.has_platform_role(array['platform_admin', 'developer']) or private.is_super_admin())
    and (select auth.jwt() ->> 'aal') = 'aal2'
  )
  with check (
    (private.has_platform_role(array['platform_admin', 'developer']) or private.is_super_admin())
    and (select auth.jwt() ->> 'aal') = 'aal2'
  );

create policy cms_process_steps_admin_write on public.cms_process_steps
  for all to authenticated
  using (
    (private.has_platform_role(array['platform_admin', 'developer']) or private.is_super_admin())
    and (select auth.jwt() ->> 'aal') = 'aal2'
  )
  with check (
    (private.has_platform_role(array['platform_admin', 'developer']) or private.is_super_admin())
    and (select auth.jwt() ->> 'aal') = 'aal2'
  );

create policy cms_industries_admin_write on public.cms_industries
  for all to authenticated
  using (
    (private.has_platform_role(array['platform_admin', 'developer']) or private.is_super_admin())
    and (select auth.jwt() ->> 'aal') = 'aal2'
  )
  with check (
    (private.has_platform_role(array['platform_admin', 'developer']) or private.is_super_admin())
    and (select auth.jwt() ->> 'aal') = 'aal2'
  );

create policy cms_tech_stack_admin_write on public.cms_tech_stack
  for all to authenticated
  using (
    (private.has_platform_role(array['platform_admin', 'developer']) or private.is_super_admin())
    and (select auth.jwt() ->> 'aal') = 'aal2'
  )
  with check (
    (private.has_platform_role(array['platform_admin', 'developer']) or private.is_super_admin())
    and (select auth.jwt() ->> 'aal') = 'aal2'
  );

create policy cms_faqs_admin_write on public.cms_faqs
  for all to authenticated
  using (
    (private.has_platform_role(array['platform_admin', 'developer']) or private.is_super_admin())
    and (select auth.jwt() ->> 'aal') = 'aal2'
  )
  with check (
    (private.has_platform_role(array['platform_admin', 'developer']) or private.is_super_admin())
    and (select auth.jwt() ->> 'aal') = 'aal2'
  );

-- Update revisions check constraint
alter table public.cms_revisions drop constraint if exists cms_revisions_entity_type_check;
alter table public.cms_revisions add constraint cms_revisions_entity_type_check
  check (entity_type in ('page', 'post', 'service', 'case_study', 'setting', 'menu', 'hero_slide', 'capability', 'process_step', 'industry', 'tech_stack', 'faq'));

-- ============================================================================
-- 8. Seed Initial Data with Exact Approved Content
-- ============================================================================

-- Hero Slides (Initial 3 slides)
insert into public.cms_hero_slides (title, label, tagline, image_url, alt_text, link_url, sort_order, status, is_featured)
values
  ('TheCodexThrill Engineering Studio', 'TheCodexThrill Engineering Studio', 'BUILD | INNOVATE | DEPLOY | SCALE', '/brand/thecodexthrill-banner.jpg', 'TheCodexThrill — Build, Innovate, Deploy, Scale', '/contact', 1, 'published', true),
  ('High-Concurrency Distributed Cloud Architecture', 'High-Concurrency Cloud Architecture', 'SUB-50MS LATENCY | ZERO-TRUST RLS', '/brand/thecodexthrill-banner.jpg', 'High-Performance Cloud Architecture', '/services/cloud-devops', 2, 'published', false),
  ('Autonomous AI & Intelligent Multi-Agent Systems', 'Autonomous AI & Intelligent Systems', 'DETERMINISTIC | CITATION-BACKED', '/brand/thecodexthrill-banner.jpg', 'Applied Machine Intelligence Solutions', '/services/ai-solutions', 3, 'published', false)
on conflict do nothing;

-- Capabilities (Initial 6 capabilities from current approved design)
insert into public.cms_capabilities (slug, number_label, title, headline, description, icon_name, deliverables, technologies, service_slug, sort_order, status)
values
  ('web-apps', '01', 'Intelligent Web & Cloud Platforms', 'Mission-critical web applications built for speed, responsiveness, and complex workflows.',
   'We build production web platforms utilizing Next.js App Router, React Server Components, and distributed edge architectures. By moving computation closer to users and decoupling heavy mutations through background tasks and optimistic updates, we achieve sub-second perceived response times across global networks.',
   'Code2', array['Server-rendered and statically generated hybrid architectures', 'Robust state management and optimistic UI updates', 'Accessible design systems compliant with WCAG 2.1 AA', 'Edge-cached content delivery and streaming hydration'],
   array['Next.js App Router', 'React 19', 'TypeScript', 'Tailwind CSS', 'Edge Runtime'], 'web-applications', 1, 'published'),

  ('enterprise-software', '02', 'Enterprise Software & Operations Engines', 'Scalable back-office platforms, custom CRMs, project engines, and auditable data pipelines.',
   'Enterprise systems must withstand organizational complexity without slowing teams down. We engineer bespoke operational software featuring multi-tenant isolation, real-time collaboration, immutable audit logging, and automated compliance triggers that replace error-prone spreadsheets and fragmented SaaS silos.',
   'Layers', array['Multi-tenant schema partitioning with strict Row-Level Security', 'Custom project management, invoicing, and contract workflows', 'Automated event sourcing and tamper-evident audit trails', 'Role-Based Access Control (RBAC) with granular permission trees'],
   array['Supabase Cloud', 'PostgreSQL RLS', 'Server Actions', 'TanStack Table', 'Zod Validation'], 'enterprise-software', 2, 'published'),

  ('applied-ai', '03', 'Applied AI & Autonomous Agent Systems', 'Practical machine intelligence with deterministic guardrails, citations, and human oversight.',
   'We avoid AI gimmicks and build practical intelligence directly into business operations. From autonomous triage agents and multi-source semantic search to structured document extraction, our systems enforce human-in-the-loop review, strict citation tracing, and fallback heuristics when model confidence is low.',
   'BrainCircuit', array['Domain-specific retrieval augmented generation (RAG) pipelines', 'FastMCP tool servers and autonomous agent workflows', 'Vector embeddings with pgvector similarity search', 'Hallucination mitigation, latency monitoring, and prompt evaluation gates'],
   array['FastMCP', 'pgvector', 'OpenAI / Claude APIs', 'Python Agents', 'LangGraph / DSPy'], 'ai-solutions', 3, 'published'),

  ('mobile-resilience', '04', 'Resilient Mobile & Progressive Web Apps', 'Offline-first mobile software designed for high-stress field conditions and instant feedback.',
   'Users in logistics, healthcare, and field operations cannot depend on consistent cellular connectivity. We build Progressive Web Apps with persistent IndexedDB backing, background service workers, and cryptographic reconciliation queues that guarantee zero data loss during network blackouts.',
   'Smartphone', array['Deterministic offline-first synchronization protocols', 'Touch-optimized interfaces with native-grade micro-interactions', 'Biometric authentication and local cryptographic key storage', 'Installable PWA manifest with background data synchronization'],
   array['PWA Next.js', 'IndexedDB', 'Service Workers', 'Web Cryptography API', 'Capacitor'], 'mobile-products', 4, 'published'),

  ('cloud-devops', '05', 'Cloud Infrastructure & DevSecOps', 'Automated delivery pipelines, canary rollouts, and resilient cloud infrastructure.',
   'Software velocity requires unbreakable delivery pipelines. We build declarative CI/CD workflows, automated pull-request preview environments, zero-downtime database migrations, and real-time observability dashboards that allow engineering teams to deploy multiple times per day with zero downtime.',
   'Cloud', array['Canary deployment pipelines with automated rollback triggers', 'Infrastructure-as-Code and declarative configuration', 'Automated database migration testing and linting', 'Real-time OpenTelemetry tracking and error budgeting'],
   array['Docker', 'GitHub Actions', 'Vercel Edge', 'Prometheus', 'Supabase CLI'], 'cloud-devops', 5, 'published'),

  ('security-governance', '06', 'Zero-Trust Security & Multi-Tenant Platforms', 'Defense-in-depth architecture adhering to SOC-2 and HIPAA compliance foundations.',
   'Security is not a final checklist item; it is the foundation of every database query and network boundary. We implement cryptographic tenant isolation, mandatory Multi-Factor Authentication (MFA / AAL2) for elevated administrative actions, and automated session revocation upon credential rotation.',
   'ShieldCheck', array['AAL2 Multi-Factor Authentication (Authenticator TOTP & WebAuthn)', 'Strict Row-Level Security policies tested via automated suites', 'Automated vulnerability remediation and dependency pinning', 'End-to-end data encryption in transit (TLS 1.3) and at rest (AES-256)'],
   array['Supabase Auth', 'AAL2 MFA', 'PostgreSQL Policies', 'CSP Headers', 'Security Definer Functions'], 'saas-platforms', 6, 'published')
on conflict (slug) do nothing;

-- Process Steps (Initial 7 steps from current approved design)
insert into public.cms_process_steps (step_number, phase_name, name, duration, icon_name, summary, deliverables, quality_gate, sort_order, status)
values
  ('01', 'Discovery & Framing', 'Problem Definition & Feasibility', 'Week 1', 'Compass',
   'Before writing a line of code, we decompose the business problem into concrete technical requirements, user journeys, and architectural constraints.',
   array['Target audience workflow mapping', 'Technical boundary & third-party dependency analysis', 'High-level data flow diagrams', 'Phase 1 MVP scope definition & milestone schedule'],
   'Signed architectural specification and agreed data contract.', 1, 'published'),

  ('02', 'Architecture & Security', 'Zero-Trust Data Modeling', 'Weeks 1–2', 'Cpu',
   'We design the database schemas, tenant isolation rules, authentication flows, and API boundaries. Security and data integrity are baked into the schema layer.',
   array['Relational schema diagrams with primary & foreign keys', 'Declarative PostgreSQL Row-Level Security (RLS) policies', 'AAL2 / Multi-Factor Authentication security policies', 'Server action contracts with Zod validation schemas'],
   'Automated schema linting and zero cross-tenant leakage verification.', 2, 'published'),

  ('03', 'Design & UX Systems', 'Editorial Interaction Design', 'Weeks 2–4', 'Layout',
   'We craft intuitive, high-velocity user interfaces with clear typographic hierarchy, keyboard accessibility, and purpose-built interaction states.',
   array['Design tokens (colors, typography, spacing, shadows)', 'High-fidelity interactive prototypes in Figma', 'Component states (loading, error, empty, active)', 'Accessibility audit targeting WCAG 2.1 AA standards'],
   'Full user flow validation and design system token signoff.', 3, 'published'),

  ('04', 'Core Engineering', 'Full-Stack Implementation', 'Weeks 4–8', 'GitMerge',
   'We build with strict TypeScript, Next.js Server Components, Turbopack, and Supabase Cloud. Every feature is written with modularity and clean abstractions.',
   array['Production-ready Next.js App Router codebase', 'Supabase client & server action integration', 'Optimistic UI updates and cache revalidation pipelines', 'Granular role-based access control (Staff, Client, Admin)'],
   'Strict TypeScript compilation (0 errors) and automated linter compliance.', 4, 'published'),

  ('05', 'Validation & Hardening', 'Automated Quality Assurance', 'Weeks 8–9', 'FileCheck2',
   'We stress-test the implementation against real-world network drops, malformed payloads, concurrent operations, and security penetration benchmarks.',
   array['Comprehensive unit, integration, and auth test suites', 'Penetration testing and security header validation', 'Lighthouse performance, accessibility, and SEO audits', 'Cross-browser and multi-device compatibility testing'],
   '100% test pass rate across auth, operations, and regression suites.', 5, 'published'),

  ('06', 'Deployment & Handover', 'Zero-Downtime Launch', 'Week 10', 'Rocket',
   'We execute seamless production deployment on Supabase Cloud and Vercel Edge infrastructure with automated health monitoring and instantaneous rollback capability.',
   array['Production environment configuration and secrets provisioning', 'Zero-downtime database migration rollout', 'Complete DNS, SSL, and custom domain routing', 'Comprehensive source code repository handover & documentation'],
   'Smoke tests passed in production with sub-50ms TTFB globally.', 6, 'published'),

  ('07', 'Evolution & SRE', 'Continuous Maintenance & Support', 'Ongoing', 'RefreshCw',
   'Software must adapt as your user base expands. We provide ongoing engineering retainers, telemetry monitoring, performance profiling, and new feature iterations.',
   array['24/7 critical incident response and SLA commitments', 'Real-time database performance and query tuning', 'Regular dependency upgrades and security patches', 'Quarterly architecture reviews and feature roadmap sprints'],
   '99.9% uptime and immediate escalation handling.', 7, 'published')
on conflict do nothing;

-- Industries (Initial 6 industries from current approved design)
insert into public.cms_industries (slug, title, accent, icon_name, challenge, solution, compliance_tags, metrics, sort_order, status)
values
  ('fintech', 'Financial Technology & Wealth Engines', 'FinTech & Banking', 'Landmark',
   'Legacy financial platforms suffer from asynchronous reconciliation bottlenecks, error-prone manual spreadsheets, and strict audit liabilities.',
   'We build real-time transaction ledgers and fund allocation engines using PostgreSQL Row-Level Security, sub-50ms query routing, and immutable event streaming with AAL2 MFA gates.',
   array['SOC-2 Type II', 'Immutable Audit Logs', 'Strict RBAC Isolation'], 'Sub-50ms reconciliation on 1M+ daily rows', 1, 'published'),

  ('healthcare', 'Healthcare, Life Sciences & Clinical Tech', 'MedTech & Health', 'Activity',
   'Medical professionals operating in bandwidth-limited environments lose vital clinical records during network outages, violating continuity of care.',
   'We design offline-first Progressive Web Apps backed by IndexedDB and cryptographic conflict reconciliation, ensuring patient data is preserved locally and synced immediately upon reconnect.',
   array['HIPAA Compliant', 'End-to-End Encryption', 'Zero-Data-Loss Caching'], '100% data preservation across 35k+ encounters', 2, 'published'),

  ('b2b-saas', 'B2B SaaS & Developer Infrastructure', 'SaaS & DevTools', 'Boxes',
   'Rapidly scaling SaaS applications face tenant noisy-neighbor issues, complex entitlement logic, and slow, monolithic release cadences.',
   'We construct modular multi-tenant foundations with isolated database schemas or zero-leakage RLS policies, webhook delivery engines, and automated subscription tier enforcement.',
   array['Multi-Tenant Sandboxing', 'Rate-Limiting & WAF', 'OpenAPI Standards'], '99.99% uptime with instant tenant provisioning', 3, 'published'),

  ('logistics', 'Supply Chain, Fleet & Logistics Platforms', 'Logistics & Fleet', 'Truck',
   'Fragmented third-party APIs and intermittent driver connectivity lead to inaccurate dispatch queues and delayed delivery SLAs.',
   'We engineer distributed dispatch control rooms with real-time WebSocket vehicle telemetry, offline manifest caching, and automated exception routing.',
   array['Real-time Geo-Telemetry', 'Fault-Tolerant Queues', 'Offline Manifests'], 'Sub-second dispatch updates across 500+ nodes', 4, 'published'),

  ('commerce', 'Enterprise Digital Commerce & Retail', 'Commerce & Retail', 'ShoppingBag',
   'High-traffic flash sales and regional inventory fluctuations cause cart abandonment, overselling, and slow page response times.',
   'We deploy headless commerce engines built on Next.js edge caching, optimistic inventory locks, and distributed payment gateways capable of handling massive concurrency spikes.',
   array['PCI-DSS Level 1 Ready', 'Distributed Cache Purging', 'Multi-Currency Routing'], 'Under 100ms checkout latency worldwide', 5, 'published'),

  ('enterprise-infrastructure', 'Enterprise Infrastructure & Defense Tech', 'High-Security Tech', 'ShieldCheck',
   'Government, defense, and high-consequence enterprise environments require zero data leakage, strict clearance gating, and sovereign data residency.',
   'We architect isolated software environments with hardware-backed WebAuthn authentication, cryptographic event signatures, and deterministic automated builds.',
   array['Zero-Trust Network Access', 'Hardware WebAuthn', 'Air-Gapped Deployment Ready'], 'Strict cryptographic verification on every mutation', 6, 'published')
on conflict (slug) do nothing;

-- FAQs (Initial 6 FAQs from current approved design)
insert into public.cms_faqs (question, answer, category, sort_order, status)
values
  ('What is your typical timeline for delivering a production-grade MVP or platform?',
   'A focused, high-integrity MVP generally takes between 6 to 10 weeks from architectural sign-off to production deployment. Because we use pre-validated engineering foundations—including Next.js App Router, Supabase Cloud authentication, and declarative Row-Level Security policies—we bypass weeks of generic boilerplate and focus directly on your proprietary business workflows.',
   'delivery', 1, 'published'),

  ('Can TheCodexThrill modernize or refactor an existing legacy codebase without breaking live operations?',
   'Yes. We specialize in zero-downtime progressive modernization (the Strangler Fig pattern). We introduce automated integration tests around your critical business boundaries first, deploy modern micro-services or Next.js frontends alongside your legacy system, and migrate traffic incrementally with real-time canary monitoring. Your business remains fully operational throughout.',
   'modernization', 2, 'published'),

  ('How do you integrate AI capabilities without hallucination risks or runaway API costs?',
   'We design AI systems as deterministic tools rather than black boxes. We implement retrieval augmented generation (RAG) with pgvector, ground model prompts with strict source citation requirements, and incorporate human-in-the-loop review gates for consequential actions. For cost and latency control, we employ prompt caching, token budgets, and local fallback models.',
   'ai', 3, 'published'),

  ('Who owns the intellectual property, source code, and cloud infrastructure?',
   'You do. 100%. Upon milestone completion and settlement, all bespoke source code, database schemas, Figma designs, and deployment configurations are transferred directly to your organization''s GitHub, Vercel, and Supabase Cloud accounts. We never hold client code hostage or introduce proprietary vendor lock-in.',
   'ownership', 4, 'published'),

  ('How do you guarantee multi-tenant security and prevent cross-tenant data leakage?',
   'We enforce security at the database engine layer via PostgreSQL Row-Level Security (RLS). Every database query executes in the context of the authenticated user''s organization ID. Even if an application-layer endpoint were compromised, the database engine itself rejects unauthorized queries. In addition, sensitive administrative capabilities require AAL2 Multi-Factor Authentication (TOTP / WebAuthn).',
   'security', 5, 'published'),

  ('What does post-launch support look like, and what SLAs do you provide?',
   'We provide flexible post-launch engineering retainers that include active telemetry monitoring, zero-downtime database maintenance, security patching, dependency upgrades, and rapid incident response (under 1 hour for critical production incidents). We also offer continuous feature iteration sprints as your user demands evolve.',
   'sla', 6, 'published')
on conflict do nothing;

-- Tech Stack (Initial items from current approved design)
insert into public.cms_tech_stack (category, name, role, icon_name, sort_order, status)
values
  ('Frontend & User Interface', 'Next.js App Router (v16)', 'Server Components, streaming, incremental static regeneration (ISR)', 'Code2', 1, 'published'),
  ('Frontend & User Interface', 'React 19', 'Actions, concurrent features, modern server-side rendering', 'Code2', 2, 'published'),
  ('Frontend & User Interface', 'TypeScript 5.x', 'Strict type enforcement across client and server boundaries', 'Code2', 3, 'published'),
  ('Frontend & User Interface', 'Tailwind CSS', 'Utility-first design system with zero runtime CSS overhead', 'Code2', 4, 'published'),
  ('Frontend & User Interface', 'Turbopack', 'Blazing-fast incremental builds and local developer feedback loop', 'Code2', 5, 'published'),

  ('Backend, Database & Storage', 'PostgreSQL', 'Relational data integrity, ACID transactions, complex joins', 'Database', 1, 'published'),
  ('Backend, Database & Storage', 'Supabase Cloud', 'Managed enterprise database with instant auth, storage, and RLS', 'Database', 2, 'published'),
  ('Backend, Database & Storage', 'Row-Level Security (RLS)', 'Cryptographic data isolation at the database engine level', 'Database', 3, 'published'),
  ('Backend, Database & Storage', 'Next.js Server Actions', 'Secure RPC with server-side validation and CSRF mitigation', 'Database', 4, 'published'),
  ('Backend, Database & Storage', 'Zod Schema Validation', 'Runtime contract validation on every client-to-server payload', 'Database', 5, 'published'),

  ('Applied AI, Vector & Agents', 'pgvector Extension', 'Native vector similarity search directly within PostgreSQL', 'Sparkles', 1, 'published'),
  ('Applied AI, Vector & Agents', 'FastMCP Protocol', 'Model Context Protocol servers for secure tool invocation', 'Sparkles', 2, 'published'),
  ('Applied AI, Vector & Agents', 'Claude & OpenAI APIs', 'High-reasoning LLMs integrated with prompt evaluation gates', 'Sparkles', 3, 'published'),
  ('Applied AI, Vector & Agents', 'Python Agent Frameworks', 'Deterministic orchestration, multi-agent evaluation, citations', 'Sparkles', 4, 'published'),
  ('Applied AI, Vector & Agents', 'Embeddings Pipelines', 'Chunking, token optimization, and semantic vector indexing', 'Sparkles', 5, 'published'),

  ('Mobile, Offline & Edge', 'Progressive Web App (PWA)', 'Installable cross-platform app with native-like ergonomics', 'Smartphone', 1, 'published'),
  ('Mobile, Offline & Edge', 'Service Workers', 'Background caching, network interception, and resource hydration', 'Smartphone', 2, 'published'),
  ('Mobile, Offline & Edge', 'IndexedDB Storage', 'Zero-data-loss local persistence for offline field encounters', 'Smartphone', 3, 'published'),
  ('Mobile, Offline & Edge', 'Web Cryptography API', 'Client-side encryption of sensitive offline biometric/health records', 'Smartphone', 4, 'published'),
  ('Mobile, Offline & Edge', 'Vercel Edge Network', 'Global low-latency DNS routing and geo-distributed compute', 'Smartphone', 5, 'published'),

  ('Security, Auth & DevSecOps', 'AAL2 Multi-Factor Auth', 'Authenticator TOTP & WebAuthn biometric security gates', 'Shield', 1, 'published'),
  ('Security, Auth & DevSecOps', 'GitHub Actions CI/CD', 'Automated linting, type-checking, unit, and regression testing', 'Shield', 2, 'published'),
  ('Security, Auth & DevSecOps', 'Docker Containerization', 'Deterministic builds and isolated execution environments', 'Shield', 3, 'published'),
  ('Security, Auth & DevSecOps', 'Declarative Migrations', 'Version-controlled, reversible schema changes with Supabase CLI', 'Shield', 4, 'published'),
  ('Security, Auth & DevSecOps', 'Strict CSP & CORS', 'Zero inline scripts, strict frame-ancestors, defense in depth', 'Shield', 5, 'published')
on conflict do nothing;

-- Initial Hero Settings in cms_site_settings
insert into public.cms_site_settings (key, value, description)
values
  ('hero_content', jsonb_build_object(
    'badge_text', 'Engineering Software Company · Enterprise & High-Growth Scale',
    'title', 'Engineering High-Performance Digital Products That Scale.',
    'lead', 'We architect and build web applications, cloud backends, autonomous AI systems, and mission-critical enterprise software. Engineered with strict type safety, zero-trust security, and verifiable performance.',
    'primary_cta_label', 'Initiate Project Inquiry',
    'primary_cta_url', '/contact',
    'secondary_cta_label', 'Explore Case Studies',
    'secondary_cta_url', '/portfolio'
  ), 'Main homepage Hero section copy and action URLs')
on conflict (key) do nothing;

commit;


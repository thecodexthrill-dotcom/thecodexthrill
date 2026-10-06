-- Migration: 20261006210000_portfolio_cms_hardening.sql
-- Hardens Portfolio / Case Studies CMS with explicit public read permissions and seeds approved production case studies.

-- 1. Grant execute permissions on private security helper functions so anon queries evaluating OR branches do not error
grant execute on function private.has_platform_role(text[]) to anon, authenticated;
grant execute on function private.is_super_admin() to anon, authenticated;

-- 2. Harden read policies across CMS tables with auth.role() guards
drop policy if exists cms_case_studies_public_read on public.cms_case_studies;
create policy cms_case_studies_public_read on public.cms_case_studies
  for select to anon, authenticated
  using (
    status = 'published'
    or (
      auth.role() = 'authenticated'
      and (private.has_platform_role(array['platform_admin', 'developer']) or private.is_super_admin())
      and (select auth.jwt() ->> 'aal') = 'aal2'
    )
  );

drop policy if exists cms_services_public_read on public.cms_services;
create policy cms_services_public_read on public.cms_services
  for select to anon, authenticated
  using (
    status = 'published'
    or (
      auth.role() = 'authenticated'
      and (private.has_platform_role(array['platform_admin', 'developer']) or private.is_super_admin())
      and (select auth.jwt() ->> 'aal') = 'aal2'
    )
  );

drop policy if exists cms_posts_public_read on public.cms_posts;
create policy cms_posts_public_read on public.cms_posts
  for select to anon, authenticated
  using (
    (status = 'published' and (scheduled_for is null or scheduled_for <= now()))
    or (
      auth.role() = 'authenticated'
      and (private.has_platform_role(array['platform_admin', 'developer']) or private.is_super_admin())
      and (select auth.jwt() ->> 'aal') = 'aal2'
    )
  );

drop policy if exists cms_pages_public_read on public.cms_pages;
create policy cms_pages_public_read on public.cms_pages
  for select to anon, authenticated
  using (
    status = 'published'
    or (
      auth.role() = 'authenticated'
      and (private.has_platform_role(array['platform_admin', 'developer']) or private.is_super_admin())
      and (select auth.jwt() ->> 'aal') = 'aal2'
    )
  );

-- 3. Seed the 4 Approved Production Portfolio Case Studies
insert into public.cms_case_studies (
  slug,
  title,
  category,
  industry,
  summary,
  challenge,
  solution,
  client_name,
  timeline,
  technologies,
  deliverables,
  results,
  featured,
  cover_image_url,
  status,
  sort_order,
  seo_title,
  seo_description
) values
(
  'apex-capital-engine',
  'Apex Capital Operations Engine',
  'Enterprise Software',
  'Fintech & Investment Banking',
  'Multi-tenant portfolio management and real-time reconciliation engine with strict Row-Level Security, sub-50ms query latency, and automated audit logging.',
  'Apex Capital required a unified, high-integrity platform to replace legacy batch processing across global desks. They faced latency bottlenecks, potential concurrency collisions, and strict SOC-2 compliance requirements.',
  'We architected a zero-trust multi-tenant system using Next.js App Router and PostgreSQL Row-Level Security on Supabase Cloud, enforcing mandatory AAL2 MFA for high-value portfolio actions.',
  'Apex Global Assets',
  '16 weeks',
  array['Next.js 16', 'Supabase Cloud', 'PostgreSQL RLS', 'TypeScript', 'Tailwind CSS'],
  array['Real-time transaction reconciliation pipeline', 'Audited fund allocation ledger', 'Multi-factor tenant access gateway', 'Automated compliance export reports'],
  array['Sub-50ms reconciliation queries across 1.2M daily transactions', '100% compliance audit pass with immutable event logs', 'Zero cross-tenant data leakage incidents'],
  true,
  '/brand/thecodexthrill-banner.jpg',
  'published',
  1,
  'Apex Capital Operations Engine | TheCodexThrill Case Study',
  'How TheCodexThrill engineered a sub-50ms real-time portfolio reconciliation engine with PostgreSQL RLS and Next.js for Apex Capital.'
),
(
  'omnistream-ai-hub',
  'OmniStream Autonomous Support Hub',
  'AI Solutions',
  'SaaS & Developer Infrastructure',
  'Human-in-the-loop multi-agent triage system that classifies, routes, and drafts responses for complex technical incidents with verifiable source citations.',
  'Technical support volume had grown 400% year-over-year. Generic AI chatbots produced hallucinations and lacked verifiable code context, leading to customer frustration.',
  'Designed for a high-growth developer platform, OmniStream couples domain-specific AI models with rigorous human review gates. Customer tickets are categorized with confidence scores, relevant codebase documents are embedded dynamically, and staff can review or adjust suggested resolutions with one click.',
  'OmniStream Systems',
  '12 weeks',
  array['Next.js', 'Python FastMCP', 'Vector Embeddings', 'Supabase', 'TypeScript'],
  array['Context-aware incident classifier', 'Human review escalation interface', 'Streaming response generator with source links', 'Drift and hallucination monitoring'],
  array['92% automated triage accuracy on unstructured technical issues', 'Average incident response time reduced from 4 hours to 18 minutes', 'Full citation traceability for every AI-generated suggestion'],
  true,
  '/brand/thecodexthrill-banner.jpg',
  'published',
  2,
  'OmniStream Autonomous Support Hub | TheCodexThrill Case Study',
  'How TheCodexThrill built a human-in-the-loop multi-agent triage system reducing response times from 4 hours to 18 minutes.'
),
(
  'strata-cloud-deploy',
  'Strata Progressive Deployment Orchestrator',
  'Cloud & DevOps',
  'Enterprise Cloud Platforms',
  'Zero-downtime canary deployment orchestrator featuring automated health evaluations, metric threshold tracking, and instant rollback triggers.',
  'Frequent production releases were causing intermittent service disruptions across multi-region clusters. Engineering teams lacked an automated, objective mechanism to evaluate canary deployments in real time.',
  'Strata provides development teams with confidence during daily production deployments. We engineered a robust web interface and background telemetry collector that tracks release health in real time, pausing or rolling back releases whenever anomaly thresholds are breached.',
  'Strata Cloud Networks',
  '14 weeks',
  array['Next.js', 'Docker', 'Prometheus', 'PostgreSQL', 'Tailwind CSS'],
  array['Progressive canary deployment dashboard', 'Automated anomaly detection hooks', 'Multi-region rollback automation', 'SOC-2 Type II audit trail integration'],
  array['Zero downtime across 450+ weekly production releases', 'Mean time to recovery (MTTR) dropped to under 12 seconds', 'Consolidated multi-region deployment visibility for 80+ engineers'],
  true,
  '/brand/thecodexthrill-banner.jpg',
  'published',
  3,
  'Strata Progressive Deployment Orchestrator | TheCodexThrill Case Study',
  'How TheCodexThrill built an automated zero-downtime canary deployment orchestrator for enterprise multi-region clusters.'
),
(
  'pulse-clinical-field',
  'Pulse Clinical Field Companion',
  'Mobile & Web Products',
  'Healthcare & Life Sciences',
  'Offline-first clinical tracking application enabling medical teams to record critical patient encounters in connectivity-constrained field environments.',
  'Field health practitioners routinely operate in remote geographies with zero cellular connectivity. Paper notes caused data loss, transcription lag, and compliance violations.',
  'Built for medical personnel operating in remote and bandwidth-constrained settings, Pulse uses local cryptographic stores, background service workers, and structured reconciliation algorithms to ensure no patient documentation is lost, synchronizing seamlessly upon connection restoration.',
  'Pulse Health Initiative',
  '20 weeks',
  array['PWA Next.js', 'IndexedDB', 'PostgreSQL', 'Web Cryptography API', 'Tailwind CSS'],
  array['PWA with zero-data-loss offline storage', 'Cryptographic conflict reconciliation worker', 'HIPAA-compliant encrypted local cache', 'Field-tested touch-optimized interface'],
  array['100% data preservation across 35,000+ remote patient encounters', 'Sub-100ms response time on ruggedized low-power field tablets', 'Instant background synchronization when cellular data resumes'],
  true,
  '/brand/thecodexthrill-banner.jpg',
  'published',
  4,
  'Pulse Clinical Field Companion | TheCodexThrill Case Study',
  'How TheCodexThrill developed a resilient offline-first PWA for healthcare field workers with local cryptographic storage.'
)
on conflict (slug) do update set
  title = excluded.title,
  category = excluded.category,
  industry = excluded.industry,
  summary = excluded.summary,
  challenge = excluded.challenge,
  solution = excluded.solution,
  client_name = excluded.client_name,
  timeline = excluded.timeline,
  technologies = excluded.technologies,
  deliverables = excluded.deliverables,
  results = excluded.results,
  featured = excluded.featured,
  cover_image_url = excluded.cover_image_url,
  status = excluded.status,
  sort_order = excluded.sort_order,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description;


import { unstable_cache } from "next/cache";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getSupabasePublicEnv } from "@/lib/env";
import {
  articles,
  portfolioProjects,
  services,
  type PortfolioProject,
} from "@/lib/public-content";

// ============================================================================
// Public Supabase Client (No cookies - Safe for Static Generation & Caching)
// ============================================================================

function getPublicSupabase() {
  const { url, key } = getSupabasePublicEnv();
  return createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// ============================================================================
// Types
// ============================================================================

export type PublicHeroSlide = {
  id: string;
  title: string;
  label: string;
  tagline: string;
  imageUrl: string;
  altText: string;
  linkUrl: string | null;
  sortOrder: number;
  isFeatured: boolean;
};

export type PublicHeroSettings = {
  badgeText: string;
  title: string;
  lead: string;
  primaryCtaLabel: string;
  primaryCtaUrl: string;
  secondaryCtaLabel: string;
  secondaryCtaUrl: string;
};

export type PublicCapability = {
  id: string;
  slug: string;
  numberLabel: string;
  title: string;
  headline: string;
  description: string;
  iconName: string;
  deliverables: string[];
  technologies: string[];
  serviceSlug: string;
  sortOrder: number;
};

export type PublicProcessStep = {
  id: string;
  stepNumber: string;
  phaseName: string;
  name: string;
  duration: string;
  iconName: string;
  summary: string;
  deliverables: string[];
  qualityGate: string;
  sortOrder: number;
};

export type PublicIndustry = {
  id: string;
  slug: string;
  title: string;
  accent: string;
  iconName: string;
  challenge: string;
  solution: string;
  complianceTags: string[];
  metrics: string;
  sortOrder: number;
};

export type PublicTechItem = {
  id: string;
  category: string;
  name: string;
  role: string;
  iconName: string;
  sortOrder: number;
};

export type PublicFaq = {
  id: string;
  question: string;
  answer: string;
  category: string;
  sortOrder: number;
};

export type PublicArticle = {
  slug: string;
  category: string;
  title: string;
  excerpt: string;
  readingTime: string;
  body: readonly string[];
};

export type PublicService = {
  slug: string;
  title: string;
  short: string;
  description: string;
  iconName?: string;
  features?: string[];
  ctaLabel?: string;
  ctaUrl?: string;
};

export type PublicPage = {
  slug: string;
  title: string;
  content: string;
  seo_title: string | null;
  seo_description: string | null;
  published_at: string | null;
};

// ============================================================================
// Default Authentic Fallbacks (Preserves 100% of current approved content)
// ============================================================================

export const defaultHeroSettings: PublicHeroSettings = {
  badgeText: "Engineering Software Company · Enterprise & High-Growth Scale",
  title: "Engineering High-Performance Digital Products That Scale.",
  lead: "We architect and build web applications, cloud backends, autonomous AI systems, and mission-critical enterprise software. Engineered with strict type safety, zero-trust security, and verifiable performance.",
  primaryCtaLabel: "Initiate Project Inquiry",
  primaryCtaUrl: "/contact",
  secondaryCtaLabel: "Explore Case Studies",
  secondaryCtaUrl: "/portfolio",
};

export const defaultHeroSlides: PublicHeroSlide[] = [
  {
    id: "default-slide-1",
    title: "TheCodexThrill Engineering Studio",
    label: "TheCodexThrill Engineering Studio",
    tagline: "BUILD | INNOVATE | DEPLOY | SCALE",
    imageUrl: "/brand/thecodexthrill-banner.jpg",
    altText: "TheCodexThrill — Build, Innovate, Deploy, Scale",
    linkUrl: "/contact",
    sortOrder: 1,
    isFeatured: true,
  },
  {
    id: "default-slide-2",
    title: "High-Concurrency Distributed Cloud Architecture",
    label: "High-Concurrency Cloud Architecture",
    tagline: "SUB-50MS LATENCY | ZERO-TRUST RLS",
    imageUrl: "/brand/thecodexthrill-banner.jpg",
    altText: "High-Performance Cloud Architecture",
    linkUrl: "/services/cloud-devops",
    sortOrder: 2,
    isFeatured: false,
  },
  {
    id: "default-slide-3",
    title: "Autonomous AI & Intelligent Multi-Agent Systems",
    label: "Autonomous AI & Intelligent Systems",
    tagline: "DETERMINISTIC | CITATION-BACKED",
    imageUrl: "/brand/thecodexthrill-banner.jpg",
    altText: "Applied Machine Intelligence Solutions",
    linkUrl: "/services/ai-solutions",
    sortOrder: 3,
    isFeatured: false,
  },
];

export const defaultCapabilities: PublicCapability[] = [
  {
    id: "cap-1",
    slug: "web-apps",
    numberLabel: "01",
    title: "Intelligent Web & Cloud Platforms",
    headline: "Mission-critical web applications built for speed, responsiveness, and complex workflows.",
    description: "We build production web platforms utilizing Next.js App Router, React Server Components, and distributed edge architectures. By moving computation closer to users and decoupling heavy mutations through background tasks and optimistic updates, we achieve sub-second perceived response times across global networks.",
    iconName: "Code2",
    deliverables: [
      "Server-rendered and statically generated hybrid architectures",
      "Robust state management and optimistic UI updates",
      "Accessible design systems compliant with WCAG 2.1 AA",
      "Edge-cached content delivery and streaming hydration",
    ],
    technologies: ["Next.js App Router", "React 19", "TypeScript", "Tailwind CSS", "Edge Runtime"],
    serviceSlug: "web-applications",
    sortOrder: 1,
  },
  {
    id: "cap-2",
    slug: "enterprise-software",
    numberLabel: "02",
    title: "Enterprise Software & Operations Engines",
    headline: "Scalable back-office platforms, custom CRMs, project engines, and auditable data pipelines.",
    description: "Enterprise systems must withstand organizational complexity without slowing teams down. We engineer bespoke operational software featuring multi-tenant isolation, real-time collaboration, immutable audit logging, and automated compliance triggers that replace error-prone spreadsheets and fragmented SaaS silos.",
    iconName: "Layers",
    deliverables: [
      "Multi-tenant schema partitioning with strict Row-Level Security",
      "Custom project management, invoicing, and contract workflows",
      "Automated event sourcing and tamper-evident audit trails",
      "Role-Based Access Control (RBAC) with granular permission trees",
    ],
    technologies: ["Supabase Cloud", "PostgreSQL RLS", "Server Actions", "TanStack Table", "Zod Validation"],
    serviceSlug: "enterprise-software",
    sortOrder: 2,
  },
  {
    id: "cap-3",
    slug: "applied-ai",
    numberLabel: "03",
    title: "Applied AI & Autonomous Agent Systems",
    headline: "Practical machine intelligence with deterministic guardrails, citations, and human oversight.",
    description: "We avoid AI gimmicks and build practical intelligence directly into business operations. From autonomous triage agents and multi-source semantic search to structured document extraction, our systems enforce human-in-the-loop review, strict citation tracing, and fallback heuristics when model confidence is low.",
    iconName: "BrainCircuit",
    deliverables: [
      "Domain-specific retrieval augmented generation (RAG) pipelines",
      "FastMCP tool servers and autonomous agent workflows",
      "Vector embeddings with pgvector similarity search",
      "Hallucination mitigation, latency monitoring, and prompt evaluation gates",
    ],
    technologies: ["FastMCP", "pgvector", "OpenAI / Claude APIs", "Python Agents", "LangGraph / DSPy"],
    serviceSlug: "ai-solutions",
    sortOrder: 3,
  },
  {
    id: "cap-4",
    slug: "mobile-resilience",
    numberLabel: "04",
    title: "Resilient Mobile & Progressive Web Apps",
    headline: "Offline-first mobile software designed for high-stress field conditions and instant feedback.",
    description: "Users in logistics, healthcare, and field operations cannot depend on consistent cellular connectivity. We build Progressive Web Apps with persistent IndexedDB backing, background service workers, and cryptographic reconciliation queues that guarantee zero data loss during network blackouts.",
    iconName: "Smartphone",
    deliverables: [
      "Deterministic offline-first synchronization protocols",
      "Touch-optimized interfaces with native-grade micro-interactions",
      "Biometric authentication and local cryptographic key storage",
      "Installable PWA manifest with background data synchronization",
    ],
    technologies: ["PWA Next.js", "IndexedDB", "Service Workers", "Web Cryptography API", "Capacitor"],
    serviceSlug: "mobile-products",
    sortOrder: 4,
  },
  {
    id: "cap-5",
    slug: "cloud-devops",
    numberLabel: "05",
    title: "Cloud Infrastructure & DevSecOps",
    headline: "Automated delivery pipelines, canary rollouts, and resilient cloud infrastructure.",
    description: "Software velocity requires unbreakable delivery pipelines. We build declarative CI/CD workflows, automated pull-request preview environments, zero-downtime database migrations, and real-time observability dashboards that allow engineering teams to deploy multiple times per day with zero downtime.",
    iconName: "Cloud",
    deliverables: [
      "Canary deployment pipelines with automated rollback triggers",
      "Infrastructure-as-Code and declarative configuration",
      "Automated database migration testing and linting",
      "Real-time OpenTelemetry tracking and error budgeting",
    ],
    technologies: ["Docker", "GitHub Actions", "Vercel Edge", "Prometheus", "Supabase CLI"],
    serviceSlug: "cloud-devops",
    sortOrder: 5,
  },
  {
    id: "cap-6",
    slug: "security-governance",
    numberLabel: "06",
    title: "Zero-Trust Security & Multi-Tenant Platforms",
    headline: "Defense-in-depth architecture adhering to SOC-2 and HIPAA compliance foundations.",
    description: "Security is not a final checklist item; it is the foundation of every database query and network boundary. We implement cryptographic tenant isolation, mandatory Multi-Factor Authentication (MFA / AAL2) for elevated administrative actions, and automated session revocation upon credential rotation.",
    iconName: "ShieldCheck",
    deliverables: [
      "AAL2 Multi-Factor Authentication (Authenticator TOTP & WebAuthn)",
      "Strict Row-Level Security policies tested via automated suites",
      "Automated vulnerability remediation and dependency pinning",
      "End-to-end data encryption in transit (TLS 1.3) and at rest (AES-256)",
    ],
    technologies: ["Supabase Auth", "AAL2 MFA", "PostgreSQL Policies", "CSP Headers", "Security Definer Functions"],
    serviceSlug: "saas-platforms",
    sortOrder: 6,
  },
];

export const defaultProcessSteps: PublicProcessStep[] = [
  {
    id: "step-1",
    stepNumber: "01",
    phaseName: "Discovery & Framing",
    name: "Problem Definition & Feasibility",
    duration: "Week 1",
    iconName: "Compass",
    summary: "Before writing a line of code, we decompose the business problem into concrete technical requirements, user journeys, and architectural constraints.",
    deliverables: [
      "Target audience workflow mapping",
      "Technical boundary & third-party dependency analysis",
      "High-level data flow diagrams",
      "Phase 1 MVP scope definition & milestone schedule",
    ],
    qualityGate: "Signed architectural specification and agreed data contract.",
    sortOrder: 1,
  },
  {
    id: "step-2",
    stepNumber: "02",
    phaseName: "Architecture & Security",
    name: "Zero-Trust Data Modeling",
    duration: "Weeks 1–2",
    iconName: "Cpu",
    summary: "We design the database schemas, tenant isolation rules, authentication flows, and API boundaries. Security and data integrity are baked into the schema layer.",
    deliverables: [
      "Relational schema diagrams with primary & foreign keys",
      "Declarative PostgreSQL Row-Level Security (RLS) policies",
      "AAL2 / Multi-Factor Authentication security policies",
      "Server action contracts with Zod validation schemas",
    ],
    qualityGate: "Automated schema linting and zero cross-tenant leakage verification.",
    sortOrder: 2,
  },
  {
    id: "step-3",
    stepNumber: "03",
    phaseName: "Design & UX Systems",
    name: "Editorial Interaction Design",
    duration: "Weeks 2–4",
    iconName: "Layout",
    summary: "We craft intuitive, high-velocity user interfaces with clear typographic hierarchy, keyboard accessibility, and purpose-built interaction states.",
    deliverables: [
      "Design tokens (colors, typography, spacing, shadows)",
      "High-fidelity interactive prototypes in Figma",
      "Component states (loading, error, empty, active)",
      "Accessibility audit targeting WCAG 2.1 AA standards",
    ],
    qualityGate: "Full user flow validation and design system token signoff.",
    sortOrder: 3,
  },
  {
    id: "step-4",
    stepNumber: "04",
    phaseName: "Core Engineering",
    name: "Full-Stack Implementation",
    duration: "Weeks 4–8",
    iconName: "GitMerge",
    summary: "We build with strict TypeScript, Next.js Server Components, Turbopack, and Supabase Cloud. Every feature is written with modularity and clean abstractions.",
    deliverables: [
      "Production-ready Next.js App Router codebase",
      "Supabase client & server action integration",
      "Optimistic UI updates and cache revalidation pipelines",
      "Granular role-based access control (Staff, Client, Admin)",
    ],
    qualityGate: "Strict TypeScript compilation (0 errors) and automated linter compliance.",
    sortOrder: 4,
  },
  {
    id: "step-5",
    stepNumber: "05",
    phaseName: "Validation & Hardening",
    name: "Automated Quality Assurance",
    duration: "Weeks 8–9",
    iconName: "FileCheck2",
    summary: "We stress-test the implementation against real-world network drops, malformed payloads, concurrent operations, and security penetration benchmarks.",
    deliverables: [
      "Comprehensive unit, integration, and auth test suites",
      "Penetration testing and security header validation",
      "Lighthouse performance, accessibility, and SEO audits",
      "Cross-browser and multi-device compatibility testing",
    ],
    qualityGate: "100% test pass rate across auth, operations, and regression suites.",
    sortOrder: 5,
  },
  {
    id: "step-6",
    stepNumber: "06",
    phaseName: "Deployment & Handover",
    name: "Zero-Downtime Launch",
    duration: "Week 10",
    iconName: "Rocket",
    summary: "We execute seamless production deployment on Supabase Cloud and Vercel Edge infrastructure with automated health monitoring and instantaneous rollback capability.",
    deliverables: [
      "Production environment configuration and secrets provisioning",
      "Zero-downtime database migration rollout",
      "Complete DNS, SSL, and custom domain routing",
      "Comprehensive source code repository handover & documentation",
    ],
    qualityGate: "Smoke tests passed in production with sub-50ms TTFB globally.",
    sortOrder: 6,
  },
  {
    id: "step-7",
    stepNumber: "07",
    phaseName: "Evolution & SRE",
    name: "Continuous Maintenance & Support",
    duration: "Ongoing",
    iconName: "RefreshCw",
    summary: "Software must adapt as your user base expands. We provide ongoing engineering retainers, telemetry monitoring, performance profiling, and new feature iterations.",
    deliverables: [
      "24/7 critical incident response and SLA commitments",
      "Real-time database performance and query tuning",
      "Regular dependency upgrades and security patches",
      "Quarterly architecture reviews and feature roadmap sprints",
    ],
    qualityGate: "99.9% uptime and immediate escalation handling.",
    sortOrder: 7,
  },
];

export const defaultIndustries: PublicIndustry[] = [
  {
    id: "ind-1",
    slug: "fintech",
    title: "Financial Technology & Wealth Engines",
    accent: "FinTech & Banking",
    iconName: "Landmark",
    challenge: "Legacy financial platforms suffer from asynchronous reconciliation bottlenecks, error-prone manual spreadsheets, and strict audit liabilities.",
    solution: "We build real-time transaction ledgers and fund allocation engines using PostgreSQL Row-Level Security, sub-50ms query routing, and immutable event streaming with AAL2 MFA gates.",
    complianceTags: ["SOC-2 Type II", "Immutable Audit Logs", "Strict RBAC Isolation"],
    metrics: "Sub-50ms reconciliation on 1M+ daily rows",
    sortOrder: 1,
  },
  {
    id: "ind-2",
    slug: "healthcare",
    title: "Healthcare, Life Sciences & Clinical Tech",
    accent: "MedTech & Health",
    iconName: "Activity",
    challenge: "Medical professionals operating in bandwidth-limited environments lose vital clinical records during network outages, violating continuity of care.",
    solution: "We design offline-first Progressive Web Apps backed by IndexedDB and cryptographic conflict reconciliation, ensuring patient data is preserved locally and synced immediately upon reconnect.",
    complianceTags: ["HIPAA Compliant", "End-to-End Encryption", "Zero-Data-Loss Caching"],
    metrics: "100% data preservation across 35k+ encounters",
    sortOrder: 2,
  },
  {
    id: "ind-3",
    slug: "b2b-saas",
    title: "B2B SaaS & Developer Infrastructure",
    accent: "SaaS & DevTools",
    iconName: "Boxes",
    challenge: "Rapidly scaling SaaS applications face tenant noisy-neighbor issues, complex entitlement logic, and slow, monolithic release cadences.",
    solution: "We construct modular multi-tenant foundations with isolated database schemas or zero-leakage RLS policies, webhook delivery engines, and automated subscription tier enforcement.",
    complianceTags: ["Multi-Tenant Sandboxing", "Rate-Limiting & WAF", "OpenAPI Standards"],
    metrics: "99.99% uptime with instant tenant provisioning",
    sortOrder: 3,
  },
  {
    id: "ind-4",
    slug: "logistics",
    title: "Supply Chain, Fleet & Logistics Platforms",
    accent: "Logistics & Fleet",
    iconName: "Truck",
    challenge: "Fragmented third-party APIs and intermittent driver connectivity lead to inaccurate dispatch queues and delayed delivery SLAs.",
    solution: "We engineer distributed dispatch control rooms with real-time WebSocket vehicle telemetry, offline manifest caching, and automated exception routing.",
    complianceTags: ["Real-time Geo-Telemetry", "Fault-Tolerant Queues", "Offline Manifests"],
    metrics: "Sub-second dispatch updates across 500+ nodes",
    sortOrder: 4,
  },
  {
    id: "ind-5",
    slug: "commerce",
    title: "Enterprise Digital Commerce & Retail",
    accent: "Commerce & Retail",
    iconName: "ShoppingBag",
    challenge: "High-traffic flash sales and regional inventory fluctuations cause cart abandonment, overselling, and slow page response times.",
    solution: "We deploy headless commerce engines built on Next.js edge caching, optimistic inventory locks, and distributed payment gateways capable of handling massive concurrency spikes.",
    complianceTags: ["PCI-DSS Level 1 Ready", "Distributed Cache Purging", "Multi-Currency Routing"],
    metrics: "Under 100ms checkout latency worldwide",
    sortOrder: 5,
  },
  {
    id: "ind-6",
    slug: "enterprise-infrastructure",
    title: "Enterprise Infrastructure & Defense Tech",
    accent: "High-Security Tech",
    iconName: "ShieldCheck",
    challenge: "Government, defense, and high-consequence enterprise environments require zero data leakage, strict clearance gating, and sovereign data residency.",
    solution: "We architect isolated software environments with hardware-backed WebAuthn authentication, cryptographic event signatures, and deterministic automated builds.",
    complianceTags: ["Zero-Trust Network Access", "Hardware WebAuthn", "Air-Gapped Deployment Ready"],
    metrics: "Strict cryptographic verification on every mutation",
    sortOrder: 6,
  },
];

export const defaultFaqs: PublicFaq[] = [
  {
    id: "faq-1",
    question: "What is your typical timeline for delivering a production-grade MVP or platform?",
    answer: "A focused, high-integrity MVP generally takes between 6 to 10 weeks from architectural sign-off to production deployment. Because we use pre-validated engineering foundations—including Next.js App Router, Supabase Cloud authentication, and declarative Row-Level Security policies—we bypass weeks of generic boilerplate and focus directly on your proprietary business workflows.",
    category: "delivery",
    sortOrder: 1,
  },
  {
    id: "faq-2",
    question: "Can TheCodexThrill modernize or refactor an existing legacy codebase without breaking live operations?",
    answer: "Yes. We specialize in zero-downtime progressive modernization (the Strangler Fig pattern). We introduce automated integration tests around your critical business boundaries first, deploy modern micro-services or Next.js frontends alongside your legacy system, and migrate traffic incrementally with real-time canary monitoring. Your business remains fully operational throughout.",
    category: "modernization",
    sortOrder: 2,
  },
  {
    id: "faq-3",
    question: "How do you integrate AI capabilities without hallucination risks or runaway API costs?",
    answer: "We design AI systems as deterministic tools rather than black boxes. We implement retrieval augmented generation (RAG) with pgvector, ground model prompts with strict source citation requirements, and incorporate human-in-the-loop review gates for consequential actions. For cost and latency control, we employ prompt caching, token budgets, and local fallback models.",
    category: "ai",
    sortOrder: 3,
  },
  {
    id: "faq-4",
    question: "Who owns the intellectual property, source code, and cloud infrastructure?",
    answer: "You do. 100%. Upon milestone completion and settlement, all bespoke source code, database schemas, Figma designs, and deployment configurations are transferred directly to your organization's GitHub, Vercel, and Supabase Cloud accounts. We never hold client code hostage or introduce proprietary vendor lock-in.",
    category: "ownership",
    sortOrder: 4,
  },
  {
    id: "faq-5",
    question: "How do you guarantee multi-tenant security and prevent cross-tenant data leakage?",
    answer: "We enforce security at the database engine layer via PostgreSQL Row-Level Security (RLS). Every database query executes in the context of the authenticated user's organization ID. Even if an application-layer endpoint were compromised, the database engine itself rejects unauthorized queries. In addition, sensitive administrative capabilities require AAL2 Multi-Factor Authentication (TOTP / WebAuthn).",
    category: "security",
    sortOrder: 5,
  },
  {
    id: "faq-6",
    question: "What does post-launch support look like, and what SLAs do you provide?",
    answer: "We provide flexible post-launch engineering retainers that include active telemetry monitoring, zero-downtime database maintenance, security patching, dependency upgrades, and rapid incident response (under 1 hour for critical production incidents). We also offer continuous feature iteration sprints as your user demands evolve.",
    category: "sla",
    sortOrder: 6,
  },
];

// ============================================================================
// Cached High-Performance Public Readers
// ============================================================================

export const getPublishedHeroSettings = unstable_cache(
  async (): Promise<PublicHeroSettings> => {
    try {
      const supabase = getPublicSupabase();
      const { data, error } = await supabase
        .from("cms_site_settings")
        .select("value")
        .eq("key", "hero_content")
        .maybeSingle();

      if (!error && data?.value && typeof data.value === "object") {
        const val = data.value as Record<string, string>;
        return {
          badgeText: val.badge_text || defaultHeroSettings.badgeText,
          title: val.title || defaultHeroSettings.title,
          lead: val.lead || defaultHeroSettings.lead,
          primaryCtaLabel: val.primary_cta_label || defaultHeroSettings.primaryCtaLabel,
          primaryCtaUrl: val.primary_cta_url || defaultHeroSettings.primaryCtaUrl,
          secondaryCtaLabel: val.secondary_cta_label || defaultHeroSettings.secondaryCtaLabel,
          secondaryCtaUrl: val.secondary_cta_url || defaultHeroSettings.secondaryCtaUrl,
        };
      }
    } catch {
      // Return authentic fallback on error
    }
    return defaultHeroSettings;
  },
  ["cms-hero-settings"],
  { tags: ["cms-public", "cms-hero-settings"], revalidate: 3600 }
);

export const getPublishedHeroSlides = unstable_cache(
  async (): Promise<PublicHeroSlide[]> => {
    try {
      const supabase = getPublicSupabase();
      const { data, error } = await supabase
        .from("cms_hero_slides")
        .select("*")
        .eq("status", "published")
        .order("sort_order", { ascending: true });

      if (!error && data && data.length > 0) {
        return data.map((item) => ({
          id: item.id,
          title: item.title,
          label: item.label,
          tagline: item.tagline,
          imageUrl: item.image_url,
          altText: item.alt_text,
          linkUrl: item.link_url,
          sortOrder: item.sort_order,
          isFeatured: Boolean(item.is_featured),
        }));
      }
    } catch {
      // Fallback
    }
    return defaultHeroSlides;
  },
  ["cms-hero-slides"],
  { tags: ["cms-public", "cms-hero-slides"], revalidate: 3600 }
);

export const getPublishedCapabilities = unstable_cache(
  async (): Promise<PublicCapability[]> => {
    try {
      const supabase = getPublicSupabase();
      const { data, error } = await supabase
        .from("cms_capabilities")
        .select("*")
        .eq("status", "published")
        .order("sort_order", { ascending: true });

      if (!error && data && data.length > 0) {
        return data.map((c) => ({
          id: c.id,
          slug: c.slug,
          numberLabel: c.number_label,
          title: c.title,
          headline: c.headline,
          description: c.description,
          iconName: c.icon_name,
          deliverables: c.deliverables || [],
          technologies: c.technologies || [],
          serviceSlug: c.service_slug,
          sortOrder: c.sort_order,
        }));
      }
    } catch {
      // Fallback
    }
    return defaultCapabilities;
  },
  ["cms-capabilities"],
  { tags: ["cms-public", "cms-capabilities"], revalidate: 3600 }
);

export const getPublishedProcessSteps = unstable_cache(
  async (): Promise<PublicProcessStep[]> => {
    try {
      const supabase = getPublicSupabase();
      const { data, error } = await supabase
        .from("cms_process_steps")
        .select("*")
        .eq("status", "published")
        .order("sort_order", { ascending: true });

      if (!error && data && data.length > 0) {
        return data.map((s) => ({
          id: s.id,
          stepNumber: s.step_number,
          phaseName: s.phase_name,
          name: s.name,
          duration: s.duration,
          iconName: s.icon_name,
          summary: s.summary,
          deliverables: s.deliverables || [],
          qualityGate: s.quality_gate,
          sortOrder: s.sort_order,
        }));
      }
    } catch {
      // Fallback
    }
    return defaultProcessSteps;
  },
  ["cms-process-steps"],
  { tags: ["cms-public", "cms-process-steps"], revalidate: 3600 }
);

export const getPublishedIndustries = unstable_cache(
  async (): Promise<PublicIndustry[]> => {
    try {
      const supabase = getPublicSupabase();
      const { data, error } = await supabase
        .from("cms_industries")
        .select("*")
        .eq("status", "published")
        .order("sort_order", { ascending: true });

      if (!error && data && data.length > 0) {
        return data.map((ind) => ({
          id: ind.id,
          slug: ind.slug,
          title: ind.title,
          accent: ind.accent,
          iconName: ind.icon_name,
          challenge: ind.challenge,
          solution: ind.solution,
          complianceTags: ind.compliance_tags || [],
          metrics: ind.metrics,
          sortOrder: ind.sort_order,
        }));
      }
    } catch {
      // Fallback
    }
    return defaultIndustries;
  },
  ["cms-industries"],
  { tags: ["cms-public", "cms-industries"], revalidate: 3600 }
);

export const getPublishedTechStack = unstable_cache(
  async (): Promise<PublicTechItem[]> => {
    try {
      const supabase = getPublicSupabase();
      const { data, error } = await supabase
        .from("cms_tech_stack")
        .select("*")
        .eq("status", "published")
        .order("sort_order", { ascending: true });

      if (!error && data && data.length > 0) {
        return data.map((t) => ({
          id: t.id,
          category: t.category,
          name: t.name,
          role: t.role,
          iconName: t.icon_name,
          sortOrder: t.sort_order,
        }));
      }
    } catch {
      // Fallback
    }
    return [];
  },
  ["cms-tech-stack"],
  { tags: ["cms-public", "cms-tech-stack"], revalidate: 3600 }
);

export const getPublishedFaqs = unstable_cache(
  async (): Promise<PublicFaq[]> => {
    try {
      const supabase = getPublicSupabase();
      const { data, error } = await supabase
        .from("cms_faqs")
        .select("*")
        .eq("status", "published")
        .order("sort_order", { ascending: true });

      if (!error && data && data.length > 0) {
        return data.map((f) => ({
          id: f.id,
          question: f.question,
          answer: f.answer,
          category: f.category,
          sortOrder: f.sort_order,
        }));
      }
    } catch {
      // Fallback
    }
    return defaultFaqs;
  },
  ["cms-faqs"],
  { tags: ["cms-public", "cms-faqs"], revalidate: 3600 }
);

export const getPublishedArticles = unstable_cache(
  async (): Promise<PublicArticle[]> => {
    try {
      const supabase = getPublicSupabase();
      const { data, error } = await supabase
        .from("cms_posts")
        .select("slug, title, excerpt, content, reading_time, category_id, cms_categories(name)")
        .eq("status", "published")
        .order("published_at", { ascending: false });

      if (error || !data || data.length === 0) {
        return [...articles];
      }

      return data.map((item) => {
        const categoryName = (item.cms_categories as { name?: string } | null)?.name ?? "Engineering";
        const paragraphs = item.content ? item.content.split("\n\n").filter(Boolean) : [item.excerpt];
        return {
          slug: item.slug,
          title: item.title,
          excerpt: item.excerpt,
          category: categoryName,
          readingTime: item.reading_time || "5 min read",
          body: paragraphs,
        };
      });
    } catch {
      return [...articles];
    }
  },
  ["cms-articles"],
  { tags: ["cms-public", "cms-posts"], revalidate: 3600 }
);

export async function getPublishedArticleBySlug(slug: string): Promise<PublicArticle | null> {
  const allArticles = await getPublishedArticles();
  const matched = allArticles.find((a) => a.slug === slug);
  return matched || null;
}

export const getPublishedCaseStudies = unstable_cache(
  async (): Promise<PortfolioProject[]> => {
    try {
      const supabase = getPublicSupabase();
      const { data, error } = await supabase
        .from("cms_case_studies")
        .select("*")
        .eq("status", "published")
        .order("sort_order", { ascending: true });

      if (error || !data || data.length === 0) {
        return [...portfolioProjects];
      }

      return data.map((item) => ({
        slug: item.slug,
        title: item.title,
        category: item.category,
        industry: item.industry,
        summary: item.summary,
        description: item.challenge && item.solution ? `${item.challenge}\n\n${item.solution}` : item.summary,
        client: item.client_name,
        timeline: item.timeline || "12 weeks",
        technologies: item.technologies || [],
        deliverables: item.deliverables || [],
        results: item.results || [],
        challenge: item.challenge,
        solution: item.solution,
        coverImageUrl: item.cover_image_url,
        featured: Boolean(item.featured),
      }));
    } catch {
      return [...portfolioProjects];
    }
  },
  ["cms-case-studies"],
  { tags: ["cms-public", "cms-case-studies"], revalidate: 3600 }
);

export async function getPublishedCaseStudyBySlug(slug: string): Promise<PortfolioProject | null> {
  const allProjects = await getPublishedCaseStudies();
  const matched = allProjects.find((p) => p.slug === slug);
  return matched || null;
}

export const getPublishedPageBySlug = unstable_cache(
  async (slug: string): Promise<PublicPage | null> => {
    try {
      const supabase = getPublicSupabase();
      const { data, error } = await supabase
        .from("cms_pages")
        .select("slug, title, content, seo_title, seo_description, published_at")
        .eq("slug", slug)
        .eq("status", "published")
        .maybeSingle();

      if (!error && data) {
        return data as PublicPage;
      }
    } catch {
      // Fallback
    }
    return null;
  },
  ["cms-page-by-slug"],
  { tags: ["cms-public", "cms-pages"], revalidate: 3600 }
);

export const getPublishedServices = unstable_cache(
  async (): Promise<PublicService[]> => {
    try {
      const supabase = getPublicSupabase();
      const { data, error } = await supabase
        .from("cms_services")
        .select("*")
        .eq("status", "published")
        .order("sort_order", { ascending: true });

      if (!error && data && data.length > 0) {
        return data.map((item) => ({
          slug: item.slug,
          title: item.title,
          short: item.short_description,
          description: item.full_description,
          iconName: item.icon_name || "Code2",
          features: item.features || [],
          ctaLabel: item.cta_label || "Start a Project",
          ctaUrl: item.cta_url || "/contact",
        }));
      }
    } catch {
      // Fallback
    }

    return services.map((s) => ({
      slug: s.slug,
      title: s.title,
      short: s.short,
      description: s.description,
    }));
  },
  ["cms-services"],
  { tags: ["cms-public", "cms-services"], revalidate: 3600 }
);

export async function getPublishedServiceBySlug(slug: string): Promise<PublicService | null> {
  const allServices = await getPublishedServices();
  const matched = allServices.find((s) => s.slug === slug);
  return matched || null;
}

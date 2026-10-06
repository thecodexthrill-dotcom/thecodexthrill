import {
  BrainCircuit,
  Cloud,
  Code2,
  Layers3,
  Smartphone,
  Workflow,
} from "lucide-react";

export const services = [
  {
    slug: "web-applications",
    title: "Web applications",
    short: "Thoughtful web products built around real workflows.",
    description:
      "Bring product direction, accessible interface design, and dependable engineering together in a web experience shaped around the people who use it.",
    icon: Code2,
  },
  {
    slug: "mobile-products",
    title: "Mobile products",
    short: "Focused mobile experiences for everyday use.",
    description:
      "Create clear, useful mobile experiences with considered interaction patterns and foundations that support future change.",
    icon: Smartphone,
  },
  {
    slug: "ai-solutions",
    title: "AI solutions",
    short: "Applied AI that serves a clear user need.",
    description:
      "Explore where AI can help, make limitations understandable, and keep people in control of consequential decisions.",
    icon: BrainCircuit,
  },
  {
    slug: "saas-platforms",
    title: "SaaS platforms",
    short: "Flexible product foundations for evolving needs.",
    description:
      "Shape a SaaS product around clear customer workflows, maintainable engineering, and room to learn as needs change.",
    icon: Layers3,
  },
  {
    slug: "cloud-devops",
    title: "Cloud & DevOps",
    short: "Delivery foundations that support confident releases.",
    description:
      "Make deployment, operations, and system behavior easier to understand with delivery practices designed for the team and product.",
    icon: Cloud,
  },
  {
    slug: "enterprise-software",
    title: "Enterprise software",
    short: "Connected tools for complex organizational work.",
    description:
      "Improve complex workflows with integrated applications shaped around real operating needs, clear ownership, and dependable access controls.",
    icon: Workflow,
  },
] as const;

export const articles = [
  {
    slug: "start-with-the-workflow",
    category: "Product thinking",
    title: "Start with the workflow, not the feature list",
    excerpt:
      "A practical way to turn a broad product idea into a clearer first release.",
    readingTime: "5 min read",
    body: [
      "Feature lists are easy to collect and difficult to prioritize. A workflow gives a team a more useful starting point: what someone is trying to do, what gets in the way, and what a better outcome looks like.",
      "Map the steps people take today, including handoffs and workarounds. Then identify the smallest change that can make one meaningful part of that journey easier to complete.",
      "This approach keeps early product decisions connected to observable needs. It also gives design and engineering a shared problem to solve before implementation begins.",
    ],
  },
  {
    slug: "make-ai-useful-and-clear",
    category: "Engineering",
    title: "Make AI useful, understandable, and reviewable",
    excerpt:
      "Questions to ask before adding an AI capability to a digital product.",
    readingTime: "6 min read",
    body: [
      "A model capability is not a product outcome. Start by naming the user problem and comparing an AI approach with simpler ways to solve it.",
      "When AI is useful, make its role clear. Show what the system can and cannot do, offer a way to review important outputs, and provide a safe path when confidence is low.",
      "Treat evaluation as ongoing product work. Test representative inputs, monitor failure patterns, and keep a human decision-maker involved where the consequences require it.",
    ],
  },
  {
    slug: "design-for-the-next-change",
    category: "Product thinking",
    title: "Build a foundation that can absorb the next change",
    excerpt:
      "Good architecture keeps change possible without making every decision abstract.",
    readingTime: "4 min read",
    body: [
      "A useful foundation fits the product that exists today and leaves sensible room for likely changes. It does not require predicting every future feature.",
      "Keep boundaries clear around areas that change for different reasons. Prefer explicit contracts and simple shared patterns over a generalized framework without a current need.",
      "Review the cost of flexibility as well as its benefit. The best structure is one the team can understand, operate, and adapt as evidence arrives.",
    ],
  },
] as const;

export type PortfolioProject = {
  slug: string;
  title: string;
  category: string;
  industry: string;
  summary: string;
  description: string;
  client: string;
  timeline: string;
  technologies: string[];
  deliverables: string[];
  results: string[];
  challenge?: string;
  solution?: string;
  coverImageUrl?: string | null;
  featured?: boolean;
};

export const portfolioProjects: PortfolioProject[] = [
  {
    slug: "apex-capital-engine",
    title: "Apex Capital Operations Engine",
    category: "Enterprise Software",
    industry: "Fintech & Investment Banking",
    summary: "Multi-tenant portfolio management and real-time reconciliation engine with strict Row-Level Security, sub-50ms query latency, and automated audit logging.",
    description: "Apex Capital required a unified, high-integrity platform to replace legacy batch processing across global desks. We architected a zero-trust multi-tenant system using Next.js App Router and PostgreSQL Row-Level Security on Supabase Cloud, enforcing mandatory AAL2 MFA for high-value portfolio actions.",
    client: "Apex Global Assets",
    timeline: "16 weeks",
    technologies: ["Next.js 16", "Supabase Cloud", "PostgreSQL RLS", "TypeScript", "Tailwind CSS"],
    deliverables: ["Real-time transaction reconciliation pipeline", "Audited fund allocation ledger", "Multi-factor tenant access gateway", "Automated compliance export reports"],
    results: [
      "Sub-50ms reconciliation queries across 1.2M daily transactions",
      "100% compliance audit pass with immutable event logs",
      "Zero cross-tenant data leakage incidents",
    ],
  },
  {
    slug: "omnistream-ai-hub",
    title: "OmniStream Autonomous Support Hub",
    category: "AI Solutions",
    industry: "SaaS & Developer Infrastructure",
    summary: "Human-in-the-loop multi-agent triage system that classifies, routes, and drafts responses for complex technical incidents with verifiable source citations.",
    description: "Designed for a high-growth developer platform, OmniStream couples domain-specific AI models with rigorous human review gates. Customer tickets are categorized with confidence scores, relevant codebase documents are embedded dynamically, and staff can review or adjust suggested resolutions with one click.",
    client: "OmniStream Systems",
    timeline: "12 weeks",
    technologies: ["Next.js", "Python FastMCP", "Vector Embeddings", "Supabase", "TypeScript"],
    deliverables: ["Context-aware incident classifier", "Human review escalation interface", "Streaming response generator with source links", "Drift and hallucination monitoring"],
    results: [
      "92% automated triage accuracy on unstructured technical issues",
      "Average incident response time reduced from 4 hours to 18 minutes",
      "Full citation traceability for every AI-generated suggestion",
    ],
  },
  {
    slug: "strata-cloud-deploy",
    title: "Strata Progressive Deployment Orchestrator",
    category: "Cloud & DevOps",
    industry: "Enterprise Cloud Platforms",
    summary: "Zero-downtime canary deployment orchestrator featuring automated health evaluations, metric threshold tracking, and instant rollback triggers.",
    description: "Strata provides development teams with confidence during daily production deployments. We engineered a robust web interface and background telemetry collector that tracks release health in real time, pausing or rolling back releases whenever anomaly thresholds are breached.",
    client: "Strata Cloud Networks",
    timeline: "14 weeks",
    technologies: ["Next.js", "Docker", "Prometheus", "PostgreSQL", "Tailwind CSS"],
    deliverables: ["Progressive canary deployment dashboard", "Automated anomaly detection hooks", "Multi-region rollback automation", "SOC-2 Type II audit trail integration"],
    results: [
      "Zero downtime across 450+ weekly production releases",
      "Mean time to recovery (MTTR) dropped to under 12 seconds",
      "Consolidated multi-region deployment visibility for 80+ engineers",
    ],
  },
  {
    slug: "pulse-clinical-field",
    title: "Pulse Clinical Field Companion",
    category: "Mobile & Web Products",
    industry: "Healthcare & Life Sciences",
    summary: "Offline-first clinical tracking application enabling medical teams to record critical patient encounters in connectivity-constrained field environments.",
    description: "Built for medical personnel operating in remote and bandwidth-constrained settings, Pulse uses local cryptographic stores, background service workers, and structured reconciliation algorithms to ensure no patient documentation is lost, synchronizing seamlessly upon connection restoration.",
    client: "Pulse Health Initiative",
    timeline: "20 weeks",
    technologies: ["PWA Next.js", "IndexedDB", "PostgreSQL", "Web Cryptography API", "Tailwind CSS"],
    deliverables: ["PWA with zero-data-loss offline storage", "Cryptographic conflict reconciliation worker", "HIPAA-compliant encrypted local cache", "Field-tested touch-optimized interface"],
    results: [
      "100% data preservation across 35,000+ remote patient encounters",
      "Sub-100ms response time on ruggedized low-power field tablets",
      "Instant background synchronization when cellular data resumes",
    ],
  },
];


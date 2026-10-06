import { Shield, Database, Smartphone, Sparkles } from "lucide-react";
import type { PublicTechItem } from "@/lib/cms-public";
import { ScrollReveal } from "@/components/ui/scroll-reveal";

export type TechGroup = {
  category: string;
  icon: React.ComponentType<any>;
  technologies: { name: string; role: string }[];
};

export const defaultTechMatrix: TechGroup[] = [
  {
    category: "Frontend & User Interface",
    icon: LayoutGridIcon,
    technologies: [
      { name: "Next.js App Router (v16)", role: "Server Components, streaming, incremental static regeneration (ISR)" },
      { name: "React 19", role: "Actions, concurrent features, modern server-side rendering" },
      { name: "TypeScript 5.x", role: "Strict type enforcement across client and server boundaries" },
      { name: "Tailwind CSS", role: "Utility-first design system with zero runtime CSS overhead" },
      { name: "Turbopack", role: "Blazing-fast incremental builds and local developer feedback loop" },
    ],
  },
  {
    category: "Backend, Database & Storage",
    icon: Database,
    technologies: [
      { name: "PostgreSQL", role: "Relational data integrity, ACID transactions, complex joins" },
      { name: "Supabase Cloud", role: "Managed enterprise database with instant auth, storage, and RLS" },
      { name: "Row-Level Security (RLS)", role: "Cryptographic data isolation at the database engine level" },
      { name: "Next.js Server Actions", role: "Secure RPC with server-side validation and CSRF mitigation" },
      { name: "Zod Schema Validation", role: "Runtime contract validation on every client-to-server payload" },
    ],
  },
  {
    category: "Applied AI, Vector & Agents",
    icon: Sparkles,
    technologies: [
      { name: "pgvector Extension", role: "Native vector similarity search directly within PostgreSQL" },
      { name: "FastMCP Protocol", role: "Model Context Protocol servers for secure tool invocation" },
      { name: "Claude & OpenAI APIs", role: "High-reasoning LLMs integrated with prompt evaluation gates" },
      { name: "Python Agent Frameworks", role: "Deterministic orchestration, multi-agent evaluation, citations" },
      { name: "Embeddings Pipelines", role: "Chunking, token optimization, and semantic vector indexing" },
    ],
  },
  {
    category: "Mobile, Offline & Edge",
    icon: Smartphone,
    technologies: [
      { name: "Progressive Web App (PWA)", role: "Installable cross-platform app with native-like ergonomics" },
      { name: "Service Workers", role: "Background caching, network interception, and resource hydration" },
      { name: "IndexedDB Storage", role: "Zero-data-loss local persistence for offline field encounters" },
      { name: "Web Cryptography API", role: "Client-side encryption of sensitive offline biometric/health records" },
      { name: "Vercel Edge Network", role: "Global low-latency DNS routing and geo-distributed compute" },
    ],
  },
  {
    category: "Security, Auth & DevSecOps",
    icon: Shield,
    technologies: [
      { name: "AAL2 Multi-Factor Auth", role: "Authenticator TOTP & WebAuthn biometric security gates" },
      { name: "GitHub Actions CI/CD", role: "Automated linting, type-checking, unit, and regression testing" },
      { name: "Docker Containerization", role: "Deterministic builds and isolated execution environments" },
      { name: "Declarative Migrations", role: "Version-controlled, reversible schema changes with Supabase CLI" },
      { name: "Strict CSP & CORS", role: "Zero inline scripts, strict frame-ancestors, defense in depth" },
    ],
  },
];

function LayoutGridIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect width="7" height="7" x="3" y="3" rx="1" />
      <rect width="7" height="7" x="14" y="3" rx="1" />
      <rect width="7" height="7" x="14" y="14" rx="1" />
      <rect width="7" height="7" x="3" y="14" rx="1" />
    </svg>
  );
}

const categoryIconMap: Record<string, React.ComponentType<any>> = {
  "Frontend & User Interface": LayoutGridIcon,
  "Backend, Database & Storage": Database,
  "Applied AI, Vector & Agents": Sparkles,
  "Mobile, Offline & Edge": Smartphone,
  "Security, Auth & DevSecOps": Shield,
};

export function TechStackMatrix({
  items,
}: {
  items?: PublicTechItem[];
}) {
  let displayGroups: TechGroup[] = defaultTechMatrix;

  if (items && items.length > 0) {
    const grouped = items.reduce<Record<string, { name: string; role: string }[]>>((acc, item) => {
      if (!acc[item.category]) acc[item.category] = [];
      acc[item.category].push({ name: item.name, role: item.role });
      return acc;
    }, {});

    displayGroups = Object.entries(grouped).map(([category, technologies]) => ({
      category,
      icon: categoryIconMap[category] || LayoutGridIcon,
      technologies,
    }));
  }

  return (
    <section aria-labelledby="tech-matrix-title" className="section-tech-matrix">
      <div className="container-shell">
        <ScrollReveal variant="fade-up">
          <div className="tech-matrix-header">
            <div>
              <p className="eyebrow">
                <span />
                Technical Arsenal
              </p>
              <h2 id="tech-matrix-title">
                Battle-Tested Technologies. <em>No Ephemeral Trends.</em>
              </h2>
            </div>
            <p className="tech-matrix-sub">
              We select tools based on resilience, maintainability, community velocity, and security pedigree. Our engineering stack is optimized for decades of reliable service, not marketing buzzwords.
            </p>
          </div>
        </ScrollReveal>

        <div className="tech-matrix-grid">
          {displayGroups.map((group, idx) => {
            const Icon = group.icon;
            return (
              <ScrollReveal
                key={group.category}
                variant="fade-up"
                delayMs={Math.min(idx * 75, 300)}
              >
                <div className="tech-category-card">
                  <div className="tech-category-top">
                    <div className="tech-category-icon">
                      <Icon aria-hidden="true" width={18} height={18} />
                    </div>
                    <h3>{group.category}</h3>
                  </div>

                  <div className="tech-item-list">
                    {group.technologies.map((t) => (
                      <div className="tech-item" key={t.name}>
                        <div className="tech-name-row">
                          <span className="tech-name">{t.name}</span>
                        </div>
                        <p className="tech-role">{t.role}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </ScrollReveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

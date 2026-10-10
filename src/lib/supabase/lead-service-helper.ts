export const AVAILABLE_SERVICES = [
  { slug: "web-applications", title: "Web Applications" },
  { slug: "mobile-products", title: "Mobile Products" },
  { slug: "ai-solutions", title: "AI Solutions" },
  { slug: "saas-platforms", title: "SaaS Platforms" },
  { slug: "cloud-devops", title: "Cloud & DevOps" },
  { slug: "enterprise-software", title: "Enterprise Software" },
  { slug: "custom-architecture", title: "Custom Architecture / Advisory" },
] as const;

export function extractLeadService(message?: string | null): {
  requestedService: string;
  notes: string;
} {
  if (!message) {
    return { requestedService: "General Technical Inquiry", notes: "" };
  }

  const match = message.match(/^\[Requested Service:\s*([^\]]+)\]\s*\n*/i);
  if (match) {
    const rawService = match[1].trim();
    const cleanNotes = message.replace(match[0], "").trim();
    return {
      requestedService: rawService || "General Technical Inquiry",
      notes: cleanNotes,
    };
  }

  // Fallback pattern matching for [Service: ...]
  const altMatch = message.match(/^\[Service:\s*([^\]]+)\]\s*\n*/i);
  if (altMatch) {
    const rawService = altMatch[1].trim();
    const cleanNotes = message.replace(altMatch[0], "").trim();
    return {
      requestedService: rawService || "General Technical Inquiry",
      notes: cleanNotes,
    };
  }

  return {
    requestedService: "General Technical Inquiry",
    notes: message.trim(),
  };
}

export function formatLeadMessage(
  service: string | undefined | null,
  message: string,
): string {
  const trimmed = message.trim();
  if (!service || service === "General Technical Inquiry") {
    return trimmed;
  }
  return `[Requested Service: ${service.trim()}]\n\n${trimmed}`;
}

export function getLeadFollowUpStatus(followUpAt?: string | null): {
  status: "none" | "scheduled" | "overdue";
  label: string;
} {
  if (!followUpAt) {
    return { status: "none", label: "None scheduled" };
  }

  const target = new Date(followUpAt);
  const now = new Date();

  if (target < now) {
    return {
      status: "overdue",
      label: `Overdue (${target.toLocaleDateString()})`,
    };
  }

  return {
    status: "scheduled",
    label: target.toLocaleDateString(),
  };
}


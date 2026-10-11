import {
  classifyInvoiceLifecycleStatus,
  parseInvoiceItems,
} from "./delivery-operations-helper.ts";
import {
  type AutomationAuditRecord,
  type AutomationJobHealthSummary,
  type PlatformIntegrationStatus,
  evaluateAutomationJobHealth,
} from "./platform-health-helper.ts";

// ============================================================================
// 1. Input Record Types for Executive Analytics
// ============================================================================

export type AnalyticsPeriodPreset =
  | "7d"
  | "30d"
  | "90d"
  | "365d"
  | "all"
  | "custom";

export type AnalyticsLeadRecord = {
  id?: string;
  stage: string;
  source?: string | null;
  follow_up_at?: string | null;
  created_at: string;
};

export type AnalyticsOrgRecord = {
  id?: string;
  name?: string;
  status: string;
  created_at: string;
};

export type AnalyticsMembershipRecord = {
  organization_id: string;
  user_id?: string | null;
  status: string;
  role?: string | null;
  created_at?: string | null;
};

export type AnalyticsProjectRecord = {
  id?: string;
  organization_id?: string;
  name?: string;
  status: string;
  progress_pct: number;
  target_date?: string | null;
  created_at: string;
};

export type AnalyticsTaskRecord = {
  id?: string;
  project_id?: string;
  organization_id?: string;
  title?: string;
  status: string;
  priority: string;
  assigned_to?: string | null;
  due_date?: string | null;
  created_at: string;
};

export type AnalyticsInvoiceRecord = {
  id?: string;
  organization_id?: string;
  invoice_number?: string;
  amount_cents: number;
  status: string;
  currency: string;
  due_date: string | null;
  paid_at: string | null;
  created_at: string;
  items?: unknown;
};

export type AnalyticsTicketRecord = {
  id?: string;
  ticket_number?: string;
  title?: string;
  status: string;
  priority: string;
  category: string;
  assigned_to?: string | null;
  resolved_at?: string | null;
  created_at: string;
};

export type AnalyticsInvitationRecord = {
  id?: string;
  role: string;
  status: string;
  created_at: string;
  expires_at: string;
  archived_at?: string | null;
};

export type AnalyticsNotificationRecord = {
  id?: string;
  type: string;
  is_read: boolean;
  created_at: string;
};

export type ExecutiveAnalyticsDataset = {
  leads: AnalyticsLeadRecord[] | null;
  organizations: AnalyticsOrgRecord[] | null;
  memberships?: AnalyticsMembershipRecord[] | null;
  staffCount: number | null;
  pendingInvitesCount: number | null;
  invitations?: AnalyticsInvitationRecord[] | null;
  projects: AnalyticsProjectRecord[] | null;
  tasks: AnalyticsTaskRecord[] | null;
  invoices: AnalyticsInvoiceRecord[] | null;
  tickets: AnalyticsTicketRecord[] | null;
  automationAuditEvents?: AutomationAuditRecord[] | null;
  notifications?: AnalyticsNotificationRecord[] | null;
  integrationStatus?: PlatformIntegrationStatus;
  queryErrors?: string[];
};

// ============================================================================
// 2. Date-Range Boundaries & Period Comparisons
// ============================================================================

export type ResolvedDateWindow = {
  preset: AnalyticsPeriodPreset;
  label: string;
  currentStart: Date | null;
  currentEnd: Date;
  previousStart: Date | null;
  previousEnd: Date | null;
  durationDays: number | null;
  bucketGranularity: "day" | "week" | "month";
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function parseUtcDateBoundary(
  dateStr: string | null | undefined,
  boundary: "start" | "end",
): Date | null {
  if (!dateStr || typeof dateStr !== "string") return null;
  const trimmed = dateStr.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const parsed = new Date(trimmed);
    return Number.isFinite(parsed.getTime()) ? parsed : null;
  }
  const iso =
    boundary === "start"
      ? `${trimmed}T00:00:00.000Z`
      : `${trimmed}T23:59:59.999Z`;
  const parsed = new Date(iso);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

export function resolveAnalyticsDateWindow(params: {
  preset: AnalyticsPeriodPreset;
  customStart?: string | null;
  customEnd?: string | null;
  now?: Date;
}): ResolvedDateWindow {
  const now = params.now ?? new Date();
  const todayUtcEnd = new Date(
    `${now.toISOString().slice(0, 10)}T23:59:59.999Z`,
  );

  if (params.preset === "all") {
    return {
      preset: "all",
      label: "All Time",
      currentStart: null,
      currentEnd: todayUtcEnd,
      previousStart: null,
      previousEnd: null,
      durationDays: null,
      bucketGranularity: "month",
    };
  }

  if (params.preset === "custom") {
    let start = parseUtcDateBoundary(params.customStart, "start");
    let end = parseUtcDateBoundary(params.customEnd, "end");

    if (!start && !end) {
      start = new Date(todayUtcEnd.getTime() - 30 * DAY_MS + 1);
      end = todayUtcEnd;
    } else if (start && !end) {
      end = todayUtcEnd;
    } else if (!start && end) {
      start = new Date(end.getTime() - 30 * DAY_MS + 1);
    }

    if (start && end && start.getTime() > end.getTime()) {
      const tmp = start;
      start = new Date(
        `${end.toISOString().slice(0, 10)}T00:00:00.000Z`,
      );
      end = new Date(
        `${tmp.toISOString().slice(0, 10)}T23:59:59.999Z`,
      );
    }

    const validStart = start ?? new Date(todayUtcEnd.getTime() - 30 * DAY_MS + 1);
    const validEnd = end ?? todayUtcEnd;
    const spanMs = Math.max(DAY_MS, validEnd.getTime() - validStart.getTime());
    const durationDays = Math.max(1, Math.round(spanMs / DAY_MS));
    const previousEnd = new Date(validStart.getTime() - 1);
    const previousStart = new Date(previousEnd.getTime() - spanMs);

    return {
      preset: "custom",
      label: `${validStart.toISOString().slice(0, 10)} to ${validEnd.toISOString().slice(0, 10)}`,
      currentStart: validStart,
      currentEnd: validEnd,
      previousStart,
      previousEnd,
      durationDays,
      bucketGranularity:
        durationDays <= 14 ? "day" : durationDays <= 90 ? "week" : "month",
    };
  }

  const daysMap: Record<Exclude<AnalyticsPeriodPreset, "all" | "custom">, number> = {
    "7d": 7,
    "30d": 30,
    "90d": 90,
    "365d": 365,
  };
  const labelMap: Record<Exclude<AnalyticsPeriodPreset, "all" | "custom">, string> = {
    "7d": "Last 7 Days",
    "30d": "Last 30 Days",
    "90d": "Last 90 Days",
    "365d": "Last 12 Months",
  };

  const days = daysMap[params.preset] ?? 30;
  const spanMs = days * DAY_MS;
  const currentStart = new Date(todayUtcEnd.getTime() - spanMs + 1);
  const previousEnd = new Date(currentStart.getTime() - 1);
  const previousStart = new Date(currentStart.getTime() - spanMs);

  return {
    preset: params.preset,
    label: labelMap[params.preset] ?? `Last ${days} Days`,
    currentStart,
    currentEnd: todayUtcEnd,
    previousStart,
    previousEnd,
    durationDays: days,
    bucketGranularity:
      days <= 14 ? "day" : days <= 90 ? "week" : "month",
  };
}

export function isTimestampInRange(
  isoString: string | null | undefined,
  start: Date | null,
  end: Date | null,
): boolean {
  if (!isoString) return false;
  const ms = new Date(isoString).getTime();
  if (!Number.isFinite(ms)) return false;
  if (start && ms < start.getTime()) return false;
  if (end && ms > end.getTime()) return false;
  return true;
}

export function filterRecordsByWindow<T>(
  items: T[] | null,
  getTimestamp: (item: T) => string | null | undefined,
  start: Date | null,
  end: Date | null,
): T[] | null {
  if (items === null) return null;
  if (!start && !end) return items;
  return items.filter((item) =>
    isTimestampInRange(getTimestamp(item), start, end),
  );
}

export type PeriodComparisonMetric = {
  current: number | null;
  previous: number | null;
  deltaAbsolute: number | null;
  deltaPct: number | null;
  direction: "up" | "down" | "flat" | "new" | "unavailable";
  label: string;
};

/**
 * Computes period-over-period comparisons safely without dividing by zero
 * or inventing percentages when baseline data is missing.
 */
export function computePeriodComparison(
  current: number | null,
  previous: number | null,
  hasComparisonWindow = true,
): PeriodComparisonMetric {
  if (current === null) {
    return {
      current: null,
      previous: null,
      deltaAbsolute: null,
      deltaPct: null,
      direction: "unavailable",
      label: "Unavailable",
    };
  }

  if (!hasComparisonWindow || previous === null) {
    return {
      current,
      previous: null,
      deltaAbsolute: null,
      deltaPct: null,
      direction: "unavailable",
      label: "All-time cumulative",
    };
  }

  const deltaAbsolute = current - previous;

  if (previous === 0) {
    if (current === 0) {
      return {
        current,
        previous,
        deltaAbsolute: 0,
        deltaPct: 0,
        direction: "flat",
        label: "0% vs prior period",
      };
    }
    return {
      current,
      previous,
      deltaAbsolute,
      deltaPct: null,
      direction: "new",
      label: `+${current} (0 in prior period)`,
    };
  }

  const deltaPct = Math.round((deltaAbsolute / previous) * 100);
  const direction =
    deltaAbsolute > 0 ? "up" : deltaAbsolute < 0 ? "down" : "flat";
  const sign = deltaPct > 0 ? "+" : "";

  return {
    current,
    previous,
    deltaAbsolute,
    deltaPct,
    direction,
    label: `${sign}${deltaPct}% vs prior period`,
  };
}

// ============================================================================
// 3. Consistent Currency Formatting
// ============================================================================

export function formatAnalyticsCurrency(
  cents: number | null | undefined,
  options?: { currency?: string; showCents?: boolean },
): string {
  if (cents === null || cents === undefined || !Number.isFinite(cents)) {
    return "Unavailable";
  }
  const currency =
    options?.currency && /^[A-Z]{3}$/i.test(options.currency.trim())
      ? options.currency.trim().toUpperCase()
      : "USD";
  const showCents = options?.showCents ?? false;

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: showCents ? 2 : 0,
    maximumFractionDigits: showCents ? 2 : 0,
  }).format(cents / 100);
}

// ============================================================================
// 4. Time-Series Bucketing Helper
// ============================================================================

export type TimeBucket = {
  key: string;
  label: string;
  startMs: number;
  endMs: number;
};

export function buildTimeBuckets(
  window: ResolvedDateWindow,
  earliestRecordDate?: Date | null,
): TimeBucket[] {
  const end = window.currentEnd;
  const endMs = end.getTime();

  if (window.bucketGranularity === "day") {
    const days = Math.min(14, Math.max(1, window.durationDays ?? 7));
    const buckets: TimeBucket[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const dayEndMs = endMs - i * DAY_MS;
      const dayStartMs = dayEndMs - DAY_MS + 1;
      const dateIso = new Date(dayEndMs).toISOString().slice(0, 10);
      buckets.push({
        key: dateIso,
        label: dateIso.slice(5), // MM-DD
        startMs: dayStartMs,
        endMs: dayEndMs,
      });
    }
    return buckets;
  }

  if (window.bucketGranularity === "week") {
    const totalDays = window.durationDays ?? 30;
    const weekCount = Math.min(13, Math.max(4, Math.ceil(totalDays / 7)));
    const bucketSpanMs = Math.ceil((totalDays * DAY_MS) / weekCount);
    const buckets: TimeBucket[] = [];
    for (let i = weekCount - 1; i >= 0; i--) {
      const bEndMs = endMs - i * bucketSpanMs;
      const bStartMs = bEndMs - bucketSpanMs + 1;
      const startIso = new Date(bStartMs).toISOString().slice(5, 10);
      const endIso = new Date(bEndMs).toISOString().slice(5, 10);
      buckets.push({
        key: `${new Date(bStartMs).toISOString().slice(0, 10)}_${new Date(bEndMs).toISOString().slice(0, 10)}`,
        label: `${startIso}–${endIso}`,
        startMs: bStartMs,
        endMs: bEndMs,
      });
    }
    return buckets;
  }

  // Monthly buckets (up to 6 or 12 months)
  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  let monthCount = 6;
  if (window.preset === "365d") {
    monthCount = 12;
  } else if (window.preset === "all" && earliestRecordDate) {
    const diffMonths =
      (end.getUTCFullYear() - earliestRecordDate.getUTCFullYear()) * 12 +
      (end.getUTCMonth() - earliestRecordDate.getUTCMonth()) +
      1;
    monthCount = Math.min(12, Math.max(4, diffMonths));
  }

  const buckets: TimeBucket[] = [];
  const endYear = end.getUTCFullYear();
  const endMonth = end.getUTCMonth();

  for (let i = monthCount - 1; i >= 0; i--) {
    const mDate = new Date(Date.UTC(endYear, endMonth - i, 1, 0, 0, 0, 0));
    const nextMDate = new Date(
      Date.UTC(mDate.getUTCFullYear(), mDate.getUTCMonth() + 1, 1, 0, 0, 0, 0),
    );
    const yearStr = String(mDate.getUTCFullYear());
    const monthIdx = mDate.getUTCMonth();
    const monthKey = `${yearStr}-${String(monthIdx + 1).padStart(2, "0")}`;
    buckets.push({
      key: monthKey,
      label: `${monthNames[monthIdx]} '${yearStr.slice(2)}`,
      startMs: mDate.getTime(),
      endMs: nextMDate.getTime() - 1,
    });
  }

  return buckets;
}

// ============================================================================
// 5. CRM Leads, Funnel & Conversion Analytics
// ============================================================================

export type LeadSourceMetric = {
  source: string;
  total: number;
  converted: number;
  qualified: number;
  conversionRatePct: number;
  sharePct: number;
};

export type LeadTrendBucket = {
  key: string;
  label: string;
  newLeads: number;
  convertedLeads: number;
  qualifiedLeads: number;
  conversionRatePct: number | null;
};

export type LeadExecutiveAnalytics = {
  totalLeads: number;
  previousTotalLeads: number | null;
  leadsComparison: PeriodComparisonMetric;
  convertedLeads: number;
  qualifiedLeads: number;
  activePipelineLeads: number;
  conversionRatePct: number | null;
  previousConversionRatePct: number | null;
  stageCounts: {
    new: number;
    contacted: number;
    qualified: number;
    converted: number;
    closed: number;
  };
  sourceBreakdown: LeadSourceMetric[];
  followUpHealth: {
    overdueCount: number;
    upcoming24hCount: number;
    upcoming7dCount: number;
    unscheduledActiveCount: number;
  };
  trendSeries: LeadTrendBucket[];
};

export function computeLeadExecutiveAnalytics(
  leads: AnalyticsLeadRecord[] | null,
  window: ResolvedDateWindow,
  now = new Date(),
): LeadExecutiveAnalytics | null {
  if (leads === null) return null;

  const hasComparison = window.previousStart !== null && window.previousEnd !== null;
  const currentLeads =
    filterRecordsByWindow(
      leads,
      (l) => l.created_at,
      window.currentStart,
      window.currentEnd,
    ) ?? [];
  const previousLeads = hasComparison
    ? (filterRecordsByWindow(
        leads,
        (l) => l.created_at,
        window.previousStart,
        window.previousEnd,
      ) ?? [])
    : null;

  const stageCounts = {
    new: 0,
    contacted: 0,
    qualified: 0,
    converted: 0,
    closed: 0,
  };

  const sourceMap: Record<
    string,
    { total: number; converted: number; qualified: number }
  > = {
    website: { total: 0, converted: 0, qualified: 0 },
    referral: { total: 0, converted: 0, qualified: 0 },
    admin: { total: 0, converted: 0, qualified: 0 },
    import: { total: 0, converted: 0, qualified: 0 },
    other: { total: 0, converted: 0, qualified: 0 },
  };

  for (const lead of currentLeads) {
    if (lead.stage in stageCounts) {
      stageCounts[lead.stage as keyof typeof stageCounts] += 1;
    }
    const rawSource = (lead.source ?? "website").toLowerCase().trim();
    const srcKey = rawSource in sourceMap ? rawSource : "other";
    sourceMap[srcKey].total += 1;
    if (lead.stage === "converted") {
      sourceMap[srcKey].converted += 1;
    }
    if (lead.stage === "qualified" || lead.stage === "converted") {
      sourceMap[srcKey].qualified += 1;
    }
  }

  const totalLeads = currentLeads.length;
  const convertedLeads = stageCounts.converted;
  const qualifiedLeads = stageCounts.qualified;
  const activePipelineLeads =
    stageCounts.new + stageCounts.contacted + stageCounts.qualified;

  const conversionRatePct =
    totalLeads > 0 ? Math.round((convertedLeads / totalLeads) * 100) : null;

  const previousTotalLeads = previousLeads ? previousLeads.length : null;
  const previousConverted = previousLeads
    ? previousLeads.filter((l) => l.stage === "converted").length
    : null;
  const previousConversionRatePct =
    previousTotalLeads !== null &&
    previousTotalLeads > 0 &&
    previousConverted !== null
      ? Math.round((previousConverted / previousTotalLeads) * 100)
      : null;

  const sourceBreakdown: LeadSourceMetric[] = Object.entries(sourceMap).map(
    ([source, stats]) => ({
      source,
      total: stats.total,
      converted: stats.converted,
      qualified: stats.qualified,
      conversionRatePct:
        stats.total > 0 ? Math.round((stats.converted / stats.total) * 100) : 0,
      sharePct:
        totalLeads > 0 ? Math.round((stats.total / totalLeads) * 100) : 0,
    }),
  );

  // Follow-up health across active leads
  const nowMs = now.getTime();
  const next24hMs = nowMs + DAY_MS;
  const next7dMs = nowMs + 7 * DAY_MS;
  let overdueCount = 0;
  let upcoming24hCount = 0;
  let upcoming7dCount = 0;
  let unscheduledActiveCount = 0;

  for (const lead of leads) {
    if (lead.stage === "converted" || lead.stage === "closed") continue;
    if (!lead.follow_up_at) {
      unscheduledActiveCount += 1;
      continue;
    }
    const fMs = new Date(lead.follow_up_at).getTime();
    if (!Number.isFinite(fMs)) {
      unscheduledActiveCount += 1;
      continue;
    }
    if (fMs < nowMs) {
      overdueCount += 1;
    } else if (fMs <= next24hMs) {
      upcoming24hCount += 1;
      upcoming7dCount += 1;
    } else if (fMs <= next7dMs) {
      upcoming7dCount += 1;
    }
  }

  // Earliest date for bucketing
  let earliestMs = Infinity;
  for (const l of currentLeads) {
    const ms = new Date(l.created_at).getTime();
    if (Number.isFinite(ms) && ms < earliestMs) earliestMs = ms;
  }
  const earliestDate = Number.isFinite(earliestMs)
    ? new Date(earliestMs)
    : null;
  const buckets = buildTimeBuckets(window, earliestDate);

  const trendSeries: LeadTrendBucket[] = buckets.map((b) => {
    const inBucket = currentLeads.filter((l) => {
      const ms = new Date(l.created_at).getTime();
      return ms >= b.startMs && ms <= b.endMs;
    });
    const newCount = inBucket.length;
    const convCount = inBucket.filter((l) => l.stage === "converted").length;
    const qualCount = inBucket.filter((l) => l.stage === "qualified").length;
    return {
      key: b.key,
      label: b.label,
      newLeads: newCount,
      convertedLeads: convCount,
      qualifiedLeads: qualCount,
      conversionRatePct:
        newCount > 0 ? Math.round((convCount / newCount) * 100) : null,
    };
  });

  return {
    totalLeads,
    previousTotalLeads,
    leadsComparison: computePeriodComparison(
      totalLeads,
      previousTotalLeads,
      hasComparison,
    ),
    convertedLeads,
    qualifiedLeads,
    activePipelineLeads,
    conversionRatePct,
    previousConversionRatePct,
    stageCounts,
    sourceBreakdown,
    followUpHealth: {
      overdueCount,
      upcoming24hCount,
      upcoming7dCount,
      unscheduledActiveCount,
    },
    trendSeries,
  };
}

// ============================================================================
// 6. Client Organizations & Memberships Analytics
// ============================================================================

export type OrganizationExecutiveAnalytics = {
  totalOrganizations: number;
  activeOrganizations: number;
  suspendedOrganizations: number;
  deletedOrganizations: number;
  newOrganizationsInPeriod: number;
  previousNewOrganizations: number | null;
  newOrgsComparison: PeriodComparisonMetric;
  activeClientMembershipsCount: number | null;
  organizationsWithActiveClientsCount: number | null;
};

export function computeOrganizationExecutiveAnalytics(
  organizations: AnalyticsOrgRecord[] | null,
  memberships: AnalyticsMembershipRecord[] | null | undefined,
  window: ResolvedDateWindow,
): OrganizationExecutiveAnalytics | null {
  if (organizations === null) return null;

  let activeOrganizations = 0;
  let suspendedOrganizations = 0;
  let deletedOrganizations = 0;

  for (const org of organizations) {
    if (org.status === "active") activeOrganizations += 1;
    else if (org.status === "suspended") suspendedOrganizations += 1;
    else if (org.status === "deleted") deletedOrganizations += 1;
  }

  const hasComparison =
    window.previousStart !== null && window.previousEnd !== null;
  const newOrgs =
    filterRecordsByWindow(
      organizations,
      (o) => o.created_at,
      window.currentStart,
      window.currentEnd,
    ) ?? [];
  const prevOrgs = hasComparison
    ? (filterRecordsByWindow(
        organizations,
        (o) => o.created_at,
        window.previousStart,
        window.previousEnd,
      ) ?? [])
    : null;

  let activeClientMembershipsCount: number | null = null;
  let organizationsWithActiveClientsCount: number | null = null;

  if (Array.isArray(memberships)) {
    const activeOrgIds = new Set(
      organizations.filter((o) => o.status === "active").map((o) => o.id),
    );
    const activeMembers = memberships.filter(
      (m) =>
        m.status === "active" &&
        (!activeOrgIds.size || activeOrgIds.has(m.organization_id)),
    );
    activeClientMembershipsCount = activeMembers.length;
    organizationsWithActiveClientsCount = new Set(
      activeMembers.map((m) => m.organization_id),
    ).size;
  }

  return {
    totalOrganizations: organizations.length,
    activeOrganizations,
    suspendedOrganizations,
    deletedOrganizations,
    newOrganizationsInPeriod: newOrgs.length,
    previousNewOrganizations: prevOrgs ? prevOrgs.length : null,
    newOrgsComparison: computePeriodComparison(
      newOrgs.length,
      prevOrgs ? prevOrgs.length : null,
      hasComparison,
    ),
    activeClientMembershipsCount,
    organizationsWithActiveClientsCount,
  };
}

// ============================================================================
// 7. Projects & Task Delivery Analytics (Including Overdue & Upcoming Tasks)
// ============================================================================

export type TaskAlertItem = {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: string;
  isOverdue: boolean;
  daysDelta: number;
};

export type DeliveryExecutiveAnalytics = {
  projects: {
    totalProjects: number;
    activeProjects: number;
    completedProjects: number;
    onHoldProjects: number;
    avgCompletionPct: number | null;
    overdueTargetProjectsCount: number;
    upcomingTargetProjectsCount: number;
    statusCounts: {
      planning: number;
      in_progress: number;
      in_review: number;
      completed: number;
      on_hold: number;
    };
  } | null;
  tasks: {
    totalTasks: number;
    completedTasks: number;
    openTasks: number;
    completionRatePct: number | null;
    overdueTasksCount: number;
    upcoming7dTasksCount: number;
    upcoming48hTasksCount: number;
    unassignedOpenTasksCount: number;
    statusCounts: {
      todo: number;
      in_progress: number;
      review: number;
      done: number;
    };
    openPriorityCounts: {
      urgent: number;
      high: number;
      medium: number;
      low: number;
    };
    overdueTaskItems: TaskAlertItem[];
    upcomingTaskItems: TaskAlertItem[];
  } | null;
};

export function computeDeliveryExecutiveAnalytics(
  projects: AnalyticsProjectRecord[] | null,
  tasks: AnalyticsTaskRecord[] | null,
  window: ResolvedDateWindow,
  now = new Date(),
): DeliveryExecutiveAnalytics {
  const todayStr = now.toISOString().slice(0, 10);
  const next48hStr = new Date(now.getTime() + 2 * DAY_MS)
    .toISOString()
    .slice(0, 10);
  const next7dStr = new Date(now.getTime() + 7 * DAY_MS)
    .toISOString()
    .slice(0, 10);
  const next14dStr = new Date(now.getTime() + 14 * DAY_MS)
    .toISOString()
    .slice(0, 10);
  const todayMidnightMs = new Date(`${todayStr}T00:00:00.000Z`).getTime();

  let projectStats: DeliveryExecutiveAnalytics["projects"] = null;
  if (projects !== null) {
    const filteredProjects =
      filterRecordsByWindow(
        projects,
        (p) => p.created_at,
        window.currentStart,
        window.currentEnd,
      ) ?? [];

    const statusCounts = {
      planning: 0,
      in_progress: 0,
      in_review: 0,
      completed: 0,
      on_hold: 0,
    };
    let progressSum = 0;

    for (const p of filteredProjects) {
      if (p.status in statusCounts) {
        statusCounts[p.status as keyof typeof statusCounts] += 1;
      }
      progressSum += Number(p.progress_pct) || 0;
    }

    // Overdue / upcoming target dates across all active projects
    let overdueTargetProjectsCount = 0;
    let upcomingTargetProjectsCount = 0;
    for (const p of projects) {
      if (p.status === "completed" || !p.target_date) continue;
      if (p.target_date < todayStr) {
        overdueTargetProjectsCount += 1;
      } else if (p.target_date <= next14dStr) {
        upcomingTargetProjectsCount += 1;
      }
    }

    projectStats = {
      totalProjects: filteredProjects.length,
      activeProjects:
        statusCounts.planning +
        statusCounts.in_progress +
        statusCounts.in_review,
      completedProjects: statusCounts.completed,
      onHoldProjects: statusCounts.on_hold,
      avgCompletionPct:
        filteredProjects.length > 0
          ? Math.round(progressSum / filteredProjects.length)
          : null,
      overdueTargetProjectsCount,
      upcomingTargetProjectsCount,
      statusCounts,
    };
  }

  let taskStats: DeliveryExecutiveAnalytics["tasks"] = null;
  if (tasks !== null) {
    const filteredTasks =
      filterRecordsByWindow(
        tasks,
        (t) => t.created_at,
        window.currentStart,
        window.currentEnd,
      ) ?? [];

    const statusCounts = {
      todo: 0,
      in_progress: 0,
      review: 0,
      done: 0,
    };
    const openPriorityCounts = {
      urgent: 0,
      high: 0,
      medium: 0,
      low: 0,
    };

    for (const t of filteredTasks) {
      if (t.status in statusCounts) {
        statusCounts[t.status as keyof typeof statusCounts] += 1;
      }
      if (t.status !== "done" && t.priority in openPriorityCounts) {
        openPriorityCounts[t.priority as keyof typeof openPriorityCounts] += 1;
      }
    }

    // Evaluate overdue and upcoming deadlines across all open tasks in the workspace
    // so overdue tasks from prior periods are never hidden from operational view.
    const overdueTaskItems: TaskAlertItem[] = [];
    const upcomingTaskItems: TaskAlertItem[] = [];
    let upcoming48hTasksCount = 0;
    let unassignedOpenTasksCount = 0;

    for (const t of tasks) {
      if (t.status === "done") continue;
      if (!t.assigned_to) {
        unassignedOpenTasksCount += 1;
      }
      if (!t.due_date) continue;

      const dueMidnightMs = new Date(`${t.due_date.slice(0, 10)}T00:00:00.000Z`).getTime();
      const daysDelta = Number.isFinite(dueMidnightMs)
        ? Math.round((dueMidnightMs - todayMidnightMs) / DAY_MS)
        : 0;

      if (t.due_date < todayStr) {
        overdueTaskItems.push({
          id: t.id ?? `task-${overdueTaskItems.length}`,
          title: t.title || "Untitled Task",
          status: t.status,
          priority: t.priority,
          dueDate: t.due_date.slice(0, 10),
          isOverdue: true,
          daysDelta,
        });
      } else if (t.due_date <= next7dStr) {
        if (t.due_date <= next48hStr) {
          upcoming48hTasksCount += 1;
        }
        upcomingTaskItems.push({
          id: t.id ?? `task-${upcomingTaskItems.length}`,
          title: t.title || "Untitled Task",
          status: t.status,
          priority: t.priority,
          dueDate: t.due_date.slice(0, 10),
          isOverdue: false,
          daysDelta,
        });
      }
    }

    overdueTaskItems.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    upcomingTaskItems.sort((a, b) => a.dueDate.localeCompare(b.dueDate));

    taskStats = {
      totalTasks: filteredTasks.length,
      completedTasks: statusCounts.done,
      openTasks:
        statusCounts.todo + statusCounts.in_progress + statusCounts.review,
      completionRatePct:
        filteredTasks.length > 0
          ? Math.round((statusCounts.done / filteredTasks.length) * 100)
          : null,
      overdueTasksCount: overdueTaskItems.length,
      upcoming7dTasksCount: upcomingTaskItems.length,
      upcoming48hTasksCount,
      unassignedOpenTasksCount,
      statusCounts,
      openPriorityCounts,
      overdueTaskItems: overdueTaskItems.slice(0, 8),
      upcomingTaskItems: upcomingTaskItems.slice(0, 8),
    };
  }

  return {
    projects: projectStats,
    tasks: taskStats,
  };
}

// ============================================================================
// 8. Commercial Invoicing, Verified Payments & Revenue Trend Analytics
// ============================================================================

export type RevenueTrendBucket = {
  key: string;
  label: string;
  bookedInvoiceCents: number;
  verifiedCollectedCents: number;
  outstandingBalanceCents: number;
  overdueReceivablesCents: number;
};

export type CommercialExecutiveAnalytics = {
  bookedInvoiceCents: number;
  previousBookedInvoiceCents: number | null;
  bookedComparison: PeriodComparisonMetric;
  verifiedCollectedCents: number;
  previousVerifiedCollectedCents: number | null;
  collectedComparison: PeriodComparisonMetric;
  unverifiedSettledCents: number;
  outstandingBalanceCents: number;
  currentReceivablesCents: number;
  overdueReceivablesCents: number;
  draftInvoiceCents: number;
  cancelledInvoiceCents: number;
  collectionRatePct: number | null;
  verifiedPaymentRecordsCount: number;
  lifecycleCounts: {
    draft: number;
    issued: number;
    partially_paid: number;
    overdue: number;
    settled: number;
    cancelled: number;
    overduePartiallyPaid: number;
  };
  paymentMethodBreakdown: {
    wire_transfer: { count: number; amountCents: number };
    ach: { count: number; amountCents: number };
    check: { count: number; amountCents: number };
    manual_settlement: { count: number; amountCents: number };
  };
  revenueTrendSeries: RevenueTrendBucket[];
};

/**
 * Strictly separates Booked Invoice Value, Verified Collected Payments (backed by
 * audited `payment_record` items), Current Receivables, and Overdue Receivables.
 * Never labels issued invoices as collected revenue.
 */
export function computeCommercialExecutiveAnalytics(
  invoices: AnalyticsInvoiceRecord[] | null,
  window: ResolvedDateWindow,
): CommercialExecutiveAnalytics | null {
  if (invoices === null) return null;

  const hasComparison =
    window.previousStart !== null && window.previousEnd !== null;
  const currentInvoices =
    filterRecordsByWindow(
      invoices,
      (inv) => inv.created_at,
      window.currentStart,
      window.currentEnd,
    ) ?? [];
  const previousInvoices = hasComparison
    ? (filterRecordsByWindow(
        invoices,
        (inv) => inv.created_at,
        window.previousStart,
        window.previousEnd,
      ) ?? [])
    : null;

  let bookedInvoiceCents = 0;
  let verifiedCollectedCents = 0;
  let unverifiedSettledCents = 0;
  let currentReceivablesCents = 0;
  let overdueReceivablesCents = 0;
  let draftInvoiceCents = 0;
  let cancelledInvoiceCents = 0;
  let verifiedPaymentRecordsCount = 0;

  const lifecycleCounts = {
    draft: 0,
    issued: 0,
    partially_paid: 0,
    overdue: 0,
    settled: 0,
    cancelled: 0,
    overduePartiallyPaid: 0,
  };

  const paymentMethodBreakdown = {
    wire_transfer: { count: 0, amountCents: 0 },
    ach: { count: 0, amountCents: 0 },
    check: { count: 0, amountCents: 0 },
    manual_settlement: { count: 0, amountCents: 0 },
  };

  for (const inv of currentInvoices) {
    const commercial = classifyInvoiceLifecycleStatus(inv);
    const parsed = parseInvoiceItems(inv.items, inv.amount_cents);

    if (commercial.displayStatus === "draft") {
      lifecycleCounts.draft += 1;
      draftInvoiceCents += inv.amount_cents;
      continue;
    }

    if (commercial.displayStatus === "cancelled") {
      lifecycleCounts.cancelled += 1;
      cancelledInvoiceCents += inv.amount_cents;
      continue;
    }

    // Booked invoice value includes issued, partially_paid, overdue, and settled
    bookedInvoiceCents += inv.amount_cents;

    // Verified payments strictly come from recorded payment_record entries
    const verifiedPaidOnInvoice = Math.min(
      inv.amount_cents,
      parsed.recordedPaidCents,
    );
    verifiedCollectedCents += verifiedPaidOnInvoice;
    verifiedPaymentRecordsCount += parsed.paymentRecords.length;

    for (const pr of parsed.paymentRecords) {
      const methodKey =
        pr.method in paymentMethodBreakdown ? pr.method : "wire_transfer";
      paymentMethodBreakdown[methodKey].count += 1;
      paymentMethodBreakdown[methodKey].amountCents += pr.amount_cents;
    }

    if (
      commercial.displayStatus === "settled" &&
      verifiedPaidOnInvoice < inv.amount_cents
    ) {
      unverifiedSettledCents += inv.amount_cents - verifiedPaidOnInvoice;
    }

    if (commercial.displayStatus === "settled") {
      lifecycleCounts.settled += 1;
    } else if (commercial.displayStatus === "partially_paid") {
      lifecycleCounts.partially_paid += 1;
      if (commercial.isOverdue) {
        lifecycleCounts.overduePartiallyPaid += 1;
        overdueReceivablesCents += commercial.balanceDueCents;
      } else {
        currentReceivablesCents += commercial.balanceDueCents;
      }
    } else if (commercial.displayStatus === "overdue") {
      lifecycleCounts.overdue += 1;
      overdueReceivablesCents += commercial.balanceDueCents;
    } else {
      lifecycleCounts.issued += 1;
      currentReceivablesCents += commercial.balanceDueCents;
    }
  }

  // Also check if any payments were recorded in the current window on invoices created prior to window
  if (window.currentStart !== null) {
    for (const inv of invoices) {
      if (inv.status === "cancelled" || inv.status === "draft") continue;
      const createdInCurrentWindow = isTimestampInRange(
        inv.created_at,
        window.currentStart,
        window.currentEnd,
      );
      if (createdInCurrentWindow) continue; // Already counted above

      const parsed = parseInvoiceItems(inv.items, inv.amount_cents);
      for (const pr of parsed.paymentRecords) {
        if (
          isTimestampInRange(
            pr.recorded_at,
            window.currentStart,
            window.currentEnd,
          )
        ) {
          verifiedCollectedCents += pr.amount_cents;
          verifiedPaymentRecordsCount += 1;
          const methodKey =
            pr.method in paymentMethodBreakdown ? pr.method : "wire_transfer";
          paymentMethodBreakdown[methodKey].count += 1;
          paymentMethodBreakdown[methodKey].amountCents += pr.amount_cents;
        }
      }
    }
  }

  // Previous period comparison
  let previousBookedInvoiceCents: number | null = null;
  let previousVerifiedCollectedCents: number | null = null;

  if (previousInvoices !== null) {
    previousBookedInvoiceCents = 0;
    previousVerifiedCollectedCents = 0;
    for (const inv of previousInvoices) {
      if (inv.status === "draft" || inv.status === "cancelled") continue;
      previousBookedInvoiceCents += inv.amount_cents;
      const parsed = parseInvoiceItems(inv.items, inv.amount_cents);
      previousVerifiedCollectedCents += Math.min(
        inv.amount_cents,
        parsed.recordedPaidCents,
      );
    }
  }

  const outstandingBalanceCents =
    currentReceivablesCents + overdueReceivablesCents;
  const collectionRatePct =
    bookedInvoiceCents > 0
      ? Math.min(
          100,
          Math.round((verifiedCollectedCents / bookedInvoiceCents) * 100),
        )
      : null;

  // Earliest invoice date for bucketing
  let earliestMs = Infinity;
  for (const inv of currentInvoices) {
    const ms = new Date(inv.created_at).getTime();
    if (Number.isFinite(ms) && ms < earliestMs) earliestMs = ms;
  }
  const earliestDate = Number.isFinite(earliestMs)
    ? new Date(earliestMs)
    : null;
  const buckets = buildTimeBuckets(window, earliestDate);

  const revenueTrendSeries: RevenueTrendBucket[] = buckets.map((b) => {
    let bBooked = 0;
    let bVerifiedCollected = 0;
    let bOutstanding = 0;
    let bOverdue = 0;

    for (const inv of invoices) {
      if (inv.status === "draft" || inv.status === "cancelled") continue;
      const commercial = classifyInvoiceLifecycleStatus(inv);
      const parsed = parseInvoiceItems(inv.items, inv.amount_cents);
      const invCreatedMs = new Date(inv.created_at).getTime();

      if (invCreatedMs >= b.startMs && invCreatedMs <= b.endMs) {
        bBooked += inv.amount_cents;
        if (commercial.isOverdue) {
          bOverdue += commercial.balanceDueCents;
        } else {
          bOutstanding += commercial.balanceDueCents;
        }
      }

      if (parsed.paymentRecords.length > 0) {
        for (const pr of parsed.paymentRecords) {
          const prMs = new Date(pr.recorded_at || inv.paid_at || inv.created_at).getTime();
          if (prMs >= b.startMs && prMs <= b.endMs) {
            bVerifiedCollected += pr.amount_cents;
          }
        }
      }
    }

    return {
      key: b.key,
      label: b.label,
      bookedInvoiceCents: bBooked,
      verifiedCollectedCents: bVerifiedCollected,
      outstandingBalanceCents: bOutstanding + bOverdue,
      overdueReceivablesCents: bOverdue,
    };
  });

  return {
    bookedInvoiceCents,
    previousBookedInvoiceCents,
    bookedComparison: computePeriodComparison(
      bookedInvoiceCents,
      previousBookedInvoiceCents,
      hasComparison,
    ),
    verifiedCollectedCents,
    previousVerifiedCollectedCents,
    collectedComparison: computePeriodComparison(
      verifiedCollectedCents,
      previousVerifiedCollectedCents,
      hasComparison,
    ),
    unverifiedSettledCents,
    outstandingBalanceCents,
    currentReceivablesCents,
    overdueReceivablesCents,
    draftInvoiceCents,
    cancelledInvoiceCents,
    collectionRatePct,
    verifiedPaymentRecordsCount,
    lifecycleCounts,
    paymentMethodBreakdown,
    revenueTrendSeries,
  };
}

// ============================================================================
// 9. Support Tickets & Queue SLA Analytics
// ============================================================================

export type SupportExecutiveAnalytics = {
  totalTickets: number;
  openTicketsCount: number;
  resolvedOrClosedCount: number;
  highPriorityOpenCount: number;
  urgentOpenCount: number;
  unassignedOpenCount: number;
  resolutionRatePct: number | null;
  statusCounts: {
    new: number;
    in_progress: number;
    waiting_on_client: number;
    resolved: number;
    closed: number;
  };
  priorityCounts: {
    urgent: number;
    high: number;
    medium: number;
    low: number;
  };
  categoryCounts: {
    technical: number;
    billing: number;
    feature_request: number;
    general: number;
  };
};

export function computeSupportExecutiveAnalytics(
  tickets: AnalyticsTicketRecord[] | null,
  window: ResolvedDateWindow,
): SupportExecutiveAnalytics | null {
  if (tickets === null) return null;

  const filteredTickets =
    filterRecordsByWindow(
      tickets,
      (t) => t.created_at,
      window.currentStart,
      window.currentEnd,
    ) ?? [];

  const statusCounts = {
    new: 0,
    in_progress: 0,
    waiting_on_client: 0,
    resolved: 0,
    closed: 0,
  };
  const priorityCounts = {
    urgent: 0,
    high: 0,
    medium: 0,
    low: 0,
  };
  const categoryCounts = {
    technical: 0,
    billing: 0,
    feature_request: 0,
    general: 0,
  };

  let highPriorityOpenCount = 0;
  let urgentOpenCount = 0;
  let unassignedOpenCount = 0;

  for (const t of filteredTickets) {
    if (t.status in statusCounts) {
      statusCounts[t.status as keyof typeof statusCounts] += 1;
    }
    if (t.priority in priorityCounts) {
      priorityCounts[t.priority as keyof typeof priorityCounts] += 1;
    }
    if (t.category in categoryCounts) {
      categoryCounts[t.category as keyof typeof categoryCounts] += 1;
    }

    const isOpen = t.status !== "resolved" && t.status !== "closed";
    if (isOpen) {
      if (t.priority === "urgent") {
        urgentOpenCount += 1;
        highPriorityOpenCount += 1;
      } else if (t.priority === "high") {
        highPriorityOpenCount += 1;
      }
      if (!t.assigned_to) {
        unassignedOpenCount += 1;
      }
    }
  }

  const totalTickets = filteredTickets.length;
  const openTicketsCount =
    statusCounts.new +
    statusCounts.in_progress +
    statusCounts.waiting_on_client;
  const resolvedOrClosedCount = statusCounts.resolved + statusCounts.closed;

  // Never show fake 100% when 0 tickets exist
  const resolutionRatePct =
    totalTickets > 0
      ? Math.round((resolvedOrClosedCount / totalTickets) * 100)
      : null;

  return {
    totalTickets,
    openTicketsCount,
    resolvedOrClosedCount,
    highPriorityOpenCount,
    urgentOpenCount,
    unassignedOpenCount,
    resolutionRatePct,
    statusCounts,
    priorityCounts,
    categoryCounts,
  };
}

// ============================================================================
// 10. Invitations, Notifications & Automation Job Health
// ============================================================================

export type GovernanceAndOperationsAnalytics = {
  staffCount: number | null;
  invitations: {
    pendingCount: number;
    expiredCount: number;
    acceptedCount: number;
    revokedCount: number;
    archivedCount: number;
  } | null;
  notifications: {
    totalRecent: number;
    unreadCount: number;
    byCategory: {
      security: number;
      project: number;
      billing: number;
      ticket: number;
      system: number;
    };
  } | null;
  automationHealth: AutomationJobHealthSummary;
};

export function computeGovernanceAndOperationsAnalytics(params: {
  staffCount: number | null;
  pendingInvitesCount: number | null;
  invitations?: AnalyticsInvitationRecord[] | null;
  notifications?: AnalyticsNotificationRecord[] | null;
  automationAuditEvents?: AutomationAuditRecord[] | null;
  schedulerConfigured: boolean;
  now?: Date;
}): GovernanceAndOperationsAnalytics {
  const nowMs = (params.now ?? new Date()).getTime();

  let invitationsSummary: GovernanceAndOperationsAnalytics["invitations"] = null;
  if (Array.isArray(params.invitations)) {
    let pendingCount = 0;
    let expiredCount = 0;
    let acceptedCount = 0;
    let revokedCount = 0;
    let archivedCount = 0;

    for (const inv of params.invitations) {
      if (inv.archived_at) {
        archivedCount += 1;
      }
      if (inv.status === "accepted") {
        acceptedCount += 1;
      } else if (inv.status === "revoked") {
        revokedCount += 1;
      } else if (inv.status === "expired") {
        expiredCount += 1;
      } else if (inv.status === "pending" && !inv.archived_at) {
        const expMs = new Date(inv.expires_at).getTime();
        if (Number.isFinite(expMs) && expMs < nowMs) {
          expiredCount += 1;
        } else {
          pendingCount += 1;
        }
      }
    }

    invitationsSummary = {
      pendingCount,
      expiredCount,
      acceptedCount,
      revokedCount,
      archivedCount,
    };
  } else if (params.pendingInvitesCount !== null) {
    invitationsSummary = {
      pendingCount: params.pendingInvitesCount,
      expiredCount: 0,
      acceptedCount: 0,
      revokedCount: 0,
      archivedCount: 0,
    };
  }

  let notificationsSummary: GovernanceAndOperationsAnalytics["notifications"] =
    null;
  if (Array.isArray(params.notifications)) {
    const byCategory = {
      security: 0,
      project: 0,
      billing: 0,
      ticket: 0,
      system: 0,
    };
    let unreadCount = 0;
    for (const n of params.notifications) {
      if (!n.is_read) unreadCount += 1;
      if (n.type in byCategory) {
        byCategory[n.type as keyof typeof byCategory] += 1;
      }
    }
    notificationsSummary = {
      totalRecent: params.notifications.length,
      unreadCount,
      byCategory,
    };
  }

  const automationHealth = evaluateAutomationJobHealth(
    params.automationAuditEvents === undefined
      ? []
      : params.automationAuditEvents,
    params.schedulerConfigured,
  );

  return {
    staffCount: params.staffCount,
    invitations: invitationsSummary,
    notifications: notificationsSummary,
    automationHealth,
  };
}

// ============================================================================
// 11. CSV Export Serialization & Formula Injection Prevention
// ============================================================================

const FORMULA_TRIGGER_PATTERN = /^[\s\u0000-\u001F]*[=+\-@|\t\r\n]/;

/**
 * Sanitizes a single CSV cell value to prevent Spreadsheet Formula Injection
 * (CSV Injection / DDE Injection) and formats RFC-4180 compliant quoting.
 */
export function sanitizeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "";
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  let str = String(value)
    .replace(/\0/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");

  const needsFormulaNeutralization = FORMULA_TRIGGER_PATTERN.test(str);
  if (needsFormulaNeutralization) {
    str = `'${str}`;
  }

  const needsQuotes =
    needsFormulaNeutralization ||
    str.includes(",") ||
    str.includes('"') ||
    str.includes("\n") ||
    /^\s|\s$/.test(str);

  if (needsQuotes) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

export function serializeCsvRows(
  headers: string[],
  rows: Array<Array<unknown>>,
): string {
  const headerLine = headers.map((h) => sanitizeCsvCell(h)).join(",");
  const bodyLines = rows.map((row) =>
    row.map((cell) => sanitizeCsvCell(cell)).join(","),
  );
  return [headerLine, ...bodyLines].join("\r\n") + "\r\n";
}

export type AnalyticsReportType =
  | "executive_summary"
  | "leads"
  | "invoices"
  | "projects_tasks"
  | "support";

export function buildExecutiveCsvReport(params: {
  reportType: AnalyticsReportType;
  data: ExecutiveAnalyticsDataset;
  window: ResolvedDateWindow;
  now?: Date;
}): { filename: string; csvContent: string } {
  const now = params.now ?? new Date();
  const dateStamp = now.toISOString().slice(0, 10);
  const leadsMetrics = computeLeadExecutiveAnalytics(
    params.data.leads,
    params.window,
    now,
  );
  const orgMetrics = computeOrganizationExecutiveAnalytics(
    params.data.organizations,
    params.data.memberships,
    params.window,
  );
  const deliveryMetrics = computeDeliveryExecutiveAnalytics(
    params.data.projects,
    params.data.tasks,
    params.window,
    now,
  );
  const commercialMetrics = computeCommercialExecutiveAnalytics(
    params.data.invoices,
    params.window,
  );
  const supportMetrics = computeSupportExecutiveAnalytics(
    params.data.tickets,
    params.window,
  );
  const govMetrics = computeGovernanceAndOperationsAnalytics({
    staffCount: params.data.staffCount,
    pendingInvitesCount: params.data.pendingInvitesCount,
    invitations: params.data.invitations,
    notifications: params.data.notifications,
    automationAuditEvents: params.data.automationAuditEvents,
    schedulerConfigured:
      params.data.integrationStatus?.workflowScheduler.status === "configured",
    now,
  });

  if (params.reportType === "leads") {
    const filtered =
      filterRecordsByWindow(
        params.data.leads,
        (l) => l.created_at,
        params.window.currentStart,
        params.window.currentEnd,
      ) ?? [];
    const headers = [
      "Lead ID",
      "Stage",
      "Source",
      "Follow-up Scheduled At",
      "Created At",
    ];
    const rows = filtered.map((l) => [
      l.id ?? "—",
      l.stage,
      l.source ?? "website",
      l.follow_up_at ?? "Not scheduled",
      l.created_at,
    ]);
    return {
      filename: `thecodexthrill-crm-leads-${params.window.preset}-${dateStamp}.csv`,
      csvContent: serializeCsvRows(headers, rows),
    };
  }

  if (params.reportType === "invoices") {
    const filtered =
      filterRecordsByWindow(
        params.data.invoices,
        (inv) => inv.created_at,
        params.window.currentStart,
        params.window.currentEnd,
      ) ?? [];
    const headers = [
      "Invoice Number",
      "Commercial Lifecycle Status",
      "Booked Amount (USD)",
      "Verified Collected (USD)",
      "Balance Due (USD)",
      "Verified Payment Records Count",
      "Due Date",
      "Paid At",
      "Created At",
    ];
    const rows = filtered.map((inv) => {
      const comm = classifyInvoiceLifecycleStatus(inv);
      const parsed = parseInvoiceItems(inv.items, inv.amount_cents);
      const bookedCents =
        comm.displayStatus === "draft" || comm.displayStatus === "cancelled"
          ? 0
          : inv.amount_cents;
      return [
        inv.invoice_number ?? inv.id ?? "—",
        comm.label,
        (bookedCents / 100).toFixed(2),
        (parsed.recordedPaidCents / 100).toFixed(2),
        (comm.balanceDueCents / 100).toFixed(2),
        parsed.paymentRecords.length,
        inv.due_date ?? "—",
        inv.paid_at ?? "—",
        inv.created_at,
      ];
    });
    return {
      filename: `thecodexthrill-commercial-billing-${params.window.preset}-${dateStamp}.csv`,
      csvContent: serializeCsvRows(headers, rows),
    };
  }

  if (params.reportType === "projects_tasks") {
    const filteredProjects =
      filterRecordsByWindow(
        params.data.projects,
        (p) => p.created_at,
        params.window.currentStart,
        params.window.currentEnd,
      ) ?? [];
    const headers = [
      "Record Type",
      "Name / Title",
      "Status",
      "Priority / Progress",
      "Target / Due Date",
      "Created At",
    ];
    const rows: Array<Array<unknown>> = [];
    for (const p of filteredProjects) {
      rows.push([
        "Project",
        p.name ?? "Project",
        p.status,
        `${p.progress_pct}%`,
        p.target_date ?? "—",
        p.created_at,
      ]);
    }
    const filteredTasks =
      filterRecordsByWindow(
        params.data.tasks,
        (t) => t.created_at,
        params.window.currentStart,
        params.window.currentEnd,
      ) ?? [];
    for (const t of filteredTasks) {
      rows.push([
        "Task",
        t.title ?? "Task",
        t.status,
        t.priority,
        t.due_date ?? "—",
        t.created_at,
      ]);
    }
    return {
      filename: `thecodexthrill-delivery-projects-tasks-${params.window.preset}-${dateStamp}.csv`,
      csvContent: serializeCsvRows(headers, rows),
    };
  }

  if (params.reportType === "support") {
    const filteredTickets =
      filterRecordsByWindow(
        params.data.tickets,
        (t) => t.created_at,
        params.window.currentStart,
        params.window.currentEnd,
      ) ?? [];
    const headers = [
      "Ticket Number",
      "Title",
      "Status",
      "Priority",
      "Category",
      "Resolved At",
      "Created At",
    ];
    const rows = filteredTickets.map((t) => [
      t.ticket_number ?? t.id ?? "—",
      t.title ?? "Support Ticket",
      t.status,
      t.priority,
      t.category,
      t.resolved_at ?? "—",
      t.created_at,
    ]);
    return {
      filename: `thecodexthrill-support-queue-${params.window.preset}-${dateStamp}.csv`,
      csvContent: serializeCsvRows(headers, rows),
    };
  }

  // Default: Executive Summary KPI Report
  const headers = [
    "Domain",
    "Metric",
    "Current Period Value",
    "Prior Period Comparison",
    "Period Filter",
  ];
  const rows: Array<Array<unknown>> = [
    [
      "CRM & Pipeline",
      "New Sales Leads",
      leadsMetrics ? leadsMetrics.totalLeads : "Unavailable",
      leadsMetrics ? leadsMetrics.leadsComparison.label : "Unavailable",
      params.window.label,
    ],
    [
      "CRM & Pipeline",
      "Converted Leads",
      leadsMetrics ? leadsMetrics.convertedLeads : "Unavailable",
      leadsMetrics && leadsMetrics.conversionRatePct !== null
        ? `${leadsMetrics.conversionRatePct}% conversion rate`
        : "No leads in period",
      params.window.label,
    ],
    [
      "CRM & Pipeline",
      "Overdue Lead Follow-ups",
      leadsMetrics ? leadsMetrics.followUpHealth.overdueCount : "Unavailable",
      leadsMetrics
        ? `${leadsMetrics.followUpHealth.upcoming24hCount} due within 24h`
        : "Unavailable",
      "Live Active Queue",
    ],
    [
      "Clients & Tenancy",
      "Active Client Organizations",
      orgMetrics ? orgMetrics.activeOrganizations : "Unavailable",
      orgMetrics ? orgMetrics.newOrgsComparison.label : "Unavailable",
      params.window.label,
    ],
    [
      "Delivery & Projects",
      "Active Projects",
      deliveryMetrics.projects
        ? deliveryMetrics.projects.activeProjects
        : "Unavailable",
      deliveryMetrics.projects &&
      deliveryMetrics.projects.avgCompletionPct !== null
        ? `${deliveryMetrics.projects.avgCompletionPct}% average completion`
        : "Unavailable",
      params.window.label,
    ],
    [
      "Delivery & Tasks",
      "Overdue Open Tasks",
      deliveryMetrics.tasks
        ? deliveryMetrics.tasks.overdueTasksCount
        : "Unavailable",
      deliveryMetrics.tasks
        ? `${deliveryMetrics.tasks.upcoming7dTasksCount} upcoming within 7 days`
        : "Unavailable",
      "Live Active Queue",
    ],
    [
      "Commercial & Billing",
      "Booked Invoice Value (Issued + Partially Paid + Overdue + Settled)",
      commercialMetrics
        ? formatAnalyticsCurrency(commercialMetrics.bookedInvoiceCents, {
            showCents: true,
          })
        : "Unavailable",
      commercialMetrics
        ? commercialMetrics.bookedComparison.label
        : "Unavailable",
      params.window.label,
    ],
    [
      "Commercial & Billing",
      "Verified Collected Payments (Audited Payment Records)",
      commercialMetrics
        ? formatAnalyticsCurrency(commercialMetrics.verifiedCollectedCents, {
            showCents: true,
          })
        : "Unavailable",
      commercialMetrics
        ? commercialMetrics.collectedComparison.label
        : "Unavailable",
      params.window.label,
    ],
    [
      "Commercial & Billing",
      "Total Outstanding Balance",
      commercialMetrics
        ? formatAnalyticsCurrency(commercialMetrics.outstandingBalanceCents, {
            showCents: true,
          })
        : "Unavailable",
      commercialMetrics
        ? `Current: ${formatAnalyticsCurrency(commercialMetrics.currentReceivablesCents, { showCents: true })}`
        : "Unavailable",
      params.window.label,
    ],
    [
      "Commercial & Billing",
      "Overdue Receivables",
      commercialMetrics
        ? formatAnalyticsCurrency(commercialMetrics.overdueReceivablesCents, {
            showCents: true,
          })
        : "Unavailable",
      commercialMetrics
        ? `${commercialMetrics.lifecycleCounts.overdue + commercialMetrics.lifecycleCounts.overduePartiallyPaid} overdue statement(s)`
        : "Unavailable",
      params.window.label,
    ],
    [
      "Support Desk",
      "Open Support Tickets",
      supportMetrics ? supportMetrics.openTicketsCount : "Unavailable",
      supportMetrics
        ? `${supportMetrics.highPriorityOpenCount} high/urgent priority open`
        : "Unavailable",
      params.window.label,
    ],
    [
      "Platform Governance",
      "Pending Staff Invitations",
      govMetrics.invitations
        ? govMetrics.invitations.pendingCount
        : "Unavailable",
      govMetrics.invitations
        ? `${govMetrics.invitations.expiredCount} expired unaccepted`
        : "Unavailable",
      "Live Active Queue",
    ],
    [
      "Platform Reliability",
      "Workflow Automation Job Status",
      govMetrics.automationHealth.statusLabel,
      govMetrics.automationHealth.lastRunAt
        ? `Last run: ${govMetrics.automationHealth.lastRunAt}`
        : "No runs recorded",
      "Live Observability",
    ],
  ];

  return {
    filename: `thecodexthrill-executive-intelligence-${params.window.preset}-${dateStamp}.csv`,
    csvContent: serializeCsvRows(headers, rows),
  };
}


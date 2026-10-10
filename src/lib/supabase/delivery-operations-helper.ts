export type ParsedDeliveryDescription = {
  milestone: string | null;
  clientDescription: string;
  internalNotes: string;
  handoverChecklist: string | null;
};

const INTERNAL_NOTES_DELIMITER = "\n\n---[INTERNAL STAFF NOTES]---\n";
const HANDOVER_DELIMITER = "\n\n---[DELIVERY HANDOVER]---\n";

/**
 * Formats client-visible description, optional milestone tag, delivery handover summary,
 * and internal staff-only notes into a single text column without altering DB schema.
 */
export function formatDeliveryDescription(input: {
  clientDescription?: string | null;
  internalNotes?: string | null;
  milestone?: string | null;
  handoverChecklist?: string | null;
}): string {
  const parts: string[] = [];
  const cleanMilestone = input.milestone?.trim();
  const cleanClient = input.clientDescription?.trim() ?? "";
  const cleanHandover = input.handoverChecklist?.trim();
  const cleanInternal = input.internalNotes?.trim();

  if (cleanMilestone) {
    parts.push(`[Milestone: ${cleanMilestone}]`);
  }

  if (cleanClient) {
    parts.push(cleanClient);
  }

  let result = parts.join("\n\n");

  if (cleanHandover) {
    result += `${HANDOVER_DELIMITER}${cleanHandover}`;
  }

  if (cleanInternal) {
    result += `${INTERNAL_NOTES_DELIMITER}${cleanInternal}`;
  }

  return result.trim();
}

/**
 * Parses a stored project or task description into structured milestone,
 * client-visible description, handover summary, and internal staff notes.
 */
export function parseDeliveryDescription(
  raw?: string | null,
): ParsedDeliveryDescription {
  if (!raw) {
    return {
      milestone: null,
      clientDescription: "",
      internalNotes: "",
      handoverChecklist: null,
    };
  }

  let working = raw;
  let internalNotes = "";
  let handoverChecklist: string | null = null;

  const internalIdx = working.indexOf(INTERNAL_NOTES_DELIMITER);
  if (internalIdx !== -1) {
    internalNotes = working
      .slice(internalIdx + INTERNAL_NOTES_DELIMITER.length)
      .trim();
    working = working.slice(0, internalIdx);
  } else {
    // Also support legacy/inline [Internal Note: ...] syntax
    const inlineMatch = working.match(/\n*\[Internal Note:\s*([\s\S]*?)\]$/i);
    if (inlineMatch) {
      internalNotes = inlineMatch[1].trim();
      working = working.slice(0, inlineMatch.index).trim();
    }
  }

  const handoverIdx = working.indexOf(HANDOVER_DELIMITER);
  if (handoverIdx !== -1) {
    handoverChecklist = working
      .slice(handoverIdx + HANDOVER_DELIMITER.length)
      .trim();
    working = working.slice(0, handoverIdx);
  }

  let milestone: string | null = null;
  const milestoneMatch = working.match(/^\[Milestone:\s*([^\]]+)\]\s*\n*/i);
  if (milestoneMatch) {
    milestone = milestoneMatch[1].trim() || null;
    working = working.slice(milestoneMatch[0].length);
  }

  return {
    milestone,
    clientDescription: working.trim(),
    internalNotes,
    handoverChecklist,
  };
}

/**
 * Strips internal staff notes from a project or task description before sending
 * the record to a Client Portal view (defense-in-depth server-side redaction).
 */
export function redactInternalNotesForClient(raw?: string | null): string {
  const parsed = parseDeliveryDescription(raw);
  return formatDeliveryDescription({
    milestone: parsed.milestone,
    clientDescription: parsed.clientDescription,
    handoverChecklist: parsed.handoverChecklist,
    internalNotes: null,
  });
}

export type TaskProgressSummary = {
  totalTasks: number;
  completedTasks: number;
  reviewTasks: number;
  inProgressTasks: number;
  todoTasks: number;
  computedProgressPct: number;
};

export function calculateProjectTaskProgress(
  tasks?: Array<{ status: string }> | null,
): TaskProgressSummary {
  const list = tasks ?? [];
  const totalTasks = list.length;
  let completedTasks = 0;
  let reviewTasks = 0;
  let inProgressTasks = 0;
  let todoTasks = 0;

  for (const t of list) {
    if (t.status === "done") completedTasks++;
    else if (t.status === "review") reviewTasks++;
    else if (t.status === "in_progress") inProgressTasks++;
    else todoTasks++;
  }

  // Weighted progress: done = 100%, review = 75%, in_progress = 35%
  const weightedSum =
    completedTasks * 100 + reviewTasks * 75 + inProgressTasks * 35;
  const computedProgressPct =
    totalTasks > 0 ? Math.min(100, Math.round(weightedSum / totalTasks)) : 0;

  return {
    totalTasks,
    completedTasks,
    reviewTasks,
    inProgressTasks,
    todoTasks,
    computedProgressPct,
  };
}

// ============================================================================
// Commercial & Invoice Helpers
// ============================================================================

export type InvoiceLineItem = {
  kind?: "line_item";
  description: string;
  quantity?: number;
  unit_price_cents?: number;
  amount_cents: number;
  project_id?: string | null;
  project_name?: string | null;
};

export type InvoicePaymentRecord = {
  kind: "payment_record";
  amount_cents: number;
  method: "wire_transfer" | "ach" | "check" | "manual_settlement";
  reference: string;
  recorded_at: string;
  recorded_by_email?: string;
  notes?: string;
};

export type InvoiceItemsEntry = InvoiceLineItem | InvoicePaymentRecord;

export type ParsedInvoiceDetails = {
  lineItems: InvoiceLineItem[];
  paymentRecords: InvoicePaymentRecord[];
  linkedProject: { id: string; name: string } | null;
  recordedPaidCents: number;
};

export function parseInvoiceItems(
  rawItems: unknown,
  fallbackAmountCents: number,
): ParsedInvoiceDetails {
  const entries = Array.isArray(rawItems) ? rawItems : [];
  const lineItems: InvoiceLineItem[] = [];
  const paymentRecords: InvoicePaymentRecord[] = [];
  let linkedProject: { id: string; name: string } | null = null;

  for (const entry of entries) {
    if (!entry || typeof entry !== "object") continue;
    const obj = entry as Record<string, unknown>;

    if (obj.kind === "payment_record") {
      const amount = Number(obj.amount_cents) || 0;
      if (amount > 0 && typeof obj.reference === "string") {
        paymentRecords.push({
          kind: "payment_record",
          amount_cents: amount,
          method:
            (obj.method as InvoicePaymentRecord["method"]) || "wire_transfer",
          reference: obj.reference,
          recorded_at:
            typeof obj.recorded_at === "string"
              ? obj.recorded_at
              : new Date().toISOString(),
          recorded_by_email:
            typeof obj.recorded_by_email === "string"
              ? obj.recorded_by_email
              : undefined,
          notes: typeof obj.notes === "string" ? obj.notes : undefined,
        });
      }
    } else {
      const amount = Number(obj.amount_cents) || 0;
      const projectId =
        typeof obj.project_id === "string" && obj.project_id
          ? obj.project_id
          : null;
      const projectName =
        typeof obj.project_name === "string" && obj.project_name
          ? obj.project_name
          : null;

      if (projectId && !linkedProject) {
        linkedProject = {
          id: projectId,
          name: projectName || "Linked Project",
        };
      }

      lineItems.push({
        kind: "line_item",
        description:
          typeof obj.description === "string" && obj.description.trim()
            ? obj.description.trim()
            : "Professional Software Engineering Services",
        quantity: Number(obj.quantity) || 1,
        unit_price_cents: Number(obj.unit_price_cents) || amount,
        amount_cents: amount,
        project_id: projectId,
        project_name: projectName,
      });
    }
  }

  if (lineItems.length === 0) {
    lineItems.push({
      kind: "line_item",
      description: "Professional Software Engineering Services",
      quantity: 1,
      unit_price_cents: fallbackAmountCents,
      amount_cents: fallbackAmountCents,
    });
  }

  const recordedPaidCents = paymentRecords.reduce(
    (sum, r) => sum + r.amount_cents,
    0,
  );

  return {
    lineItems,
    paymentRecords,
    linkedProject,
    recordedPaidCents,
  };
}

export type InvoiceCommercialStatus = {
  displayStatus:
    | "draft"
    | "issued"
    | "partially_paid"
    | "overdue"
    | "settled"
    | "cancelled";
  label: string;
  paidAmountCents: number;
  balanceDueCents: number;
  isOverdue: boolean;
  hasVerifiedPaymentRecord: boolean;
};

export function classifyInvoiceLifecycleStatus(invoice: {
  status: string;
  amount_cents: number;
  due_date?: string | null;
  paid_at?: string | null;
  items?: unknown;
}): InvoiceCommercialStatus {
  const parsed = parseInvoiceItems(invoice.items, invoice.amount_cents);
  const hasVerifiedPaymentRecord = parsed.paymentRecords.length > 0;

  if (invoice.status === "cancelled") {
    return {
      displayStatus: "cancelled",
      label: "Cancelled",
      paidAmountCents: parsed.recordedPaidCents,
      balanceDueCents: 0,
      isOverdue: false,
      hasVerifiedPaymentRecord,
    };
  }

  if (invoice.status === "draft") {
    return {
      displayStatus: "draft",
      label: "Draft",
      paidAmountCents: 0,
      balanceDueCents: invoice.amount_cents,
      isOverdue: false,
      hasVerifiedPaymentRecord,
    };
  }

  // Settled / Paid state
  const effectivePaidCents =
    invoice.status === "paid"
      ? Math.max(parsed.recordedPaidCents, invoice.amount_cents)
      : parsed.recordedPaidCents;

  const balanceDueCents = Math.max(
    0,
    invoice.amount_cents - effectivePaidCents,
  );

  if (
    invoice.status === "paid" ||
    (invoice.amount_cents > 0 && effectivePaidCents >= invoice.amount_cents)
  ) {
    return {
      displayStatus: "settled",
      label: "Settled (Paid)",
      paidAmountCents: effectivePaidCents,
      balanceDueCents: 0,
      isOverdue: false,
      hasVerifiedPaymentRecord,
    };
  }

  // Check if due_date is in the past
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const isPastDue = Boolean(
    invoice.due_date && invoice.due_date < todayStr,
  );
  const isOverdue = invoice.status === "overdue" || isPastDue;

  if (effectivePaidCents > 0 && effectivePaidCents < invoice.amount_cents) {
    return {
      displayStatus: "partially_paid",
      label: isOverdue ? "Partially Paid (Overdue)" : "Partially Paid",
      paidAmountCents: effectivePaidCents,
      balanceDueCents,
      isOverdue,
      hasVerifiedPaymentRecord,
    };
  }

  if (isOverdue) {
    return {
      displayStatus: "overdue",
      label: "Overdue",
      paidAmountCents: 0,
      balanceDueCents: invoice.amount_cents,
      isOverdue: true,
      hasVerifiedPaymentRecord,
    };
  }

  return {
    displayStatus: "issued",
    label: "Issued",
    paidAmountCents: 0,
    balanceDueCents: invoice.amount_cents,
    isOverdue: false,
    hasVerifiedPaymentRecord,
  };
}


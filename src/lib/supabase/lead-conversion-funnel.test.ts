import assert from "node:assert/strict";
import test from "node:test";
import {
  extractLeadService,
  formatLeadMessage,
  getLeadFollowUpStatus,
  AVAILABLE_SERVICES,
} from "./lead-service-helper.ts";
import {
  invitationEmailFailureMessage,
  safeInvitationEmailCode,
} from "./invitation-email-status.ts";

test("Lead service helper extracts requested capability and preserves message notes", () => {
  const formatted = "[Requested Service: Web Applications]\n\nWe need an edge-computing clinical telemetry platform.";
  const result = extractLeadService(formatted);

  assert.equal(result.requestedService, "Web Applications");
  assert.equal(result.notes, "We need an edge-computing clinical telemetry platform.");

  // Alternative tag syntax
  const alt = "[Service: Cloud & DevOps]\n\nAutomated CI/CD pipeline setup.";
  const altResult = extractLeadService(alt);
  assert.equal(altResult.requestedService, "Cloud & DevOps");
  assert.equal(altResult.notes, "Automated CI/CD pipeline setup.");

  // Unstructured message fallback
  const raw = "Looking for general consulting on system architecture.";
  const rawResult = extractLeadService(raw);
  assert.equal(rawResult.requestedService, "General Technical Inquiry");
  assert.equal(rawResult.notes, "Looking for general consulting on system architecture.");

  // Null message
  const nullResult = extractLeadService(null);
  assert.equal(nullResult.requestedService, "General Technical Inquiry");
  assert.equal(nullResult.notes, "");
});

test("Lead message formatter structures requested capability cleanly for storage", () => {
  const formatted = formatLeadMessage("SaaS Platforms", "Multi-tenant billing portal.");
  assert.equal(formatted, "[Requested Service: SaaS Platforms]\n\nMulti-tenant billing portal.");

  const unspec = formatLeadMessage("General Technical Inquiry", "General enquiry note.");
  assert.equal(unspec, "General enquiry note.");

  const empty = formatLeadMessage(null, "Direct note.");
  assert.equal(empty, "Direct note.");
});

test("Follow-up status helper identifies overdue vs scheduled dates accurately", () => {
  // Past date -> Overdue
  const past = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const pastStatus = getLeadFollowUpStatus(past);
  assert.equal(pastStatus.status, "overdue");
  assert.match(pastStatus.label, /^Overdue/);

  // Future date -> Scheduled
  const future = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
  const futureStatus = getLeadFollowUpStatus(future);
  assert.equal(futureStatus.status, "scheduled");

  // Null date -> None
  const noneStatus = getLeadFollowUpStatus(null);
  assert.equal(noneStatus.status, "none");
  assert.equal(noneStatus.label, "None scheduled");
});

test("Available services list covers core capabilities", () => {
  assert.ok(AVAILABLE_SERVICES.length >= 6);
  const slugs = AVAILABLE_SERVICES.map((s) => s.slug);
  assert.ok(slugs.includes("web-applications"));
  assert.ok(slugs.includes("mobile-products"));
  assert.ok(slugs.includes("ai-solutions"));
  assert.ok(slugs.includes("saas-platforms"));
  assert.ok(slugs.includes("cloud-devops"));
  assert.ok(slugs.includes("enterprise-software"));
});

test("Invitation email error classification handles unconfigured SMTP safely", () => {
  const unconfigured = invitationEmailFailureMessage({ code: "smtp_not_configured" });
  assert.match(unconfigured, /no production SMTP provider configured/i);

  const teamOnly = invitationEmailFailureMessage({ code: "email_address_not_authorized" });
  assert.match(teamOnly, /test email service only sends to project team members/i);

  const rateLimited = invitationEmailFailureMessage({ code: "over_email_send_rate_limit" });
  assert.match(rateLimited, /rate-limited/i);

  assert.equal(safeInvitationEmailCode("smtp_not_configured"), "smtp_not_configured");
  assert.equal(safeInvitationEmailCode("invalid!code#injection"), "unknown");
});

import {
  classifyOrganizationDeleteDatabaseError,
  evaluateOrganizationDeletionEligibility,
  isLikelyTestOrganizationName,
  validateOrganizationDeleteConfirmation,
} from "./organization-lifecycle-helper.ts";

test("Organization deletion eligibility blocks real client organizations with dependencies and allows empty organizations", () => {
  const emptyEligibility = evaluateOrganizationDeletionEligibility({
    projectsCount: 0,
    tasksCount: 0,
    documentsCount: 0,
    invoicesCount: 0,
    supportTicketsCount: 0,
    activeMembershipsCount: 0,
    totalMembershipsCount: 0,
    roleAssignmentsCount: 0,
    auditEventsCount: 0,
  });
  assert.equal(emptyEligibility.canPermanentlyDelete, true);
  assert.equal(emptyEligibility.totalBlockingRecords, 0);
  assert.equal(emptyEligibility.blockers.length, 0);

  const clientWithRecords = evaluateOrganizationDeletionEligibility({
    projectsCount: 0,
    tasksCount: 0,
    documentsCount: 4,
    invoicesCount: 1,
    supportTicketsCount: 0,
    activeMembershipsCount: 0,
    totalMembershipsCount: 0,
    roleAssignmentsCount: 0,
    auditEventsCount: 6,
  });
  assert.equal(clientWithRecords.canPermanentlyDelete, false);
  assert.equal(clientWithRecords.totalBlockingRecords, 11);
  assert.deepEqual(clientWithRecords.blockers, [
    "4 documents",
    "1 invoice",
    "6 retained audit events",
  ]);
  assert.match(clientWithRecords.recommendation, /Archive or Suspend/i);
});

test("Regression 23503: organization with 0 active operational rows but retained organization audit_events is blocked from permanent deletion", () => {
  // Reproduces Automation Org MV3B9DKK (14fff560-9d27-427c-b0b2-22b35212c883):
  // 0 projects, tasks, documents, invoices, tickets, and memberships, but 8 rows in public.audit_events
  // referencing public.organizations(id) via audit_events_organization_id_fkey (ON DELETE RESTRICT).
  const retainedAuditOnly = evaluateOrganizationDeletionEligibility({
    projectsCount: 0,
    tasksCount: 0,
    documentsCount: 0,
    invoicesCount: 0,
    supportTicketsCount: 0,
    activeMembershipsCount: 0,
    totalMembershipsCount: 0,
    roleAssignmentsCount: 0,
    auditEventsCount: 8,
  });
  assert.equal(retainedAuditOnly.canPermanentlyDelete, false);
  assert.equal(retainedAuditOnly.totalBlockingRecords, 8);
  assert.deepEqual(retainedAuditOnly.blockers, ["8 retained audit events"]);
  assert.match(retainedAuditOnly.recommendation, /ON DELETE RESTRICT/i);
  assert.match(retainedAuditOnly.recommendation, /Archive or Suspend/i);

  const fkErrorMessage = classifyOrganizationDeleteDatabaseError(
    {
      code: "23503",
      message:
        'update or delete on table "organizations" violates foreign key constraint "audit_events_organization_id_fkey" on table "audit_events"',
      details: 'Key (id)=(14fff560-9d27-427c-b0b2-22b35212c883) is still referenced from table "audit_events".',
    },
    "Automation Org MV3B9DKK",
  );
  assert.match(fkErrorMessage, /audit_events_organization_id_fkey \(23503\)/);
  assert.match(fkErrorMessage, /Archive or Suspend/i);
});

test("Organization permanent delete requires exact two-step name and DELETE phrase confirmation", () => {
  assert.equal(
    validateOrganizationDeleteConfirmation({
      targetOrganizationName: "Automation Org 1775810186919",
      confirmationName: "Automation Org 1775810186919",
      typedConfirmation: "DELETE Automation Org 1775810186919",
    }).valid,
    true,
  );

  assert.equal(
    validateOrganizationDeleteConfirmation({
      targetOrganizationName: "Automation Org 1775810186919",
      confirmationName: "automation org 1775810186919",
      typedConfirmation: "DELETE Automation Org 1775810186919",
    }).valid,
    false,
  );

  assert.equal(
    validateOrganizationDeleteConfirmation({
      targetOrganizationName: "Automation Org 1775810186919",
      confirmationName: "Automation Org 1775810186919",
      typedConfirmation: "delete Automation Org 1775810186919",
    }).valid,
    false,
  );

  assert.equal(isLikelyTestOrganizationName("Automation Org 1775810186919"), true);
  assert.equal(isLikelyTestOrganizationName("Phase 5 Alpha Org 1775827750592"), true);
  assert.equal(isLikelyTestOrganizationName("Code Sparks"), false);
});



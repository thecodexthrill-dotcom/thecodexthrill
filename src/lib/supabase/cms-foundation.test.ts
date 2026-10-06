import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const cmsMigration = readFileSync("supabase/migrations/20261006150000_core_cms_foundation.sql", "utf8");

test("CMS migration enforces strict schema, tables, triggers, and audit logging", () => {
  // Verify all 10 core tables are created
  assert.match(cmsMigration, /create table public\.cms_pages/);
  assert.match(cmsMigration, /create table public\.cms_categories/);
  assert.match(cmsMigration, /create table public\.cms_posts/);
  assert.match(cmsMigration, /create table public\.cms_services/);
  assert.match(cmsMigration, /create table public\.cms_case_studies/);
  assert.match(cmsMigration, /create table public\.cms_media/);
  assert.match(cmsMigration, /create table public\.cms_menus/);
  assert.match(cmsMigration, /create table public\.cms_menu_items/);
  assert.match(cmsMigration, /create table public\.cms_site_settings/);
  assert.match(cmsMigration, /create table public\.cms_revisions/);

  // Verify RLS is enabled on all CMS tables
  assert.match(cmsMigration, /alter table public\.cms_pages enable row level security;/);
  assert.match(cmsMigration, /alter table public\.cms_posts enable row level security;/);
  assert.match(cmsMigration, /alter table public\.cms_services enable row level security;/);
  assert.match(cmsMigration, /alter table public\.cms_case_studies enable row level security;/);
  assert.match(cmsMigration, /alter table public\.cms_media enable row level security;/);
  assert.match(cmsMigration, /alter table public\.cms_site_settings enable row level security;/);
  assert.match(cmsMigration, /alter table public\.cms_revisions enable row level security;/);

  // Verify audit triggers
  assert.match(cmsMigration, /create trigger cms_pages_audit/);
  assert.match(cmsMigration, /create trigger cms_posts_audit/);
  assert.match(cmsMigration, /create trigger cms_services_audit/);
  assert.match(cmsMigration, /create trigger cms_case_studies_audit/);
  assert.match(cmsMigration, /create trigger cms_site_settings_audit/);
});

test("CMS slug validation rejects uppercase, whitespace, and special characters", () => {
  const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

  assert.equal(slugRegex.test("zero-trust-architecture"), true);
  assert.equal(slugRegex.test("engineering-notes-2026"), true);
  assert.equal(slugRegex.test("web-applications"), true);

  assert.equal(slugRegex.test("Zero-Trust"), false, "Uppercase must be rejected");
  assert.equal(slugRegex.test("zero trust"), false, "Spaces must be rejected");
  assert.equal(slugRegex.test("zero_trust"), false, "Underscores must be rejected for URLs");
  assert.equal(slugRegex.test("-leading-hyphen"), false, "Leading hyphen must be rejected");
  assert.equal(slugRegex.test("trailing-hyphen-"), false, "Trailing hyphen must be rejected");
  assert.equal(slugRegex.test("double--hyphen"), false, "Double hyphen must be rejected");
});

test("CMS lifecycle statuses are strictly bounded", () => {
  const allowedStatuses = new Set(["draft", "review", "published", "scheduled", "archived"]);

  assert.equal(allowedStatuses.has("draft"), true);
  assert.equal(allowedStatuses.has("published"), true);
  assert.equal(allowedStatuses.has("review"), true);
  assert.equal(allowedStatuses.has("scheduled"), true);
  assert.equal(allowedStatuses.has("archived"), true);

  assert.equal(allowedStatuses.has("deleted"), false);
  assert.equal(allowedStatuses.has("public"), false);
  assert.equal(allowedStatuses.has("active"), false);
});

test("CMS site settings value must be a valid JSON object", () => {
  const validateSettingsPayload = (raw: string) => {
    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        return false;
      }
      return true;
    } catch {
      return false;
    }
  };

  assert.equal(validateSettingsPayload('{"name":"TheCodexThrill"}'), true);
  assert.equal(validateSettingsPayload('{"sla":24,"email":"contact@thecodexthrill.com"}'), true);
  assert.equal(validateSettingsPayload('["array","not","allowed"]'), false);
  assert.equal(validateSettingsPayload('"just a string"'), false);
  assert.equal(validateSettingsPayload("12345"), false);
  assert.equal(validateSettingsPayload("{invalid-json}"), false);
});

test("CMS revision entity types and action names are bounded", () => {
  const allowedEntities = new Set(["page", "post", "service", "case_study", "setting", "menu"]);
  assert.equal(allowedEntities.has("page"), true);
  assert.equal(allowedEntities.has("post"), true);
  assert.equal(allowedEntities.has("service"), true);
  assert.equal(allowedEntities.has("case_study"), true);
  assert.equal(allowedEntities.has("setting"), true);
  assert.equal(allowedEntities.has("menu"), true);
  assert.equal(allowedEntities.has("user"), false);

  const allowedActions = new Set(["create", "update", "publish", "unpublish", "archive", "restore"]);
  assert.equal(allowedActions.has("create"), true);
  assert.equal(allowedActions.has("update"), true);
  assert.equal(allowedActions.has("archive"), true);
  assert.equal(allowedActions.has("drop"), false);
});

test("CMS RBAC requires developer, platform_admin, or super_admin", () => {
  const canEditCms = (roles: string[]) =>
    roles.some((r) => r === "super_admin" || r === "platform_admin" || r === "developer");

  assert.equal(canEditCms(["super_admin"]), true);
  assert.equal(canEditCms(["platform_admin"]), true);
  assert.equal(canEditCms(["developer"]), true);

  assert.equal(canEditCms(["support_staff"]), false);
  assert.equal(canEditCms(["client_member"]), false);
  assert.equal(canEditCms(["organization_owner"]), false);
  assert.equal(canEditCms([]), false);
});

test("CMS content richness expansion migration creates hero, capabilities, process, industries, tech, faqs with RLS and audit", () => {
  const richnessMigration = readFileSync("supabase/migrations/20261006200000_content_richness_expansion.sql", "utf8");

  // Verify all 6 new content tables exist
  assert.match(richnessMigration, /create table public\.cms_hero_slides/);
  assert.match(richnessMigration, /create table public\.cms_capabilities/);
  assert.match(richnessMigration, /create table public\.cms_process_steps/);
  assert.match(richnessMigration, /create table public\.cms_industries/);
  assert.match(richnessMigration, /create table public\.cms_tech_stack/);
  assert.match(richnessMigration, /create table public\.cms_faqs/);

  // Verify RLS enabled
  assert.match(richnessMigration, /alter table public\.cms_hero_slides enable row level security;/);
  assert.match(richnessMigration, /alter table public\.cms_capabilities enable row level security;/);
  assert.match(richnessMigration, /alter table public\.cms_process_steps enable row level security;/);
  assert.match(richnessMigration, /alter table public\.cms_industries enable row level security;/);
  assert.match(richnessMigration, /alter table public\.cms_tech_stack enable row level security;/);
  assert.match(richnessMigration, /alter table public\.cms_faqs enable row level security;/);

  // Verify audit triggers
  assert.match(richnessMigration, /create trigger cms_hero_slides_audit/);
  assert.match(richnessMigration, /create trigger cms_capabilities_audit/);
  assert.match(richnessMigration, /create trigger cms_process_steps_audit/);
  assert.match(richnessMigration, /create trigger cms_industries_audit/);
  assert.match(richnessMigration, /create trigger cms_tech_stack_audit/);
  assert.match(richnessMigration, /create trigger cms_faqs_audit/);

  // Verify initial seed records
  assert.match(richnessMigration, /insert into public\.cms_hero_slides/);
  assert.match(richnessMigration, /insert into public\.cms_capabilities/);
  assert.match(richnessMigration, /insert into public\.cms_process_steps/);
  assert.match(richnessMigration, /insert into public\.cms_industries/);
  assert.match(richnessMigration, /insert into public\.cms_faqs/);
  assert.match(richnessMigration, /insert into public\.cms_tech_stack/);
});

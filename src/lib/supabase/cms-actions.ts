"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireWorkspace } from "@/lib/supabase/access";

export type CmsActionState = {
  error?: string;
  message?: string;
  id?: string;
};

async function verifyCmsAdminSession() {
  const { roles } = await requireWorkspace("admin", ["cms"]);
  const isCmsAuthorized = roles.some((r) => r === "super_admin" || r === "platform_admin" || r === "developer");
  if (!isCmsAuthorized) redirect("/access-denied");

  const supabase = await createClient();
  const [{ data: { user } }, { data: assurance }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
  ]);

  if (!user) redirect("/login");
  if (assurance?.currentLevel !== "aal2") {
    redirect("/mfa?next=%2Fadmin%2Fcms");
  }

  return { supabase, user, roles };
}

// ============================================================================
// 1. Pages CMS Actions
// ============================================================================

const pageSchema = z.object({
  id: z.string().uuid().optional(),
  slug: z.string().trim().min(1).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase alphanumeric with hyphens"),
  title: z.string().trim().min(1).max(200),
  content: z.string().default(""),
  status: z.enum(["draft", "review", "published", "archived"]).default("draft"),
  seoTitle: z.string().trim().max(200).optional(),
  seoDescription: z.string().trim().max(500).optional(),
  sortOrder: z.coerce.number().default(0),
});

export async function saveCmsPageAction(
  _previousState: CmsActionState,
  formData: FormData,
): Promise<CmsActionState> {
  const { supabase, user } = await verifyCmsAdminSession();

  const raw = {
    id: formData.get("id") ? String(formData.get("id")) : undefined,
    slug: formData.get("slug"),
    title: formData.get("title"),
    content: formData.get("content"),
    status: formData.get("status") || "draft",
    seoTitle: formData.get("seo_title") || undefined,
    seoDescription: formData.get("seo_description") || undefined,
    sortOrder: formData.get("sort_order") || 0,
  };

  const parsed = pageSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid page inputs." };
  }

  const { id, slug, title, content, status, seoTitle, seoDescription, sortOrder } = parsed.data;

  const payload: Record<string, unknown> = {
    slug,
    title,
    content,
    status,
    seo_title: seoTitle || null,
    seo_description: seoDescription || null,
    sort_order: sortOrder,
    updated_by: user.id,
    published_at: status === "published" ? new Date().toISOString() : null,
  };

  if (id) {
    const { error: updateError } = await supabase.from("cms_pages").update(payload).eq("id", id);
    if (updateError) return { error: `Failed to update page: ${updateError.message}` };

    await supabase.from("cms_revisions").insert({
      entity_type: "page",
      entity_id: id,
      action: "update",
      snapshot: { ...payload, id },
      actor_id: user.id,
    });
  } else {
    payload.created_by = user.id;
    const { data: newPage, error: insertError } = await supabase.from("cms_pages").insert(payload).select("id").single();
    if (insertError) return { error: `Failed to create page: ${insertError.message}` };

    if (newPage) {
      await supabase.from("cms_revisions").insert({
        entity_type: "page",
        entity_id: newPage.id,
        action: "create",
        snapshot: { ...payload, id: newPage.id },
        actor_id: user.id,
      });
    }
  }

  updateTag("cms-public");
  updateTag("cms-pages");
  revalidatePath("/admin/cms");
  revalidatePath("/");
  revalidatePath(`/${slug}`);
  return { message: "Page saved successfully." };
}

export async function deleteCmsPageAction(
  _previousState: CmsActionState,
  formData: FormData,
): Promise<CmsActionState> {
  const { supabase, user } = await verifyCmsAdminSession();
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return { error: "Invalid page ID." };

  const { data: existing } = await supabase.from("cms_pages").select("*").eq("id", id.data).single();

  const { error } = await supabase.from("cms_pages").delete().eq("id", id.data);
  if (error) return { error: `Could not delete page: ${error.message}` };

  if (existing) {
    await supabase.from("cms_revisions").insert({
      entity_type: "page",
      entity_id: id.data,
      action: "archive",
      snapshot: existing,
      actor_id: user.id,
    });
  }

  updateTag("cms-public");
  updateTag("cms-pages");
  revalidatePath("/admin/cms");
  revalidatePath("/");
  return { message: "Page deleted successfully." };
}

// ============================================================================
// 2. Blog Posts CMS Actions
// ============================================================================

const postSchema = z.object({
  id: z.string().uuid().optional(),
  slug: z.string().trim().min(1).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase alphanumeric with hyphens"),
  title: z.string().trim().min(1).max(250),
  excerpt: z.string().default(""),
  content: z.string().default(""),
  categoryId: z.string().uuid().optional(),
  authorName: z.string().default("TheCodexThrill Team"),
  status: z.enum(["draft", "review", "published", "scheduled", "archived"]).default("draft"),
  readingTime: z.string().default("5 min read"),
  seoTitle: z.string().trim().max(250).optional(),
  seoDescription: z.string().trim().max(500).optional(),
});

export async function saveCmsPostAction(
  _previousState: CmsActionState,
  formData: FormData,
): Promise<CmsActionState> {
  const { supabase, user } = await verifyCmsAdminSession();

  const raw = {
    id: formData.get("id") ? String(formData.get("id")) : undefined,
    slug: formData.get("slug"),
    title: formData.get("title"),
    excerpt: formData.get("excerpt"),
    content: formData.get("content"),
    categoryId: formData.get("category_id") || undefined,
    authorName: formData.get("author_name") || "TheCodexThrill Team",
    status: formData.get("status") || "draft",
    readingTime: formData.get("reading_time") || "5 min read",
    seoTitle: formData.get("seo_title") || undefined,
    seoDescription: formData.get("seo_description") || undefined,
  };

  const parsed = postSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid article inputs." };

  const { id, slug, title, excerpt, content, categoryId, authorName, status, readingTime, seoTitle, seoDescription } = parsed.data;

  const payload: Record<string, unknown> = {
    slug,
    title,
    excerpt,
    content,
    category_id: categoryId || null,
    author_name: authorName,
    status,
    reading_time: readingTime,
    seo_title: seoTitle || null,
    seo_description: seoDescription || null,
    updated_by: user.id,
    published_at: status === "published" ? new Date().toISOString() : null,
  };

  if (id) {
    const { error: updateError } = await supabase.from("cms_posts").update(payload).eq("id", id);
    if (updateError) return { error: `Failed to update post: ${updateError.message}` };

    await supabase.from("cms_revisions").insert({
      entity_type: "post",
      entity_id: id,
      action: "update",
      snapshot: { ...payload, id },
      actor_id: user.id,
    });
  } else {
    payload.created_by = user.id;
    const { data: newPost, error: insertError } = await supabase.from("cms_posts").insert(payload).select("id").single();
    if (insertError) return { error: `Failed to create post: ${insertError.message}` };

    if (newPost) {
      await supabase.from("cms_revisions").insert({
        entity_type: "post",
        entity_id: newPost.id,
        action: "create",
        snapshot: { ...payload, id: newPost.id },
        actor_id: user.id,
      });
    }
  }

  updateTag("cms-public");
  updateTag("cms-posts");
  revalidatePath("/admin/cms");
  revalidatePath("/");
  revalidatePath("/blog");
  revalidatePath(`/blog/${slug}`);
  return { message: "Article saved successfully." };
}

export async function deleteCmsPostAction(
  _previousState: CmsActionState,
  formData: FormData,
): Promise<CmsActionState> {
  const { supabase, user } = await verifyCmsAdminSession();
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return { error: "Invalid post ID." };

  const { data: existing } = await supabase.from("cms_posts").select("*").eq("id", id.data).single();

  const { error } = await supabase.from("cms_posts").delete().eq("id", id.data);
  if (error) return { error: `Could not delete post: ${error.message}` };

  if (existing) {
    await supabase.from("cms_revisions").insert({
      entity_type: "post",
      entity_id: id.data,
      action: "archive",
      snapshot: existing,
      actor_id: user.id,
    });
  }

  updateTag("cms-public");
  updateTag("cms-posts");
  revalidatePath("/admin/cms");
  revalidatePath("/");
  revalidatePath("/blog");
  return { message: "Article deleted successfully." };
}

// ============================================================================
// 3. Services CMS Actions
// ============================================================================

const serviceSchema = z.object({
  id: z.string().uuid().optional(),
  slug: z.string().trim().min(1).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase alphanumeric with hyphens"),
  title: z.string().trim().min(1).max(160),
  shortDescription: z.string().trim().min(1),
  fullDescription: z.string().trim().min(1),
  iconName: z.string().default("Code2"),
  features: z.string().default(""),
  ctaLabel: z.string().default("Start a Project"),
  ctaUrl: z.string().default("/contact"),
  status: z.enum(["draft", "review", "published", "archived"]).default("published"),
  sortOrder: z.coerce.number().default(0),
});

export async function saveCmsServiceAction(
  _previousState: CmsActionState,
  formData: FormData,
): Promise<CmsActionState> {
  const { supabase, user } = await verifyCmsAdminSession();

  const raw = {
    id: formData.get("id") ? String(formData.get("id")) : undefined,
    slug: formData.get("slug"),
    title: formData.get("title"),
    shortDescription: formData.get("short_description"),
    fullDescription: formData.get("full_description"),
    iconName: formData.get("icon_name") || "Code2",
    features: formData.get("features") || "",
    ctaLabel: formData.get("cta_label") || "Start a Project",
    ctaUrl: formData.get("cta_url") || "/contact",
    status: formData.get("status") || "published",
    sortOrder: formData.get("sort_order") || 0,
  };

  const parsed = serviceSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid service inputs." };

  const { id, slug, title, shortDescription, fullDescription, iconName, features, ctaLabel, ctaUrl, status, sortOrder } = parsed.data;

  const featuresArray = features
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  const payload: Record<string, unknown> = {
    slug,
    title,
    short_description: shortDescription,
    full_description: fullDescription,
    icon_name: iconName,
    features: featuresArray,
    cta_label: ctaLabel,
    cta_url: ctaUrl,
    status,
    sort_order: sortOrder,
    updated_by: user.id,
  };

  if (id) {
    const { error: updateError } = await supabase.from("cms_services").update(payload).eq("id", id);
    if (updateError) return { error: `Failed to update service: ${updateError.message}` };

    await supabase.from("cms_revisions").insert({
      entity_type: "service",
      entity_id: id,
      action: "update",
      snapshot: { ...payload, id },
      actor_id: user.id,
    });
  } else {
    payload.created_by = user.id;
    const { data: newService, error: insertError } = await supabase.from("cms_services").insert(payload).select("id").single();
    if (insertError) return { error: `Failed to create service: ${insertError.message}` };

    if (newService) {
      await supabase.from("cms_revisions").insert({
        entity_type: "service",
        entity_id: newService.id,
        action: "create",
        snapshot: { ...payload, id: newService.id },
        actor_id: user.id,
      });
    }
  }

  updateTag("cms-public");
  updateTag("cms-services");
  revalidatePath("/admin/cms");
  revalidatePath("/");
  revalidatePath("/services");
  revalidatePath(`/services/${slug}`);
  return { message: "Service saved successfully." };
}

export async function deleteCmsServiceAction(
  _previousState: CmsActionState,
  formData: FormData,
): Promise<CmsActionState> {
  const { supabase, user } = await verifyCmsAdminSession();
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return { error: "Invalid service ID." };

  const { data: existing } = await supabase.from("cms_services").select("*").eq("id", id.data).single();

  const { error } = await supabase.from("cms_services").delete().eq("id", id.data);
  if (error) return { error: `Could not delete service: ${error.message}` };

  if (existing) {
    await supabase.from("cms_revisions").insert({
      entity_type: "service",
      entity_id: id.data,
      action: "archive",
      snapshot: existing,
      actor_id: user.id,
    });
  }

  updateTag("cms-public");
  updateTag("cms-services");
  revalidatePath("/admin/cms");
  revalidatePath("/");
  revalidatePath("/services");
  return { message: "Service deleted successfully." };
}

// ============================================================================
// 4. Portfolio / Case Study CMS Actions
// ============================================================================

const caseStudySchema = z.object({
  id: z.string().uuid().optional(),
  slug: z.string().trim().min(1).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase alphanumeric with hyphens"),
  title: z.string().trim().min(1).max(200),
  clientName: z.string().trim().min(1),
  industry: z.string().trim().min(1),
  category: z.string().trim().min(1),
  summary: z.string().trim().min(1),
  challenge: z.string().trim().min(1),
  solution: z.string().trim().min(1),
  deliverables: z.string().default(""),
  results: z.string().default(""),
  technologies: z.string().default(""),
  timeline: z.string().default("12 weeks"),
  featured: z.coerce.boolean().default(false),
  status: z.enum(["draft", "review", "published", "archived"]).default("published"),
  sortOrder: z.coerce.number().default(0),
  coverImageUrl: z.string().optional(),
  seoTitle: z.string().optional(),
  seoDescription: z.string().optional(),
});

export async function saveCmsCaseStudyAction(
  _previousState: CmsActionState,
  formData: FormData,
): Promise<CmsActionState> {
  const { supabase, user } = await verifyCmsAdminSession();

  const raw = {
    id: formData.get("id") ? String(formData.get("id")) : undefined,
    slug: formData.get("slug"),
    title: formData.get("title"),
    clientName: formData.get("client_name"),
    industry: formData.get("industry"),
    category: formData.get("category"),
    summary: formData.get("summary"),
    challenge: formData.get("challenge"),
    solution: formData.get("solution"),
    deliverables: formData.get("deliverables") || "",
    results: formData.get("results") || "",
    technologies: formData.get("technologies") || "",
    timeline: formData.get("timeline") || "12 weeks",
    featured: formData.get("featured") === "on" || formData.get("featured") === "true",
    status: formData.get("status") || "published",
    sortOrder: formData.get("sort_order") || 0,
    coverImageUrl: formData.get("cover_image_url") ? String(formData.get("cover_image_url")).trim() : undefined,
    seoTitle: formData.get("seo_title") ? String(formData.get("seo_title")).trim() : undefined,
    seoDescription: formData.get("seo_description") ? String(formData.get("seo_description")).trim() : undefined,
  };

  const parsed = caseStudySchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid case study inputs." };

  const {
    id, slug, title, clientName, industry, category, summary, challenge, solution,
    deliverables, results, technologies, timeline, featured, status, sortOrder,
    coverImageUrl, seoTitle, seoDescription,
  } = parsed.data;

  const deliverablesArr = deliverables.split("\n").map((s) => s.trim()).filter(Boolean);
  const resultsArr = results.split("\n").map((s) => s.trim()).filter(Boolean);
  const techArr = technologies.split(",").map((s) => s.trim()).filter(Boolean);

  const payload: Record<string, unknown> = {
    slug,
    title,
    client_name: clientName,
    industry,
    category,
    summary,
    challenge,
    solution,
    deliverables: deliverablesArr,
    results: resultsArr,
    technologies: techArr,
    timeline,
    featured,
    status,
    sort_order: sortOrder,
    cover_image_url: coverImageUrl || null,
    seo_title: seoTitle || null,
    seo_description: seoDescription || null,
    updated_by: user.id,
  };

  if (id) {
    const { error: updateError } = await supabase.from("cms_case_studies").update(payload).eq("id", id);
    if (updateError) return { error: `Failed to update case study: ${updateError.message}` };

    await supabase.from("cms_revisions").insert({
      entity_type: "case_study",
      entity_id: id,
      action: "update",
      snapshot: { ...payload, id },
      actor_id: user.id,
    });
  } else {
    payload.created_by = user.id;
    const { data: newCase, error: insertError } = await supabase.from("cms_case_studies").insert(payload).select("id").single();
    if (insertError) return { error: `Failed to create case study: ${insertError.message}` };

    if (newCase) {
      await supabase.from("cms_revisions").insert({
        entity_type: "case_study",
        entity_id: newCase.id,
        action: "create",
        snapshot: { ...payload, id: newCase.id },
        actor_id: user.id,
      });
    }
  }

  updateTag("cms-public");
  updateTag("cms-case-studies");
  revalidatePath("/admin/cms");
  revalidatePath("/");
  revalidatePath("/portfolio");
  revalidatePath(`/portfolio/${slug}`);
  return { message: "Case study saved successfully." };
}

export async function deleteCmsCaseStudyAction(
  _previousState: CmsActionState,
  formData: FormData,
): Promise<CmsActionState> {
  const { supabase, user } = await verifyCmsAdminSession();
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return { error: "Invalid case study ID." };

  const { data: existing } = await supabase.from("cms_case_studies").select("*").eq("id", id.data).single();

  const { error } = await supabase.from("cms_case_studies").delete().eq("id", id.data);
  if (error) return { error: `Could not delete case study: ${error.message}` };

  if (existing) {
    await supabase.from("cms_revisions").insert({
      entity_type: "case_study",
      entity_id: id.data,
      action: "archive",
      snapshot: existing,
      actor_id: user.id,
    });
  }

  updateTag("cms-public");
  updateTag("cms-case-studies");
  revalidatePath("/admin/cms");
  revalidatePath("/");
  revalidatePath("/portfolio");
  return { message: "Case study deleted successfully." };
}

// ============================================================================
// 5. Global Site Settings Action
// ============================================================================

export async function updateCmsSiteSettingsAction(
  _previousState: CmsActionState,
  formData: FormData,
): Promise<CmsActionState> {
  const { supabase, user } = await verifyCmsAdminSession();

  const key = z.string().min(1).max(80).safeParse(formData.get("key"));
  const rawJson = formData.get("value");
  if (!key.success || typeof rawJson !== "string") {
    return { error: "Invalid configuration key or JSON value." };
  }

  let parsedJson: Record<string, unknown>;
  try {
    parsedJson = JSON.parse(rawJson);
    if (typeof parsedJson !== "object" || parsedJson === null || Array.isArray(parsedJson)) {
      throw new Error("Value must be a valid JSON object.");
    }
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Malformed JSON provided." };
  }

  const { error } = await supabase
    .from("cms_site_settings")
    .upsert({
      key: key.data,
      value: parsedJson,
      updated_by: user.id,
    }, { onConflict: "key" });

  if (error) return { error: `Failed to update configuration: ${error.message}` };

  await supabase.from("cms_revisions").insert({
    entity_type: "setting",
    entity_id: user.id, // reference actor for singleton
    action: "update",
    snapshot: { key: key.data, value: parsedJson },
    actor_id: user.id,
  });

  updateTag("cms-public");
  revalidatePath("/admin/cms");
  revalidatePath("/");
  return { message: `Settings for "${key.data}" updated successfully.` };
}


// ============================================================================
// 6. Hero Slides CMS Actions
// ============================================================================

const heroSlideSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(1).max(200),
  label: z.string().trim().min(1).max(200),
  tagline: z.string().trim().min(1).max(200),
  imageUrl: z.string().trim().min(1),
  altText: z.string().trim().default(""),
  linkUrl: z.string().trim().optional(),
  status: z.enum(["draft", "review", "published", "archived"]).default("published"),
  sortOrder: z.coerce.number().default(0),
  isFeatured: z.boolean().default(false),
});

export async function saveCmsHeroSlideAction(
  _previousState: CmsActionState,
  formData: FormData,
): Promise<CmsActionState> {
  const { supabase, user } = await verifyCmsAdminSession();

  const raw = {
    id: formData.get("id") ? String(formData.get("id")) : undefined,
    title: formData.get("title"),
    label: formData.get("label"),
    tagline: formData.get("tagline"),
    imageUrl: formData.get("image_url"),
    altText: formData.get("alt_text") || "",
    linkUrl: formData.get("link_url") || undefined,
    status: formData.get("status") || "published",
    sortOrder: formData.get("sort_order") || 0,
    isFeatured: formData.get("is_featured") === "true",
  };

  const parsed = heroSlideSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid hero slide inputs." };

  const { id, title, label, tagline, imageUrl, altText, linkUrl, status, sortOrder, isFeatured } = parsed.data;

  const payload: Record<string, unknown> = {
    title,
    label,
    tagline,
    image_url: imageUrl,
    alt_text: altText,
    link_url: linkUrl || null,
    status,
    sort_order: sortOrder,
    is_featured: isFeatured,
    updated_by: user.id,
  };

  if (id) {
    const { error: updateError } = await supabase.from("cms_hero_slides").update(payload).eq("id", id);
    if (updateError) return { error: `Failed to update slide: ${updateError.message}` };

    await supabase.from("cms_revisions").insert({
      entity_type: "hero_slide",
      entity_id: id,
      action: "update",
      snapshot: { ...payload, id },
      actor_id: user.id,
    });
  } else {
    payload.created_by = user.id;
    const { data: newSlide, error: insertError } = await supabase.from("cms_hero_slides").insert(payload).select("id").single();
    if (insertError) return { error: `Failed to create slide: ${insertError.message}` };

    if (newSlide) {
      await supabase.from("cms_revisions").insert({
        entity_type: "hero_slide",
        entity_id: newSlide.id,
        action: "create",
        snapshot: { ...payload, id: newSlide.id },
        actor_id: user.id,
      });
    }
  }

  updateTag("cms-public");
  revalidatePath("/admin/cms");
  revalidatePath("/");
  return { message: "Hero slide saved successfully." };
}

export async function deleteCmsHeroSlideAction(
  _previousState: CmsActionState,
  formData: FormData,
): Promise<CmsActionState> {
  const { supabase, user } = await verifyCmsAdminSession();
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return { error: "Invalid slide ID." };

  const { data: existing } = await supabase.from("cms_hero_slides").select("*").eq("id", id.data).single();

  const { error } = await supabase.from("cms_hero_slides").delete().eq("id", id.data);
  if (error) return { error: `Could not delete slide: ${error.message}` };

  if (existing) {
    await supabase.from("cms_revisions").insert({
      entity_type: "hero_slide",
      entity_id: id.data,
      action: "archive",
      snapshot: existing,
      actor_id: user.id,
    });
  }

  updateTag("cms-public");
  revalidatePath("/admin/cms");
  revalidatePath("/");
  return { message: "Hero slide deleted successfully." };
}

export async function saveCmsHeroSettingsAction(
  _previousState: CmsActionState,
  formData: FormData,
): Promise<CmsActionState> {
  const { supabase, user } = await verifyCmsAdminSession();

  const badgeText = formData.get("badge_text") ? String(formData.get("badge_text")) : "";
  const title = formData.get("title") ? String(formData.get("title")) : "";
  const lead = formData.get("lead") ? String(formData.get("lead")) : "";
  const primaryCtaLabel = formData.get("primary_cta_label") ? String(formData.get("primary_cta_label")) : "";
  const primaryCtaUrl = formData.get("primary_cta_url") ? String(formData.get("primary_cta_url")) : "";
  const secondaryCtaLabel = formData.get("secondary_cta_label") ? String(formData.get("secondary_cta_label")) : "";
  const secondaryCtaUrl = formData.get("secondary_cta_url") ? String(formData.get("secondary_cta_url")) : "";

  const payload = {
    badge_text: badgeText,
    title,
    lead,
    primary_cta_label: primaryCtaLabel,
    primary_cta_url: primaryCtaUrl,
    secondary_cta_label: secondaryCtaLabel,
    secondary_cta_url: secondaryCtaUrl,
  };

  const { error } = await supabase
    .from("cms_site_settings")
    .upsert({
      key: "hero_content",
      value: payload,
      updated_by: user.id,
    }, { onConflict: "key" });

  if (error) return { error: `Failed to update hero settings: ${error.message}` };

  await supabase.from("cms_revisions").insert({
    entity_type: "setting",
    entity_id: user.id,
    action: "update",
    snapshot: { key: "hero_content", value: payload },
    actor_id: user.id,
  });

  updateTag("cms-public");
  revalidatePath("/admin/cms");
  revalidatePath("/");
  return { message: "Hero copy updated successfully." };
}

// ============================================================================
// 7. Capabilities CMS Actions
// ============================================================================

const capabilitySchema = z.object({
  id: z.string().uuid().optional(),
  slug: z.string().trim().min(1).max(100),
  numberLabel: z.string().trim().default("01"),
  title: z.string().trim().min(1).max(200),
  headline: z.string().trim().min(1),
  description: z.string().trim().min(1),
  iconName: z.string().default("Code2"),
  deliverables: z.string().default(""),
  technologies: z.string().default(""),
  serviceSlug: z.string().default("web-applications"),
  status: z.enum(["draft", "review", "published", "archived"]).default("published"),
  sortOrder: z.coerce.number().default(0),
});

export async function saveCmsCapabilityAction(
  _previousState: CmsActionState,
  formData: FormData,
): Promise<CmsActionState> {
  const { supabase, user } = await verifyCmsAdminSession();

  const raw = {
    id: formData.get("id") ? String(formData.get("id")) : undefined,
    slug: formData.get("slug"),
    numberLabel: formData.get("number_label") || "01",
    title: formData.get("title"),
    headline: formData.get("headline"),
    description: formData.get("description"),
    iconName: formData.get("icon_name") || "Code2",
    deliverables: formData.get("deliverables") || "",
    technologies: formData.get("technologies") || "",
    serviceSlug: formData.get("service_slug") || "web-applications",
    status: formData.get("status") || "published",
    sortOrder: formData.get("sort_order") || 0,
  };

  const parsed = capabilitySchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid capability inputs." };

  const { id, slug, numberLabel, title, headline, description, iconName, deliverables, technologies, serviceSlug, status, sortOrder } = parsed.data;

  const deliverablesArr = deliverables.split("\n").map((s) => s.trim()).filter(Boolean);
  const techArr = technologies.split(",").map((s) => s.trim()).filter(Boolean);

  const payload: Record<string, unknown> = {
    slug,
    number_label: numberLabel,
    title,
    headline,
    description,
    icon_name: iconName,
    deliverables: deliverablesArr,
    technologies: techArr,
    service_slug: serviceSlug,
    status,
    sort_order: sortOrder,
    updated_by: user.id,
  };

  if (id) {
    const { error: updateError } = await supabase.from("cms_capabilities").update(payload).eq("id", id);
    if (updateError) return { error: `Failed to update capability: ${updateError.message}` };

    await supabase.from("cms_revisions").insert({
      entity_type: "capability",
      entity_id: id,
      action: "update",
      snapshot: { ...payload, id },
      actor_id: user.id,
    });
  } else {
    payload.created_by = user.id;
    const { data: newCap, error: insertError } = await supabase.from("cms_capabilities").insert(payload).select("id").single();
    if (insertError) return { error: `Failed to create capability: ${insertError.message}` };

    if (newCap) {
      await supabase.from("cms_revisions").insert({
        entity_type: "capability",
        entity_id: newCap.id,
        action: "create",
        snapshot: { ...payload, id: newCap.id },
        actor_id: user.id,
      });
    }
  }

  updateTag("cms-public");
  revalidatePath("/admin/cms");
  revalidatePath("/");
  return { message: "Capability saved successfully." };
}

export async function deleteCmsCapabilityAction(
  _previousState: CmsActionState,
  formData: FormData,
): Promise<CmsActionState> {
  const { supabase, user } = await verifyCmsAdminSession();
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return { error: "Invalid capability ID." };

  const { data: existing } = await supabase.from("cms_capabilities").select("*").eq("id", id.data).single();

  const { error } = await supabase.from("cms_capabilities").delete().eq("id", id.data);
  if (error) return { error: `Could not delete capability: ${error.message}` };

  if (existing) {
    await supabase.from("cms_revisions").insert({
      entity_type: "capability",
      entity_id: id.data,
      action: "archive",
      snapshot: existing,
      actor_id: user.id,
    });
  }

  updateTag("cms-public");
  revalidatePath("/admin/cms");
  revalidatePath("/");
  return { message: "Capability deleted successfully." };
}

// ============================================================================
// 8. Engineering Process CMS Actions
// ============================================================================

const processStepSchema = z.object({
  id: z.string().uuid().optional(),
  stepNumber: z.string().trim().default("01"),
  phaseName: z.string().trim().min(1),
  name: z.string().trim().min(1),
  duration: z.string().trim().default("Week 1"),
  iconName: z.string().default("Compass"),
  summary: z.string().trim().min(1),
  deliverables: z.string().default(""),
  qualityGate: z.string().trim().min(1),
  status: z.enum(["draft", "review", "published", "archived"]).default("published"),
  sortOrder: z.coerce.number().default(0),
});

export async function saveCmsProcessStepAction(
  _previousState: CmsActionState,
  formData: FormData,
): Promise<CmsActionState> {
  const { supabase, user } = await verifyCmsAdminSession();

  const raw = {
    id: formData.get("id") ? String(formData.get("id")) : undefined,
    stepNumber: formData.get("step_number") || "01",
    phaseName: formData.get("phase_name"),
    name: formData.get("name"),
    duration: formData.get("duration") || "Week 1",
    iconName: formData.get("icon_name") || "Compass",
    summary: formData.get("summary"),
    deliverables: formData.get("deliverables") || "",
    qualityGate: formData.get("quality_gate"),
    status: formData.get("status") || "published",
    sortOrder: formData.get("sort_order") || 0,
  };

  const parsed = processStepSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid process step inputs." };

  const { id, stepNumber, phaseName, name, duration, iconName, summary, deliverables, qualityGate, status, sortOrder } = parsed.data;

  const deliverablesArr = deliverables.split("\n").map((s) => s.trim()).filter(Boolean);

  const payload: Record<string, unknown> = {
    step_number: stepNumber,
    phase_name: phaseName,
    name,
    duration,
    icon_name: iconName,
    summary,
    deliverables: deliverablesArr,
    quality_gate: qualityGate,
    status,
    sort_order: sortOrder,
    updated_by: user.id,
  };

  if (id) {
    const { error: updateError } = await supabase.from("cms_process_steps").update(payload).eq("id", id);
    if (updateError) return { error: `Failed to update process step: ${updateError.message}` };

    await supabase.from("cms_revisions").insert({
      entity_type: "process_step",
      entity_id: id,
      action: "update",
      snapshot: { ...payload, id },
      actor_id: user.id,
    });
  } else {
    payload.created_by = user.id;
    const { data: newStep, error: insertError } = await supabase.from("cms_process_steps").insert(payload).select("id").single();
    if (insertError) return { error: `Failed to create process step: ${insertError.message}` };

    if (newStep) {
      await supabase.from("cms_revisions").insert({
        entity_type: "process_step",
        entity_id: newStep.id,
        action: "create",
        snapshot: { ...payload, id: newStep.id },
        actor_id: user.id,
      });
    }
  }

  updateTag("cms-public");
  revalidatePath("/admin/cms");
  revalidatePath("/");
  return { message: "Process step saved successfully." };
}

export async function deleteCmsProcessStepAction(
  _previousState: CmsActionState,
  formData: FormData,
): Promise<CmsActionState> {
  const { supabase, user } = await verifyCmsAdminSession();
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return { error: "Invalid process step ID." };

  const { data: existing } = await supabase.from("cms_process_steps").select("*").eq("id", id.data).single();

  const { error } = await supabase.from("cms_process_steps").delete().eq("id", id.data);
  if (error) return { error: `Could not delete process step: ${error.message}` };

  if (existing) {
    await supabase.from("cms_revisions").insert({
      entity_type: "process_step",
      entity_id: id.data,
      action: "archive",
      snapshot: existing,
      actor_id: user.id,
    });
  }

  updateTag("cms-public");
  revalidatePath("/admin/cms");
  revalidatePath("/");
  return { message: "Process step deleted successfully." };
}

// ============================================================================
// 9. Industries CMS Actions
// ============================================================================

const industrySchema = z.object({
  id: z.string().uuid().optional(),
  slug: z.string().trim().min(1).max(100),
  title: z.string().trim().min(1).max(200),
  accent: z.string().trim().min(1),
  iconName: z.string().default("Landmark"),
  challenge: z.string().trim().min(1),
  solution: z.string().trim().min(1),
  complianceTags: z.string().default(""),
  metrics: z.string().trim().min(1),
  status: z.enum(["draft", "review", "published", "archived"]).default("published"),
  sortOrder: z.coerce.number().default(0),
});

export async function saveCmsIndustryAction(
  _previousState: CmsActionState,
  formData: FormData,
): Promise<CmsActionState> {
  const { supabase, user } = await verifyCmsAdminSession();

  const raw = {
    id: formData.get("id") ? String(formData.get("id")) : undefined,
    slug: formData.get("slug"),
    title: formData.get("title"),
    accent: formData.get("accent"),
    iconName: formData.get("icon_name") || "Landmark",
    challenge: formData.get("challenge"),
    solution: formData.get("solution"),
    complianceTags: formData.get("compliance_tags") || "",
    metrics: formData.get("metrics"),
    status: formData.get("status") || "published",
    sortOrder: formData.get("sort_order") || 0,
  };

  const parsed = industrySchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid industry inputs." };

  const { id, slug, title, accent, iconName, challenge, solution, complianceTags, metrics, status, sortOrder } = parsed.data;

  const tagsArr = complianceTags.split(",").map((s) => s.trim()).filter(Boolean);

  const payload: Record<string, unknown> = {
    slug,
    title,
    accent,
    icon_name: iconName,
    challenge,
    solution,
    compliance_tags: tagsArr,
    metrics,
    status,
    sort_order: sortOrder,
    updated_by: user.id,
  };

  if (id) {
    const { error: updateError } = await supabase.from("cms_industries").update(payload).eq("id", id);
    if (updateError) return { error: `Failed to update industry: ${updateError.message}` };

    await supabase.from("cms_revisions").insert({
      entity_type: "industry",
      entity_id: id,
      action: "update",
      snapshot: { ...payload, id },
      actor_id: user.id,
    });
  } else {
    payload.created_by = user.id;
    const { data: newInd, error: insertError } = await supabase.from("cms_industries").insert(payload).select("id").single();
    if (insertError) return { error: `Failed to create industry: ${insertError.message}` };

    if (newInd) {
      await supabase.from("cms_revisions").insert({
        entity_type: "industry",
        entity_id: newInd.id,
        action: "create",
        snapshot: { ...payload, id: newInd.id },
        actor_id: user.id,
      });
    }
  }

  updateTag("cms-public");
  revalidatePath("/admin/cms");
  revalidatePath("/");
  return { message: "Industry saved successfully." };
}

export async function deleteCmsIndustryAction(
  _previousState: CmsActionState,
  formData: FormData,
): Promise<CmsActionState> {
  const { supabase, user } = await verifyCmsAdminSession();
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return { error: "Invalid industry ID." };

  const { data: existing } = await supabase.from("cms_industries").select("*").eq("id", id.data).single();

  const { error } = await supabase.from("cms_industries").delete().eq("id", id.data);
  if (error) return { error: `Could not delete industry: ${error.message}` };

  if (existing) {
    await supabase.from("cms_revisions").insert({
      entity_type: "industry",
      entity_id: id.data,
      action: "archive",
      snapshot: existing,
      actor_id: user.id,
    });
  }

  updateTag("cms-public");
  revalidatePath("/admin/cms");
  revalidatePath("/");
  return { message: "Industry deleted successfully." };
}

// ============================================================================
// 10. Technology Stack CMS Actions
// ============================================================================

const techStackSchema = z.object({
  id: z.string().uuid().optional(),
  category: z.string().trim().min(1),
  name: z.string().trim().min(1),
  role: z.string().trim().min(1),
  iconName: z.string().default("Code2"),
  status: z.enum(["draft", "review", "published", "archived"]).default("published"),
  sortOrder: z.coerce.number().default(0),
});

export async function saveCmsTechStackAction(
  _previousState: CmsActionState,
  formData: FormData,
): Promise<CmsActionState> {
  const { supabase, user } = await verifyCmsAdminSession();

  const raw = {
    id: formData.get("id") ? String(formData.get("id")) : undefined,
    category: formData.get("category"),
    name: formData.get("name"),
    role: formData.get("role"),
    iconName: formData.get("icon_name") || "Code2",
    status: formData.get("status") || "published",
    sortOrder: formData.get("sort_order") || 0,
  };

  const parsed = techStackSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid tech stack inputs." };

  const { id, category, name, role, iconName, status, sortOrder } = parsed.data;

  const payload: Record<string, unknown> = {
    category,
    name,
    role,
    icon_name: iconName,
    status,
    sort_order: sortOrder,
    updated_by: user.id,
  };

  if (id) {
    const { error: updateError } = await supabase.from("cms_tech_stack").update(payload).eq("id", id);
    if (updateError) return { error: `Failed to update technology: ${updateError.message}` };

    await supabase.from("cms_revisions").insert({
      entity_type: "tech_stack",
      entity_id: id,
      action: "update",
      snapshot: { ...payload, id },
      actor_id: user.id,
    });
  } else {
    payload.created_by = user.id;
    const { data: newTech, error: insertError } = await supabase.from("cms_tech_stack").insert(payload).select("id").single();
    if (insertError) return { error: `Failed to create technology: ${insertError.message}` };

    if (newTech) {
      await supabase.from("cms_revisions").insert({
        entity_type: "tech_stack",
        entity_id: newTech.id,
        action: "create",
        snapshot: { ...payload, id: newTech.id },
        actor_id: user.id,
      });
    }
  }

  updateTag("cms-public");
  revalidatePath("/admin/cms");
  revalidatePath("/");
  return { message: "Technology saved successfully." };
}

export async function deleteCmsTechStackAction(
  _previousState: CmsActionState,
  formData: FormData,
): Promise<CmsActionState> {
  const { supabase, user } = await verifyCmsAdminSession();
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return { error: "Invalid technology ID." };

  const { data: existing } = await supabase.from("cms_tech_stack").select("*").eq("id", id.data).single();

  const { error } = await supabase.from("cms_tech_stack").delete().eq("id", id.data);
  if (error) return { error: `Could not delete technology: ${error.message}` };

  if (existing) {
    await supabase.from("cms_revisions").insert({
      entity_type: "tech_stack",
      entity_id: id.data,
      action: "archive",
      snapshot: existing,
      actor_id: user.id,
    });
  }

  updateTag("cms-public");
  revalidatePath("/admin/cms");
  revalidatePath("/");
  return { message: "Technology deleted successfully." };
}

// ============================================================================
// 11. FAQs CMS Actions
// ============================================================================

const faqSchema = z.object({
  id: z.string().uuid().optional(),
  question: z.string().trim().min(1),
  answer: z.string().trim().min(1),
  category: z.string().trim().default("general"),
  status: z.enum(["draft", "review", "published", "archived"]).default("published"),
  sortOrder: z.coerce.number().default(0),
});

export async function saveCmsFaqAction(
  _previousState: CmsActionState,
  formData: FormData,
): Promise<CmsActionState> {
  const { supabase, user } = await verifyCmsAdminSession();

  const raw = {
    id: formData.get("id") ? String(formData.get("id")) : undefined,
    question: formData.get("question"),
    answer: formData.get("answer"),
    category: formData.get("category") || "general",
    status: formData.get("status") || "published",
    sortOrder: formData.get("sort_order") || 0,
  };

  const parsed = faqSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid FAQ inputs." };

  const { id, question, answer, category, status, sortOrder } = parsed.data;

  const payload: Record<string, unknown> = {
    question,
    answer,
    category,
    status,
    sort_order: sortOrder,
    updated_by: user.id,
  };

  if (id) {
    const { error: updateError } = await supabase.from("cms_faqs").update(payload).eq("id", id);
    if (updateError) return { error: `Failed to update FAQ: ${updateError.message}` };

    await supabase.from("cms_revisions").insert({
      entity_type: "faq",
      entity_id: id,
      action: "update",
      snapshot: { ...payload, id },
      actor_id: user.id,
    });
  } else {
    payload.created_by = user.id;
    const { data: newFaq, error: insertError } = await supabase.from("cms_faqs").insert(payload).select("id").single();
    if (insertError) return { error: `Failed to create FAQ: ${insertError.message}` };

    if (newFaq) {
      await supabase.from("cms_revisions").insert({
        entity_type: "faq",
        entity_id: newFaq.id,
        action: "create",
        snapshot: { ...payload, id: newFaq.id },
        actor_id: user.id,
      });
    }
  }

  updateTag("cms-public");
  revalidatePath("/admin/cms");
  revalidatePath("/");
  return { message: "FAQ saved successfully." };
}

export async function deleteCmsFaqAction(
  _previousState: CmsActionState,
  formData: FormData,
): Promise<CmsActionState> {
  const { supabase, user } = await verifyCmsAdminSession();
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return { error: "Invalid FAQ ID." };

  const { data: existing } = await supabase.from("cms_faqs").select("*").eq("id", id.data).single();

  const { error } = await supabase.from("cms_faqs").delete().eq("id", id.data);
  if (error) return { error: `Could not delete FAQ: ${error.message}` };

  if (existing) {
    await supabase.from("cms_revisions").insert({
      entity_type: "faq",
      entity_id: id.data,
      action: "archive",
      snapshot: existing,
      actor_id: user.id,
    });
  }

  updateTag("cms-public");
  revalidatePath("/admin/cms");
  revalidatePath("/");
  return { message: "FAQ deleted successfully." };
}

// ============================================================================
// 12. Media Library CMS Actions (cms_media)
// ============================================================================

const mediaSchema = z.object({
  id: z.string().uuid().optional(),
  fileName: z.string().trim().min(1).max(255),
  publicUrl: z.string().trim().min(1).max(2000),
  mimeType: z.string().trim().default("image/jpeg"),
  fileSizeBytes: z.coerce.number().int().min(1).default(1024),
  category: z.string().trim().default("general"),
  altText: z.string().trim().max(500).default(""),
  isArchived: z.boolean().default(false),
});

export async function saveCmsMediaAction(
  _previousState: CmsActionState,
  formData: FormData,
): Promise<CmsActionState> {
  const { supabase, user } = await verifyCmsAdminSession();

  const file = formData.get("file");
  let fileSizeBytes = formData.get("file_size_bytes") ? Number(formData.get("file_size_bytes")) : 1024;
  let mimeType = (formData.get("mime_type") as string) || "image/jpeg";
  let fileName = (formData.get("file_name") as string)?.trim() || "";
  let publicUrl = (formData.get("public_url") as string)?.trim() || "";

  if (file && typeof file === "object" && "size" in file && (file as File).size > 0) {
    const uploadedFile = file as File;
    fileName = fileName || uploadedFile.name;
    mimeType = uploadedFile.type || mimeType;
    fileSizeBytes = uploadedFile.size;
    const sanitizedFileName = uploadedFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `cms-media/${Date.now()}-${sanitizedFileName}`;

    try {
      const adminSupabase = createAdminClient();
      const arrayBuffer = await uploadedFile.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const { error: uploadErr } = await adminSupabase.storage
        .from("cms-media")
        .upload(storagePath, buffer, {
          contentType: mimeType,
          upsert: true,
        });

      if (!uploadErr) {
        const { data: publicUrlData } = adminSupabase.storage
          .from("cms-media")
          .getPublicUrl(storagePath);
        publicUrl = publicUrlData?.publicUrl || `/brand/${sanitizedFileName}`;
      } else {
        publicUrl = publicUrl || `/brand/${sanitizedFileName}`;
      }
    } catch {
      publicUrl = publicUrl || `/brand/${sanitizedFileName}`;
    }
  }

  const raw = {
    id: formData.get("id") ? String(formData.get("id")) : undefined,
    fileName: fileName || "media-asset",
    publicUrl: publicUrl || "/brand/thecodexthrill-banner.jpg",
    mimeType,
    fileSizeBytes: isNaN(fileSizeBytes) || fileSizeBytes <= 0 ? 1024 : fileSizeBytes,
    category: formData.get("category") || "general",
    altText: formData.get("alt_text") || "",
    isArchived: formData.get("is_archived") === "true",
  };

  const parsed = mediaSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid media asset inputs." };
  }

  const { id, fileName: validFileName, publicUrl: validPublicUrl, mimeType: validMime, fileSizeBytes: validSize, category, altText, isArchived } =
    parsed.data;

  if (id) {
    const { error } = await supabase
      .from("cms_media")
      .update({
        file_name: validFileName,
        public_url: validPublicUrl,
        mime_type: validMime,
        file_size_bytes: validSize,
        category,
        alt_text: altText,
        is_archived: isArchived,
      })
      .eq("id", id);

    if (error) return { error: `Failed to update media asset: ${error.message}` };
  } else {
    const storagePath = `cms-media/${Date.now()}-${validFileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const { error } = await supabase.from("cms_media").insert({
      file_name: validFileName,
      storage_path: storagePath,
      public_url: validPublicUrl,
      mime_type: validMime,
      file_size_bytes: validSize,
      category,
      alt_text: altText,
      uploaded_by: user.id,
      is_archived: isArchived,
    });

    if (error) return { error: `Failed to register media asset: ${error.message}` };
  }

  updateTag("cms-public");
  revalidatePath("/admin/cms");
  return { message: "Media asset saved successfully." };
}

export async function deleteCmsMediaAction(
  _previousState: CmsActionState,
  formData: FormData,
): Promise<CmsActionState> {
  const { supabase } = await verifyCmsAdminSession();
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return { error: "Invalid media asset ID." };

  const { error } = await supabase.from("cms_media").delete().eq("id", id.data);
  if (error) return { error: `Could not delete media asset: ${error.message}` };

  updateTag("cms-public");
  revalidatePath("/admin/cms");
  return { message: "Media asset deleted." };
}

// ============================================================================
// 13. Navigation Menus CMS Actions (cms_menus & cms_menu_items)
// ============================================================================

const menuCodeTitles: Record<string, string> = {
  header: "Primary Header Navigation",
  footer_services: "Footer Services Column",
  footer_company: "Footer Company Column",
  footer_platform: "Footer Platform Column",
  footer_legal: "Footer Trust & Legal Column",
};

const menuItemSchema = z.object({
  id: z.string().uuid().optional(),
  menuCode: z.enum([
    "header",
    "footer_services",
    "footer_company",
    "footer_platform",
    "footer_legal",
  ]),
  label: z.string().trim().min(1).max(120),
  href: z.string().trim().min(1).max(500),
  isExternal: z.boolean().default(false),
  isVisible: z.boolean().default(true),
  sortOrder: z.coerce.number().default(0),
});

export async function saveCmsMenuItemAction(
  _previousState: CmsActionState,
  formData: FormData,
): Promise<CmsActionState> {
  const { supabase, user } = await verifyCmsAdminSession();

  const raw = {
    id: formData.get("id") ? String(formData.get("id")) : undefined,
    menuCode: formData.get("menu_code") || "header",
    label: formData.get("label"),
    href: formData.get("href"),
    isExternal: formData.get("is_external") === "true",
    isVisible: formData.get("is_visible") !== "false",
    sortOrder: formData.get("sort_order") || 0,
  };

  const parsed = menuItemSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid navigation menu item inputs." };
  }

  const { id, menuCode, label, href, isExternal, isVisible, sortOrder } = parsed.data;

  // Ensure parent menu exists for menuCode
  const { data: menuRecord, error: menuError } = await supabase
    .from("cms_menus")
    .upsert(
      {
        code: menuCode,
        title: menuCodeTitles[menuCode] || menuCode,
      },
      { onConflict: "code" },
    )
    .select("id")
    .single();

  if (menuError || !menuRecord) {
    return { error: `Failed to resolve menu container: ${menuError?.message ?? "Unknown error"}` };
  }

  const payload = {
    menu_id: menuRecord.id,
    label,
    href,
    is_external: isExternal,
    is_visible: isVisible,
    sort_order: sortOrder,
  };

  if (id) {
    const { error } = await supabase.from("cms_menu_items").update(payload).eq("id", id);
    if (error) return { error: `Failed to update navigation link: ${error.message}` };
  } else {
    const { error } = await supabase.from("cms_menu_items").insert(payload);
    if (error) return { error: `Failed to create navigation link: ${error.message}` };
  }

  await supabase.from("cms_revisions").insert({
    entity_type: "menu",
    entity_id: menuRecord.id,
    action: id ? "update" : "create",
    snapshot: { menuCode, ...payload, id: id ?? null },
    actor_id: user.id,
  });

  updateTag("cms-public");
  revalidatePath("/admin/cms");
  revalidatePath("/");
  return { message: "Navigation link saved successfully." };
}

export async function deleteCmsMenuItemAction(
  _previousState: CmsActionState,
  formData: FormData,
): Promise<CmsActionState> {
  const { supabase } = await verifyCmsAdminSession();
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return { error: "Invalid menu item ID." };

  const { error } = await supabase.from("cms_menu_items").delete().eq("id", id.data);
  if (error) return { error: `Could not delete navigation link: ${error.message}` };

  updateTag("cms-public");
  revalidatePath("/admin/cms");
  revalidatePath("/");
  return { message: "Navigation link removed." };
}

// ============================================================================
// 14. CMS Revision Snapshot Restore Action (cms_revisions)
// ============================================================================

export async function restoreCmsRevisionAction(
  _previousState: CmsActionState,
  formData: FormData,
): Promise<CmsActionState> {
  const { supabase, user } = await verifyCmsAdminSession();
  const revisionId = z.string().uuid().safeParse(formData.get("revision_id"));
  if (!revisionId.success) return { error: "Invalid revision ID." };

  const { data: revision, error: fetchError } = await supabase
    .from("cms_revisions")
    .select("id, entity_type, entity_id, snapshot")
    .eq("id", revisionId.data)
    .single();

  if (fetchError || !revision) {
    return { error: "Revision snapshot could not be loaded." };
  }

  const snap = (revision.snapshot ?? {}) as Record<string, unknown>;
  const entityType = revision.entity_type as string;
  const entityId = revision.entity_id as string;

  if (entityType === "page" && typeof snap.slug === "string" && typeof snap.title === "string") {
    const { error } = await supabase.from("cms_pages").upsert({
      id: entityId,
      slug: snap.slug,
      title: snap.title,
      content: typeof snap.content === "string" ? snap.content : "",
      status: typeof snap.status === "string" ? snap.status : "draft",
      seo_title: typeof snap.seo_title === "string" ? snap.seo_title : null,
      seo_description: typeof snap.seo_description === "string" ? snap.seo_description : null,
      sort_order: typeof snap.sort_order === "number" ? snap.sort_order : 0,
      updated_by: user.id,
    });
    if (error) return { error: `Failed to restore page snapshot: ${error.message}` };
  } else if (entityType === "post" && typeof snap.slug === "string" && typeof snap.title === "string") {
    const { error } = await supabase.from("cms_posts").upsert({
      id: entityId,
      slug: snap.slug,
      title: snap.title,
      excerpt: typeof snap.excerpt === "string" ? snap.excerpt : "",
      content: typeof snap.content === "string" ? snap.content : "",
      author_name: typeof snap.author_name === "string" ? snap.author_name : "TheCodexThrill Team",
      status: typeof snap.status === "string" ? snap.status : "draft",
      reading_time: typeof snap.reading_time === "string" ? snap.reading_time : "5 min read",
      seo_title: typeof snap.seo_title === "string" ? snap.seo_title : null,
      seo_description: typeof snap.seo_description === "string" ? snap.seo_description : null,
      updated_by: user.id,
    });
    if (error) return { error: `Failed to restore article snapshot: ${error.message}` };
  } else if (entityType === "service" && typeof snap.slug === "string" && typeof snap.title === "string") {
    const { error } = await supabase.from("cms_services").upsert({
      id: entityId,
      slug: snap.slug,
      title: snap.title,
      short_description: typeof snap.short_description === "string" ? snap.short_description : "",
      full_description: typeof snap.full_description === "string" ? snap.full_description : "",
      icon_name: typeof snap.icon_name === "string" ? snap.icon_name : "Code2",
      features: Array.isArray(snap.features) ? snap.features : [],
      cta_label: typeof snap.cta_label === "string" ? snap.cta_label : "Start a Project",
      cta_url: typeof snap.cta_url === "string" ? snap.cta_url : "/contact",
      status: typeof snap.status === "string" ? snap.status : "published",
      sort_order: typeof snap.sort_order === "number" ? snap.sort_order : 0,
      updated_by: user.id,
    });
    if (error) return { error: `Failed to restore service snapshot: ${error.message}` };
  } else if (entityType === "case_study" && typeof snap.slug === "string" && typeof snap.title === "string") {
    const { error } = await supabase.from("cms_case_studies").upsert({
      id: entityId,
      slug: snap.slug,
      title: snap.title,
      client_name: typeof snap.client_name === "string" ? snap.client_name : "",
      industry: typeof snap.industry === "string" ? snap.industry : "",
      category: typeof snap.category === "string" ? snap.category : "Enterprise Platform",
      summary: typeof snap.summary === "string" ? snap.summary : "",
      challenge: typeof snap.challenge === "string" ? snap.challenge : "",
      solution: typeof snap.solution === "string" ? snap.solution : "",
      deliverables: Array.isArray(snap.deliverables) ? snap.deliverables : [],
      results: Array.isArray(snap.results) ? snap.results : [],
      technologies: Array.isArray(snap.technologies) ? snap.technologies : [],
      timeline: typeof snap.timeline === "string" ? snap.timeline : "12 weeks",
      featured: typeof snap.featured === "boolean" ? snap.featured : false,
      cover_image_url: typeof snap.cover_image_url === "string" ? snap.cover_image_url : null,
      seo_title: typeof snap.seo_title === "string" ? snap.seo_title : null,
      seo_description: typeof snap.seo_description === "string" ? snap.seo_description : null,
      status: typeof snap.status === "string" ? snap.status : "published",
      sort_order: typeof snap.sort_order === "number" ? snap.sort_order : 0,
      updated_by: user.id,
    });
    if (error) return { error: `Failed to restore case study snapshot: ${error.message}` };
  } else if (entityType === "setting" && typeof snap.key === "string" && snap.value && typeof snap.value === "object") {
    const { error } = await supabase.from("cms_site_settings").upsert(
      {
        key: snap.key,
        value: snap.value,
        updated_by: user.id,
      },
      { onConflict: "key" },
    );
    if (error) return { error: `Failed to restore site setting snapshot: ${error.message}` };
  } else {
    return {
      error: `Direct restore is not supported for ${entityType} snapshots without required fields.`,
    };
  }

  await supabase.from("cms_revisions").insert({
    entity_type: entityType,
    entity_id: entityId,
    action: "restore",
    snapshot: snap,
    actor_id: user.id,
  });

  updateTag("cms-public");
  updateTag("cms-pages");
  updateTag("cms-posts");
  updateTag("cms-services");
  updateTag("cms-case-studies");
  revalidatePath("/admin/cms");
  revalidatePath("/");
  return { message: `Restored ${entityType} snapshot from revision ${revisionId.data.slice(0, 8)}.` };
}


"use client";

import { useActionState, useState } from "react";
import { Edit2, Plus, Trash2, RotateCcw, Copy, Check, Video, Image as ImageIcon } from "lucide-react";
import {
  saveCmsPageAction,
  deleteCmsPageAction,
  saveCmsPostAction,
  deleteCmsPostAction,
  saveCmsCaseStudyAction,
  deleteCmsCaseStudyAction,
  saveCmsServiceAction,
  deleteCmsServiceAction,
  updateCmsSiteSettingsAction,
  saveCmsHeroSlideAction,
  deleteCmsHeroSlideAction,
  saveCmsHeroSettingsAction,
  saveCmsCapabilityAction,
  deleteCmsCapabilityAction,
  saveCmsProcessStepAction,
  deleteCmsProcessStepAction,
  saveCmsIndustryAction,
  deleteCmsIndustryAction,
  saveCmsTechStackAction,
  deleteCmsTechStackAction,
  saveCmsFaqAction,
  deleteCmsFaqAction,
  saveCmsMediaAction,
  deleteCmsMediaAction,
  saveCmsMenuItemAction,
  deleteCmsMenuItemAction,
  restoreCmsRevisionAction,
  type CmsActionState,
} from "@/lib/supabase/cms-actions";

const initialState: CmsActionState = {};

// ============================================================================
// 1. Pages Management Component
// ============================================================================

export type CmsPageRecord = {
  id: string;
  slug: string;
  title: string;
  content: string;
  status: string;
  seo_title: string | null;
  seo_description: string | null;
  sort_order: number;
  published_at: string | null;
  updated_at: string;
};

export function CmsPagesManager({ pages }: { pages: CmsPageRecord[] }) {
  const [saveState, saveAction, savePending] = useActionState(saveCmsPageAction, initialState);
  const [deleteState, deleteAction, deletePending] = useActionState(deleteCmsPageAction, initialState);
  const [editingPage, setEditingPage] = useState<CmsPageRecord | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  return (
    <div className="workspace-content">
      <section className="module-panel">
        <div className="module-heading" style={{ marginTop: 0 }}>
          <div>
            <p className="eyebrow">CMS ENGINE · PAGES</p>
            <h2>Managed website pages</h2>
            <p>Publish, draft, and optimize standalone pages across the application shell.</p>
          </div>
          <button
            className="button button-gold module-heading-action"
            onClick={() => {
              setEditingPage(null);
              setIsCreating(!isCreating);
            }}
            type="button"
          >
            <Plus size={16} /> {isCreating ? "Close Editor" : "New Page"}
          </button>
        </div>

        {saveState.error && <p className="module-alert" role="alert">{saveState.error}</p>}
        {saveState.message && <p className="module-success" role="status">{saveState.message}</p>}
        {deleteState.error && <p className="module-alert" role="alert">{deleteState.error}</p>}
        {deleteState.message && <p className="module-success" role="status">{deleteState.message}</p>}

        {(isCreating || editingPage) && (
          <form action={saveAction} className="auth-form lead-create-form" style={{ marginTop: "24px", marginBottom: "32px", padding: "20px", border: "1px solid var(--line)", borderRadius: "14px", background: "var(--surface-raised)" }}>
            {editingPage && <input name="id" type="hidden" value={editingPage.id} />}
            <label>
              Title *
              <input defaultValue={editingPage?.title ?? ""} name="title" placeholder="Company Overview" required type="text" />
            </label>
            <label>
              URL Slug *
              <input defaultValue={editingPage?.slug ?? ""} name="slug" placeholder="company-overview" required type="text" />
            </label>
            <label>
              Lifecycle Status
              <select defaultValue={editingPage?.status ?? "draft"} name="status">
                <option value="draft">Draft</option>
                <option value="review">Review</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </select>
            </label>
            <label>
              Sort Order
              <input defaultValue={editingPage?.sort_order ?? 0} name="sort_order" type="number" />
            </label>
            <label>
              SEO Meta Title
              <input defaultValue={editingPage?.seo_title ?? ""} name="seo_title" placeholder="Custom SEO Title" type="text" />
            </label>
            <label>
              SEO Meta Description
              <input defaultValue={editingPage?.seo_description ?? ""} name="seo_description" placeholder="Short description for search engines" type="text" />
            </label>
            <label style={{ gridColumn: "1 / -1" }}>
              Page Content (Markdown / Text)
              <textarea defaultValue={editingPage?.content ?? ""} name="content" placeholder="Write page content..." rows={6} />
            </label>
            <div style={{ display: "flex", gap: "10px", gridColumn: "1 / -1" }}>
              <button className="button button-gold" disabled={savePending} type="submit">
                {savePending ? "Saving Page…" : editingPage ? "Update Page" : "Create Page"}
              </button>
              <button
                className="button button-secondary"
                onClick={() => {
                  setEditingPage(null);
                  setIsCreating(false);
                }}
                type="button"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        <div className="module-table-wrap" style={{ marginTop: "20px" }}>
          <table className="module-table">
            <thead>
              <tr>
                <th>Title &amp; Slug</th>
                <th>Status</th>
                <th>Order</th>
                <th>Last Updated</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pages.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", padding: "24px" }}>
                    No custom CMS pages configured yet. Click &quot;New Page&quot; to author one.
                  </td>
                </tr>
              ) : (
                pages.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <strong>{p.title}</strong>
                      <small>/{p.slug}</small>
                    </td>
                    <td>
                      <span className="record-status">{p.status}</span>
                    </td>
                    <td>{p.sort_order}</td>
                    <td>{new Date(p.updated_at).toLocaleDateString()}</td>
                    <td>
                      <div style={{ display: "flex", gap: "8px" }}>
                        <button
                          className="button button-small button-secondary"
                          onClick={() => {
                            setIsCreating(false);
                            setEditingPage(p);
                          }}
                          type="button"
                        >
                          <Edit2 size={13} /> Edit
                        </button>
                        <form action={deleteAction}>
                          <input name="id" type="hidden" value={p.id} />
                          <button className="button button-small button-danger" disabled={deletePending} type="submit">
                            <Trash2 size={13} />
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

// ============================================================================
// 2. Blog Posts Management Component
// ============================================================================

export type CmsPostRecord = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  author_name: string;
  status: string;
  reading_time: string | null;
  seo_title: string | null;
  seo_description: string | null;
  published_at: string | null;
  updated_at: string;
};

export function CmsBlogManager({ posts }: { posts: CmsPostRecord[] }) {
  const [saveState, saveAction, savePending] = useActionState(saveCmsPostAction, initialState);
  const [deleteState, deleteAction, deletePending] = useActionState(deleteCmsPostAction, initialState);
  const [editingPost, setEditingPost] = useState<CmsPostRecord | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  return (
    <div className="workspace-content">
      <section className="module-panel">
        <div className="module-heading" style={{ marginTop: 0 }}>
          <div>
            <p className="eyebrow">CMS ENGINE · INSIGHTS &amp; BLOG</p>
            <h2>Technical insights &amp; publications</h2>
            <p>Draft, publish, and schedule thought leadership articles and engineering notes.</p>
          </div>
          <button
            className="button button-gold module-heading-action"
            onClick={() => {
              setEditingPost(null);
              setIsCreating(!isCreating);
            }}
            type="button"
          >
            <Plus size={16} /> {isCreating ? "Close Editor" : "New Article"}
          </button>
        </div>

        {saveState.error && <p className="module-alert" role="alert">{saveState.error}</p>}
        {saveState.message && <p className="module-success" role="status">{saveState.message}</p>}
        {deleteState.error && <p className="module-alert" role="alert">{deleteState.error}</p>}
        {deleteState.message && <p className="module-success" role="status">{deleteState.message}</p>}

        {(isCreating || editingPost) && (
          <form action={saveAction} className="auth-form lead-create-form" style={{ marginTop: "24px", marginBottom: "32px", padding: "20px", border: "1px solid var(--line)", borderRadius: "14px", background: "var(--surface-raised)" }}>
            {editingPost && <input name="id" type="hidden" value={editingPost.id} />}
            <label>
              Article Title *
              <input defaultValue={editingPost?.title ?? ""} name="title" placeholder="Architecting for Zero Trust" required type="text" />
            </label>
            <label>
              URL Slug *
              <input defaultValue={editingPost?.slug ?? ""} name="slug" placeholder="architecting-for-zero-trust" required type="text" />
            </label>
            <label>
              Author Name
              <input defaultValue={editingPost?.author_name ?? "TheCodexThrill Team"} name="author_name" type="text" />
            </label>
            <label>
              Status
              <select defaultValue={editingPost?.status ?? "draft"} name="status">
                <option value="draft">Draft</option>
                <option value="review">Review</option>
                <option value="published">Published</option>
                <option value="scheduled">Scheduled</option>
                <option value="archived">Archived</option>
              </select>
            </label>
            <label>
              Estimated Reading Time
              <input defaultValue={editingPost?.reading_time ?? "5 min read"} name="reading_time" type="text" />
            </label>
            <label>
              SEO Meta Title
              <input defaultValue={editingPost?.seo_title ?? ""} name="seo_title" type="text" />
            </label>
            <label style={{ gridColumn: "1 / -1" }}>
              Executive Excerpt
              <textarea defaultValue={editingPost?.excerpt ?? ""} name="excerpt" placeholder="Short preview text for listings..." rows={2} />
            </label>
            <label style={{ gridColumn: "1 / -1" }}>
              Article Body Content
              <textarea defaultValue={editingPost?.content ?? ""} name="content" placeholder="Full body content or markdown..." rows={8} />
            </label>
            <div style={{ display: "flex", gap: "10px", gridColumn: "1 / -1" }}>
              <button className="button button-gold" disabled={savePending} type="submit">
                {savePending ? "Saving Article…" : editingPost ? "Update Article" : "Create Article"}
              </button>
              <button
                className="button button-secondary"
                onClick={() => {
                  setEditingPost(null);
                  setIsCreating(false);
                }}
                type="button"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        <div className="module-table-wrap" style={{ marginTop: "20px" }}>
          <table className="module-table">
            <thead>
              <tr>
                <th>Article</th>
                <th>Author</th>
                <th>Status</th>
                <th>Read Time</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {posts.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", padding: "24px" }}>
                    No blog articles stored in database yet. Click &quot;New Article&quot; to publish one.
                  </td>
                </tr>
              ) : (
                posts.map((post) => (
                  <tr key={post.id}>
                    <td>
                      <strong>{post.title}</strong>
                      <small>/blog/{post.slug}</small>
                    </td>
                    <td>{post.author_name}</td>
                    <td>
                      <span className="record-status">{post.status}</span>
                    </td>
                    <td>{post.reading_time}</td>
                    <td>
                      <div style={{ display: "flex", gap: "8px" }}>
                        <button
                          className="button button-small button-secondary"
                          onClick={() => {
                            setIsCreating(false);
                            setEditingPost(post);
                          }}
                          type="button"
                        >
                          <Edit2 size={13} /> Edit
                        </button>
                        <form action={deleteAction}>
                          <input name="id" type="hidden" value={post.id} />
                          <button className="button button-small button-danger" disabled={deletePending} type="submit">
                            <Trash2 size={13} />
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

// ============================================================================
// 3. Portfolio / Case Studies Management Component
// ============================================================================

export type CmsCaseStudyRecord = {
  id: string;
  slug: string;
  title: string;
  client_name: string;
  industry: string;
  category: string;
  summary: string;
  challenge: string;
  solution: string;
  deliverables: string[];
  results: string[];
  technologies: string[];
  timeline: string;
  featured: boolean;
  status: string;
  sort_order: number;
  cover_image_url?: string | null;
  seo_title?: string | null;
  seo_description?: string | null;
};

export function CmsPortfolioManager({ caseStudies }: { caseStudies: CmsCaseStudyRecord[] }) {
  const [saveState, saveAction, savePending] = useActionState(saveCmsCaseStudyAction, initialState);
  const [deleteState, deleteAction, deletePending] = useActionState(deleteCmsCaseStudyAction, initialState);
  const [editingCase, setEditingCase] = useState<CmsCaseStudyRecord | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  return (
    <div className="workspace-content">
      <section className="module-panel">
        <div className="module-heading" style={{ marginTop: 0 }}>
          <div>
            <p className="eyebrow">CMS ENGINE · SELECTED WORK</p>
            <h2>Portfolio &amp; case studies</h2>
            <p>Curate client deliverables, architectural challenges, and verified production outcomes.</p>
          </div>
          <button
            className="button button-gold module-heading-action"
            onClick={() => {
              setEditingCase(null);
              setIsCreating(!isCreating);
            }}
            type="button"
          >
            <Plus size={16} /> {isCreating ? "Close Editor" : "New Case Study"}
          </button>
        </div>

        {saveState.error && <p className="module-alert" role="alert">{saveState.error}</p>}
        {saveState.message && <p className="module-success" role="status">{saveState.message}</p>}
        {deleteState.error && <p className="module-alert" role="alert">{deleteState.error}</p>}
        {deleteState.message && <p className="module-success" role="status">{deleteState.message}</p>}

        {(isCreating || editingCase) && (
          <form action={saveAction} className="auth-form lead-create-form" style={{ marginTop: "24px", marginBottom: "32px", padding: "20px", border: "1px solid var(--line)", borderRadius: "14px", background: "var(--surface-raised)" }}>
            {editingCase && <input name="id" type="hidden" value={editingCase.id} />}
            <label>
              Project Title *
              <input defaultValue={editingCase?.title ?? ""} name="title" placeholder="Apex Capital Engine" required type="text" />
            </label>
            <label>
              URL Slug *
              <input defaultValue={editingCase?.slug ?? ""} name="slug" placeholder="apex-capital-engine" required type="text" />
            </label>
            <label>
              Client Name *
              <input defaultValue={editingCase?.client_name ?? ""} name="client_name" placeholder="Apex Global Assets" required type="text" />
            </label>
            <label>
              Industry *
              <input defaultValue={editingCase?.industry ?? ""} name="industry" placeholder="Fintech & Banking" required type="text" />
            </label>
            <label>
              Category *
              <input defaultValue={editingCase?.category ?? "Enterprise Software"} name="category" placeholder="Enterprise Software" required type="text" />
            </label>
            <label>
              Timeline
              <input defaultValue={editingCase?.timeline ?? "12 weeks"} name="timeline" type="text" />
            </label>
            <label>
              Sort Order
              <input defaultValue={editingCase?.sort_order ?? 0} name="sort_order" type="number" />
            </label>
            <label>
              Cover Image URL (optional)
              <input defaultValue={editingCase?.cover_image_url ?? ""} name="cover_image_url" placeholder="/brand/thecodexthrill-banner.jpg" type="text" />
            </label>
            <label>
              Technologies (comma separated)
              <input defaultValue={editingCase?.technologies?.join(", ") ?? ""} name="technologies" placeholder="Next.js 16, Supabase Cloud, PostgreSQL RLS" type="text" />
            </label>
            <label>
              Status
              <select defaultValue={editingCase?.status ?? "published"} name="status">
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </select>
            </label>
            <label>
              SEO Title (optional)
              <input defaultValue={editingCase?.seo_title ?? ""} name="seo_title" placeholder="Apex Capital — Case Study" type="text" />
            </label>
            <label>
              SEO Meta Description (optional)
              <input defaultValue={editingCase?.seo_description ?? ""} name="seo_description" placeholder="Architectural overview of Apex Capital Engine..." type="text" />
            </label>
            <label className="workspace-check" style={{ gridColumn: "1 / -1" }}>
              <input defaultChecked={editingCase?.featured ?? false} name="featured" type="checkbox" />
              <span>Feature prominently on homepage and portfolio header</span>
            </label>
            <label style={{ gridColumn: "1 / -1" }}>
              Summary *
              <textarea defaultValue={editingCase?.summary ?? ""} name="summary" placeholder="Executive summary of the project..." required rows={2} />
            </label>
            <label>
              Challenge Description *
              <textarea defaultValue={editingCase?.challenge ?? ""} name="challenge" placeholder="The architectural or business challenge..." required rows={4} />
            </label>
            <label>
              Engineering Solution *
              <textarea defaultValue={editingCase?.solution ?? ""} name="solution" placeholder="How TheCodexThrill engineered the solution..." required rows={4} />
            </label>
            <label>
              Key Deliverables (one per line)
              <textarea defaultValue={editingCase?.deliverables?.join("\n") ?? ""} name="deliverables" placeholder="Real-time transaction reconciliation pipeline&#10;Audited fund allocation ledger" rows={4} />
            </label>
            <label>
              Verified Outcomes &amp; Metrics (one per line)
              <textarea defaultValue={editingCase?.results?.join("\n") ?? ""} name="results" placeholder="Sub-50ms reconciliation queries&#10;Zero cross-tenant data leakage" rows={4} />
            </label>
            <div style={{ display: "flex", gap: "10px", gridColumn: "1 / -1" }}>
              <button className="button button-gold" disabled={savePending} type="submit">
                {savePending ? "Saving Case Study…" : editingCase ? "Update Case Study" : "Create Case Study"}
              </button>
              <button
                className="button button-secondary"
                onClick={() => {
                  setEditingCase(null);
                  setIsCreating(false);
                }}
                type="button"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        <div className="module-table-wrap" style={{ marginTop: "20px" }}>
          <table className="module-table">
            <thead>
              <tr>
                <th>Case Study</th>
                <th>Client</th>
                <th>Category</th>
                <th>Featured</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {caseStudies.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: "24px" }}>
                    No case studies in database. Click &quot;New Case Study&quot; to publish one.
                  </td>
                </tr>
              ) : (
                caseStudies.map((cs) => (
                  <tr key={cs.id}>
                    <td>
                      <strong>{cs.title}</strong>
                      <small>/portfolio/{cs.slug}</small>
                    </td>
                    <td>{cs.client_name}</td>
                    <td>{cs.category}</td>
                    <td>{cs.featured ? "★ Featured" : "Standard"}</td>
                    <td>
                      <span className="record-status">{cs.status}</span>
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: "8px" }}>
                        <button
                          className="button button-small button-secondary"
                          onClick={() => {
                            setIsCreating(false);
                            setEditingCase(cs);
                          }}
                          type="button"
                        >
                          <Edit2 size={13} /> Edit
                        </button>
                        <form action={deleteAction}>
                          <input name="id" type="hidden" value={cs.id} />
                          <button className="button button-small button-danger" disabled={deletePending} type="submit">
                            <Trash2 size={13} />
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

// ============================================================================
// 4. Global Site Settings Management Component
// ============================================================================

export type CmsSettingRecord = {
  id: string;
  key: string;
  value: Record<string, unknown>;
  description: string | null;
  updated_at: string;
};

export function CmsSiteSettingsManager({ settings }: { settings: CmsSettingRecord[] }) {
  const [state, formAction, pending] = useActionState(updateCmsSiteSettingsAction, initialState);
  const [activeKey, setActiveKey] = useState<string | null>(settings[0]?.key ?? null);

  const activeSetting = settings.find((s) => s.key === activeKey);

  return (
    <div className="workspace-content">
      <section className="module-panel">
        <p className="eyebrow">CMS ENGINE · SITE CONFIGURATION</p>
        <h2>Global site &amp; SEO settings</h2>
        <p>Centrally govern branding, contact channels, social profiles, and search engine directives.</p>

        {state.error && <p className="module-alert" role="alert">{state.error}</p>}
        {state.message && <p className="module-success" role="status">{state.message}</p>}

        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", margin: "20px 0" }}>
          {settings.map((s) => (
            <button
              className={`button button-small ${activeKey === s.key ? "button-gold" : "button-secondary"}`}
              key={s.key}
              onClick={() => setActiveKey(s.key)}
              type="button"
            >
              {s.key.replace("_", " ").toUpperCase()}
            </button>
          ))}
        </div>

        {activeSetting && (
          <form action={formAction} style={{ display: "grid", gap: "16px", padding: "20px", border: "1px solid var(--line)", borderRadius: "14px", background: "var(--surface)" }}>
            <input name="key" type="hidden" value={activeSetting.key} />
            <div>
              <strong style={{ fontSize: "16px" }}>{activeSetting.key.toUpperCase()} Settings</strong>
              <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: "12px" }}>{activeSetting.description}</p>
            </div>
            <label style={{ display: "grid", gap: "6px" }}>
              <span style={{ fontSize: "12px", color: "var(--subtle)" }}>Configuration Payload (JSON)</span>
              <textarea
                defaultValue={JSON.stringify(activeSetting.value, null, 2)}
                name="value"
                rows={10}
                style={{ fontFamily: "monospace", fontSize: "13px", padding: "12px", borderRadius: "10px", border: "1px solid var(--line)", background: "var(--background)", color: "var(--foreground)" }}
              />
            </label>
            <div>
              <button className="button button-gold" disabled={pending} type="submit">
                {pending ? "Saving Configuration…" : "Update Setting"}
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}

// ============================================================================
// 5. Services Management Component
// ============================================================================

export type CmsServiceRecord = {
  id: string;
  slug: string;
  title: string;
  short_description: string;
  full_description: string;
  icon_name: string | null;
  features: string[];
  cta_label: string;
  cta_url: string;
  status: string;
  sort_order: number;
  updated_at: string;
};

export function CmsServicesManager({ services }: { services: CmsServiceRecord[] }) {
  const [saveState, saveAction, savePending] = useActionState(saveCmsServiceAction, initialState);
  const [deleteState, deleteAction, deletePending] = useActionState(deleteCmsServiceAction, initialState);
  const [editingService, setEditingService] = useState<CmsServiceRecord | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  return (
    <div className="workspace-content">
      <section className="module-panel">
        <div className="module-heading" style={{ marginTop: 0 }}>
          <div>
            <p className="eyebrow">CMS ENGINE · SERVICES</p>
            <h2>Managed engineering capabilities</h2>
            <p>Publish, edit, and organize offerings shown on /services and service detail pages.</p>
          </div>
          <button
            className="button button-gold module-heading-action"
            onClick={() => {
              setEditingService(null);
              setIsCreating(!isCreating);
            }}
            type="button"
          >
            <Plus size={16} /> {isCreating ? "Close Editor" : "New Service"}
          </button>
        </div>

        {saveState.error && <p className="module-alert" role="alert">{saveState.error}</p>}
        {saveState.message && <p className="module-success" role="status">{saveState.message}</p>}
        {deleteState.error && <p className="module-alert" role="alert">{deleteState.error}</p>}
        {deleteState.message && <p className="module-success" role="status">{deleteState.message}</p>}

        {(isCreating || editingService) && (
          <form action={saveAction} className="auth-form lead-create-form" style={{ marginTop: "24px", marginBottom: "32px", padding: "20px", border: "1px solid var(--line)", borderRadius: "14px", background: "var(--surface-raised)" }}>
            {editingService && <input name="id" type="hidden" value={editingService.id} />}
            <label>
              Service Title *
              <input defaultValue={editingService?.title ?? ""} name="title" placeholder="Web Applications" required type="text" />
            </label>
            <label>
              URL Slug *
              <input defaultValue={editingService?.slug ?? ""} name="slug" placeholder="web-applications" required type="text" />
            </label>
            <label>
              Icon Name
              <input defaultValue={editingService?.icon_name ?? "Code2"} name="icon_name" placeholder="Code2, Smartphone, Cloud..." type="text" />
            </label>
            <label>
              Lifecycle Status
              <select defaultValue={editingService?.status ?? "published"} name="status">
                <option value="draft">Draft</option>
                <option value="review">Review</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </select>
            </label>
            <label>
              Sort Order
              <input defaultValue={editingService?.sort_order ?? 0} name="sort_order" type="number" />
            </label>
            <label>
              CTA Label
              <input defaultValue={editingService?.cta_label ?? "Start a Project"} name="cta_label" type="text" />
            </label>
            <label>
              CTA Link URL
              <input defaultValue={editingService?.cta_url ?? "/contact"} name="cta_url" type="text" />
            </label>
            <label style={{ gridColumn: "1 / -1" }}>
              Short Summary Description *
              <textarea defaultValue={editingService?.short_description ?? ""} name="short_description" placeholder="One sentence overview..." required rows={2} />
            </label>
            <label style={{ gridColumn: "1 / -1" }}>
              Full Engineering Scope &amp; Methodology *
              <textarea defaultValue={editingService?.full_description ?? ""} name="full_description" placeholder="Detailed service description..." required rows={5} />
            </label>
            <label style={{ gridColumn: "1 / -1" }}>
              Features &amp; Capabilities (one per line)
              <textarea defaultValue={editingService?.features?.join("\n") ?? ""} name="features" placeholder="Custom architecture&#10;Zero-trust security..." rows={3} />
            </label>
            <div style={{ display: "flex", gap: "10px", gridColumn: "1 / -1" }}>
              <button className="button button-gold" disabled={savePending} type="submit">
                {savePending ? "Saving Service…" : editingService ? "Update Service" : "Create Service"}
              </button>
              <button
                className="button button-secondary"
                onClick={() => {
                  setEditingService(null);
                  setIsCreating(false);
                }}
                type="button"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        <div className="module-table-wrap" style={{ marginTop: "20px" }}>
          <table className="module-table">
            <thead>
              <tr>
                <th>Service &amp; Slug</th>
                <th>Status</th>
                <th>Order</th>
                <th>Updated</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {services.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", padding: "24px" }}>
                    No custom services configured yet. Default platform services will be served on public pages.
                  </td>
                </tr>
              ) : (
                services.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <strong>{s.title}</strong>
                      <small>/services/{s.slug}</small>
                    </td>
                    <td>
                      <span className="record-status">{s.status}</span>
                    </td>
                    <td>{s.sort_order}</td>
                    <td>{new Date(s.updated_at).toLocaleDateString()}</td>
                    <td>
                      <div style={{ display: "flex", gap: "8px" }}>
                        <button
                          className="button button-small button-secondary"
                          onClick={() => {
                            setIsCreating(false);
                            setEditingService(s);
                          }}
                          type="button"
                        >
                          <Edit2 size={13} /> Edit
                        </button>
                        <form action={deleteAction}>
                          <input name="id" type="hidden" value={s.id} />
                          <button className="button button-small button-danger" disabled={deletePending} type="submit">
                            <Trash2 size={13} />
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}


// ============================================================================
// 6. Hero Copy & Multi-Image Slides Manager
// ============================================================================

export type CmsHeroSlideRecord = {
  id: string;
  title: string;
  label: string;
  tagline: string;
  image_url: string;
  alt_text: string;
  link_url: string | null;
  status: string;
  sort_order: number;
  is_featured: boolean;
  updated_at: string;
};

export function CmsHeroManager({
  slides,
  heroSettings,
}: {
  slides: CmsHeroSlideRecord[];
  heroSettings?: Record<string, string>;
}) {
  const [saveSlideState, saveSlideAction, saveSlidePending] = useActionState(saveCmsHeroSlideAction, initialState);
  const [deleteSlideState, deleteSlideAction, deleteSlidePending] = useActionState(deleteCmsHeroSlideAction, initialState);
  const [saveSettingsState, saveSettingsAction, saveSettingsPending] = useActionState(saveCmsHeroSettingsAction, initialState);

  const [editingSlide, setEditingSlide] = useState<CmsHeroSlideRecord | null>(null);
  const [isCreatingSlide, setIsCreatingSlide] = useState(false);

  return (
    <div className="workspace-content">
      {/* Hero Copy Settings */}
      <section className="module-panel">
        <div className="module-heading" style={{ marginTop: 0 }}>
          <div>
            <p className="eyebrow">CMS ENGINE · HERO SECTION</p>
            <h2>Hero Headlines &amp; Call To Actions</h2>
            <p>Control the primary visitor-facing value proposition, badge text, and conversion buttons.</p>
          </div>
        </div>

        {saveSettingsState.error && <p className="module-alert" role="alert">{saveSettingsState.error}</p>}
        {saveSettingsState.message && <p className="module-success" role="status">{saveSettingsState.message}</p>}

        <form action={saveSettingsAction} className="auth-form lead-create-form" style={{ marginTop: "16px", padding: "20px", border: "1px solid var(--line)", borderRadius: "14px", background: "var(--surface-raised)" }}>
          <label>
            Badge Text
            <input defaultValue={heroSettings?.badge_text ?? "Engineering Software Company · Enterprise & High-Growth Scale"} name="badge_text" required type="text" />
          </label>
          <label>
            Hero Primary Title
            <input defaultValue={heroSettings?.title ?? "Engineering High-Performance Digital Products That Scale."} name="title" required type="text" />
          </label>
          <label style={{ gridColumn: "1 / -1" }}>
            Hero Lead Paragraph
            <textarea defaultValue={heroSettings?.lead ?? "We architect and build web applications, cloud backends, autonomous AI systems, and mission-critical enterprise software. Engineered with strict type safety, zero-trust security, and verifiable performance."} name="lead" rows={3} />
          </label>
          <label>
            Primary CTA Button Label
            <input defaultValue={heroSettings?.primary_cta_label ?? "Initiate Project Inquiry"} name="primary_cta_label" type="text" />
          </label>
          <label>
            Primary CTA Button URL
            <input defaultValue={heroSettings?.primary_cta_url ?? "/contact"} name="primary_cta_url" type="text" />
          </label>
          <label>
            Secondary CTA Button Label
            <input defaultValue={heroSettings?.secondary_cta_label ?? "Explore Case Studies"} name="secondary_cta_label" type="text" />
          </label>
          <label>
            Secondary CTA Button URL
            <input defaultValue={heroSettings?.secondary_cta_url ?? "/portfolio"} name="secondary_cta_url" type="text" />
          </label>
          <div style={{ gridColumn: "1 / -1" }}>
            <button className="button button-gold" disabled={saveSettingsPending} type="submit">
              {saveSettingsPending ? "Saving Settings…" : "Save Hero Copy"}
            </button>
          </div>
        </form>
      </section>

      {/* Hero Media / Slides Management */}
      <section className="module-panel" style={{ marginTop: "32px" }}>
        <div className="module-heading" style={{ marginTop: 0 }}>
          <div>
            <p className="eyebrow">CMS ENGINE · HERO MEDIA</p>
            <h2>Hero Rotating Slides (Multi-Image)</h2>
            <p>Upload, publish, reorder, and configure media displayed in the hero showcase carousel.</p>
          </div>
          <button
            className="button button-gold module-heading-action"
            onClick={() => {
              setEditingSlide(null);
              setIsCreatingSlide(!isCreatingSlide);
            }}
            type="button"
          >
            <Plus size={16} /> {isCreatingSlide ? "Close Editor" : "Add Slide"}
          </button>
        </div>

        {saveSlideState.error && <p className="module-alert" role="alert">{saveSlideState.error}</p>}
        {saveSlideState.message && <p className="module-success" role="status">{saveSlideState.message}</p>}
        {deleteSlideState.error && <p className="module-alert" role="alert">{deleteSlideState.error}</p>}
        {deleteSlideState.message && <p className="module-success" role="status">{deleteSlideState.message}</p>}

        {(isCreatingSlide || editingSlide) && (
          <form action={saveSlideAction} className="auth-form lead-create-form" style={{ marginTop: "24px", marginBottom: "32px", padding: "20px", border: "1px solid var(--line)", borderRadius: "14px", background: "var(--surface-raised)" }}>
            {editingSlide && <input name="id" type="hidden" value={editingSlide.id} />}
            <label>
              Slide Title / Internal Name *
              <input defaultValue={editingSlide?.title ?? ""} name="title" placeholder="TheCodexThrill Engineering Studio" required type="text" />
            </label>
            <label>
              Visual Label Overlay
              <input defaultValue={editingSlide?.label ?? "TheCodexThrill Engineering Studio"} name="label" placeholder="TheCodexThrill Engineering Studio" required type="text" />
            </label>
            <label>
              Tagline Overlay
              <input defaultValue={editingSlide?.tagline ?? "BUILD | INNOVATE | DEPLOY | SCALE"} name="tagline" placeholder="BUILD | INNOVATE | DEPLOY | SCALE" required type="text" />
            </label>
            <label>
              Image URL / Path *
              <input defaultValue={editingSlide?.image_url ?? "/brand/thecodexthrill-banner.jpg"} name="image_url" placeholder="/brand/thecodexthrill-banner.jpg" required type="text" />
            </label>
            <label>
              Image Alt Text *
              <input defaultValue={editingSlide?.alt_text ?? "TheCodexThrill — Build, Innovate, Deploy, Scale"} name="alt_text" required type="text" />
            </label>
            <label>
              Optional Slide Link
              <input defaultValue={editingSlide?.link_url ?? "/contact"} name="link_url" placeholder="/contact" type="text" />
            </label>
            <label>
              Publication Status
              <select defaultValue={editingSlide?.status ?? "published"} name="status">
                <option value="published">Published</option>
                <option value="draft">Draft</option>
                <option value="review">Review</option>
                <option value="archived">Archived</option>
              </select>
            </label>
            <label>
              Sort Order (Ascending)
              <input defaultValue={editingSlide?.sort_order ?? 0} name="sort_order" type="number" />
            </label>
            <div style={{ display: "flex", gap: "10px", gridColumn: "1 / -1" }}>
              <button className="button button-gold" disabled={saveSlidePending} type="submit">
                {saveSlidePending ? "Saving Slide…" : editingSlide ? "Update Slide" : "Create Slide"}
              </button>
              <button
                className="button button-secondary"
                onClick={() => {
                  setEditingSlide(null);
                  setIsCreatingSlide(false);
                }}
                type="button"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        <div className="module-table-wrap" style={{ marginTop: "20px" }}>
          <table className="module-table">
            <thead>
              <tr>
                <th>Slide &amp; Label</th>
                <th>Status</th>
                <th>Order</th>
                <th>Image Preview</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {slides.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", padding: "24px" }}>
                    No custom slides configured yet. Default slides are active.
                  </td>
                </tr>
              ) : (
                slides.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <strong>{s.title}</strong>
                      <small>{s.label}</small>
                    </td>
                    <td>
                      <span className="record-status">{s.status}</span>
                    </td>
                    <td>{s.sort_order}</td>
                    <td>
                      <small style={{ fontFamily: "monospace", fontSize: "11px" }}>{s.image_url}</small>
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: "8px" }}>
                        <button
                          className="button button-small button-secondary"
                          onClick={() => {
                            setIsCreatingSlide(false);
                            setEditingSlide(s);
                          }}
                          type="button"
                        >
                          <Edit2 size={13} /> Edit
                        </button>
                        <form action={deleteSlideAction}>
                          <input name="id" type="hidden" value={s.id} />
                          <button className="button button-small button-danger" disabled={deleteSlidePending} type="submit">
                            <Trash2 size={13} />
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

// ============================================================================
// 7. Capabilities CMS Manager
// ============================================================================

export type CmsCapabilityRecord = {
  id: string;
  slug: string;
  number_label: string;
  title: string;
  headline: string;
  description: string;
  icon_name: string;
  deliverables: string[];
  technologies: string[];
  service_slug: string;
  status: string;
  sort_order: number;
  updated_at: string;
};

export function CmsCapabilitiesManager({ capabilities }: { capabilities: CmsCapabilityRecord[] }) {
  const [saveState, saveAction, savePending] = useActionState(saveCmsCapabilityAction, initialState);
  const [deleteState, deleteAction, deletePending] = useActionState(deleteCmsCapabilityAction, initialState);
  const [editingCap, setEditingCap] = useState<CmsCapabilityRecord | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  return (
    <div className="workspace-content">
      <section className="module-panel">
        <div className="module-heading" style={{ marginTop: 0 }}>
          <div>
            <p className="eyebrow">CMS ENGINE · CAPABILITIES</p>
            <h2>Managed Engineering Capabilities</h2>
            <p>Configure the 6 core pillars displayed in the homepage &quot;Content &gt; Containers&quot; editorial stream.</p>
          </div>
          <button
            className="button button-gold module-heading-action"
            onClick={() => {
              setEditingCap(null);
              setIsCreating(!isCreating);
            }}
            type="button"
          >
            <Plus size={16} /> {isCreating ? "Close Editor" : "New Capability"}
          </button>
        </div>

        {saveState.error && <p className="module-alert" role="alert">{saveState.error}</p>}
        {saveState.message && <p className="module-success" role="status">{saveState.message}</p>}
        {deleteState.error && <p className="module-alert" role="alert">{deleteState.error}</p>}
        {deleteState.message && <p className="module-success" role="status">{deleteState.message}</p>}

        {(isCreating || editingCap) && (
          <form action={saveAction} className="auth-form lead-create-form" style={{ marginTop: "24px", marginBottom: "32px", padding: "20px", border: "1px solid var(--line)", borderRadius: "14px", background: "var(--surface-raised)" }}>
            {editingCap && <input name="id" type="hidden" value={editingCap.id} />}
            <label>
              Number Label (e.g. 01)
              <input defaultValue={editingCap?.number_label ?? "01"} name="number_label" required type="text" />
            </label>
            <label>
              Title *
              <input defaultValue={editingCap?.title ?? ""} name="title" placeholder="Intelligent Web & Cloud Platforms" required type="text" />
            </label>
            <label>
              Slug *
              <input defaultValue={editingCap?.slug ?? ""} name="slug" placeholder="web-apps" required type="text" />
            </label>
            <label>
              Service Link Slug
              <input defaultValue={editingCap?.service_slug ?? "web-applications"} name="service_slug" placeholder="web-applications" required type="text" />
            </label>
            <label>
              Icon Identifier
              <select defaultValue={editingCap?.icon_name ?? "Code2"} name="icon_name">
                <option value="Code2">Code2</option>
                <option value="Layers">Layers</option>
                <option value="BrainCircuit">BrainCircuit</option>
                <option value="Smartphone">Smartphone</option>
                <option value="Cloud">Cloud</option>
                <option value="ShieldCheck">ShieldCheck</option>
              </select>
            </label>
            <label>
              Status
              <select defaultValue={editingCap?.status ?? "published"} name="status">
                <option value="published">Published</option>
                <option value="draft">Draft</option>
                <option value="review">Review</option>
                <option value="archived">Archived</option>
              </select>
            </label>
            <label>
              Sort Order
              <input defaultValue={editingCap?.sort_order ?? 0} name="sort_order" type="number" />
            </label>
            <label style={{ gridColumn: "1 / -1" }}>
              Editorial Headline *
              <input defaultValue={editingCap?.headline ?? ""} name="headline" placeholder="Mission-critical web applications built for speed..." required type="text" />
            </label>
            <label style={{ gridColumn: "1 / -1" }}>
              In-Depth Description *
              <textarea defaultValue={editingCap?.description ?? ""} name="description" rows={4} />
            </label>
            <label style={{ gridColumn: "1 / -1" }}>
              Deliverables (one per line)
              <textarea defaultValue={editingCap?.deliverables?.join("\n") ?? ""} name="deliverables" placeholder="Server-rendered architectures&#10;Robust state management..." rows={3} />
            </label>
            <label style={{ gridColumn: "1 / -1" }}>
              Production Technologies (comma separated)
              <input defaultValue={editingCap?.technologies?.join(", ") ?? ""} name="technologies" placeholder="Next.js App Router, React 19, TypeScript" type="text" />
            </label>
            <div style={{ display: "flex", gap: "10px", gridColumn: "1 / -1" }}>
              <button className="button button-gold" disabled={savePending} type="submit">
                {savePending ? "Saving Capability…" : editingCap ? "Update Capability" : "Create Capability"}
              </button>
              <button
                className="button button-secondary"
                onClick={() => {
                  setEditingCap(null);
                  setIsCreating(false);
                }}
                type="button"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        <div className="module-table-wrap" style={{ marginTop: "20px" }}>
          <table className="module-table">
            <thead>
              <tr>
                <th>Number &amp; Title</th>
                <th>Status</th>
                <th>Order</th>
                <th>Tech Count</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {capabilities.map((c) => (
                <tr key={c.id}>
                  <td>
                    <strong>{c.number_label}. {c.title}</strong>
                    <small>/{c.slug}</small>
                  </td>
                  <td>
                    <span className="record-status">{c.status}</span>
                  </td>
                  <td>{c.sort_order}</td>
                  <td>{c.technologies?.length ?? 0} items</td>
                  <td>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button
                        className="button button-small button-secondary"
                        onClick={() => {
                          setIsCreating(false);
                          setEditingCap(c);
                        }}
                        type="button"
                      >
                        <Edit2 size={13} /> Edit
                      </button>
                      <form action={deleteAction}>
                        <input name="id" type="hidden" value={c.id} />
                        <button className="button button-small button-danger" disabled={deletePending} type="submit">
                          <Trash2 size={13} />
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

// ============================================================================
// 8. Engineering Process CMS Manager
// ============================================================================

export type CmsProcessStepRecord = {
  id: string;
  step_number: string;
  phase_name: string;
  name: string;
  duration: string;
  icon_name: string;
  summary: string;
  deliverables: string[];
  quality_gate: string;
  status: string;
  sort_order: number;
  updated_at: string;
};

export function CmsProcessManager({ steps }: { steps: CmsProcessStepRecord[] }) {
  const [saveState, saveAction, savePending] = useActionState(saveCmsProcessStepAction, initialState);
  const [deleteState, deleteAction, deletePending] = useActionState(deleteCmsProcessStepAction, initialState);
  const [editingStep, setEditingStep] = useState<CmsProcessStepRecord | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  return (
    <div className="workspace-content">
      <section className="module-panel">
        <div className="module-heading" style={{ marginTop: 0 }}>
          <div>
            <p className="eyebrow">CMS ENGINE · METHODOLOGY</p>
            <h2>7-Stage Engineering Process Steps</h2>
            <p>Manage the end-to-end software development lifecycle timeline.</p>
          </div>
          <button
            className="button button-gold module-heading-action"
            onClick={() => {
              setEditingStep(null);
              setIsCreating(!isCreating);
            }}
            type="button"
          >
            <Plus size={16} /> {isCreating ? "Close Editor" : "New Step"}
          </button>
        </div>

        {saveState.error && <p className="module-alert" role="alert">{saveState.error}</p>}
        {saveState.message && <p className="module-success" role="status">{saveState.message}</p>}
        {deleteState.error && <p className="module-alert" role="alert">{deleteState.error}</p>}
        {deleteState.message && <p className="module-success" role="status">{deleteState.message}</p>}

        {(isCreating || editingStep) && (
          <form action={saveAction} className="auth-form lead-create-form" style={{ marginTop: "24px", marginBottom: "32px", padding: "20px", border: "1px solid var(--line)", borderRadius: "14px", background: "var(--surface-raised)" }}>
            {editingStep && <input name="id" type="hidden" value={editingStep.id} />}
            <label>
              Step Number (e.g. 01)
              <input defaultValue={editingStep?.step_number ?? "01"} name="step_number" required type="text" />
            </label>
            <label>
              Phase Name *
              <input defaultValue={editingStep?.phase_name ?? ""} name="phase_name" placeholder="Discovery & Framing" required type="text" />
            </label>
            <label>
              Step Title *
              <input defaultValue={editingStep?.name ?? ""} name="name" placeholder="Problem Definition & Feasibility" required type="text" />
            </label>
            <label>
              Duration Estimate
              <input defaultValue={editingStep?.duration ?? "Week 1"} name="duration" placeholder="Week 1" required type="text" />
            </label>
            <label>
              Icon Identifier
              <select defaultValue={editingStep?.icon_name ?? "Compass"} name="icon_name">
                <option value="Compass">Compass</option>
                <option value="Cpu">Cpu</option>
                <option value="Layout">Layout</option>
                <option value="GitMerge">GitMerge</option>
                <option value="FileCheck2">FileCheck2</option>
                <option value="Rocket">Rocket</option>
                <option value="RefreshCw">RefreshCw</option>
              </select>
            </label>
            <label>
              Status
              <select defaultValue={editingStep?.status ?? "published"} name="status">
                <option value="published">Published</option>
                <option value="draft">Draft</option>
                <option value="review">Review</option>
                <option value="archived">Archived</option>
              </select>
            </label>
            <label>
              Sort Order
              <input defaultValue={editingStep?.sort_order ?? 0} name="sort_order" type="number" />
            </label>
            <label style={{ gridColumn: "1 / -1" }}>
              Summary *
              <textarea defaultValue={editingStep?.summary ?? ""} name="summary" rows={3} />
            </label>
            <label style={{ gridColumn: "1 / -1" }}>
              Deliverables (one per line)
              <textarea defaultValue={editingStep?.deliverables?.join("\n") ?? ""} name="deliverables" rows={3} />
            </label>
            <label style={{ gridColumn: "1 / -1" }}>
              Quality Gate Criterion *
              <input defaultValue={editingStep?.quality_gate ?? ""} name="quality_gate" required type="text" />
            </label>
            <div style={{ display: "flex", gap: "10px", gridColumn: "1 / -1" }}>
              <button className="button button-gold" disabled={savePending} type="submit">
                {savePending ? "Saving Step…" : editingStep ? "Update Step" : "Create Step"}
              </button>
              <button
                className="button button-secondary"
                onClick={() => {
                  setEditingStep(null);
                  setIsCreating(false);
                }}
                type="button"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        <div className="module-table-wrap" style={{ marginTop: "20px" }}>
          <table className="module-table">
            <thead>
              <tr>
                <th>Step &amp; Phase</th>
                <th>Title</th>
                <th>Duration</th>
                <th>Status</th>
                <th>Order</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {steps.map((s) => (
                <tr key={s.id}>
                  <td>
                    <strong>{s.step_number}. {s.phase_name}</strong>
                  </td>
                  <td>{s.name}</td>
                  <td>{s.duration}</td>
                  <td><span className="record-status">{s.status}</span></td>
                  <td>{s.sort_order}</td>
                  <td>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button
                        className="button button-small button-secondary"
                        onClick={() => {
                          setIsCreating(false);
                          setEditingStep(s);
                        }}
                        type="button"
                      >
                        <Edit2 size={13} /> Edit
                      </button>
                      <form action={deleteAction}>
                        <input name="id" type="hidden" value={s.id} />
                        <button className="button button-small button-danger" disabled={deletePending} type="submit">
                          <Trash2 size={13} />
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

// ============================================================================
// 9. Strategic Industries CMS Manager
// ============================================================================

export type CmsIndustryRecord = {
  id: string;
  slug: string;
  title: string;
  accent: string;
  icon_name: string;
  challenge: string;
  solution: string;
  compliance_tags: string[];
  metrics: string;
  status: string;
  sort_order: number;
  updated_at: string;
};

export function CmsIndustriesManager({ industries }: { industries: CmsIndustryRecord[] }) {
  const [saveState, saveAction, savePending] = useActionState(saveCmsIndustryAction, initialState);
  const [deleteState, deleteAction, deletePending] = useActionState(deleteCmsIndustryAction, initialState);
  const [editingInd, setEditingInd] = useState<CmsIndustryRecord | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  return (
    <div className="workspace-content">
      <section className="module-panel">
        <div className="module-heading" style={{ marginTop: 0 }}>
          <div>
            <p className="eyebrow">CMS ENGINE · VERTICALS</p>
            <h2>Strategic Industry Verticals</h2>
            <p>Control high-consequence industry sectors displayed on the public site.</p>
          </div>
          <button
            className="button button-gold module-heading-action"
            onClick={() => {
              setEditingInd(null);
              setIsCreating(!isCreating);
            }}
            type="button"
          >
            <Plus size={16} /> {isCreating ? "Close Editor" : "New Industry"}
          </button>
        </div>

        {saveState.error && <p className="module-alert" role="alert">{saveState.error}</p>}
        {saveState.message && <p className="module-success" role="status">{saveState.message}</p>}
        {deleteState.error && <p className="module-alert" role="alert">{deleteState.error}</p>}
        {deleteState.message && <p className="module-success" role="status">{deleteState.message}</p>}

        {(isCreating || editingInd) && (
          <form action={saveAction} className="auth-form lead-create-form" style={{ marginTop: "24px", marginBottom: "32px", padding: "20px", border: "1px solid var(--line)", borderRadius: "14px", background: "var(--surface-raised)" }}>
            {editingInd && <input name="id" type="hidden" value={editingInd.id} />}
            <label>
              Title *
              <input defaultValue={editingInd?.title ?? ""} name="title" placeholder="Financial Technology & Wealth Engines" required type="text" />
            </label>
            <label>
              URL Slug *
              <input defaultValue={editingInd?.slug ?? ""} name="slug" placeholder="fintech" required type="text" />
            </label>
            <label>
              Accent Badge *
              <input defaultValue={editingInd?.accent ?? "FinTech & Banking"} name="accent" placeholder="FinTech & Banking" required type="text" />
            </label>
            <label>
              Icon Identifier
              <select defaultValue={editingInd?.icon_name ?? "Landmark"} name="icon_name">
                <option value="Landmark">Landmark</option>
                <option value="Activity">Activity</option>
                <option value="Boxes">Boxes</option>
                <option value="Truck">Truck</option>
                <option value="ShoppingBag">ShoppingBag</option>
                <option value="ShieldCheck">ShieldCheck</option>
              </select>
            </label>
            <label>
              Status
              <select defaultValue={editingInd?.status ?? "published"} name="status">
                <option value="published">Published</option>
                <option value="draft">Draft</option>
                <option value="review">Review</option>
                <option value="archived">Archived</option>
              </select>
            </label>
            <label>
              Sort Order
              <input defaultValue={editingInd?.sort_order ?? 0} name="sort_order" type="number" />
            </label>
            <label style={{ gridColumn: "1 / -1" }}>
              Industry Challenge / Bottleneck *
              <textarea defaultValue={editingInd?.challenge ?? ""} name="challenge" rows={3} />
            </label>
            <label style={{ gridColumn: "1 / -1" }}>
              Our Engineered Solution *
              <textarea defaultValue={editingInd?.solution ?? ""} name="solution" rows={3} />
            </label>
            <label>
              Compliance Tags (comma separated)
              <input defaultValue={editingInd?.compliance_tags?.join(", ") ?? ""} name="compliance_tags" placeholder="SOC-2, HIPAA, RLS" type="text" />
            </label>
            <label>
              Measurable Impact Metric *
              <input defaultValue={editingInd?.metrics ?? ""} name="metrics" placeholder="Sub-50ms reconciliation on 1M+ rows" required type="text" />
            </label>
            <div style={{ display: "flex", gap: "10px", gridColumn: "1 / -1" }}>
              <button className="button button-gold" disabled={savePending} type="submit">
                {savePending ? "Saving Industry…" : editingInd ? "Update Industry" : "Create Industry"}
              </button>
              <button
                className="button button-secondary"
                onClick={() => {
                  setEditingInd(null);
                  setIsCreating(false);
                }}
                type="button"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        <div className="module-table-wrap" style={{ marginTop: "20px" }}>
          <table className="module-table">
            <thead>
              <tr>
                <th>Industry &amp; Accent</th>
                <th>Status</th>
                <th>Impact Metric</th>
                <th>Order</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {industries.map((ind) => (
                <tr key={ind.id}>
                  <td>
                    <strong>{ind.title}</strong>
                    <small>{ind.accent}</small>
                  </td>
                  <td><span className="record-status">{ind.status}</span></td>
                  <td>{ind.metrics}</td>
                  <td>{ind.sort_order}</td>
                  <td>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button
                        className="button button-small button-secondary"
                        onClick={() => {
                          setIsCreating(false);
                          setEditingInd(ind);
                        }}
                        type="button"
                      >
                        <Edit2 size={13} /> Edit
                      </button>
                      <form action={deleteAction}>
                        <input name="id" type="hidden" value={ind.id} />
                        <button className="button button-small button-danger" disabled={deletePending} type="submit">
                          <Trash2 size={13} />
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

// ============================================================================
// 10. Technology Stack CMS Manager
// ============================================================================

export type CmsTechStackRecord = {
  id: string;
  category: string;
  name: string;
  role: string;
  icon_name: string;
  status: string;
  sort_order: number;
  updated_at: string;
};

export function CmsTechStackManager({ items }: { items: CmsTechStackRecord[] }) {
  const [saveState, saveAction, savePending] = useActionState(saveCmsTechStackAction, initialState);
  const [deleteState, deleteAction, deletePending] = useActionState(deleteCmsTechStackAction, initialState);
  const [editingTech, setEditingTech] = useState<CmsTechStackRecord | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  return (
    <div className="workspace-content">
      <section className="module-panel">
        <div className="module-heading" style={{ marginTop: 0 }}>
          <div>
            <p className="eyebrow">CMS ENGINE · TECHNICAL ARSENAL</p>
            <h2>Managed Technology Stack</h2>
            <p>Maintain the production technologies and architectural roles published in our stack matrix.</p>
          </div>
          <button
            className="button button-gold module-heading-action"
            onClick={() => {
              setEditingTech(null);
              setIsCreating(!isCreating);
            }}
            type="button"
          >
            <Plus size={16} /> {isCreating ? "Close Editor" : "New Technology"}
          </button>
        </div>

        {saveState.error && <p className="module-alert" role="alert">{saveState.error}</p>}
        {saveState.message && <p className="module-success" role="status">{saveState.message}</p>}
        {deleteState.error && <p className="module-alert" role="alert">{deleteState.error}</p>}
        {deleteState.message && <p className="module-success" role="status">{deleteState.message}</p>}

        {(isCreating || editingTech) && (
          <form action={saveAction} className="auth-form lead-create-form" style={{ marginTop: "24px", marginBottom: "32px", padding: "20px", border: "1px solid var(--line)", borderRadius: "14px", background: "var(--surface-raised)" }}>
            {editingTech && <input name="id" type="hidden" value={editingTech.id} />}
            <label>
              Category *
              <select defaultValue={editingTech?.category ?? "Frontend & User Interface"} name="category">
                <option value="Frontend & User Interface">Frontend &amp; User Interface</option>
                <option value="Backend, Database & Storage">Backend, Database &amp; Storage</option>
                <option value="Applied AI, Vector & Agents">Applied AI, Vector &amp; Agents</option>
                <option value="Mobile, Offline & Edge">Mobile, Offline &amp; Edge</option>
                <option value="Security, Auth & DevSecOps">Security, Auth &amp; DevSecOps</option>
              </select>
            </label>
            <label>
              Technology Name *
              <input defaultValue={editingTech?.name ?? ""} name="name" placeholder="Next.js App Router (v16)" required type="text" />
            </label>
            <label style={{ gridColumn: "1 / -1" }}>
              Architectural Role *
              <input defaultValue={editingTech?.role ?? ""} name="role" placeholder="Server Components, streaming, ISR" required type="text" />
            </label>
            <label>
              Status
              <select defaultValue={editingTech?.status ?? "published"} name="status">
                <option value="published">Published</option>
                <option value="draft">Draft</option>
                <option value="review">Review</option>
                <option value="archived">Archived</option>
              </select>
            </label>
            <label>
              Sort Order
              <input defaultValue={editingTech?.sort_order ?? 0} name="sort_order" type="number" />
            </label>
            <div style={{ display: "flex", gap: "10px", gridColumn: "1 / -1" }}>
              <button className="button button-gold" disabled={savePending} type="submit">
                {savePending ? "Saving Technology…" : editingTech ? "Update Technology" : "Create Technology"}
              </button>
              <button
                className="button button-secondary"
                onClick={() => {
                  setEditingTech(null);
                  setIsCreating(false);
                }}
                type="button"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        <div className="module-table-wrap" style={{ marginTop: "20px" }}>
          <table className="module-table">
            <thead>
              <tr>
                <th>Category</th>
                <th>Technology</th>
                <th>Role</th>
                <th>Status</th>
                <th>Order</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((t) => (
                <tr key={t.id}>
                  <td><strong>{t.category}</strong></td>
                  <td>{t.name}</td>
                  <td><small>{t.role}</small></td>
                  <td><span className="record-status">{t.status}</span></td>
                  <td>{t.sort_order}</td>
                  <td>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button
                        className="button button-small button-secondary"
                        onClick={() => {
                          setIsCreating(false);
                          setEditingTech(t);
                        }}
                        type="button"
                      >
                        <Edit2 size={13} /> Edit
                      </button>
                      <form action={deleteAction}>
                        <input name="id" type="hidden" value={t.id} />
                        <button className="button button-small button-danger" disabled={deletePending} type="submit">
                          <Trash2 size={13} />
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

// ============================================================================
// 11. Engineering FAQs CMS Manager
// ============================================================================

export type CmsFaqRecord = {
  id: string;
  question: string;
  answer: string;
  category: string;
  status: string;
  sort_order: number;
  updated_at: string;
};

export function CmsFaqManager({ faqs }: { faqs: CmsFaqRecord[] }) {
  const [saveState, saveAction, savePending] = useActionState(saveCmsFaqAction, initialState);
  const [deleteState, deleteAction, deletePending] = useActionState(deleteCmsFaqAction, initialState);
  const [editingFaq, setEditingFaq] = useState<CmsFaqRecord | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  return (
    <div className="workspace-content">
      <section className="module-panel">
        <div className="module-heading" style={{ marginTop: 0 }}>
          <div>
            <p className="eyebrow">CMS ENGINE · TRANSPARENCY</p>
            <h2>Managed Engineering FAQs</h2>
            <p>Control technical inquiries, timelines, and guarantees answered on the public site.</p>
          </div>
          <button
            className="button button-gold module-heading-action"
            onClick={() => {
              setEditingFaq(null);
              setIsCreating(!isCreating);
            }}
            type="button"
          >
            <Plus size={16} /> {isCreating ? "Close Editor" : "New FAQ"}
          </button>
        </div>

        {saveState.error && <p className="module-alert" role="alert">{saveState.error}</p>}
        {saveState.message && <p className="module-success" role="status">{saveState.message}</p>}
        {deleteState.error && <p className="module-alert" role="alert">{deleteState.error}</p>}
        {deleteState.message && <p className="module-success" role="status">{deleteState.message}</p>}

        {(isCreating || editingFaq) && (
          <form action={saveAction} className="auth-form lead-create-form" style={{ marginTop: "24px", marginBottom: "32px", padding: "20px", border: "1px solid var(--line)", borderRadius: "14px", background: "var(--surface-raised)" }}>
            {editingFaq && <input name="id" type="hidden" value={editingFaq.id} />}
            <label style={{ gridColumn: "1 / -1" }}>
              Question *
              <input defaultValue={editingFaq?.question ?? ""} name="question" placeholder="What is your typical delivery timeline?" required type="text" />
            </label>
            <label style={{ gridColumn: "1 / -1" }}>
              Detailed Answer *
              <textarea defaultValue={editingFaq?.answer ?? ""} name="answer" rows={5} />
            </label>
            <label>
              Category
              <input defaultValue={editingFaq?.category ?? "general"} name="category" placeholder="delivery" type="text" />
            </label>
            <label>
              Status
              <select defaultValue={editingFaq?.status ?? "published"} name="status">
                <option value="published">Published</option>
                <option value="draft">Draft</option>
                <option value="review">Review</option>
                <option value="archived">Archived</option>
              </select>
            </label>
            <label>
              Sort Order
              <input defaultValue={editingFaq?.sort_order ?? 0} name="sort_order" type="number" />
            </label>
            <div style={{ display: "flex", gap: "10px", gridColumn: "1 / -1" }}>
              <button className="button button-gold" disabled={savePending} type="submit">
                {savePending ? "Saving FAQ…" : editingFaq ? "Update FAQ" : "Create FAQ"}
              </button>
              <button
                className="button button-secondary"
                onClick={() => {
                  setEditingFaq(null);
                  setIsCreating(false);
                }}
                type="button"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        <div className="module-table-wrap" style={{ marginTop: "20px" }}>
          <table className="module-table">
            <thead>
              <tr>
                <th>Question</th>
                <th>Category</th>
                <th>Status</th>
                <th>Order</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {faqs.map((f) => (
                <tr key={f.id}>
                  <td><strong>{f.question}</strong></td>
                  <td>{f.category}</td>
                  <td><span className="record-status">{f.status}</span></td>
                  <td>{f.sort_order}</td>
                  <td>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button
                        className="button button-small button-secondary"
                        onClick={() => {
                          setIsCreating(false);
                          setEditingFaq(f);
                        }}
                        type="button"
                      >
                        <Edit2 size={13} /> Edit
                      </button>
                      <form action={deleteAction}>
                        <input name="id" type="hidden" value={f.id} />
                        <button className="button button-small button-danger" disabled={deletePending} type="submit">
                          <Trash2 size={13} />
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

// ============================================================================
// 12. Media Library, Navigation Menus & Content Revisions Managers
// ============================================================================

export type CmsMediaRecord = {
  id: string;
  file_name: string;
  storage_path: string;
  public_url: string;
  mime_type: string;
  file_size_bytes: number;
  category: string;
  alt_text: string;
  is_archived: boolean;
  created_at: string;
};

export function formatMediaBytes(bytes: number, decimals = 1): string {
  if (!bytes || bytes <= 0) return "0 B";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i] || "MB"}`;
}

const MEDIA_CATEGORIES = ["ALL", "HERO", "PORTFOLIO", "BLOG", "BRAND", "GENERAL"] as const;

export function CmsMediaManager({ media }: { media: CmsMediaRecord[] }) {
  const [saveState, saveAction, savePending] = useActionState(saveCmsMediaAction, initialState);
  const [deleteState, deleteAction, deletePending] = useActionState(deleteCmsMediaAction, initialState);
  const [editingItem, setEditingItem] = useState<CmsMediaRecord | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filteredMedia = media.filter((m) => {
    if (selectedCategory === "ALL") return true;
    return (m.category || "general").toLowerCase() === selectedCategory.toLowerCase();
  });

  const handleCopyUrl = async (id: string, url: string) => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
      }
    } catch {
      // Fallback ignore
    }
  };

  return (
    <div className="workspace-content">
      <section className="module-panel">
        <div className="module-heading" style={{ marginTop: 0 }}>
          <div>
            <p className="eyebrow">CMS ENGINE · MEDIA ASSETS</p>
            <h2>Public media library</h2>
            <p>Register, upload, and govern public hero banners, background videos, case study graphics, and accessible metadata.</p>
          </div>
          <button
            className="button button-gold module-heading-action"
            onClick={() => {
              setEditingItem(null);
              setIsCreating(!isCreating);
            }}
            type="button"
          >
            <Plus size={16} /> {isCreating ? "Close Form" : "Register Media Asset"}
          </button>
        </div>

        {saveState.error && <p className="module-alert" role="alert">{saveState.error}</p>}
        {saveState.message && <p className="module-success" role="status">{saveState.message}</p>}
        {deleteState.error && <p className="module-alert" role="alert">{deleteState.error}</p>}
        {deleteState.message && <p className="module-success" role="status">{deleteState.message}</p>}

        {(isCreating || editingItem) && (
          <form
            action={saveAction}
            className="auth-form lead-create-form"
            encType="multipart/form-data"
            style={{ marginTop: "24px", marginBottom: "32px", padding: "20px", border: "1px solid var(--line)", borderRadius: "14px", background: "var(--surface-raised)" }}
          >
            {editingItem && <input name="id" type="hidden" value={editingItem.id} />}
            
            <label style={{ gridColumn: "1 / -1" }}>
              Upload Asset File (Optional — Auto-detects filename, MIME type, and size)
              <input
                accept="image/*,video/mp4,video/webm"
                name="file"
                type="file"
              />
            </label>

            <label>
              Asset File Name *
              <input defaultValue={editingItem?.file_name ?? ""} name="file_name" placeholder="thecodexthrill-banner.jpg" required type="text" />
            </label>
            <label>
              Public Asset URL / Path *
              <input defaultValue={editingItem?.public_url ?? ""} name="public_url" placeholder="/brand/thecodexthrill-banner.jpg or https://..." required type="text" />
            </label>
            <label>
              Category
              <select defaultValue={editingItem?.category ?? "general"} name="category">
                <option value="general">General</option>
                <option value="hero">Hero Banner</option>
                <option value="portfolio">Case Study / Portfolio</option>
                <option value="blog">Blog / Insights</option>
                <option value="brand">Brand Identity</option>
              </select>
            </label>
            <label>
              MIME Type
              <input defaultValue={editingItem?.mime_type ?? "image/jpeg"} name="mime_type" placeholder="image/jpeg or video/mp4" type="text" />
            </label>
            <label>
              Estimated File Size (Bytes)
              <input defaultValue={editingItem?.file_size_bytes ?? 1024} min="1" name="file_size_bytes" type="number" />
            </label>
            <label style={{ gridColumn: "1 / -1" }}>
              Accessible Alt Text / Screen Reader Description *
              <input defaultValue={editingItem?.alt_text ?? ""} name="alt_text" placeholder="Descriptive alt text for screen readers, posters, and SEO" required type="text" />
            </label>
            <div style={{ display: "flex", gap: "10px", gridColumn: "1 / -1" }}>
              <button className="button button-gold" disabled={savePending} type="submit">
                {savePending ? "Saving Asset…" : editingItem ? "Update Asset" : "Register Asset"}
              </button>
              <button
                className="button button-secondary"
                onClick={() => {
                  setEditingItem(null);
                  setIsCreating(false);
                }}
                type="button"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Category Filter Pills */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "24px", marginBottom: "16px" }}>
          {MEDIA_CATEGORIES.map((cat) => {
            const isActive = selectedCategory === cat;
            return (
              <button
                key={cat}
                className={isActive ? "button button-gold button-small" : "button button-secondary button-small"}
                onClick={() => setSelectedCategory(cat)}
                style={{ fontSize: "12px", letterSpacing: "0.05em", padding: "6px 14px" }}
                type="button"
              >
                {cat}
              </button>
            );
          })}
        </div>

        <div className="module-table-wrap" style={{ marginTop: "10px" }}>
          <table className="module-table">
            <thead>
              <tr>
                <th style={{ width: "64px" }}>Preview</th>
                <th>Asset Name &amp; Details</th>
                <th>Category</th>
                <th>Alt Text</th>
                <th style={{ width: "160px" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredMedia.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", padding: "28px", color: "var(--text-muted)" }}>
                    {media.length === 0
                      ? "No media assets registered yet. Click \"Register Media Asset\" to add public visual assets."
                      : `No assets found in category "${selectedCategory}".`}
                  </td>
                </tr>
              ) : (
                filteredMedia.map((m) => {
                  const isVideo = m.mime_type?.includes("video") || m.public_url?.endsWith(".mp4") || m.public_url?.endsWith(".webm");
                  const isCopied = copiedId === m.id;

                  return (
                    <tr key={m.id}>
                      <td>
                        <div
                          style={{
                            width: "48px",
                            height: "48px",
                            borderRadius: "8px",
                            border: "1px solid var(--line)",
                            background: "var(--surface-raised)",
                            overflow: "hidden",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          {isVideo ? (
                            <div title="Video asset" style={{ color: "#dfb15b", display: "flex", alignItems: "center", justifyContent: "center" }}>
                              <Video size={22} />
                            </div>
                          ) : m.public_url?.startsWith("http") || m.public_url?.startsWith("/") ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                              alt={m.alt_text || m.file_name}
                              src={m.public_url}
                              style={{ width: "100%", height: "100%", objectFit: "cover" }}
                              onError={(e) => {
                                (e.currentTarget as HTMLElement).style.display = "none";
                              }}
                            />
                          ) : (
                            <ImageIcon color="var(--text-muted)" size={20} />
                          )}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                          <strong>{m.file_name}</strong>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "11px", color: "var(--text-muted)" }}>
                            <span>{formatMediaBytes(m.file_size_bytes)}</span>
                            <span>•</span>
                            <span>{m.mime_type || "image/jpeg"}</span>
                          </div>
                          <small style={{ wordBreak: "break-all", opacity: 0.8 }}>{m.public_url}</small>
                        </div>
                      </td>
                      <td>
                        <span className="record-status" style={{ textTransform: "uppercase" }}>{m.category || "general"}</span>
                      </td>
                      <td>
                        <small style={{ color: m.alt_text ? "var(--text-primary)" : "var(--text-muted)" }}>
                          {m.alt_text || "—"}
                        </small>
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                          <button
                            className="button button-small button-secondary"
                            onClick={() => handleCopyUrl(m.id, m.public_url)}
                            title="Copy Public URL to Clipboard"
                            type="button"
                          >
                            {isCopied ? <Check color="#22c55e" size={13} /> : <Copy size={13} />}
                            {isCopied ? "Copied" : "Copy"}
                          </button>
                          <button
                            className="button button-small button-secondary"
                            onClick={() => {
                              setIsCreating(false);
                              setEditingItem(m);
                            }}
                            title="Edit Media Metadata"
                            type="button"
                          >
                            <Edit2 size={13} />
                          </button>
                          <form action={deleteAction}>
                            <input name="id" type="hidden" value={m.id} />
                            <button
                              className="button button-small button-danger"
                              disabled={deletePending}
                              title="Delete Asset"
                              type="submit"
                            >
                              <Trash2 size={13} />
                            </button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export type CmsMenuRecord = {
  id: string;
  code: string;
  title: string;
};

export type CmsMenuItemRecord = {
  id: string;
  menu_id: string;
  label: string;
  href: string;
  is_external: boolean;
  sort_order: number;
  is_visible: boolean;
};

export function CmsNavigationManager({
  menus,
  menuItems,
}: {
  menus: CmsMenuRecord[];
  menuItems: CmsMenuItemRecord[];
}) {
  const [saveState, saveAction, savePending] = useActionState(saveCmsMenuItemAction, initialState);
  const [deleteState, deleteAction, deletePending] = useActionState(deleteCmsMenuItemAction, initialState);
  const [editingItem, setEditingItem] = useState<(CmsMenuItemRecord & { menuCode: string }) | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const resolveMenuCode = (menuId: string) => {
    return menus.find((m) => m.id === menuId)?.code ?? "header";
  };

  return (
    <div className="workspace-content">
      <section className="module-panel">
        <div className="module-heading" style={{ marginTop: 0 }}>
          <div>
            <p className="eyebrow">CMS ENGINE · NAVIGATION MENUS</p>
            <h2>Header &amp; footer navigation links</h2>
            <p>Manage structured navigation links across the primary header and footer link groups.</p>
          </div>
          <button
            className="button button-gold module-heading-action"
            onClick={() => {
              setEditingItem(null);
              setIsCreating(!isCreating);
            }}
            type="button"
          >
            <Plus size={16} /> {isCreating ? "Close Editor" : "Add Navigation Link"}
          </button>
        </div>

        {saveState.error && <p className="module-alert" role="alert">{saveState.error}</p>}
        {saveState.message && <p className="module-success" role="status">{saveState.message}</p>}
        {deleteState.error && <p className="module-alert" role="alert">{deleteState.error}</p>}
        {deleteState.message && <p className="module-success" role="status">{deleteState.message}</p>}

        {(isCreating || editingItem) && (
          <form
            action={saveAction}
            className="auth-form lead-create-form"
            style={{ marginTop: "24px", marginBottom: "32px", padding: "20px", border: "1px solid var(--line)", borderRadius: "14px", background: "var(--surface-raised)" }}
          >
            {editingItem && <input name="id" type="hidden" value={editingItem.id} />}
            <label>
              Menu Group *
              <select defaultValue={editingItem?.menuCode ?? "header"} name="menu_code">
                <option value="header">Primary Header Navigation</option>
                <option value="footer_services">Footer: Services</option>
                <option value="footer_company">Footer: Company</option>
                <option value="footer_platform">Footer: Platform</option>
                <option value="footer_legal">Footer: Trust &amp; Legal</option>
              </select>
            </label>
            <label>
              Link Label *
              <input defaultValue={editingItem?.label ?? ""} name="label" placeholder="Services" required type="text" />
            </label>
            <label>
              Target Path / URL *
              <input defaultValue={editingItem?.href ?? ""} name="href" placeholder="/services" required type="text" />
            </label>
            <label>
              Sort Order
              <input defaultValue={editingItem?.sort_order ?? 0} name="sort_order" type="number" />
            </label>
            <label>
              Visibility
              <select defaultValue={editingItem?.is_visible === false ? "false" : "true"} name="is_visible">
                <option value="true">Visible</option>
                <option value="false">Hidden</option>
              </select>
            </label>
            <label>
              External Link
              <select defaultValue={editingItem?.is_external ? "true" : "false"} name="is_external">
                <option value="false">Internal Route</option>
                <option value="true">External URL</option>
              </select>
            </label>
            <div style={{ display: "flex", gap: "10px", gridColumn: "1 / -1" }}>
              <button className="button button-gold" disabled={savePending} type="submit">
                {savePending ? "Saving Link…" : editingItem ? "Update Link" : "Create Link"}
              </button>
              <button
                className="button button-secondary"
                onClick={() => {
                  setEditingItem(null);
                  setIsCreating(false);
                }}
                type="button"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        <div className="module-table-wrap" style={{ marginTop: "20px" }}>
          <table className="module-table">
            <thead>
              <tr>
                <th>Menu Group</th>
                <th>Label &amp; Path</th>
                <th>Order</th>
                <th>Visibility</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {menuItems.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", padding: "24px" }}>
                    No custom navigation overrides configured. Default site header and footer navigation links are active.
                  </td>
                </tr>
              ) : (
                menuItems.map((item) => {
                  const menuCode = resolveMenuCode(item.menu_id);
                  return (
                    <tr key={item.id}>
                      <td><span className="record-status">{menuCode}</span></td>
                      <td>
                        <strong>{item.label}</strong>
                        <small>{item.href}</small>
                      </td>
                      <td>{item.sort_order}</td>
                      <td>{item.is_visible ? "Visible" : "Hidden"}</td>
                      <td>
                        <div style={{ display: "flex", gap: "8px" }}>
                          <button
                            className="button button-small button-secondary"
                            onClick={() => {
                              setIsCreating(false);
                              setEditingItem({ ...item, menuCode });
                            }}
                            type="button"
                          >
                            <Edit2 size={13} /> Edit
                          </button>
                          <form action={deleteAction}>
                            <input name="id" type="hidden" value={item.id} />
                            <button className="button button-small button-danger" disabled={deletePending} type="submit">
                              <Trash2 size={13} />
                            </button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export type CmsRevisionRecord = {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  snapshot: Record<string, unknown>;
  actor_id: string | null;
  created_at: string;
};

export function CmsRevisionsManager({ revisions }: { revisions: CmsRevisionRecord[] }) {
  const [restoreState, restoreAction, restorePending] = useActionState(restoreCmsRevisionAction, initialState);

  return (
    <div className="workspace-content">
      <section className="module-panel">
        <p className="eyebrow">CMS ENGINE · AUDIT &amp; VERSION HISTORY</p>
        <h2>Content revision snapshots</h2>
        <p>Immutable version trail of CMS changes across pages, articles, services, and site settings with one-click snapshot rollback.</p>

        {restoreState.error && <p className="module-alert" role="alert">{restoreState.error}</p>}
        {restoreState.message && <p className="module-success" role="status">{restoreState.message}</p>}

        <div className="module-table-wrap" style={{ marginTop: "20px" }}>
          <table className="module-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Entity Type</th>
                <th>Action</th>
                <th>Snapshot Summary</th>
                <th>Rollback</th>
              </tr>
            </thead>
            <tbody>
              {revisions.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", padding: "24px" }}>
                    No CMS revisions recorded yet. Every save or publication automatically creates a snapshot here.
                  </td>
                </tr>
              ) : (
                revisions.map((rev) => {
                  const snap = rev.snapshot ?? {};
                  const label =
                    (typeof snap.title === "string" && snap.title) ||
                    (typeof snap.name === "string" && snap.name) ||
                    (typeof snap.key === "string" && snap.key) ||
                    rev.entity_id.slice(0, 8);
                  const canRestore = ["page", "post", "service", "setting"].includes(rev.entity_type);

                  return (
                    <tr key={rev.id}>
                      <td><small>{new Date(rev.created_at).toLocaleString()}</small></td>
                      <td><span className="record-status">{rev.entity_type}</span></td>
                      <td><strong style={{ textTransform: "uppercase", fontSize: "11px" }}>{rev.action}</strong></td>
                      <td>
                        <strong>{label}</strong>
                        {typeof snap.slug === "string" && <small>/{snap.slug}</small>}
                      </td>
                      <td>
                        {canRestore ? (
                          <form action={restoreAction}>
                            <input name="revision_id" type="hidden" value={rev.id} />
                            <button
                              className="button button-small button-secondary"
                              disabled={restorePending}
                              type="submit"
                              title="Restore this snapshot"
                            >
                              <RotateCcw size={13} /> Restore
                            </button>
                          </form>
                        ) : (
                          <small style={{ color: "var(--muted)" }}>Snapshot logged</small>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

// ============================================================================
// 13. Unified Super Admin CMS Hub Component (Tabbed Architecture)
// ============================================================================

export function UnifiedCmsManager({
  pages,
  services,
  posts,
  caseStudies,
  settings,
  heroSlides,
  heroSettings,
  capabilities,
  processSteps,
  industries,
  techStack,
  faqs,
  media = [],
  menus = [],
  menuItems = [],
  revisions = [],
}: {
  pages: CmsPageRecord[];
  services: CmsServiceRecord[];
  posts: CmsPostRecord[];
  caseStudies: CmsCaseStudyRecord[];
  settings: CmsSettingRecord[];
  heroSlides: CmsHeroSlideRecord[];
  heroSettings?: Record<string, string>;
  capabilities: CmsCapabilityRecord[];
  processSteps: CmsProcessStepRecord[];
  industries: CmsIndustryRecord[];
  techStack: CmsTechStackRecord[];
  faqs: CmsFaqRecord[];
  media?: CmsMediaRecord[];
  menus?: CmsMenuRecord[];
  menuItems?: CmsMenuItemRecord[];
  revisions?: CmsRevisionRecord[];
}) {
  const [activeTab, setActiveTab] = useState<
    | "hero"
    | "capabilities"
    | "services"
    | "process"
    | "industries"
    | "portfolio"
    | "tech"
    | "faqs"
    | "pages"
    | "blog"
    | "media"
    | "navigation"
    | "revisions"
    | "settings"
  >("hero");

  return (
    <div className="workspace-content" style={{ display: "grid", gap: "24px" }}>
      {/* Navigation Sub-Tabs */}
      <div className="module-tabs" style={{ display: "flex", gap: "8px", flexWrap: "wrap", padding: "12px", border: "1px solid var(--line)", borderRadius: "16px", background: "var(--surface)" }}>
        <button
          className={`button button-small ${activeTab === "hero" ? "button-gold" : "button-secondary"}`}
          onClick={() => setActiveTab("hero")}
          type="button"
        >
          Hero &amp; Slides ({heroSlides.length})
        </button>
        <button
          className={`button button-small ${activeTab === "capabilities" ? "button-gold" : "button-secondary"}`}
          onClick={() => setActiveTab("capabilities")}
          type="button"
        >
          Capabilities ({capabilities.length})
        </button>
        <button
          className={`button button-small ${activeTab === "services" ? "button-gold" : "button-secondary"}`}
          onClick={() => setActiveTab("services")}
          type="button"
        >
          Services ({services.length})
        </button>
        <button
          className={`button button-small ${activeTab === "process" ? "button-gold" : "button-secondary"}`}
          onClick={() => setActiveTab("process")}
          type="button"
        >
          Engineering Process ({processSteps.length})
        </button>
        <button
          className={`button button-small ${activeTab === "industries" ? "button-gold" : "button-secondary"}`}
          onClick={() => setActiveTab("industries")}
          type="button"
        >
          Industries ({industries.length})
        </button>
        <button
          className={`button button-small ${activeTab === "portfolio" ? "button-gold" : "button-secondary"}`}
          onClick={() => setActiveTab("portfolio")}
          type="button"
        >
          Case Studies ({caseStudies.length})
        </button>
        <button
          className={`button button-small ${activeTab === "tech" ? "button-gold" : "button-secondary"}`}
          onClick={() => setActiveTab("tech")}
          type="button"
        >
          Tech Stack ({techStack.length})
        </button>
        <button
          className={`button button-small ${activeTab === "faqs" ? "button-gold" : "button-secondary"}`}
          onClick={() => setActiveTab("faqs")}
          type="button"
        >
          FAQs ({faqs.length})
        </button>
        <button
          className={`button button-small ${activeTab === "pages" ? "button-gold" : "button-secondary"}`}
          onClick={() => setActiveTab("pages")}
          type="button"
        >
          Pages ({pages.length})
        </button>
        <button
          className={`button button-small ${activeTab === "blog" ? "button-gold" : "button-secondary"}`}
          onClick={() => setActiveTab("blog")}
          type="button"
        >
          Blog ({posts.length})
        </button>
        <button
          className={`button button-small ${activeTab === "media" ? "button-gold" : "button-secondary"}`}
          onClick={() => setActiveTab("media")}
          type="button"
        >
          Media ({media.length})
        </button>
        <button
          className={`button button-small ${activeTab === "navigation" ? "button-gold" : "button-secondary"}`}
          onClick={() => setActiveTab("navigation")}
          type="button"
        >
          Navigation ({menuItems.length})
        </button>
        <button
          className={`button button-small ${activeTab === "revisions" ? "button-gold" : "button-secondary"}`}
          onClick={() => setActiveTab("revisions")}
          type="button"
        >
          Revisions ({revisions.length})
        </button>
        <button
          className={`button button-small ${activeTab === "settings" ? "button-gold" : "button-secondary"}`}
          onClick={() => setActiveTab("settings")}
          type="button"
        >
          Site Settings
        </button>
      </div>

      {/* Active Tab Panel */}
      {activeTab === "hero" && <CmsHeroManager heroSettings={heroSettings} slides={heroSlides} />}
      {activeTab === "capabilities" && <CmsCapabilitiesManager capabilities={capabilities} />}
      {activeTab === "services" && <CmsServicesManager services={services} />}
      {activeTab === "process" && <CmsProcessManager steps={processSteps} />}
      {activeTab === "industries" && <CmsIndustriesManager industries={industries} />}
      {activeTab === "portfolio" && <CmsPortfolioManager caseStudies={caseStudies} />}
      {activeTab === "tech" && <CmsTechStackManager items={techStack} />}
      {activeTab === "faqs" && <CmsFaqManager faqs={faqs} />}
      {activeTab === "pages" && <CmsPagesManager pages={pages} />}
      {activeTab === "blog" && <CmsBlogManager posts={posts} />}
      {activeTab === "media" && <CmsMediaManager media={media} />}
      {activeTab === "navigation" && <CmsNavigationManager menus={menus} menuItems={menuItems} />}
      {activeTab === "revisions" && <CmsRevisionsManager revisions={revisions} />}
      {activeTab === "settings" && <CmsSiteSettingsManager settings={settings} />}
    </div>
  );
}


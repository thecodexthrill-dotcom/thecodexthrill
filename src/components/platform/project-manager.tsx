"use client";

import { useState } from "react";
import {
  FolderKanban,
  Plus,
  Calendar,
  Trash2,
  Edit2,
  Flag,
  Lock,
  CheckCircle2,
  FileText,
  ExternalLink,
  UserCheck,
} from "lucide-react";
import Link from "next/link";
import {
  createProjectAction,
  updateProjectAction,
  deleteProjectAction,
  createTaskAction,
  updateTaskAction,
  updateTaskStatusAction,
  deleteTaskAction,
} from "@/lib/supabase/operations-actions";
import {
  calculateProjectTaskProgress,
  parseDeliveryDescription,
} from "@/lib/supabase/delivery-operations-helper";

export type ProjectRecord = {
  id: string;
  organization_id: string;
  name: string;
  description: string;
  status: "planning" | "in_progress" | "in_review" | "completed" | "on_hold";
  progress_pct: number;
  start_date: string | null;
  target_date: string | null;
  created_at: string;
  updated_at: string;
  tasks?: TaskRecord[];
};

export type TaskRecord = {
  id: string;
  project_id: string;
  organization_id: string;
  title: string;
  description: string;
  status: "todo" | "in_progress" | "review" | "done";
  priority: "low" | "medium" | "high" | "urgent";
  assigned_to: string | null;
  due_date: string | null;
  created_at: string;
};

export type ProjectDeliverableSummary = {
  id: string;
  project_id: string | null;
  organization_id: string;
  name: string;
  file_url: string;
  category: string;
  created_at: string;
};

type ProjectManagerProps = {
  projects: ProjectRecord[];
  isStaff: boolean;
  userOrganizations?: { id: string; name: string }[];
  staffMembers?: { id: string; label: string }[];
  documents?: ProjectDeliverableSummary[];
  currentMode: "projects" | "tasks";
  notice?: string;
  queryError?: string;
};

export function ProjectManager({
  projects,
  isStaff,
  userOrganizations = [],
  staffMembers = [],
  documents = [],
  currentMode = "projects",
  notice,
  queryError,
}: ProjectManagerProps) {
  const [selectedProjectId] = useState<string | null>(
    projects[0]?.id ?? null
  );
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [projectFilterId, setProjectFilterId] = useState<string>("all");

  const resolveAssigneeLabel = (userId: string | null) => {
    if (!userId) return null;
    const match = staffMembers.find((s) => s.id === userId);
    return match ? match.label : "Assigned Engineer";
  };

  const resolveOrgName = (orgId: string) => {
    return userOrganizations.find((o) => o.id === orgId)?.name ?? null;
  };

  const allTasks = projects
    .filter((p) => projectFilterId === "all" || p.id === projectFilterId)
    .flatMap((p) => (p.tasks ?? []).map((t) => ({ ...t, projectName: p.name })));

  if (currentMode === "tasks") {
    return (
      <div className="workspace-content" style={{ display: "grid", gap: "24px" }}>
        {queryError && (
          <div
            role="alert"
            style={{
              color: "#ef4444",
              background: "rgba(239, 68, 68, 0.1)",
              padding: "12px 16px",
              borderRadius: "6px",
              border: "1px solid rgba(239, 68, 68, 0.25)",
              fontSize: "14px",
            }}
          >
            <strong>Database Notice:</strong> Unable to load tasks from Supabase ({queryError}).
          </div>
        )}
        {notice && (
          <p className={notice === "invalid" || notice === "save" ? "module-alert" : "module-success"} role="status">
            {notice === "created"
              ? "Task created and project progress synchronized."
              : notice === "updated"
                ? "Task updated and project progress synchronized."
                : notice === "deleted"
                  ? "Task deleted."
                  : notice}
          </p>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
          <div>
            <h2 style={{ fontSize: "20px", fontWeight: 700, margin: 0 }}>Work Items &amp; Delivery Tasks</h2>
            <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: "14px" }}>
              Track technical milestones, engineering assignments, deadlines, and deliverable review status.
            </p>
          </div>

          <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
            {projects.length > 1 && (
              <select
                value={projectFilterId}
                onChange={(e) => setProjectFilterId(e.target.value)}
                style={{ fontSize: "13px", padding: "7px 10px", borderRadius: "6px", border: "1px solid var(--border)", background: "var(--surface)" }}
                aria-label="Filter tasks by project"
              >
                <option value="all">All Projects ({projects.length})</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.progress_pct}%)
                  </option>
                ))}
              </select>
            )}

            {projects.length > 0 && (
              <button
                type="button"
                onClick={() => setShowCreateTask(!showCreateTask)}
                className="button button-gold"
                style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}
              >
                <Plus size={16} /> New Task
              </button>
            )}
          </div>
        </div>

        {showCreateTask && projects.length > 0 && (
          <section className="module-panel" style={{ border: "1px solid var(--gold)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ fontSize: "18px", margin: 0 }}>Add Work Item / Delivery Task</h3>
              <button
                type="button"
                onClick={() => setShowCreateTask(false)}
                className="button button-secondary"
                style={{ padding: "4px 10px", fontSize: "12px" }}
              >
                Cancel
              </button>
            </div>

            <form action={createTaskAction} className="auth-form" style={{ marginTop: "16px", display: "grid", gap: "14px" }}>
              <input type="hidden" name="return_path" value={isStaff ? "admin" : "portal"} />
              <input type="hidden" name="has_structured_fields" value="1" />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <label>
                  Project
                  <select
                    name="project_id"
                    defaultValue={projects[0]?.id}
                    onChange={(e) => {
                      const p = projects.find((x) => x.id === e.target.value);
                      const orgInput = document.getElementById("task_org_id") as HTMLInputElement;
                      if (p && orgInput) orgInput.value = p.organization_id;
                    }}
                  >
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </label>

                <label>
                  Milestone / Sprint Phase
                  <input
                    name="milestone"
                    maxLength={100}
                    placeholder="e.g., Milestone 1: Core Architecture"
                  />
                </label>
              </div>

              <input type="hidden" id="task_org_id" name="organization_id" value={projects[0]?.organization_id} />

              <label>
                Task Title
                <input name="title" required maxLength={200} placeholder="e.g., Integrate Supabase Auth AAL2 verification" />
              </label>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "12px" }}>
                <label>
                  Status
                  <select name="status" defaultValue="todo">
                    <option value="todo">To Do</option>
                    <option value="in_progress">In Progress</option>
                    <option value="review">Client / QA Review</option>
                    <option value="done">Done</option>
                  </select>
                </label>

                <label>
                  Priority
                  <select name="priority" defaultValue="medium">
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </label>

                <label>
                  Due Date / Deadline
                  <input type="date" name="due_date" />
                </label>

                {isStaff && (
                  <label>
                    Assigned Owner
                    <select name="assigned_to" defaultValue="">
                      <option value="">Unassigned</option>
                      {staffMembers.map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.label}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>

              <label>
                Client-Visible Specification &amp; Acceptance Criteria
                <textarea name="description" rows={3} placeholder="Task specification and client-visible deliverable checklist..." />
              </label>

              {isStaff && (
                <label style={{ borderLeft: "3px solid #f59e0b", paddingLeft: "10px" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", color: "#f59e0b", fontWeight: 600 }}>
                    <Lock size={13} /> Internal Staff Notes (Hidden from Client Portal)
                  </span>
                  <textarea
                    name="internal_notes"
                    rows={2}
                    placeholder="Internal engineering notes, PR links, or blocker details (redacted from client view)..."
                  />
                </label>
              )}

              <button type="submit" className="button button-gold" style={{ justifySelf: "start" }}>
                Create Task
              </button>
            </form>
          </section>
        )}

        {/* Task Columns / Status Board */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "16px" }}>
          {(["todo", "in_progress", "review", "done"] as const).map((status) => {
            const columnTasks = allTasks.filter((t) => t.status === status);
            return (
              <div key={status} className="module-panel" style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--gold)" }}>
                    {status === "review" ? "In Review" : status.replace("_", " ")}
                  </span>
                  <span style={{ fontSize: "12px", color: "var(--muted)" }}>{columnTasks.length}</span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {columnTasks.length === 0 ? (
                    <div style={{ padding: "20px 10px", textAlign: "center", color: "var(--muted)", fontSize: "12px", border: "1px dashed var(--border)", borderRadius: "6px" }}>
                      No tasks in this stage
                    </div>
                  ) : (
                    columnTasks.map((task) => {
                      const parsedTask = parseDeliveryDescription(task.description);
                      const assigneeLabel = resolveAssigneeLabel(task.assigned_to);
                      return (
                        <div
                          key={task.id}
                          style={{
                            padding: "12px",
                            borderRadius: "6px",
                            border: "1px solid var(--border)",
                            background: "var(--panel-bg, #111)",
                            display: "flex",
                            flexDirection: "column",
                            gap: "8px",
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                            <span style={{ fontSize: "11px", color: "var(--muted)" }}>{task.projectName}</span>
                            <span
                              className="record-status"
                              style={{
                                fontSize: "10px",
                                padding: "2px 5px",
                                textTransform: "uppercase",
                                color: task.priority === "urgent" ? "#ef4444" : task.priority === "high" ? "#f59e0b" : "inherit",
                              }}
                            >
                              {task.priority}
                            </span>
                          </div>

                          {parsedTask.milestone && (
                            <div style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "11px", color: "var(--gold)", fontWeight: 600 }}>
                              <Flag size={11} /> {parsedTask.milestone}
                            </div>
                          )}

                          <strong style={{ fontSize: "13px", lineHeight: "1.4" }}>{task.title}</strong>

                          {parsedTask.clientDescription && (
                            <p style={{ margin: 0, fontSize: "12px", color: "var(--muted)", lineHeight: "1.45", whiteSpace: "pre-line" }}>
                              {parsedTask.clientDescription}
                            </p>
                          )}

                          {isStaff && parsedTask.internalNotes && (
                            <div
                              style={{
                                padding: "6px 8px",
                                borderRadius: "4px",
                                background: "rgba(245, 158, 11, 0.08)",
                                border: "1px solid rgba(245, 158, 11, 0.3)",
                                fontSize: "11px",
                                color: "#fbbf24",
                              }}
                            >
                              <strong style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "10px", textTransform: "uppercase" }}>
                                <Lock size={10} /> Internal Staff Note:
                              </strong>
                              <div style={{ marginTop: "2px", whiteSpace: "pre-line" }}>{parsedTask.internalNotes}</div>
                            </div>
                          )}

                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "6px", fontSize: "11px", color: "var(--muted)" }}>
                            {task.due_date ? (
                              <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                                <Calendar size={11} /> Due: {task.due_date}
                              </span>
                            ) : <span />}
                            {assigneeLabel && (
                              <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", color: "var(--gold-ink)" }}>
                                <UserCheck size={11} /> {assigneeLabel}
                              </span>
                            )}
                          </div>

                          {editingTaskId === task.id ? (
                            <form action={updateTaskAction} style={{ display: "grid", gap: "8px", marginTop: "8px", padding: "8px", border: "1px solid var(--border)", borderRadius: "4px" }}>
                              <input type="hidden" name="id" value={task.id} />
                              <input type="hidden" name="return_path" value={isStaff ? "admin" : "portal"} />
                              <input type="hidden" name="has_structured_fields" value="1" />
                              <label style={{ fontSize: "11px" }}>Title
                                <input name="title" defaultValue={task.title} required maxLength={200} style={{ fontSize: "12px", width: "100%" }} />
                              </label>
                              <label style={{ fontSize: "11px" }}>Milestone
                                <input name="milestone" defaultValue={parsedTask.milestone ?? ""} maxLength={100} style={{ fontSize: "11px", width: "100%" }} />
                              </label>
                              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                                <label style={{ fontSize: "11px" }}>Status
                                  <select name="status" defaultValue={task.status} style={{ fontSize: "11px", width: "100%" }}>
                                    <option value="todo">To Do</option>
                                    <option value="in_progress">In Progress</option>
                                    <option value="review">Review</option>
                                    <option value="done">Done</option>
                                  </select>
                                </label>
                                <label style={{ fontSize: "11px" }}>Priority
                                  <select name="priority" defaultValue={task.priority} style={{ fontSize: "11px", width: "100%" }}>
                                    <option value="low">Low</option>
                                    <option value="medium">Medium</option>
                                    <option value="high">High</option>
                                    <option value="urgent">Urgent</option>
                                  </select>
                                </label>
                              </div>
                              <label style={{ fontSize: "11px" }}>Due Date
                                <input type="date" name="due_date" defaultValue={task.due_date ?? ""} style={{ fontSize: "11px", width: "100%" }} />
                              </label>
                              {isStaff && (
                                <label style={{ fontSize: "11px" }}>Assigned Owner
                                  <select name="assigned_to" defaultValue={task.assigned_to ?? ""} style={{ fontSize: "11px", width: "100%" }}>
                                    <option value="">Unassigned</option>
                                    {staffMembers.map((member) => (
                                      <option key={member.id} value={member.id}>
                                        {member.label}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                              )}
                              <label style={{ fontSize: "11px" }}>Client-Visible Description
                                <textarea name="description" defaultValue={parsedTask.clientDescription} rows={2} style={{ fontSize: "11px", width: "100%" }} />
                              </label>
                              {isStaff && (
                                <label style={{ fontSize: "11px", color: "#fbbf24" }}>Internal Staff Notes (Staff Only)
                                  <textarea name="internal_notes" defaultValue={parsedTask.internalNotes} rows={2} style={{ fontSize: "11px", width: "100%" }} />
                                </label>
                              )}
                              <div style={{ display: "flex", gap: "6px", marginTop: "4px" }}>
                                <button type="submit" className="button button-gold" style={{ fontSize: "11px", padding: "3px 8px" }}>Save</button>
                                <button type="button" onClick={() => setEditingTaskId(null)} className="button button-secondary" style={{ fontSize: "11px", padding: "3px 8px" }}>Cancel</button>
                              </div>
                            </form>
                          ) : (
                            <>
                              <form action={updateTaskStatusAction} style={{ marginTop: "4px" }}>
                                <input type="hidden" name="id" value={task.id} />
                                <input type="hidden" name="return_path" value={isStaff ? "admin" : "portal"} />
                                <select
                                  name="status"
                                  defaultValue={task.status}
                                  onChange={(e) => e.target.form?.requestSubmit()}
                                  style={{ fontSize: "11px", padding: "3px 6px", width: "100%" }}
                                >
                                  <option value="todo">Move to To Do</option>
                                  <option value="in_progress">Move to In Progress</option>
                                  <option value="review">Submit for Review</option>
                                  <option value="done">Mark as Done</option>
                                </select>
                              </form>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "6px" }}>
                                <button
                                  type="button"
                                  onClick={() => setEditingTaskId(task.id)}
                                  className="button button-small button-secondary"
                                  style={{ fontSize: "11px", padding: "2px 6px", display: "inline-flex", alignItems: "center", gap: "4px" }}
                                >
                                  <Edit2 size={11} /> Edit
                                </button>
                                <form
                                  action={deleteTaskAction}
                                  onSubmit={(e) => {
                                    if (!confirm("Are you sure you want to delete this task?")) e.preventDefault();
                                  }}
                                >
                                  <input type="hidden" name="id" value={task.id} />
                                  <input type="hidden" name="return_path" value={isStaff ? "admin" : "portal"} />
                                  <button
                                    type="submit"
                                    className="button button-small button-danger"
                                    style={{ fontSize: "11px", padding: "2px 6px" }}
                                    title="Delete task"
                                  >
                                    <Trash2 size={11} />
                                  </button>
                                </form>
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }


  return (
    <div className="workspace-content" style={{ display: "grid", gap: "24px" }}>
      {queryError && (
        <div
          role="alert"
          style={{
            color: "#ef4444",
            background: "rgba(239, 68, 68, 0.1)",
            padding: "12px 16px",
            borderRadius: "6px",
            border: "1px solid rgba(239, 68, 68, 0.25)",
            fontSize: "14px",
          }}
        >
          <strong>Database Notice:</strong> Unable to load projects from Supabase ({queryError}).
        </div>
      )}
      {notice && (
        <p className={notice === "invalid" || notice === "save" ? "module-alert" : "module-success"} role="status">
          {notice === "created" ? "Project created successfully." : notice === "updated" ? "Project updated successfully." : notice === "deleted" ? "Project deleted." : notice}
        </p>
      )}

      {isStaff && userOrganizations.length === 0 && (
        <div className="module-panel" style={{ border: "1px dashed var(--gold)", padding: "16px" }}>
          <p style={{ margin: 0, fontSize: "14px", color: "var(--gold)" }}>
            <strong>Notice:</strong> No client organization found. Please <Link href="/admin/clients" style={{ textDecoration: "underline", color: "var(--gold)" }}>create an organization in Clients</Link> first before initializing a project.
          </p>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <h2 style={{ fontSize: "20px", fontWeight: 700, margin: 0 }}>Project Operations &amp; Client Delivery</h2>
          <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: "14px" }}>
            Software engineering milestones, task progress, delivery handover checklists, and authorized deliverables.
          </p>
        </div>

        {isStaff && userOrganizations.length > 0 && (
          <button
            type="button"
            onClick={() => setShowCreateProject(!showCreateProject)}
            className="button button-gold"
            style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}
          >
            <Plus size={16} /> New Project
          </button>
        )}
      </div>

      {showCreateProject && isStaff && (
        <section className="module-panel" style={{ border: "1px solid var(--gold)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ fontSize: "18px", margin: 0 }}>Create Delivery Project</h3>
            <button
              type="button"
              onClick={() => setShowCreateProject(false)}
              className="button button-secondary"
              style={{ padding: "4px 10px", fontSize: "12px" }}
            >
              Cancel
            </button>
          </div>

          <form action={createProjectAction} className="auth-form" style={{ marginTop: "16px", display: "grid", gap: "14px" }}>
            <input type="hidden" name="has_structured_fields" value="1" />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <label>
                Client Organization
                <select name="organization_id" defaultValue={userOrganizations[0]?.id}>
                  {userOrganizations.map((org) => (
                    <option key={org.id} value={org.id}>{org.name}</option>
                  ))}
                </select>
              </label>

              <label>
                Current Milestone / Phase
                <input
                  name="milestone"
                  maxLength={120}
                  placeholder="e.g., Phase 1: Architecture & Foundation"
                />
              </label>
            </div>

            <label>
              Project Name
              <input name="name" required maxLength={200} placeholder="e.g., Enterprise Platform Redesign" />
            </label>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "12px" }}>
              <label>
                Status
                <select name="status" defaultValue="in_progress">
                  <option value="planning">Planning</option>
                  <option value="in_progress">In Progress</option>
                  <option value="in_review">In Review</option>
                  <option value="completed">Completed</option>
                  <option value="on_hold">On Hold</option>
                </select>
              </label>

              <label>
                Initial Progress (%)
                <input type="number" name="progress_pct" defaultValue={10} min={0} max={100} />
              </label>

              <label>
                Kickoff / Start Date
                <input type="date" name="start_date" />
              </label>

              <label>
                Target Delivery Date
                <input type="date" name="target_date" />
              </label>
            </div>

            <label>
              Client-Visible Scope &amp; Deliverables Summary
              <textarea name="description" rows={3} placeholder="Describe technical scope, architectural goals, and client-facing deliverables..." />
            </label>

            <label>
              Delivery Handover &amp; Acceptance Checklist (Visible to Client)
              <textarea
                name="handover_checklist"
                rows={2}
                placeholder="e.g., Production URL verified, Runbook uploaded to Files, Admin credentials transferred..."
              />
            </label>

            <label style={{ borderLeft: "3px solid #f59e0b", paddingLeft: "10px" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", color: "#f59e0b", fontWeight: 600 }}>
                <Lock size={13} /> Internal Staff Notes (Hidden from Client Portal)
              </span>
              <textarea
                name="internal_notes"
                rows={2}
                placeholder="Internal margin targets, infrastructure notes, or staff-only context..."
              />
            </label>

            <button type="submit" className="button button-gold" style={{ justifySelf: "start" }}>
              Initialize Project
            </button>
          </form>
        </section>
      )}

      {/* Projects List */}
      {projects.length === 0 ? (
        <div className="module-panel" style={{ textAlign: "center", padding: "40px" }}>
          <FolderKanban size={36} style={{ color: "var(--muted)", margin: "0 auto 12px" }} />
          <h3>No projects initiated yet</h3>
          <p style={{ color: "var(--muted)", fontSize: "14px" }}>
            {isStaff
              ? "Create a project to begin tracking milestones, assigning work items, and delivering software."
              : "Active projects provisioned for your organization will appear here."}
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: "18px" }}>
          {projects.map((p) => {
            const parsedDesc = parseDeliveryDescription(p.description);
            const taskStats = calculateProjectTaskProgress(p.tasks);
            const projectDocs = documents.filter((d) => d.project_id === p.id);
            const orgName = resolveOrgName(p.organization_id);

            return (
              <div
                key={p.id}
                className="module-panel"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "14px",
                  border: selectedProjectId === p.id ? "1px solid var(--gold)" : "1px solid var(--border)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
                  <div>
                    {orgName && (
                      <small style={{ display: "block", color: "var(--muted)", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "2px" }}>
                        {orgName}
                      </small>
                    )}
                    <h3 style={{ fontSize: "17px", margin: "0 0 6px" }}>{p.name}</h3>
                    <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}>
                      <span className="record-status" style={{ fontSize: "11px", textTransform: "uppercase" }}>
                        {p.status.replace("_", " ")}
                      </span>
                      {parsedDesc.milestone && (
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                            fontSize: "11px",
                            padding: "2px 8px",
                            borderRadius: "999px",
                            background: "rgba(212, 175, 55, 0.12)",
                            border: "1px solid rgba(212, 175, 55, 0.35)",
                            color: "var(--gold)",
                            fontWeight: 600,
                          }}
                        >
                          <Flag size={11} /> {parsedDesc.milestone}
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <span style={{ fontSize: "20px", fontWeight: 700, color: "var(--gold)" }}>
                      {p.progress_pct}%
                    </span>
                    <small style={{ display: "block", fontSize: "10px", color: "var(--muted)" }}>
                      completion
                    </small>
                  </div>
                </div>

                {/* Progress Bar & Task Summary */}
                <div style={{ display: "grid", gap: "6px" }}>
                  <div style={{ width: "100%", height: "6px", background: "rgba(255, 255, 255, 0.08)", borderRadius: "3px", overflow: "hidden" }}>
                    <div style={{ width: `${p.progress_pct}%`, height: "100%", background: "var(--gold)" }} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "var(--muted)" }}>
                    <span>
                      Tasks: <strong>{taskStats.completedTasks}/{taskStats.totalTasks}</strong> done
                      {taskStats.reviewTasks > 0 ? ` · ${taskStats.reviewTasks} in review` : ""}
                      {taskStats.inProgressTasks > 0 ? ` · ${taskStats.inProgressTasks} active` : ""}
                    </span>
                    <Link
                      href={isStaff ? "/admin/tasks" : "/portal/tasks"}
                      style={{ color: "var(--gold)", textDecoration: "none", fontWeight: 600 }}
                    >
                      View Tasks &rarr;
                    </Link>
                  </div>
                </div>

                <p style={{ fontSize: "13px", color: "var(--muted)", margin: 0, lineHeight: "1.55", whiteSpace: "pre-line" }}>
                  {parsedDesc.clientDescription || "Active software engineering engagement."}
                </p>

                {/* Delivery Handover Checklist (Client & Staff visible) */}
                {parsedDesc.handoverChecklist && (
                  <div
                    style={{
                      padding: "10px 12px",
                      borderRadius: "8px",
                      background: "rgba(16, 185, 129, 0.08)",
                      border: "1px solid rgba(16, 185, 129, 0.3)",
                      fontSize: "12px",
                    }}
                  >
                    <strong style={{ display: "inline-flex", alignItems: "center", gap: "6px", color: "#10b981", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                      <CheckCircle2 size={13} /> Delivery Handover &amp; Acceptance
                    </strong>
                    <p style={{ margin: "4px 0 0", color: "var(--foreground)", whiteSpace: "pre-line", lineHeight: "1.45" }}>
                      {parsedDesc.handoverChecklist}
                    </p>
                  </div>
                )}

                {/* Linked Project Deliverables */}
                {projectDocs.length > 0 && (
                  <div
                    style={{
                      padding: "10px 12px",
                      borderRadius: "8px",
                      background: "rgba(255, 255, 255, 0.03)",
                      border: "1px solid var(--border)",
                      display: "grid",
                      gap: "6px",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--gold)" }}>
                        Project Deliverables ({projectDocs.length})
                      </span>
                      <Link href={isStaff ? "/admin/files" : "/portal/files"} style={{ fontSize: "11px", color: "var(--muted)" }}>
                        All Files
                      </Link>
                    </div>
                    {projectDocs.slice(0, 4).map((doc) => (
                      <div key={doc.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "12px" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                          <FileText size={12} style={{ color: "var(--gold)" }} />
                          {doc.name}
                        </span>
                        <a
                          href={doc.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: "var(--gold)", display: "inline-flex", alignItems: "center", gap: "3px", fontSize: "11px" }}
                        >
                          Open <ExternalLink size={11} />
                        </a>
                      </div>
                    ))}
                  </div>
                )}

                {/* Internal Staff Notes (Strictly Staff Only) */}
                {isStaff && parsedDesc.internalNotes && (
                  <div
                    style={{
                      padding: "10px 12px",
                      borderRadius: "8px",
                      background: "rgba(245, 158, 11, 0.08)",
                      border: "1px solid rgba(245, 158, 11, 0.35)",
                      fontSize: "12px",
                      color: "#fbbf24",
                    }}
                  >
                    <strong style={{ display: "inline-flex", alignItems: "center", gap: "5px", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                      <Lock size={12} /> Internal Staff Notes (Redacted from Client Portal)
                    </strong>
                    <p style={{ margin: "4px 0 0", whiteSpace: "pre-line", lineHeight: "1.45" }}>
                      {parsedDesc.internalNotes}
                    </p>
                  </div>
                )}

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px", fontSize: "12px", color: "var(--muted)" }}>
                  {p.start_date && (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
                      <Calendar size={12} /> Kickoff: {p.start_date}
                    </span>
                  )}
                  {p.target_date && (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
                      <Calendar size={12} /> Target: {p.target_date}
                    </span>
                  )}
                </div>

                {isStaff && (
                  <details style={{ marginTop: "auto", borderTop: "1px solid var(--border)", paddingTop: "10px" }}>
                    <summary style={{ fontSize: "12px", color: "var(--gold)", cursor: "pointer", fontWeight: 600 }}>
                      Manage Project, Milestones &amp; Handover
                    </summary>
                    <form action={updateProjectAction} className="row-edit-form" style={{ marginTop: "10px", display: "grid", gap: "10px" }}>
                      <input type="hidden" name="id" value={p.id} />
                      <input type="hidden" name="organization_id" value={p.organization_id} />
                      <input type="hidden" name="has_structured_fields" value="1" />
                      <label>Name<input name="name" defaultValue={p.name} required maxLength={200} /></label>
                      <label>Current Milestone / Phase<input name="milestone" defaultValue={parsedDesc.milestone ?? ""} maxLength={120} placeholder="e.g., Phase 2: UAT & Launch" /></label>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                        <label>Status
                          <select name="status" defaultValue={p.status}>
                            <option value="planning">Planning</option>
                            <option value="in_progress">In Progress</option>
                            <option value="in_review">In Review</option>
                            <option value="completed">Completed</option>
                            <option value="on_hold">On Hold</option>
                          </select>
                        </label>
                        <label>Progress (%)<input type="number" name="progress_pct" defaultValue={p.progress_pct} min={0} max={100} /></label>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                        <label>Start date<input type="date" name="start_date" defaultValue={p.start_date ?? ""} /></label>
                        <label>Target date<input type="date" name="target_date" defaultValue={p.target_date ?? ""} /></label>
                      </div>
                      <label>Client-Visible Description
                        <textarea name="description" rows={3} defaultValue={parsedDesc.clientDescription} />
                      </label>
                      <label>Delivery Handover Checklist (Client-Visible)
                        <textarea name="handover_checklist" rows={2} defaultValue={parsedDesc.handoverChecklist ?? ""} placeholder="Handover items, links, and sign-off summary..." />
                      </label>
                      <label style={{ color: "#fbbf24" }}>Internal Staff Notes (Hidden from Client)
                        <textarea name="internal_notes" rows={2} defaultValue={parsedDesc.internalNotes} placeholder="Internal staff notes..." />
                      </label>
                      <button className="button button-gold button-small" type="submit" style={{ justifySelf: "start" }}>
                        Save Project Changes
                      </button>
                    </form>
                    <form
                      action={deleteProjectAction}
                      onSubmit={(e) => {
                        if (!confirm(`Are you sure you want to delete project "${p.name}"? This will also remove related tasks.`)) e.preventDefault();
                      }}
                      style={{ marginTop: "12px", borderTop: "1px solid var(--border)", paddingTop: "10px" }}
                    >
                      <input type="hidden" name="id" value={p.id} />
                      <button type="submit" className="button button-small button-danger" style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                        <Trash2 size={13} /> Delete Project
                      </button>
                    </form>
                  </details>
                )}

              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}


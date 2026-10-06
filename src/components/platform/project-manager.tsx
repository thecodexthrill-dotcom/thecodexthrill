"use client";

import { useState } from "react";
import { FolderKanban, Plus, Calendar, Trash2, Edit2 } from "lucide-react";
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

type ProjectManagerProps = {
  projects: ProjectRecord[];
  isStaff: boolean;
  userOrganizations?: { id: string; name: string }[];
  currentMode: "projects" | "tasks";
  notice?: string;
};

export function ProjectManager({
  projects,
  isStaff,
  userOrganizations = [],
  currentMode = "projects",
  notice,
}: ProjectManagerProps) {
  const [selectedProjectId] = useState<string | null>(
    projects[0]?.id ?? null
  );
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);


  const allTasks = projects.flatMap((p) => (p.tasks ?? []).map((t) => ({ ...t, projectName: p.name })));

  if (currentMode === "tasks") {
    return (
      <div className="workspace-content" style={{ display: "grid", gap: "24px" }}>
        {notice && (
          <p className={notice === "invalid" || notice === "save" ? "module-alert" : "module-success"} role="status">
            {notice === "created" ? "Task created successfully." : notice === "updated" ? "Task updated successfully." : notice === "deleted" ? "Task deleted." : notice}
          </p>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
          <div>
            <h2 style={{ fontSize: "20px", fontWeight: 700, margin: 0 }}>Work Items &amp; Tasks</h2>
            <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: "14px" }}>
              Track technical milestones, deliverable progress, and assigned work packages.
            </p>
          </div>

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

        {showCreateTask && projects.length > 0 && (
          <section className="module-panel" style={{ border: "1px solid var(--gold)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ fontSize: "18px", margin: 0 }}>Add Work Item / Task</h3>
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
              <label>
                Project
                <select name="project_id" defaultValue={projects[0]?.id} onChange={(e) => {
                  const p = projects.find((x) => x.id === e.target.value);
                  const orgInput = document.getElementById("task_org_id") as HTMLInputElement;
                  if (p && orgInput) orgInput.value = p.organization_id;
                }}>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </label>

              <input type="hidden" id="task_org_id" name="organization_id" value={projects[0]?.organization_id} />

              <label>
                Task Title
                <input name="title" required maxLength={200} placeholder="e.g., Integrate Supabase Auth AAL2 verification" />
              </label>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <label>
                  Status
                  <select name="status" defaultValue="todo">
                    <option value="todo">To Do</option>
                    <option value="in_progress">In Progress</option>
                    <option value="review">Review</option>
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
              </div>

              <label>
                Due Date
                <input type="date" name="due_date" />
              </label>

              <label>
                Description
                <textarea name="description" rows={3} placeholder="Task specification and deliverable checklist..." />
              </label>

              <button type="submit" className="button button-gold" style={{ justifySelf: "start" }}>
                Create Task
              </button>
            </form>
          </section>
        )}

        {/* Task Columns / Status Board */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px" }}>
          {(["todo", "in_progress", "review", "done"] as const).map((status) => {
            const columnTasks = allTasks.filter((t) => t.status === status);
            return (
              <div key={status} className="module-panel" style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--gold)" }}>
                    {status.replace("_", " ")}
                  </span>
                  <span style={{ fontSize: "12px", color: "var(--muted)" }}>{columnTasks.length}</span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {columnTasks.length === 0 ? (
                    <div style={{ padding: "20px 10px", textAlign: "center", color: "var(--muted)", fontSize: "12px", border: "1px dashed var(--border)", borderRadius: "6px" }}>
                      No tasks in this column
                    </div>
                  ) : (
                    columnTasks.map((task) => (
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
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
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

                        <strong style={{ fontSize: "13px", lineHeight: "1.4" }}>{task.title}</strong>

                        {task.due_date && (
                          <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", color: "var(--muted)" }}>
                            <Calendar size={12} /> {task.due_date}
                          </div>
                        )}

                        {editingTaskId === task.id ? (
                          <form action={updateTaskAction} style={{ display: "grid", gap: "8px", marginTop: "8px", padding: "8px", border: "1px solid var(--border)", borderRadius: "4px" }}>
                            <input type="hidden" name="id" value={task.id} />
                            <input type="hidden" name="return_path" value={isStaff ? "admin" : "portal"} />
                            <label style={{ fontSize: "11px" }}>Title
                              <input name="title" defaultValue={task.title} required maxLength={200} style={{ fontSize: "12px", width: "100%" }} />
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
                            <label style={{ fontSize: "11px" }}>Description
                              <textarea name="description" defaultValue={task.description} rows={2} style={{ fontSize: "11px", width: "100%" }} />
                            </label>
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
                                <option value="review">Move to Review</option>
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
                    ))
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
          <h2 style={{ fontSize: "20px", fontWeight: 700, margin: 0 }}>Project Operations &amp; Delivery</h2>
          <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: "14px" }}>
            Software engineering deliverables, milestone status, and active project timelines.
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
            <label>
              Organization
              <select name="organization_id" defaultValue={userOrganizations[0]?.id}>
                {userOrganizations.map((org) => (
                  <option key={org.id} value={org.id}>{org.name}</option>
                ))}
              </select>
            </label>

            <label>
              Project Name
              <input name="name" required maxLength={200} placeholder="e.g., Enterprise Platform Redesign" />
            </label>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
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
                Progress (% completion)
                <input type="number" name="progress_pct" defaultValue={10} min={0} max={100} />
              </label>
            </div>

            <label>
              Target Delivery Date
              <input type="date" name="target_date" />
            </label>

            <label>
              Project Scope &amp; Deliverables
              <textarea name="description" rows={4} placeholder="Describe technical scope, architectural goals, and key phases..." />
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
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "16px" }}>
          {projects.map((p) => (
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
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <h3 style={{ fontSize: "16px", margin: "0 0 4px" }}>{p.name}</h3>
                  <span className="record-status" style={{ fontSize: "11px", textTransform: "uppercase" }}>
                    {p.status.replace("_", " ")}
                  </span>
                </div>
                <span style={{ fontSize: "18px", fontWeight: 700, color: "var(--gold)" }}>
                  {p.progress_pct}%
                </span>
              </div>

              {/* Progress Bar */}
              <div style={{ width: "100%", height: "6px", background: "rgba(255, 255, 255, 0.08)", borderRadius: "3px", overflow: "hidden" }}>
                <div style={{ width: `${p.progress_pct}%`, height: "100%", background: "var(--gold)" }} />
              </div>

              <p style={{ fontSize: "13px", color: "var(--muted)", margin: 0, lineHeight: "1.5" }}>
                {p.description || "Active software engineering engagement."}
              </p>

              {p.target_date && (
                <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "var(--muted)" }}>
                  <Calendar size={13} /> Target: {p.target_date}
                </div>
              )}

              {isStaff && (
                <details style={{ marginTop: "auto", borderTop: "1px solid var(--border)", paddingTop: "10px" }}>
                  <summary style={{ fontSize: "12px", color: "var(--gold)", cursor: "pointer" }}>Edit project details</summary>
                  <form action={updateProjectAction} className="row-edit-form" style={{ marginTop: "10px" }}>
                    <input type="hidden" name="id" value={p.id} />
                    <input type="hidden" name="organization_id" value={p.organization_id} />
                    <label>Name<input name="name" defaultValue={p.name} required maxLength={200} /></label>
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
                    <label>Target date<input type="date" name="target_date" defaultValue={p.target_date ?? ""} /></label>
                    <button className="button-secondary" type="submit">Update</button>
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
          ))}
        </div>
      )}
    </div>
  );
}


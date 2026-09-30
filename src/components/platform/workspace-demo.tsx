"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

export type WorkStatus = "Open" | "In progress" | "Blocked" | "Complete";
export type DemoLead = { id: string; name: string; email: string; organization: string; status: "New" | "Contacted" | "Qualified" | "Closed"; notes: string; createdAt: string };
export type DemoClient = { id: string; name: string; email: string; status: "Active" | "Onboarding" | "Paused"; notes: string; createdAt: string };
export type DemoProject = { id: string; title: string; clientId: string; summary: string; status: "Planning" | "In progress" | "On hold" | "Complete"; progress: number; portfolio: boolean; createdAt: string };
export type DemoTask = { id: string; projectId: string; title: string; owner: string; dueDate: string; status: WorkStatus; notes: string; createdAt: string };
export type DemoTicket = { id: string; projectId: string; subject: string; message: string; priority: "Low" | "Normal" | "High"; status: "Open" | "In progress" | "Waiting" | "Resolved"; createdAt: string };
export type DemoPage = { id: string; title: string; slug: string; body: string; status: "Draft" | "Published"; updatedAt: string };
export type DemoPost = { id: string; title: string; slug: string; summary: string; body: string; status: "Draft" | "Published"; updatedAt: string };
export type DemoFile = { id: string; projectId: string; name: string; size: number; mimeType: string; url: string; createdAt: string };
export type DemoInvoice = { id: string; projectId: string; label: string; amount: number; currency: string; dueDate: string; status: "Draft" | "Sent" | "Paid"; createdAt: string };
export type DemoActivity = { id: string; title: string; detail: string; createdAt: string };
export type DemoNotification = DemoActivity & { read: boolean };

type WorkspaceState = {
  leads: DemoLead[]; clients: DemoClient[]; projects: DemoProject[]; tasks: DemoTask[];
  tickets: DemoTicket[]; pages: DemoPage[]; posts: DemoPost[]; files: DemoFile[];
  invoices: DemoInvoice[]; activity: DemoActivity[]; notifications: DemoNotification[];
  preferences: { compactTables: boolean };
};

type WorkspaceContextValue = WorkspaceState & {
  addLead: (input: Omit<DemoLead, "id" | "createdAt" | "status">) => DemoLead;
  updateLead: (id: string, patch: Partial<DemoLead>) => void;
  addClient: (input: Omit<DemoClient, "id" | "createdAt" | "status">) => DemoClient;
  updateClient: (id: string, patch: Partial<DemoClient>) => void;
  addProject: (input: Omit<DemoProject, "id" | "createdAt" | "status" | "progress" | "portfolio">) => DemoProject;
  updateProject: (id: string, patch: Partial<DemoProject>) => void;
  addTask: (input: Omit<DemoTask, "id" | "createdAt" | "status">) => DemoTask;
  updateTask: (id: string, patch: Partial<DemoTask>) => void;
  addTicket: (input: Omit<DemoTicket, "id" | "createdAt" | "status">) => DemoTicket;
  updateTicket: (id: string, patch: Partial<DemoTicket>) => void;
  addPage: (input: Omit<DemoPage, "id" | "updatedAt" | "status">) => DemoPage;
  updatePage: (id: string, patch: Partial<DemoPage>) => void;
  addPost: (input: Omit<DemoPost, "id" | "updatedAt" | "status">) => DemoPost;
  updatePost: (id: string, patch: Partial<DemoPost>) => void;
  addFile: (projectId: string, file: File) => DemoFile;
  removeFile: (id: string) => void;
  addInvoice: (input: Omit<DemoInvoice, "id" | "createdAt" | "status">) => DemoInvoice;
  updateInvoice: (id: string, patch: Partial<DemoInvoice>) => void;
  markNotificationRead: (id: string) => void;
  updatePreferences: (patch: Partial<WorkspaceState["preferences"]>) => void;
  clearDemoData: () => void;
};

const emptyState: WorkspaceState = {
  leads: [], clients: [], projects: [], tasks: [], tickets: [], pages: [], posts: [], files: [], invoices: [], activity: [], notifications: [],
  preferences: { compactTables: false },
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);
const uid = () => crypto.randomUUID();
const now = () => new Date().toISOString();

export function WorkspaceDemoProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<WorkspaceState>(emptyState);

  const commit = useCallback((title: string, detail: string, change: (current: WorkspaceState) => WorkspaceState) => {
    const at = now();
    setState((current) => {
      const event = { id: uid(), title, detail, createdAt: at };
      return { ...change(current), activity: [event, ...current.activity], notifications: [{ ...event, read: false }, ...current.notifications] };
    });
  }, []);

  const addLead = useCallback((input: Omit<DemoLead, "id" | "createdAt" | "status">) => { const item = { ...input, id: uid(), createdAt: now(), status: "New" as const }; commit("Lead added", item.name, (s) => ({ ...s, leads: [item, ...s.leads] })); return item; }, [commit]);
  const updateLead = useCallback((id: string, patch: Partial<DemoLead>) => commit("Lead updated", id, (s) => ({ ...s, leads: s.leads.map((x) => x.id === id ? { ...x, ...patch } : x) })), [commit]);
  const addClient = useCallback((input: Omit<DemoClient, "id" | "createdAt" | "status">) => { const item = { ...input, id: uid(), createdAt: now(), status: "Onboarding" as const }; commit("Client added", item.name, (s) => ({ ...s, clients: [item, ...s.clients] })); return item; }, [commit]);
  const updateClient = useCallback((id: string, patch: Partial<DemoClient>) => commit("Client updated", id, (s) => ({ ...s, clients: s.clients.map((x) => x.id === id ? { ...x, ...patch } : x) })), [commit]);
  const addProject = useCallback((input: Omit<DemoProject, "id" | "createdAt" | "status" | "progress" | "portfolio">) => { const item = { ...input, id: uid(), createdAt: now(), status: "Planning" as const, progress: 0, portfolio: false }; commit("Project created", item.title, (s) => ({ ...s, projects: [item, ...s.projects] })); return item; }, [commit]);
  const updateProject = useCallback((id: string, patch: Partial<DemoProject>) => commit("Project updated", id, (s) => ({ ...s, projects: s.projects.map((x) => x.id === id ? { ...x, ...patch } : x) })), [commit]);
  const addTask = useCallback((input: Omit<DemoTask, "id" | "createdAt" | "status">) => { const item = { ...input, id: uid(), createdAt: now(), status: "Open" as const }; commit("Task created", item.title, (s) => ({ ...s, tasks: [item, ...s.tasks] })); return item; }, [commit]);
  const updateTask = useCallback((id: string, patch: Partial<DemoTask>) => commit("Task updated", id, (s) => ({ ...s, tasks: s.tasks.map((x) => x.id === id ? { ...x, ...patch } : x) })), [commit]);
  const addTicket = useCallback((input: Omit<DemoTicket, "id" | "createdAt" | "status">) => { const item = { ...input, id: uid(), createdAt: now(), status: "Open" as const }; commit("Support request created", item.subject, (s) => ({ ...s, tickets: [item, ...s.tickets] })); return item; }, [commit]);
  const updateTicket = useCallback((id: string, patch: Partial<DemoTicket>) => commit("Support request updated", id, (s) => ({ ...s, tickets: s.tickets.map((x) => x.id === id ? { ...x, ...patch } : x) })), [commit]);
  const addPage = useCallback((input: Omit<DemoPage, "id" | "updatedAt" | "status">) => { const item = { ...input, id: uid(), updatedAt: now(), status: "Draft" as const }; commit("CMS draft created", item.title, (s) => ({ ...s, pages: [item, ...s.pages] })); return item; }, [commit]);
  const updatePage = useCallback((id: string, patch: Partial<DemoPage>) => commit("CMS draft updated", id, (s) => ({ ...s, pages: s.pages.map((x) => x.id === id ? { ...x, ...patch, updatedAt: now() } : x) })), [commit]);
  const addPost = useCallback((input: Omit<DemoPost, "id" | "updatedAt" | "status">) => { const item = { ...input, id: uid(), updatedAt: now(), status: "Draft" as const }; commit("Blog draft created", item.title, (s) => ({ ...s, posts: [item, ...s.posts] })); return item; }, [commit]);
  const updatePost = useCallback((id: string, patch: Partial<DemoPost>) => commit("Blog draft updated", id, (s) => ({ ...s, posts: s.posts.map((x) => x.id === id ? { ...x, ...patch, updatedAt: now() } : x) })), [commit]);
  const addFile = useCallback((projectId: string, file: File) => { const item = { id: uid(), projectId, name: file.name, size: file.size, mimeType: file.type || "application/octet-stream", url: URL.createObjectURL(file), createdAt: now() }; commit("Local file preview added", item.name, (s) => ({ ...s, files: [item, ...s.files] })); return item; }, [commit]);
  const removeFile = useCallback((id: string) => { setState((current) => { const file = current.files.find((x) => x.id === id); if (file) URL.revokeObjectURL(file.url); const event = { id: uid(), title: "Local file preview removed", detail: file?.name ?? id, createdAt: now() }; return { ...current, files: current.files.filter((x) => x.id !== id), activity: [event, ...current.activity], notifications: [{ ...event, read: false }, ...current.notifications] }; }); }, []);
  const addInvoice = useCallback((input: Omit<DemoInvoice, "id" | "createdAt" | "status">) => { const item = { ...input, id: uid(), createdAt: now(), status: "Draft" as const }; commit("Invoice draft created", item.label, (s) => ({ ...s, invoices: [item, ...s.invoices] })); return item; }, [commit]);
  const updateInvoice = useCallback((id: string, patch: Partial<DemoInvoice>) => commit("Invoice draft updated", id, (s) => ({ ...s, invoices: s.invoices.map((x) => x.id === id ? { ...x, ...patch } : x) })), [commit]);
  const markNotificationRead = useCallback((id: string) => setState((s) => ({ ...s, notifications: s.notifications.map((x) => x.id === id ? { ...x, read: true } : x) })), []);
  const updatePreferences = useCallback((patch: Partial<WorkspaceState["preferences"]>) => setState((s) => ({ ...s, preferences: { ...s.preferences, ...patch } })), []);
  const clearDemoData = useCallback(() => setState((s) => { s.files.forEach((file) => URL.revokeObjectURL(file.url)); return { ...emptyState, preferences: s.preferences }; }), []);

  const value = useMemo(() => ({ ...state, addLead, updateLead, addClient, updateClient, addProject, updateProject, addTask, updateTask, addTicket, updateTicket, addPage, updatePage, addPost, updatePost, addFile, removeFile, addInvoice, updateInvoice, markNotificationRead, updatePreferences, clearDemoData }), [state, addLead, updateLead, addClient, updateClient, addProject, updateProject, addTask, updateTask, addTicket, updateTicket, addPage, updatePage, addPost, updatePost, addFile, removeFile, addInvoice, updateInvoice, markNotificationRead, updatePreferences, clearDemoData]);
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspaceDemo() {
  const value = useContext(WorkspaceContext);
  if (!value) throw new Error("WorkspaceDemoProvider is missing.");
  return value;
}

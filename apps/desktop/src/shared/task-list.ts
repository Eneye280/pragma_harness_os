export type MessageTaskStatus = "pending" | "in-progress" | "done" | "blocked";

export interface MessageTask {
  id: string;
  label: string;
  status: MessageTaskStatus;
}

export interface TaskListProgress {
  total: number;
  done: number;
  pending: number;
  inProgress: number;
  blocked: number;
}

const TASK_SECTION = /(tarea|task|paso|step|plan|checklist|todo)/i;
const CHECKBOX = /^\s*(?:[-*+]|\d+[.)])\s+\[([ xX])\]\s+(.*)$/;
const NUMBERED = /^\s*(\d+)[.)]\s+(.*)$/;
const BULLET = /^\s*[-*+]\s+(.*)$/;

function statusFromLabel(label: string, checked: boolean): MessageTaskStatus {
  if (checked) return "done";
  if (/^\s*(blocked|bloqueado|bloqueada)\b/i.test(label)) return "blocked";
  if (/^\s*\((?:in[- ]?progress|en curso)\)/i.test(label) || /\((?:in[- ]?progress|en curso)\)\s*$/i.test(label)) return "in-progress";
  return "pending";
}

export function parseTasks(markdown: string): MessageTask[] {
  const tasks: MessageTask[] = [];
  let inTaskSection = false;
  for (const rawLine of markdown.split(/\r?\n/)) {
    const heading = /^\s*#{1,6}\s+(.*)$/.exec(rawLine);
    if (heading) {
      inTaskSection = TASK_SECTION.test(heading[1]);
      continue;
    }
    const checkbox = CHECKBOX.exec(rawLine);
    if (checkbox) {
      const label = checkbox[2].replace(/\s+#\d+$/, "").trim();
      if (label) tasks.push({ id: `t${tasks.length + 1}`, label, status: statusFromLabel(label, checkbox[1].toLowerCase() === "x") });
      continue;
    }
    if (!inTaskSection) continue;
    const numbered = NUMBERED.exec(rawLine);
    const bullet = numbered ? null : BULLET.exec(rawLine);
    const label = (numbered?.[2] ?? bullet?.[1] ?? "").replace(/\s+#\d+$/, "").trim();
    if (label) tasks.push({ id: `t${tasks.length + 1}`, label, status: statusFromLabel(label, false) });
  }
  return tasks;
}

export function taskProgress(tasks: MessageTask[]): TaskListProgress {
  return {
    total: tasks.length,
    done: tasks.filter((task) => task.status === "done").length,
    pending: tasks.filter((task) => task.status === "pending").length,
    inProgress: tasks.filter((task) => task.status === "in-progress").length,
    blocked: tasks.filter((task) => task.status === "blocked").length,
  };
}

export function setTaskStatus(tasks: MessageTask[], id: string, status: MessageTaskStatus): MessageTask[] {
  return tasks.map((task) => (task.id === id ? { ...task, status } : task));
}

export function syncTaskStatuses(previous: MessageTask[], derived: MessageTask[]): MessageTask[] {
  return previous.map((task) => {
    const match = [...derived].reverse().find((candidate) => candidate.label === task.label);
    return match ? { ...task, status: match.status } : task;
  });
}

export function markRunState(tasks: MessageTask[], runState: "running" | "done" | "error"): MessageTask[] {
  if (runState === "running") {
    if (tasks.some((task) => task.status === "in-progress")) return tasks;
    const firstPending = tasks.find((task) => task.status === "pending");
    return firstPending ? setTaskStatus(tasks, firstPending.id, "in-progress") : tasks;
  }
  if (runState === "done") {
    return tasks.map((task) => (task.status === "pending" || task.status === "in-progress" ? { ...task, status: "done" } : task));
  }
  return tasks.map((task) => (task.status === "in-progress" ? { ...task, status: "blocked" } : task));
}

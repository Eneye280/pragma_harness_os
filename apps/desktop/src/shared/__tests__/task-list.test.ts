import { describe, expect, it } from "vitest";
import { markRunState, parseTasks, setTaskStatus, syncTaskStatuses, taskProgress } from "../task-list";

const PLAN = [
  "# Plan",
  "## Pasos",
  "1. Crear el controlador",
  "2. Añadir tests",
  "- [ ] Documentar",
  "- [x] Diseñar",
].join("\n");

describe("task-list", () => {
  it("parses numbered and checkbox tasks under a task section", () => {
    const tasks = parseTasks(PLAN);
    expect(tasks.map((task) => task.status)).toEqual(["pending", "pending", "pending", "done"]);
    expect(tasks[0].label).toBe("Crear el controlador");
    expect(tasks[3].label).toBe("Diseñar");
  });

  it("ignores prose bullets outside a task section", () => {
    expect(parseTasks("# Notas\n- algo\n- otra cosa")).toEqual([]);
  });

  it("detects blocked and in-progress labels", () => {
    const tasks = parseTasks("## Tareas\n- Blocked: esperar API\n- (in-progress) refactor");
    expect(tasks[0].status).toBe("blocked");
    expect(tasks[1].status).toBe("in-progress");
  });

  it("computes progress and updates status", () => {
    const tasks = parseTasks(PLAN);
    expect(taskProgress(tasks)).toEqual({ total: 4, done: 1, pending: 3, inProgress: 0, blocked: 0 });
    const updated = setTaskStatus(tasks, "t1", "done");
    expect(taskProgress(updated).done).toBe(2);
  });

  it("syncs statuses from a re-derived list by label", () => {
    const previous = parseTasks(PLAN);
    const derived = parseTasks("## Pasos\n1. Crear el controlador\n2. Añadir tests\n- [x] Documentar");
    const synced = syncTaskStatuses(previous, derived);
    expect(synced.find((task) => task.label === "Documentar")?.status).toBe("done");
  });

  it("advances task states across the run lifecycle", () => {
    const tasks = parseTasks(PLAN);
    const running = markRunState(tasks, "running");
    expect(running[0].status).toBe("in-progress");
    const failed = markRunState(running, "error");
    expect(failed[0].status).toBe("blocked");
    const done = markRunState(tasks, "done");
    expect(done.every((task) => task.status === "done")).toBe(true);
  });
});

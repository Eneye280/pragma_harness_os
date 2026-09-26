import { describe, expect, it } from "vitest";
import { buildTimeline, PHASE_TITLE, PIPELINE_PHASES, timelineProgress } from "../pipeline";

describe("pipeline timeline model", () => {
  it("renders every phase with a title and hint", () => {
    const nodes = buildTimeline([]);
    expect(nodes).toHaveLength(PIPELINE_PHASES.length);
    for (const node of nodes) {
      expect(node.title.length).toBeGreaterThan(0);
      expect(node.hint.length).toBeGreaterThan(0);
      expect(node.status).toBe("pending");
    }
  });

  it("maps reported steps to their real status and detail", () => {
    const nodes = buildTimeline([
      { phase: "classify", status: "done", label: "backend-api" },
      { phase: "skills", status: "running", label: "2 skills", detail: "backend, security" },
    ]);
    const byPhase = Object.fromEntries(nodes.map((node) => [node.phase, node]));
    expect(byPhase.classify.status).toBe("done");
    expect(byPhase.classify.detail).toBe("backend-api");
    expect(byPhase.skills.status).toBe("running");
    expect(byPhase.skills.detail).toBe("backend, security");
    expect(byPhase.agent.status).toBe("pending");
  });

  it("keeps the approved order of phases", () => {
    expect(PIPELINE_PHASES[0]).toBe("classify");
    expect(PIPELINE_PHASES[PIPELINE_PHASES.length - 1]).toBe("agent");
    expect(Object.keys(PHASE_TITLE)).toEqual(expect.arrayContaining([...PIPELINE_PHASES]));
  });

  it("computes progress from completed phases", () => {
    const nodes = buildTimeline([
      { phase: "classify", status: "done", label: "x" },
      { phase: "rules", status: "done", label: "x" },
    ]);
    expect(timelineProgress(nodes)).toBe(Math.round((2 / PIPELINE_PHASES.length) * 100));
  });
});

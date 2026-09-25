import { describe, it, expect, vi } from "vitest";
import { consolidate, detectPatterns, type DreamEvent } from "../dreaming";
import { extractCorrectionTrigger } from "../../../shared/dream";

function correctionEvent(sessionId: string, content: string, trigger: string): DreamEvent {
  return { type: "harness:memory-write", payload: { kind: "correction", trigger, content, domain: "general" }, sessionId, ts: 1 };
}

function failedObservation(sessionId: string, tool: string): DreamEvent {
  return { type: "agent:observation", payload: { ok: false, tool, output: `${tool} failed` }, sessionId, ts: 1 };
}

function toolCall(sessionId: string, tool: string): DreamEvent {
  return { type: "agent:tool-call", payload: { tool, args: {} }, sessionId, ts: 1 };
}

describe("dreaming pattern detection", () => {
  it("detects a repeated correction as an instinct candidate", () => {
    const candidates = detectPatterns([
      correctionEvent("s1", "no, usa funciones", "usa-funciones"),
      correctionEvent("s2", "no, usa funciones", "usa-funciones"),
    ]);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({ kind: "correction", trigger: "correction:usa-funciones", count: 2 });
  });

  it("ignores a single correction (below threshold)", () => {
    expect(detectPatterns([correctionEvent("s1", "no, usa clases", "usa-clases")])).toEqual([]);
  });

  it("detects repeated tool failures", () => {
    const candidates = detectPatterns([failedObservation("s1", "terminal"), failedObservation("s2", "terminal")]);
    expect(candidates[0]).toMatchObject({ kind: "error", trigger: "error:terminal", count: 2 });
  });

  it("detects a repeated workflow as a skill candidate", () => {
    const candidates = detectPatterns([
      toolCall("s1", "fileRead"),
      toolCall("s1", "fileEdit"),
      toolCall("s2", "fileRead"),
      toolCall("s2", "fileEdit"),
    ]);
    expect(candidates.find((candidate) => candidate.kind === "workflow")?.trigger).toBe("workflow:fileRead>fileEdit");
  });

  it("does not mix different correction triggers", () => {
    const candidates = detectPatterns([
      correctionEvent("s1", "no, usa funciones", "usa-funciones"),
      correctionEvent("s2", "no, usa clases", "usa-clases"),
    ]);
    expect(candidates).toEqual([]);
  });
});

describe("dreaming consolidation", () => {
  it("writes an instinct per candidate with an initial confidence", async () => {
    const addInstinct = vi.fn().mockReturnValue({ trigger: "correction:usa-funciones", content: "usa funciones", confidence: 0.5 });
    const results = await consolidate(
      [correctionEvent("s1", "no, usa funciones", "usa-funciones"), correctionEvent("s2", "no, usa funciones", "usa-funciones")],
      "/tmp/ws",
      { addInstinct }
    );
    expect(addInstinct).toHaveBeenCalledTimes(1);
    expect(results[0]).toMatchObject({ kind: "correction", confidence: 0.5 });
  });

  it("uses the analyzer to refine the instinct content when available", async () => {
    const addInstinct = vi.fn().mockReturnValue({ trigger: "error:terminal", content: "resumen", confidence: 0.5 });
    await consolidate([failedObservation("s1", "terminal"), failedObservation("s2", "terminal")], "/tmp/ws", {
      addInstinct,
      analyze: async () => "prefer functional style",
    });
    expect(addInstinct).toHaveBeenCalledWith("/tmp/ws", expect.objectContaining({ content: "prefer functional style" }));
  });

  it("falls back to the deterministic content when the analyzer fails", async () => {
    const addInstinct = vi.fn().mockReturnValue({ trigger: "error:terminal", content: "fallback", confidence: 0.5 });
    await consolidate([failedObservation("s1", "terminal"), failedObservation("s2", "terminal")], "/tmp/ws", {
      addInstinct,
      analyze: async () => {
        throw new Error("llm down");
      },
    });
    expect(addInstinct).toHaveBeenCalledWith("/tmp/ws", expect.objectContaining({ content: "El tool terminal falló 2 veces: verificar antes de reintentar" }));
  });

  it("extracts a stable trigger from a correction message", () => {
    expect(extractCorrectionTrigger("No, corrige el estilo y usa funciones")).toBe("corrige-estilo-funciones");
    expect(extractCorrectionTrigger("no")).toBe("correccion-general");
  });
});

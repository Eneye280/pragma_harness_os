import { describe, expect, it } from "vitest";
import { ModelFallbackGateway } from "../fallback";
import type { StreamChunk } from "../gateway";

async function collect(gen: AsyncGenerator<StreamChunk>): Promise<string> {
  let text = "";
  for await (const chunk of gen) if (!chunk.isDone) text += chunk.textDelta;
  return text;
}

describe("model fallback gateway", () => {
  it("falls back to the secondary provider when the primary fails", async () => {
    const attempts: string[] = [];
    const gateway = new ModelFallbackGateway({
      models: ["primary", "secondary"],
      create: (model) => ({
        async *stream(): AsyncGenerator<StreamChunk> {
          attempts.push(model);
          if (model === "primary") throw new Error("provider caído");
          yield { textDelta: "respuesta-secundaria", isDone: false };
          yield { textDelta: "", isDone: true };
        },
      }),
    });
    const text = await collect(gateway.stream("hola"));
    expect(text).toBe("respuesta-secundaria");
    expect(attempts).toEqual(["primary", "secondary"]);
  });

  it("reports each fallback attempt", async () => {
    const seen: string[] = [];
    const gateway = new ModelFallbackGateway({
      models: ["a", "b"],
      create: () => ({
        async *stream(): AsyncGenerator<StreamChunk> {
          throw new Error("boom");
          yield { textDelta: "", isDone: true };
        },
      }),
      onFallback: (attempt) => seen.push(`${attempt.attempt}:${attempt.model}`),
    });
    await expect(collect(gateway.stream("x"))).rejects.toThrow("boom");
    expect(seen).toEqual(["1:a", "2:b"]);
  });

  it("uses the primary directly when it succeeds", async () => {
    const attempts: string[] = [];
    const gateway = new ModelFallbackGateway({
      models: ["primary", "secondary"],
      create: (model) => ({
        async *stream(): AsyncGenerator<StreamChunk> {
          attempts.push(model);
          yield { textDelta: "ok", isDone: false };
          yield { textDelta: "", isDone: true };
        },
      }),
    });
    expect(await collect(gateway.stream("x"))).toBe("ok");
    expect(attempts).toEqual(["primary"]);
  });
});

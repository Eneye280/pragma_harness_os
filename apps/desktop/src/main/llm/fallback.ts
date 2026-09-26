import type { StreamChunk } from "./gateway";

export interface FallbackGatewayLike {
  stream(prompt: string): AsyncGenerator<StreamChunk>;
}

export interface FallbackAttempt {
  model: string;
  attempt: number;
  error: string;
}

export interface FallbackOptions {
  models: string[];
  create: (model: string) => FallbackGatewayLike;
  onFallback?: (attempt: FallbackAttempt) => void;
}

export class ModelFallbackGateway implements FallbackGatewayLike {
  constructor(private readonly options: FallbackOptions) {}

  async *stream(prompt: string): AsyncGenerator<StreamChunk> {
    const models = this.options.models.length > 0 ? this.options.models : [""];
    let lastError: unknown = null;
    for (let index = 0; index < models.length; index++) {
      const model = models[index];
      try {
        const gateway = this.options.create(model);
        for await (const chunk of gateway.stream(prompt)) yield chunk;
        return;
      } catch (error) {
        lastError = error;
        const message = error instanceof Error ? error.message : String(error);
        this.options.onFallback?.({ model, attempt: index + 1, error: message });
        if (index === models.length - 1) break;
      }
    }
    throw lastError instanceof Error ? lastError : new Error("all providers in the routing chain failed");
  }
}

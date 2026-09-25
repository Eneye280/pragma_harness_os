import { streamText, type LanguageModel } from "ai";
import { createProvider, type ProviderConfig, getModelId } from "./provider";
import { randomUUID } from "crypto";

export interface GatewayMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface GatewayCall {
  id: string;
  model: string;
  promptHash: string;
  messages: GatewayMessage[];
  ts: number;
}

export interface StreamChunk {
  textDelta: string;
  isDone: boolean;
}

function hashPrompt(text: string): string {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0;
  return h.toString(16).slice(0, 8);
}

export class AgentGateway {
  private providerConfig: ProviderConfig;
  private mockResponder?: (prompt: string) => AsyncGenerator<string>;

  constructor(config: ProviderConfig, mockResponder?: (prompt: string) => AsyncGenerator<string>) {
    this.providerConfig = config;
    this.mockResponder = mockResponder;
  }

  setConfig(config: ProviderConfig): void {
    this.providerConfig = config;
  }

  getModelId(): string {
    return getModelId(this.providerConfig);
  }

  buildMessages(finalPrompt: string): GatewayMessage[] {
    return [{ role: "user", content: finalPrompt }];
  }

  createCallRecord(finalPrompt: string): GatewayCall {
    return {
      id: randomUUID(),
      model: this.getModelId(),
      promptHash: hashPrompt(finalPrompt),
      messages: this.buildMessages(finalPrompt),
      ts: Date.now(),
    };
  }

  async *stream(finalPrompt: string): AsyncGenerator<StreamChunk> {
    if (this.providerConfig.provider === "mock" && this.mockResponder) {
      for await (const delta of this.mockResponder(finalPrompt)) {
        yield { textDelta: delta, isDone: false };
      }
      yield { textDelta: "", isDone: true };
      return;
    }

    const provider = createProvider(this.providerConfig);
    if (!provider) throw new Error("Provider not configured");

    const model = provider(getModelId(this.providerConfig)) as unknown as LanguageModel;
    const result = streamText({ model, prompt: finalPrompt });

    for await (const delta of result.textStream) {
      yield { textDelta: delta, isDone: false };
    }
    yield { textDelta: "", isDone: true };
  }

  async collect(finalPrompt: string): Promise<string> {
    let full = "";
    for await (const chunk of this.stream(finalPrompt)) {
      if (!chunk.isDone) full += chunk.textDelta;
    }
    return full;
  }
}

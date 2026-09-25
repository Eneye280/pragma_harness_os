import { z } from "zod";

const ProviderNameSchema = z.enum(["mock", "deepseek", "anthropic", "openai", "ollama"]);

export const ProjectProfileSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  provider: z
    .object({
      provider: ProviderNameSchema.optional(),
      baseURL: z.string().optional(),
      models: z.object({ classifier: z.string().optional(), executor: z.string().optional() }).optional(),
    })
    .optional(),
  budget: z.object({ tokensPerDay: z.number().int().nonnegative().optional(), usdPerDay: z.number().nonnegative().optional() }).optional(),
  gates: z
    .object({
      pre: z
        .object({ enabled: z.boolean().optional(), secret: z.boolean().optional(), budget: z.boolean().optional(), schema: z.boolean().optional() })
        .optional(),
      post: z
        .object({
          enabled: z.boolean().optional(),
          build: z.boolean().optional(),
          typecheck: z.boolean().optional(),
          lint: z.boolean().optional(),
          tests: z.boolean().optional(),
          security: z.boolean().optional(),
          visual: z.boolean().optional(),
        })
        .optional(),
    })
    .optional(),
  plugins: z.record(z.boolean()).optional(),
  skills: z.record(z.boolean()).optional(),
  sandbox: z.object({ enabled: z.boolean().optional(), image: z.string().optional() }).optional(),
});

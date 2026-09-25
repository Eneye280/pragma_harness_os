import type { ProjectProfile } from "../../shared/profile";
import type { HarnessSettings } from "../../shared/settings";

export function resolveEffectiveSettings(global: HarnessSettings, profile: ProjectProfile | null): HarnessSettings {
  if (!profile) return global;
  return {
    provider: {
      provider: profile.provider?.provider ?? global.provider.provider,
      apiKey: global.provider.apiKey,
      baseURL: profile.provider?.baseURL ?? global.provider.baseURL,
      models: {
        classifier: profile.provider?.models?.classifier ?? global.provider.models.classifier,
        executor: profile.provider?.models?.executor ?? global.provider.models.executor,
      },
    },
    budget: {
      tokensPerDay: profile.budget?.tokensPerDay ?? global.budget.tokensPerDay,
      usdPerDay: profile.budget?.usdPerDay ?? global.budget.usdPerDay,
    },
    gates: {
      pre: { ...global.gates.pre, ...profile.gates?.pre },
      post: { ...global.gates.post, ...profile.gates?.post },
    },
    plugins: { ...global.plugins, ...profile.plugins },
    sandbox: { ...global.sandbox, ...profile.sandbox },
    workspace: global.workspace,
  };
}

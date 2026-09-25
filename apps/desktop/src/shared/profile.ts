import type { BudgetSettings, PostGateFlags, PreGateFlags, ProviderName, SandboxFlags } from "./settings";

export interface ProjectProfile {
  name?: string;
  provider?: {
    provider?: ProviderName;
    baseURL?: string;
    models?: { classifier?: string; executor?: string };
  };
  budget?: Partial<BudgetSettings>;
  gates?: { pre?: Partial<PreGateFlags>; post?: Partial<PostGateFlags> };
  plugins?: Record<string, boolean>;
  sandbox?: Partial<SandboxFlags>;
}

export interface ProjectProfileInfo {
  active: boolean;
  path: string;
  name: string | null;
}

export const PROFILE_DIRECTORY = ".pragma-harness";
export const PROFILE_FILENAME = "profile.json";

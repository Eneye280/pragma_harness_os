import type { BudgetSettings, PostGateFlags, PreGateFlags, ProviderName, SandboxFlags, ToolPermissionSettings } from "./settings";

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
  skills?: Record<string, boolean>;
  agent?: string;
  sandbox?: Partial<SandboxFlags>;
  rag?: { excludes?: string[] };
  tools?: Partial<ToolPermissionSettings>;
}

export interface ProjectProfileInfo {
  active: boolean;
  path: string;
  name: string | null;
}

export const PROFILE_DIRECTORY = ".pragma-harness";
export const PROFILE_FILENAME = "profile.json";

import type { PostGateFlags, PreGateFlags } from "./settings";

export interface StackBundle {
  stack: string;
  label: string;
  description: string;
  skills: string[];
  agent: string;
  extraAgents?: string[];
  gates?: { pre?: Partial<PreGateFlags>; post?: Partial<PostGateFlags> };
  plugins?: Record<string, boolean>;
}

export interface BundleValidation {
  stack: string;
  ok: boolean;
  missingSkills: string[];
  missingAgents: string[];
}

export interface BundleSummary extends StackBundle {
  validation: BundleValidation;
}

export interface StackDetection {
  blank: boolean;
  entries: number;
  suggestions: string[];
  markers: string[];
}

import type { ProjectProfile } from "../../shared/profile";
import type { BundleValidation, StackBundle } from "../../shared/bundles";

export const STACK_BUNDLES: StackBundle[] = [
  {
    stack: "unity",
    label: "Unity 6",
    description: "Juego/experiencia en Unity: gameplay, UI y netcode.",
    skills: ["tdd-workflow"],
    agent: "unity-gameplay",
    extraAgents: ["unity-ui", "unity-netcode"],
    gates: { post: { visual: true, tests: true } },
  },
  {
    stack: "engine-vulkan",
    label: "Engine · Vulkan",
    description: "Engine nativo con render Vulkan y ECS.",
    skills: ["tdd-workflow"],
    agent: "engine-vulkan",
    extraAgents: ["engine-ecs"],
    gates: { post: { build: true, visual: true } },
  },
  {
    stack: "unreal",
    label: "Unreal Engine",
    description: "Proyecto Unreal: gameplay y sistemas.",
    skills: ["tdd-workflow"],
    agent: "unreal-gameplay",
    gates: { post: { visual: true } },
  },
  {
    stack: "web",
    label: "Web / Frontend",
    description: "Aplicación web o de escritorio con UI.",
    skills: ["tdd-workflow", "security-review"],
    agent: "web-frontend",
    gates: { post: { visual: true, tests: true }, pre: { secret: true } },
  },
  {
    stack: "backend",
    label: "Backend / API",
    description: "Servicio backend con API y datos.",
    skills: ["api-design", "security-review", "tdd-workflow"],
    agent: "backend-api",
    gates: { pre: { secret: true, schema: true }, post: { build: true, tests: true, security: true } },
  },
];

export function listBundles(): StackBundle[] {
  return [...STACK_BUNDLES];
}

export function resolveBundle(stack: string): StackBundle | null {
  const normalized = stack.trim().toLowerCase();
  return STACK_BUNDLES.find((bundle) => bundle.stack === normalized) ?? null;
}

export function validateBundle(bundle: StackBundle, knownSkills: string[], knownAgents: string[]): BundleValidation {
  const skillSet = new Set(knownSkills);
  const agentSet = new Set(knownAgents);
  const wantedAgents = [bundle.agent, ...(bundle.extraAgents ?? [])];
  const missingSkills = bundle.skills.filter((skill) => !skillSet.has(skill));
  const missingAgents = wantedAgents.filter((agent) => !agentSet.has(agent));
  return {
    stack: bundle.stack,
    ok: missingSkills.length === 0 && missingAgents.length === 0,
    missingSkills,
    missingAgents,
  };
}

export function bundleToProfile(bundle: StackBundle, current: ProjectProfile | null): ProjectProfile {
  const base = current ?? {};
  return {
    ...base,
    name: base.name ?? `stack:${bundle.stack}`,
    agent: bundle.agent,
    skills: {
      ...(base.skills ?? {}),
      ...Object.fromEntries(bundle.skills.map((skill) => [skill, true])),
    },
    gates: {
      pre: { ...base.gates?.pre, ...bundle.gates?.pre },
      post: { ...base.gates?.post, ...bundle.gates?.post },
    },
    plugins: { ...(base.plugins ?? {}), ...(bundle.plugins ?? {}) },
  };
}

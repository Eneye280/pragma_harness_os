import { existsSync, readFileSync, readdirSync } from "fs";
import { join } from "path";
import type { AgentDefinition, AgentSelection, AgentSummary } from "../../shared/agents";
import { PROFILE_DIRECTORY } from "../../shared/profile";
import { SEED_AGENTS } from "./seeds";

const FALLBACK_AGENT_ID = "general-builder";

function isAgentDefinition(value: unknown): value is AgentDefinition {
  if (!value || typeof value !== "object") return false;
  const raw = value as Partial<AgentDefinition>;
  return (
    typeof raw.id === "string" &&
    typeof raw.name === "string" &&
    typeof raw.prompt === "string" &&
    Array.isArray(raw.domains) &&
    Array.isArray(raw.skills)
  );
}

export class AgentCatalog {
  private cache: AgentDefinition[] | null = null;
  private rootsProvider: (() => string[]) | null = null;

  constructor(private readonly seedAgents: AgentDefinition[] = SEED_AGENTS) {}

  useRoots(provider: () => string[]): void {
    this.rootsProvider = provider;
    this.reload();
  }

  reload(): void {
    this.cache = null;
  }

  private scan(): AgentDefinition[] {
    if (this.cache) return this.cache;
    const byId = new Map<string, AgentDefinition>();
    for (const agent of [...this.seedAgents, ...this.scanUserAgents()]) {
      if (!byId.has(agent.id)) byId.set(agent.id, agent);
    }
    this.cache = [...byId.values()];
    return this.cache;
  }

  private scanUserAgents(): AgentDefinition[] {
    const roots = this.rootsProvider?.() ?? [];
    const found: AgentDefinition[] = [];
    for (const root of roots) {
      if (!root) continue;
      const directory = join(root, PROFILE_DIRECTORY, "agents");
      if (!existsSync(directory)) continue;
      for (const entry of readdirSync(directory)) {
        if (!entry.endsWith(".json")) continue;
        try {
          const parsed: unknown = JSON.parse(readFileSync(join(directory, entry), "utf8"));
          if (isAgentDefinition(parsed)) found.push(parsed);
        } catch {
          continue;
        }
      }
    }
    return found;
  }

  list(activeId: string | null = null): AgentSummary[] {
    return this.scan().map((agent) => ({
      id: agent.id,
      name: agent.name,
      role: agent.role,
      domains: [...agent.domains],
      skills: [...agent.skills],
      model: agent.model ?? null,
      active: agent.id === activeId,
    }));
  }

  get(id: string): AgentDefinition | null {
    return this.scan().find((agent) => agent.id === id) ?? null;
  }

  selectFor(domain: string, preferredId: string | null = null): AgentSelection {
    const agents = this.scan();
    const preferred = preferredId ? agents.find((agent) => agent.id === preferredId) ?? null : null;
    if (preferred) return { agent: preferred, matched: preferred.domains.includes(domain) };
    const exact = agents.find((agent) => agent.domains.includes(domain));
    if (exact) return { agent: exact, matched: true };
    return { agent: agents.find((agent) => agent.id === FALLBACK_AGENT_ID) ?? agents[agents.length - 1], matched: false };
  }
}

import type { AgentDefinition, AgentSelection, AgentSummary } from "../../shared/agents";
import { SEED_AGENTS } from "./seeds";

const FALLBACK_AGENT_ID = "general-builder";

export class AgentCatalog {
  constructor(private readonly agents: AgentDefinition[] = SEED_AGENTS) {}

  list(activeId: string | null = null): AgentSummary[] {
    return this.agents.map((agent) => ({
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
    return this.agents.find((agent) => agent.id === id) ?? null;
  }

  selectFor(domain: string, preferredId: string | null = null): AgentSelection {
    const preferred = preferredId ? this.get(preferredId) : null;
    if (preferred) return { agent: preferred, matched: preferred.domains.includes(domain) };
    const exact = this.agents.find((agent) => agent.domains.includes(domain));
    if (exact) return { agent: exact, matched: true };
    return { agent: this.get(FALLBACK_AGENT_ID) ?? this.agents[this.agents.length - 1], matched: false };
  }
}

export interface AgentDefinition {
  id: string;
  name: string;
  role: string;
  domains: string[];
  skills: string[];
  model?: string;
  prompt: string;
}

export interface AgentSummary {
  id: string;
  name: string;
  role: string;
  domains: string[];
  skills: string[];
  model: string | null;
  active: boolean;
}

export interface AgentSelection {
  agent: AgentDefinition;
  matched: boolean;
}

import { readFileSync, existsSync } from "fs";
import { join } from "path";
import fg from "fast-glob";
import { RuleEngine } from "./rule-engine";
import { SkillCompiler } from "./skills/skill-compiler";

export interface AssembleInput {
  message: string;
  intent: { domain: string; type: string; effort: string; needs: string[]; confidence: number };
  sessionId: string;
  workspacePath: string;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
  ragHits?: Array<{ content: string; score: number }>;
  instincts?: Array<{ trigger: string; content: string }>;
}

export interface AssembledContext {
  finalPrompt: string;
  breakdown: {
    rules: { tokens: number; chars: number };
    skills: { tokens: number; chars: number; sources: string[] };
    rag: { tokens: number; hits: number };
    files: { tokens: number; files: number; paths: string[] };
    instincts: { tokens: number; count: number };
    history: { tokens: number; messages: number };
    userMessage: { tokens: number };
    totalTokens: number;
  };
}

function tokenCount(text: string): number {
  return Math.ceil(text.length / 4);
}

const DOMAIN_GLOBS: Record<string, string[]> = {
  backend: ["src/modules/auth/**/*", "src/modules/**/route.ts", "src/core/middleware/**/*"],
  engine: ["src/PragmaEngine.*/**/*", "src/**/*.cs", "shaders/**/*"],
  unity: ["Assets/Scripts/**/*", "Assets/Prefabs/**/*", "Packages/**/Runtime/**/*"],
  general: ["README.md", "AGENTS.md"],
};

export class ContextAssembler {
  constructor(
    private readonly ruleEngine = new RuleEngine(),
    private readonly skillCompiler = new SkillCompiler()
  ) {}

  async prefetchFiles(intent: AssembleInput["intent"], workspacePath: string, maxFiles = 4, maxCharsPerFile = 3000): Promise<{ content: string; paths: string[]; tokens: number }> {
    const patterns = DOMAIN_GLOBS[intent.domain] ?? DOMAIN_GLOBS["general"];
    const paths: string[] = [];
    for (const pat of patterns) {
      const found = await fg(pat, { cwd: workspacePath, absolute: false, onlyFiles: true, deep: 2 }).catch(() => []);
      for (const f of found) {
        if (paths.length >= maxFiles) break;
        paths.push(f);
      }
      if (paths.length >= maxFiles) break;
    }

    let content = "";
    const included: string[] = [];
    for (const rel of paths) {
      const abs = join(workspacePath, rel);
      if (!existsSync(abs)) continue;
      try {
        const raw = readFileSync(abs, "utf-8").slice(0, maxCharsPerFile);
        content += `\n\n# File: ${rel}\n${raw}`;
        included.push(rel);
      } catch {}
    }

    return { content, paths: included, tokens: tokenCount(content) };
  }

  async assemble(input: AssembleInput, budget = 8000): Promise<AssembledContext> {
    const rulesBlock = this.ruleEngine.compile({ domain: input.intent.domain }, { maxTokens: 1200, includeAgentsMd: false });
    const skillsResult = await this.skillCompiler.compile(this.skillCompiler.resolve(input.intent.needs), 2000);
    const skillsBlock = skillsResult.block;

    const ragBlock = (input.ragHits ?? []).map((h) => `- ${h.content.slice(0, 400)}`).join("\n");
    const instinctsBlock = (input.instincts ?? []).map((ins) => `- [${ins.trigger}] ${ins.content}`).join("\n");
    const historyBlock = (input.history ?? []).slice(-6).map((m) => `${m.role}: ${m.content.slice(0, 500)}`).join("\n\n");

    const filesResult = await this.prefetchFiles(input.intent, input.workspacePath);

    const sections = [
      { key: "rules", priority: 1, content: rulesBlock },
      { key: "skills", priority: 2, content: skillsBlock },
      { key: "rag", priority: 3, content: ragBlock },
      { key: "files", priority: 4, content: filesResult.content },
      { key: "instincts", priority: 5, content: instinctsBlock },
      { key: "history", priority: 6, content: historyBlock },
    ];

    let truncatedHistory = historyBlock;
    let truncatedFiles = filesResult.content;
    let truncatedRag = ragBlock;
    let truncatedInstincts = instinctsBlock;
    let truncatedSkills = skillsBlock;
    let truncatedRules = rulesBlock;

    const buildPromptText = (
      rules: string,
      skills: string,
      rag: string,
      files: string,
      instincts: string,
      history: string
    ) => `# SYSTEM — HARNESS COMPILED (do not search skills, they are already here)

${rules}

# SKILLS (compiled pre-agent, sources: ${skillsResult.sources.join(", ")})
${skills}

${rag ? `# RAG HITS\n${rag}\n` : ""}${files ? `# PREFETCHED FILES\n${files}\n` : ""}${instincts ? `# INSTINCTS\n${instincts}\n` : ""}${history ? `# HISTORY (last 6)\n${history}\n` : ""}# USER MESSAGE
${input.message}
`;

    const calcTotal = () =>
      tokenCount(buildPromptText(truncatedRules, truncatedSkills, truncatedRag, truncatedFiles, truncatedInstincts, truncatedHistory));

    let total = calcTotal();

    while (total > budget) {
      if (tokenCount(truncatedHistory) > 20) {
        truncatedHistory = truncatedHistory.slice(0, Math.ceil(truncatedHistory.length * 0.5));
      } else if (tokenCount(truncatedFiles) > 20) {
        truncatedFiles = truncatedFiles.slice(0, Math.ceil(truncatedFiles.length * 0.5));
      } else if (truncatedRag.length > 0) {
        truncatedRag = "";
      } else if (truncatedInstincts.length > 0) {
        truncatedInstincts = "";
      } else if (tokenCount(truncatedSkills) > 20) {
        truncatedSkills = truncatedSkills.slice(0, Math.ceil(truncatedSkills.length * 0.5));
      } else if (tokenCount(truncatedRules) > 20) {
        truncatedRules = truncatedRules.slice(0, Math.ceil(truncatedRules.length * 0.5));
      } else {
        break;
      }
      const newTotal = calcTotal();
      if (newTotal === total) break;
      total = newTotal;
    }

    const finalPrompt = buildPromptText(truncatedRules, truncatedSkills, truncatedRag, truncatedFiles, truncatedInstincts, truncatedHistory);

    const breakdown = {
      rules: { tokens: tokenCount(truncatedRules), chars: truncatedRules.length },
      skills: { tokens: tokenCount(truncatedSkills), chars: truncatedSkills.length, sources: skillsResult.sources },
      rag: { tokens: tokenCount(truncatedRag), hits: input.ragHits?.length ?? 0 },
      files: { tokens: tokenCount(truncatedFiles), files: filesResult.paths.length, paths: filesResult.paths },
      instincts: { tokens: tokenCount(truncatedInstincts), count: input.instincts?.length ?? 0 },
      history: { tokens: tokenCount(truncatedHistory), messages: input.history?.length ?? 0 },
      userMessage: { tokens: tokenCount(input.message) },
      totalTokens: tokenCount(finalPrompt),
    };

    return { finalPrompt, breakdown };
  }
}

export const contextAssembler = new ContextAssembler();

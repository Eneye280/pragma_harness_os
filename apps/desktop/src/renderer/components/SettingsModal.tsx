import { useEffect, useState } from "react";
import {
  KNOWN_PLUGINS,
  KNOWN_PROVIDERS,
  KNOWN_TOOLS,
  TOOL_PERMISSION_PRESETS,
  type HarnessSettings,
  type ProviderName,
} from "@shared/settings";
import type { CostSnapshot } from "@shared/cost";
import { cn } from "../lib/cn";
import { IconClose } from "./icons";
import type { UseSettingsResult } from "../settings/use-settings";
import type { UseUpdaterResult } from "../settings/use-updater";
import type { UseSkillsResult } from "../skills/use-skills";
import type { UseAgentsResult } from "../agents/use-agents";
import { useFocusTrap } from "../shell/use-focus-trap";
import { ACCENTS } from "../theme/accents";
import { SkillEditor } from "./SkillEditor";
import { PluginEditor } from "./PluginEditor";
import type { CustomPluginDef, ProjectTask } from "@shared/plugin-authoring";

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  settingsState: UseSettingsResult;
  cost: CostSnapshot | null;
  updater: UseUpdaterResult;
  skillsState: UseSkillsResult;
  agentsState: UseAgentsResult;
  themeMode: import("../theme/theme").ThemeMode;
  onThemeChange: (mode: import("../theme/theme").ThemeMode) => void;
  accent: string;
  onAccentChange: (accent: string) => void;
}

const UPDATE_STAGE_LABEL: Record<string, string> = {
  idle: "sin comprobar",
  disabled: "no disponible en dev",
  checking: "buscando…",
  available: "actualización disponible",
  "not-available": "al día",
  downloading: "descargando…",
  downloaded: "lista para instalar",
  error: "error",
};

const POST_GATE_LABELS: Array<{ key: keyof HarnessSettings["gates"]["post"]; label: string }> = [
  { key: "build", label: "build" },
  { key: "typecheck", label: "typecheck" },
  { key: "lint", label: "lint" },
  { key: "tests", label: "tests" },
  { key: "security", label: "security" },
  { key: "visual", label: "visual" },
];

export function SettingsModal({ open, onClose, settingsState, cost, updater, skillsState, agentsState, themeMode, onThemeChange, accent, onAccentChange }: SettingsModalProps): React.ReactElement | null {
  const { settings, resolved, saving, error, testResult, save, testProvider, writeProfile, clearProfile } = settingsState;
  const [draft, setDraft] = useState<HarnessSettings | null>(settings);
  const [revealKey, setRevealKey] = useState(false);
  const [skillQuery, setSkillQuery] = useState("");
  const [categoryQuery, setCategoryQuery] = useState("");
  const [activeSection, setActiveSection] = useState("sec-apariencia");
  const [integrationResult, setIntegrationResult] = useState<string | null>(null);
  const [skillEditor, setSkillEditor] = useState<{ name: string | null } | null>(null);
  const [customPlugins, setCustomPlugins] = useState<CustomPluginDef[]>([]);
  const [pluginEditor, setPluginEditor] = useState<{ def: CustomPluginDef | null } | null>(null);
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [newTask, setNewTask] = useState("");
  const [projectRules, setProjectRules] = useState<Array<{ id: string; text: string }>>([]);
  const [newRule, setNewRule] = useState("");
  const [feedResult, setFeedResult] = useState<{ ok: boolean; available: boolean; reason: string; release: { version: string; notes: string; channel: string } | null } | null>(null);
  const containerRef = useFocusTrap(open, onClose);

  useEffect(() => {
    if (!open) return;
    void window.harness?.plugins.list().then((result) => setCustomPlugins(result?.custom ?? []));
    void window.harness?.tasks.list().then((result) => setTasks(result?.tasks ?? []));
    void window.harness?.rules.list().then((result) => setProjectRules(result?.rules ?? []));
  }, [open]);

  async function persistTasks(next: ProjectTask[]): Promise<void> {
    setTasks(next);
    await window.harness?.tasks.save(next);
  }

  async function addRule(): Promise<void> {
    const text = newRule.trim();
    if (!text) return;
    const result = await window.harness?.rules.add(text);
    if (!result?.error) {
      setProjectRules(result?.rules ?? []);
      setNewRule("");
    }
  }

  async function removeRule(id: string): Promise<void> {
    const result = await window.harness?.rules.remove(id);
    setProjectRules(result?.rules ?? []);
  }

  useEffect(() => {
    if (open && settings) setDraft(settings);
  }, [open, settings]);

  if (!open || !draft) return null;

  function patchProvider(changes: Partial<HarnessSettings["provider"]>): void {
    setDraft((current) => (current ? { ...current, provider: { ...current.provider, ...changes } } : current));
  }

  function patchModels(changes: Partial<HarnessSettings["provider"]["models"]>): void {
    setDraft((current) =>
      current ? { ...current, provider: { ...current.provider, models: { ...current.provider.models, ...changes } } } : current,
    );
  }

  function patchPre(key: keyof HarnessSettings["gates"]["pre"], value: boolean): void {
    setDraft((current) => (current ? { ...current, gates: { ...current.gates, pre: { ...current.gates.pre, [key]: value } } } : current));
  }

  function patchPost(key: keyof HarnessSettings["gates"]["post"], value: boolean): void {
    setDraft((current) => (current ? { ...current, gates: { ...current.gates, post: { ...current.gates.post, [key]: value } } } : current));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 px-4 py-10 backdrop-blur-sm" onMouseDown={onClose} role="presentation">
      <div
        ref={containerRef}
        className="palette-anim flex max-h-full w-full max-w-[880px] flex-col overflow-hidden sheet"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
      >
        <div className="flex items-center gap-3 border-b border-hairline px-5 py-4">
          <div>
            <h2 id="settings-title" className="text-[15px] font-semibold text-zinc-100">Settings</h2>
            <p className="mt-0.5 text-[12px] text-zinc-500">Proveedor, gates, herramientas y proyecto.</p>
          </div>
          <span className="ml-auto rounded-pill border border-hairline bg-surface-raised px-2.5 py-1 text-[12px] text-zinc-300">{resolved?.provider ?? "—"}</span>
          {resolved ? <span className="font-mono text-[12px] text-zinc-500">{resolved.model}</span> : null}
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar settings"
            className="rounded-control p-1.5 text-zinc-500 transition-colors hover:bg-surface-raised hover:text-zinc-200"
          >
            <IconClose width={16} height={16} />
          </button>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-[220px_1fr] divide-x divide-hairline">
          <nav aria-label="Categorías de settings" className="min-h-0 overflow-y-auto p-3">
            <div className="field mb-3 flex items-center gap-2 px-2.5 py-1.5">
              <span aria-hidden="true" className="text-[12px] text-zinc-500">⌕</span>
              <input
                value={categoryQuery}
                aria-label="Buscar ajuste"
                placeholder="Buscar ajuste…"
                onChange={(event) => setCategoryQuery(event.target.value)}
                className="min-w-0 flex-1 bg-transparent text-[13px] text-zinc-200 outline-none"
              />
            </div>
            {SETTINGS_GROUPS.map((group) => {
              const query = categoryQuery.trim().toLowerCase();
              const categories = SETTINGS_CATEGORIES.filter(
                (category) => category.group === group.id && (!query || `${category.label} ${category.keywords}`.toLowerCase().includes(query)),
              );
              if (categories.length === 0) return null;
              return (
                <div key={group.id} className="mb-3">
                  <p className="mb-1 px-2 text-[12px] font-medium text-zinc-500">{group.label}</p>
                  {categories.map((category) => (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => {
                        setActiveSection(category.target);
                        document.getElementById(category.target)?.scrollIntoView({ behavior: "smooth", block: "start" });
                      }}
                      className={cn(
                        "mb-0.5 flex w-full items-center gap-2 rounded-control px-2.5 py-2 text-left text-[13px] transition-colors",
                        activeSection === category.target ? "bg-harness/15 text-harness-soft" : "text-zinc-300 hover:bg-surface-raised hover:text-zinc-100",
                      )}
                    >
                      <span aria-hidden="true" className="w-4 text-center text-[12px] text-zinc-500">{category.glyph}</span>
                      {category.label}
                    </button>
                  ))}
                </div>
              );
            })}
          </nav>

          <div className="min-h-0 space-y-3 overflow-y-auto px-5 py-5">
          <Section title="Apariencia">
            <div className="flex items-center gap-2">
              {(["system", "light", "dark"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  aria-pressed={themeMode === mode}
                  onClick={() => onThemeChange(mode)}
                  className={cn(
                    "rounded-control border px-3 py-1.5 text-[12px] transition-colors",
                    themeMode === mode ? "border-harness/50 bg-harness/10 text-harness-soft" : "border-hairline bg-surface text-zinc-400 hover:bg-surface-raised",
                  )}
                >
                  {mode === "system" ? "sistema" : mode === "light" ? "claro" : "oscuro"}
                </button>
              ))}
            </div>
            <p className="text-[12px] text-zinc-500">El tema sigue al sistema salvo que lo fijes. Se guarda por usuario.</p>

            <div className="mt-3 border-t border-hairline pt-3">
              <p className="mb-2 text-[12px] font-medium text-zinc-400">Color de acento</p>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Color de acento">
                {ACCENTS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    role="radio"
                    aria-checked={accent === option.id}
                    aria-label={option.label}
                    title={option.label}
                    onClick={() => onAccentChange(option.id)}
                    className={cn(
                      "h-7 w-7 rounded-full border-2 transition-transform hover:scale-110",
                      accent === option.id ? "border-zinc-100" : "border-transparent",
                    )}
                    style={{ background: option.base }}
                  />
                ))}
              </div>
              <p className="mt-1.5 text-[12px] text-zinc-500">Se aplica a botones, foco, timeline y acentos de toda la UI.</p>
            </div>
          </Section>

          <Section title="Provider (BYOK)" description="Quién ejecuta el modelo: mock local o un proveedor real con tu API key (nunca sale de tu máquina).">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Provider">
                <select
                  value={draft.provider.provider}
                  onChange={(event) => patchProvider({ provider: event.target.value as ProviderName })}
                  className="w-full rounded-control border border-hairline bg-surface px-2 py-1.5 text-[12px] text-zinc-200 outline-none focus:border-harness/60"
                >
                  {KNOWN_PROVIDERS.map((providerName) => (
                    <option key={providerName} value={providerName}>
                      {providerName}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Base URL (opcional)">
                <input
                  value={draft.provider.baseURL}
                  onChange={(event) => patchProvider({ baseURL: event.target.value })}
                  placeholder="https://api…"
                  className="w-full rounded-control border border-hairline bg-surface px-2 py-1.5 font-mono text-[12px] text-zinc-200 outline-none focus:border-harness/60"
                />
              </Field>
            </div>

            <Field label="API key">
              <div className="flex items-center gap-2">
                <input
                  type={revealKey ? "text" : "password"}
                  value={draft.provider.apiKey}
                  onChange={(event) => patchProvider({ apiKey: event.target.value })}
                  placeholder="se guarda en ~/.pragma-harness/config.json"
                  className="w-full rounded-control border border-hairline bg-surface px-2 py-1.5 font-mono text-[12px] text-zinc-200 outline-none focus:border-harness/60"
                />
                <button
                  type="button"
                  onClick={() => setRevealKey((value) => !value)}
                  className="shrink-0 rounded-control border border-hairline px-2 py-1.5 text-[12px] text-zinc-400 transition-colors hover:bg-zinc-800"
                >
                  {revealKey ? "ocultar" : "ver"}
                </button>
              </div>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Model · classifier">
                <input
                  value={draft.provider.models.classifier}
                  onChange={(event) => patchModels({ classifier: event.target.value })}
                  className="w-full rounded-control border border-hairline bg-surface px-2 py-1.5 font-mono text-[12px] text-zinc-200 outline-none focus:border-harness/60"
                />
              </Field>
              <Field label="Model · executor">
                <input
                  value={draft.provider.models.executor}
                  onChange={(event) => patchModels({ executor: event.target.value })}
                  className="w-full rounded-control border border-hairline bg-surface px-2 py-1.5 font-mono text-[12px] text-zinc-200 outline-none focus:border-harness/60"
                />
              </Field>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => void testProvider()}
                className="rounded-control border border-harness/40 bg-harness/10 px-3 py-1.5 text-[12px] text-harness-soft transition-colors hover:bg-harness/20"
              >
                Probar conexión
              </button>
              {testResult ? (
                <span className={cn("text-[12px]", testResult.ok ? "text-emerald-400" : "text-red-400")}>
                  {testResult.ok ? "✓" : "✕"} {testResult.reason}
                </span>
              ) : null}
            </div>
          </Section>

          <Section title="Costo de hoy">
            {cost ? (
              <>
                <div className="grid grid-cols-3 gap-3">
                  <Field label="USD hoy">
                    <p className="font-mono text-[13px] text-zinc-200">
                      ${cost.today.usd.toFixed(4)} <span className="text-zinc-600">/ ${cost.budget.usdPerDay.toFixed(2)}</span>
                    </p>
                  </Field>
                  <Field label="Tokens hoy">
                    <p className="font-mono text-[13px] text-zinc-200">
                      {cost.today.tokens.toLocaleString()} <span className="text-zinc-600">/ {cost.budget.tokensPerDay.toLocaleString()}</span>
                    </p>
                  </Field>
                  <Field label="Llamadas">
                    <p className="font-mono text-[13px] text-zinc-200">{cost.today.calls}</p>
                  </Field>
                </div>
                <div className="mt-1 rounded-control border border-hairline bg-surface p-2">
                  <p className="text-[12px] uppercase tracking-widest text-zinc-600">Por dominio</p>
                  {cost.perDomain.length === 0 ? (
                    <p className="mt-1 text-[12px] text-zinc-500">sin uso todavía</p>
                  ) : (
                    <ul className="mt-1 space-y-0.5">
                      {cost.perDomain.map((domain) => (
                        <li key={domain.domain} className="flex items-center justify-between text-[12px]">
                          <span className="text-zinc-400">{domain.domain}</span>
                          <span className="font-mono text-zinc-500">
                            {domain.tokens.toLocaleString()} tok · ${domain.usd.toFixed(4)} · {domain.calls} calls
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <p className="text-[12px] text-zinc-600">
                  token+USD se cuentan por llamada y se persisten en metrics.json
                </p>
              </>
            ) : (
              <p className="text-[12px] text-zinc-500">sin datos de costo</p>
            )}
          </Section>

          <Section title="Budget diario">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Tokens / día">
                <input
                  type="number"
                  value={draft.budget.tokensPerDay}
                  onChange={(event) => setDraft({ ...draft, budget: { ...draft.budget, tokensPerDay: Number(event.target.value) } })}
                  className="w-full rounded-control border border-hairline bg-surface px-2 py-1.5 text-[12px] text-zinc-200 outline-none focus:border-harness/60"
                />
              </Field>
              <Field label="USD / día">
                <input
                  type="number"
                  step="0.5"
                  value={draft.budget.usdPerDay}
                  onChange={(event) => setDraft({ ...draft, budget: { ...draft.budget, usdPerDay: Number(event.target.value) } })}
                  className="w-full rounded-control border border-hairline bg-surface px-2 py-1.5 text-[12px] text-zinc-200 outline-none focus:border-harness/60"
                />
              </Field>
            </div>
          </Section>

          <Section title="Gates" description="Controles deterministas antes y después del agente: bloquean si no se cumplen.">
            <Toggle label="pre-gates activos" checked={draft.gates.pre.enabled} onChange={(value) => patchPre("enabled", value)} />
            <div className="mt-2 grid grid-cols-3 gap-2">
              <Toggle label="secret" checked={draft.gates.pre.secret} onChange={(value) => patchPre("secret", value)} />
              <Toggle label="budget" checked={draft.gates.pre.budget} onChange={(value) => patchPre("budget", value)} />
              <Toggle label="schema" checked={draft.gates.pre.schema} onChange={(value) => patchPre("schema", value)} />
            </div>
            <div className="mt-3 border-t border-hairline pt-3">
              <Toggle label="post-gates activos" checked={draft.gates.post.enabled} onChange={(value) => patchPost("enabled", value)} />
              <div className="mt-2 grid grid-cols-3 gap-2">
                {POST_GATE_LABELS.map((phase) => (
                  <Toggle
                    key={phase.key}
                    label={phase.label}
                    checked={Boolean(draft.gates.post[phase.key])}
                    onChange={(value) => patchPost(phase.key, value)}
                  />
                ))}
              </div>
            </div>
          </Section>

          <Section anchor="sec-reglas" title={`Reglas del proyecto (${projectRules.length})`} description="Reglas propias del proyecto que el harness inyecta en cada run, además de G1-G10. Formato libre.">
            <div className="flex items-center gap-2">
              <input
                value={newRule}
                onChange={(event) => setNewRule(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void addRule();
                }}
                placeholder="p. ej. usa nombres en español para las clases del dominio"
                aria-label="Nueva regla del proyecto"
                className="field min-w-0 flex-1 px-2.5 py-1.5 text-[12px] text-zinc-200"
              />
              <button type="button" onClick={() => void addRule()} className="rounded-control border border-harness/40 bg-harness/10 px-3 py-1.5 text-[12px] text-harness-soft hover:bg-harness/20">
                Añadir regla
              </button>
            </div>
            {projectRules.length === 0 ? (
              <p className="text-[12px] text-zinc-500">Sin reglas propias. Se guardan en <span className="font-mono">.pragma-harness/rules.json</span> y se inyectan en el bloque de reglas.</p>
            ) : (
              <ul className="space-y-1">
                {projectRules.map((rule) => (
                  <li key={rule.id} className="flex items-start gap-2 rounded-control border border-hairline bg-surface px-2 py-1.5">
                    <span className="mt-[2px] font-mono text-[12px] text-harness-soft">{rule.id}</span>
                    <span className="flex-1 text-[12px] text-zinc-200">{rule.text}</span>
                    <button type="button" aria-label={`Quitar ${rule.id}`} onClick={() => void removeRule(rule.id)} className="rounded-control px-1.5 text-[12px] text-zinc-500 hover:text-red-300">
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Plugins">
            <div className="grid grid-cols-3 gap-2">
              {KNOWN_PLUGINS.map((pluginName) => (
                <Toggle
                  key={pluginName}
                  label={pluginName}
                  checked={draft.plugins[pluginName] ?? false}
                  onChange={(value) => setDraft({ ...draft, plugins: { ...draft.plugins, [pluginName]: value } })}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={() => setPluginEditor({ def: null })}
              className="rounded-control border border-harness/40 px-3 py-1.5 text-[12px] text-harness-soft transition-colors hover:bg-harness/10"
            >
              Nuevo plugin
            </button>
            {customPlugins.length > 0 ? (
              <ul className="space-y-1">
                {customPlugins.map((plugin) => (
                  <li key={plugin.name} className="flex items-center gap-2 rounded-control border border-hairline bg-surface px-2 py-1.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12px] text-zinc-200">{plugin.name}</p>
                      <p className="truncate text-[12px] text-zinc-500">{plugin.stage} · {plugin.action} · /{plugin.match}/</p>
                    </div>
                    <button
                      type="button"
                      aria-label={`Editar ${plugin.name}`}
                      onClick={() => setPluginEditor({ def: plugin })}
                      className="rounded-control border border-hairline px-2 py-1 text-[12px] text-zinc-400 transition-colors hover:bg-zinc-800"
                    >
                      Editar
                    </button>
                    <Toggle
                      label={draft.plugins[plugin.name] === true ? "activo" : "off"}
                      checked={draft.plugins[plugin.name] === true}
                      onChange={(value) => setDraft({ ...draft, plugins: { ...draft.plugins, [plugin.name]: value } })}
                    />
                  </li>
                ))}
              </ul>
            ) : null}
          </Section>

          <Section anchor="sec-tareas" title={`Tareas del proyecto (${tasks.filter((task) => task.done).length}/${tasks.length})`}>
            <div className="flex items-center gap-2">
              <input
                value={newTask}
                aria-label="Nueva tarea"
                onChange={(event) => setNewTask(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && newTask.trim()) {
                    void persistTasks([...tasks, { id: `${Date.now().toString(36)}`, title: newTask.trim(), done: false }]);
                    setNewTask("");
                  }
                }}
                placeholder="nueva tarea…"
                className="min-w-0 flex-1 rounded-control border border-hairline bg-surface px-2 py-1.5 text-[12px] text-zinc-200 outline-none focus:border-harness/60"
              />
              <button
                type="button"
                onClick={() => {
                  if (!newTask.trim()) return;
                  void persistTasks([...tasks, { id: `${Date.now().toString(36)}`, title: newTask.trim(), done: false }]);
                  setNewTask("");
                }}
                className="rounded-control border border-hairline px-2 py-1.5 text-[12px] text-zinc-300 hover:bg-zinc-800"
              >
                Añadir
              </button>
            </div>
            {tasks.length > 0 ? (
              <ul className="space-y-1">
                {tasks.map((task) => (
                  <li key={task.id} className="flex items-center gap-2 rounded-control border border-hairline bg-surface px-2 py-1.5">
                    <input
                      type="checkbox"
                      checked={task.done}
                      aria-label={`Completar ${task.title}`}
                      onChange={(event) => void persistTasks(tasks.map((entry) => (entry.id === task.id ? { ...entry, done: event.target.checked } : entry)))}
                    />
                    <span className={cn("flex-1 text-[12px]", task.done ? "text-zinc-500 line-through" : "text-zinc-200")}>{task.title}</span>
                    <button
                      type="button"
                      aria-label={`Quitar ${task.title}`}
                      onClick={() => void persistTasks(tasks.filter((entry) => entry.id !== task.id))}
                      className="rounded-control border border-hairline px-2 py-1 text-[12px] text-zinc-500 hover:bg-zinc-800"
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </Section>

          <Section anchor="sec-agentes" title={`Agentes (${agentsState.agents.length})`}>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void agentsState.select("")}
                className={cn(
                  "rounded-control border px-2.5 py-1 text-[12px] transition-colors",
                  agentsState.active === null
                    ? "border-harness/40 bg-harness/10 text-harness-soft"
                    : "border-hairline bg-surface text-zinc-400 hover:text-zinc-200",
                )}
              >
                Automático por dominio
              </button>
              <span className="text-[12px] text-zinc-500">
                {agentsState.active ? `activo: ${agentsState.active.name}` : "el harness elige según el dominio"}
              </span>
            </div>
            {agentsState.loading ? (
              <p className="text-[12px] text-zinc-500">cargando agentes…</p>
            ) : (
              <ul className="max-h-[200px] space-y-1 overflow-y-auto">
                {agentsState.agents.map((agent) => (
                  <li key={agent.id} className="flex items-center gap-2 rounded-control border border-hairline bg-surface px-2 py-1.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12px] text-zinc-200">{agent.name}</p>
                      <p className="truncate text-[12px] text-zinc-500">
                        {agent.role} · {agent.domains.join(", ")}
                        {agent.skills.length > 0 ? ` · skills: ${agent.skills.join(", ")}` : ""}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void agentsState.select(agent.active ? "" : agent.id)}
                      className={cn(
                        "shrink-0 rounded-control border px-2 py-1 text-[12px] transition-colors",
                        agent.active
                          ? "border-harness/40 bg-harness/10 text-harness-soft"
                          : "border-hairline text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200",
                      )}
                    >
                      {agent.active ? "usando" : "usar"}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section anchor="sec-skills" title={`Skills (${skillsState.skills.filter((skill) => skill.enabled).length}/${skillsState.skills.length})`}>
            <button
              type="button"
              onClick={() => setSkillEditor({ name: null })}
              className="rounded-control border border-harness/40 px-3 py-1.5 text-[12px] text-harness-soft transition-colors hover:bg-harness/10"
            >
              Nueva skill
            </button>
            <input
              value={skillQuery}
              onChange={(event) => setSkillQuery(event.target.value)}
              placeholder="buscar por nombre, trigger o descripción"
              aria-label="Buscar skills"
              className="w-full rounded-control border border-hairline bg-surface px-2 py-1.5 text-[12px] text-zinc-200 outline-none focus:border-harness/60 placeholder:text-zinc-500"
            />
            {skillsState.loading ? (
              <p className="text-[12px] text-zinc-500">cargando catálogo…</p>
            ) : skillsState.skills.length === 0 ? (
              <p className="text-[12px] text-zinc-500">sin skills en este workspace</p>
            ) : (
              <ul className="max-h-[220px] space-y-1 overflow-y-auto">
                {skillsState.skills
                  .filter((skill) => {
                    const query = skillQuery.trim().toLowerCase();
                    if (!query) return true;
                    return (
                      skill.name.toLowerCase().includes(query) ||
                      skill.description.toLowerCase().includes(query) ||
                      skill.triggers.some((trigger) => trigger.toLowerCase().includes(query))
                    );
                  })
                  .map((skill) => (
                    <li
                      key={skill.name}
                      className="flex items-center gap-2 rounded-control border border-hairline bg-surface px-2 py-1.5"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12px] text-zinc-200" title={skill.path}>
                          {skill.name}
                        </p>
                        <p className="truncate text-[12px] text-zinc-500">
                          {skill.description || skill.triggers.join(", ") || "sin descripción"}
                        </p>
                      </div>
                      <span className="rounded bg-zinc-800 px-1.5 py-[1px] font-mono text-[12px] text-zinc-400" title="prioridad">
                        {skill.priority}
                      </span>
                      <button
                        type="button"
                        aria-label={`Editar ${skill.name}`}
                        onClick={() => setSkillEditor({ name: skill.name })}
                        className="rounded-control border border-hairline px-2 py-1 text-[12px] text-zinc-400 transition-colors hover:bg-zinc-800"
                      >
                        Editar
                      </button>
                      <Toggle
                        label={skill.enabled ? "activa" : "off"}
                        checked={skill.enabled}
                        onChange={(value) => void skillsState.toggle(skill.name, value)}
                      />
                    </li>
                  ))}
              </ul>
            )}
          </Section>

          <Section title="Sandbox" description="Aislamiento de comandos: contenedor, sin red y worktree en solo lectura por defecto.">
            <Toggle
              label="ejecutar en Docker (opt-in)"
              checked={draft.sandbox.enabled}
              onChange={(value) => setDraft({ ...draft, sandbox: { ...draft.sandbox, enabled: value } })}
            />
            <Field label="Imagen">
              <input
                value={draft.sandbox.image}
                onChange={(event) => setDraft({ ...draft, sandbox: { ...draft.sandbox, image: event.target.value } })}
                className="w-40 rounded-control border border-hairline bg-surface px-2 py-1.5 font-mono text-[12px] text-zinc-200 outline-none focus:border-harness/60"
              />
            </Field>
            <div className="grid grid-cols-4 gap-2">
              <Toggle
                label="red"
                checked={draft.sandbox.network}
                onChange={(value) => setDraft({ ...draft, sandbox: { ...draft.sandbox, network: value } })}
              />
              <Toggle
                label="worktree ro"
                checked={draft.sandbox.readOnlyWorkspace}
                onChange={(value) => setDraft({ ...draft, sandbox: { ...draft.sandbox, readOnlyWorkspace: value } })}
              />
              <Field label="cpus">
                <input
                  aria-label="sandbox cpus"
                  value={draft.sandbox.cpus}
                  onChange={(event) => setDraft({ ...draft, sandbox: { ...draft.sandbox, cpus: Number(event.target.value) || 0 } })}
                  className="w-full rounded-control border border-hairline bg-surface px-2 py-1.5 font-mono text-[12px] text-zinc-200 outline-none focus:border-harness/60"
                />
              </Field>
              <Field label="memoryMb">
                <input
                  aria-label="sandbox memory"
                  value={draft.sandbox.memoryMb}
                  onChange={(event) => setDraft({ ...draft, sandbox: { ...draft.sandbox, memoryMb: Number(event.target.value) || 0 } })}
                  className="w-full rounded-control border border-hairline bg-surface px-2 py-1.5 font-mono text-[12px] text-zinc-200 outline-none focus:border-harness/60"
                />
              </Field>
            </div>
          </Section>

          <Section title="Herramientas del agente" description="Qué puede ejecutar el agente sin preguntar, con permiso, o nunca.">
            <Toggle
              label={draft.tools.askBeforeTools ? "preguntar antes de ejecutar tools" : "el harness continúa solo"}
              checked={draft.tools.askBeforeTools}
              onChange={(value) => setDraft({ ...draft, tools: { ...draft.tools, askBeforeTools: value } })}
            />
            <div className="grid grid-cols-4 gap-2">
              {KNOWN_TOOLS.map((tool) => (
                <label key={tool} className="block text-[12px] uppercase tracking-widest text-zinc-500">
                  {tool}
                  <select
                    aria-label={`Permiso ${tool}`}
                    value={draft.tools.perTool[tool] ?? ""}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        tools: {
                          ...draft.tools,
                          perTool: { ...draft.tools.perTool, [tool]: (event.target.value || undefined) as import("@shared/settings").ToolPermissionMode | undefined },
                        },
                      })
                    }
                    className="mt-1 w-full rounded-control border border-hairline bg-surface px-2 py-1 text-[12px] text-zinc-300 outline-none"
                  >
                    <option value="">auto</option>
                    <option value="allow">allow</option>
                    <option value="ask">ask</option>
                    <option value="deny">deny</option>
                  </select>
                </label>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setDraft({ ...draft, tools: TOOL_PERMISSION_PRESETS.seguro })}
                className="rounded-control border border-hairline px-2 py-1 text-[12px] text-zinc-300 hover:bg-zinc-800"
              >
                preset seguro
              </button>
              <button
                type="button"
                onClick={() => setDraft({ ...draft, tools: TOOL_PERMISSION_PRESETS.autonomo })}
                className="rounded-control border border-hairline px-2 py-1 text-[12px] text-zinc-300 hover:bg-zinc-800"
              >
                preset autónomo
              </button>
            </div>
          </Section>

          <Section title="Actualizaciones">
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  "rounded-full px-2 py-[1px] text-[12px]",
                  updater.status?.stage === "downloaded"
                    ? "bg-emerald-500/15 text-emerald-300"
                    : updater.status?.stage === "error"
                      ? "bg-red-500/15 text-red-300"
                      : "bg-zinc-800 text-zinc-400",
                )}
              >
                {UPDATE_STAGE_LABEL[updater.status?.stage ?? "idle"] ?? "—"}
              </span>
              <span className="font-mono text-[12px] text-zinc-600">
                v{updater.status?.currentVersion ?? "—"}
                {updater.status?.version ? ` → v${updater.status.version}` : ""}
                {typeof updater.status?.percent === "number" ? ` · ${updater.status.percent}%` : ""}
              </span>
            </div>
            {updater.status?.message ? <p className="text-[12px] text-zinc-500">{updater.status.message}</p> : null}
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={updater.busy || updater.status?.stage === "disabled"}
                onClick={() => void updater.check()}
                className="rounded-control border border-hairline px-3 py-1.5 text-[12px] text-zinc-300 transition-colors hover:bg-zinc-800 disabled:opacity-40"
              >
                Buscar actualizaciones
              </button>
              {updater.status?.stage === "available" ? (
                <button
                  type="button"
                  disabled={updater.busy}
                  onClick={() => void updater.download()}
                  className="rounded-control border border-harness/40 bg-harness/10 px-3 py-1.5 text-[12px] text-harness-soft hover:bg-harness/20 disabled:opacity-40"
                >
                  Descargar
                </button>
              ) : null}
              {updater.status?.stage === "downloaded" ? (
                <button
                  type="button"
                  onClick={() => void updater.install()}
                  className="rounded-control bg-harness px-3 py-1.5 text-[12px] font-medium text-white hover:bg-harness-strong"
                >
                  Reiniciar e instalar
                </button>
              ) : null}
            </div>
            <p className="text-[12px] text-zinc-600">feed: GitHub Releases · autoDownload on</p>

            <Field label="Feed privado (URL firmada / S3)">
              <input
                aria-label="Feed URL"
                value={draft.updater.feedUrl}
                onChange={(event) => setDraft({ ...draft, updater: { ...draft.updater, feedUrl: event.target.value } })}
                className="w-full rounded-control border border-hairline bg-surface px-2 py-1.5 font-mono text-[12px] text-zinc-200 outline-none focus:border-harness/60"
              />
            </Field>
            <div className="flex items-center gap-2">
              <select
                aria-label="Canal de actualización"
                value={draft.updater.channel}
                onChange={(event) => setDraft({ ...draft, updater: { ...draft.updater, channel: event.target.value === "beta" ? "beta" : "stable" } })}
                className="rounded-control border border-hairline bg-surface px-2 py-1.5 text-[12px] text-zinc-300 outline-none"
              >
                <option value="stable">stable</option>
                <option value="beta">beta</option>
              </select>
              <input
                aria-label="Token del feed"
                type="password"
                placeholder="token (opcional)"
                value={draft.updater.token}
                onChange={(event) => setDraft({ ...draft, updater: { ...draft.updater, token: event.target.value } })}
                className="min-w-0 flex-1 rounded-control border border-hairline bg-surface px-2 py-1.5 font-mono text-[12px] text-zinc-200 outline-none focus:border-harness/60"
              />
              <button
                type="button"
                onClick={() => void window.harness?.updater.feed().then(setFeedResult)}
                className="rounded-control border border-harness/40 px-3 py-1.5 text-[12px] text-harness-soft hover:bg-harness/10"
              >
                Comprobar feed
              </button>
            </div>
            {feedResult ? (
              <div className="rounded-control border border-hairline bg-surface p-2">
                <p className="text-[12px] text-zinc-300">{feedResult.available ? "disponible" : feedResult.ok ? "al día" : "error"} · {feedResult.reason}</p>
                {feedResult.release?.notes ? <p className="mt-1 whitespace-pre-wrap text-[12px] text-zinc-500">{feedResult.release.notes}</p> : null}
              </div>
            ) : null}
          </Section>

          <Section title="Integraciones (terceros)" description="Conexiones externas (MCP/Supabase) que el harness puede usar cuando las actives. Las credenciales se guardan cifradas.">
            <Toggle
              label={draft.integrations.supabase.enabled ? "Supabase activo" : "Supabase off"}
              checked={draft.integrations.supabase.enabled}
              onChange={(value) => setDraft({ ...draft, integrations: { ...draft.integrations, supabase: { ...draft.integrations.supabase, enabled: value } } })}
            />
            <div className="grid grid-cols-2 gap-2">
              <Field label="Project URL">
                <input
                  aria-label="Supabase URL"
                  value={draft.integrations.supabase.url}
                  onChange={(event) => setDraft({ ...draft, integrations: { ...draft.integrations, supabase: { ...draft.integrations.supabase, url: event.target.value } } })}
                  className="w-full rounded-control border border-hairline bg-surface px-2 py-1.5 font-mono text-[12px] text-zinc-200 outline-none focus:border-harness/60"
                />
              </Field>
              <Field label="Anon key (pública)">
                <input
                  aria-label="Supabase anon key"
                  type="password"
                  value={draft.integrations.supabase.anonKey}
                  onChange={(event) => setDraft({ ...draft, integrations: { ...draft.integrations, supabase: { ...draft.integrations.supabase, anonKey: event.target.value } } })}
                  className="w-full rounded-control border border-hairline bg-surface px-2 py-1.5 font-mono text-[12px] text-zinc-200 outline-none focus:border-harness/60"
                />
              </Field>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void window.harness?.integrations.test("supabase").then((result) => setIntegrationResult(`${result.ok ? "ok" : "error"} · ${result.detail}`))}
                className="rounded-control border border-harness/40 px-3 py-1.5 text-[12px] text-harness-soft hover:bg-harness/10"
              >
                Probar Supabase
              </button>
              {integrationResult ? <span className="text-[12px] text-zinc-400">{integrationResult}</span> : null}
            </div>
            <p className="text-[12px] text-zinc-600">Guarda para persistir. Los MCP de terceros se activan por config.</p>
          </Section>

          <Section title="Perfil del proyecto">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "rounded-full px-2 py-[1px] text-[12px]",
                  resolved?.profile.active ? "bg-harness/15 text-harness-soft" : "bg-zinc-800 text-zinc-400",
                )}
              >
                {resolved?.profile.active ? `perfil: ${resolved.profile.name ?? "sin nombre"}` : "sin perfil"}
              </span>
              {resolved?.profile.path ? (
                <span className="truncate font-mono text-[12px] text-zinc-500" title={resolved.profile.path}>
                  {resolved.profile.path}
                </span>
              ) : null}
            </div>
            <p className="text-[12px] text-zinc-500">
              Un perfil en <span className="font-mono">.pragma-harness/profile.json</span> sobreescribe la config global
              (provider, gates, plugins, sandbox) sólo para este proyecto.
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void writeProfile()}
                className="rounded-control border border-harness/40 bg-harness/10 px-3 py-1.5 text-[12px] text-harness-soft transition-colors hover:bg-harness/20"
              >
                Guardar settings actuales como perfil
              </button>
              {resolved?.profile.active ? (
                <button
                  type="button"
                  onClick={() => void clearProfile()}
                  className="rounded-control border border-hairline px-3 py-1.5 text-[12px] text-zinc-400 transition-colors hover:bg-zinc-800"
                >
                  Eliminar perfil
                </button>
              ) : null}
            </div>
          </Section>

          {error ? <p className="text-[12px] text-red-400">{error}</p> : null}
          </div>
        </div>

        <div className="flex items-center gap-2 border-t border-hairline px-4 py-3">
          <span className="font-mono text-[12px] text-zinc-600">{resolved?.configPath}</span>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto rounded-control border border-hairline px-3 py-1.5 text-[12px] text-zinc-400 transition-colors hover:bg-zinc-800"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void save(draft).then((ok) => (ok ? onClose() : undefined))}
            className="rounded-control bg-harness px-3 py-1.5 text-[12px] font-medium text-white transition-colors hover:bg-harness-strong disabled:opacity-50"
          >
            {saving ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>

      <SkillEditor
        open={skillEditor !== null}
        initialName={skillEditor?.name ?? null}
        onClose={() => setSkillEditor(null)}
        onSaved={() => skillsState.refresh()}
      />
      <PluginEditor
        open={pluginEditor !== null}
        initial={pluginEditor?.def ?? null}
        onClose={() => setPluginEditor(null)}
        onSaved={() => void window.harness?.plugins.list().then((result) => setCustomPlugins(result?.custom ?? []))}
      />
    </div>
  );
}

function Section({ title, description, anchor, children }: { title: string; description?: string; anchor?: string; children: React.ReactNode }): React.ReactElement {
  const id = anchor ?? `sec-${title.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
  const [open, setOpen] = useState<boolean>(() => {
    try {
      return localStorage.getItem(`phs:settings:${id}`) !== "closed";
    } catch {
      return true;
    }
  });

  function toggle(): void {
    setOpen((value) => {
      try {
        localStorage.setItem(`phs:settings:${id}`, value ? "closed" : "open");
      } catch {
        // storage unavailable
      }
      return !value;
    });
  }

  return (
    <section id={id} className="scroll-mt-4">
      <div className="overflow-hidden rounded-sheet border border-hairline bg-surface-raised/40">
        <button type="button" onClick={toggle} aria-expanded={open} className="flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-surface-raised/60">
          <div className="min-w-0 flex-1">
            <h2 className="text-[14px] font-semibold text-zinc-100">{title}</h2>
            {description ? <p className="mt-0.5 text-[12px] leading-snug text-zinc-500">{description}</p> : null}
          </div>
          <span className="mt-0.5 shrink-0 text-[12px] text-zinc-500" aria-hidden="true">{open ? "▾" : "▸"}</span>
        </button>
        {open ? <div className="space-y-3 border-t border-hairline px-4 py-4">{children}</div> : null}
      </div>
    </section>
  );
}

const SETTINGS_GROUPS: Array<{ id: string; label: string }> = [
  { id: "general", label: "General" },
  { id: "model", label: "Modelo y coste" },
  { id: "agent", label: "Agente" },
  { id: "security", label: "Seguridad y datos" },
  { id: "project", label: "Proyecto" },
];

const SETTINGS_CATEGORIES: Array<{ id: string; label: string; keywords: string; target: string; group: string; glyph: string }> = [
  { id: "appearance", label: "Apariencia", keywords: "tema color claro oscuro", target: "sec-apariencia", group: "general", glyph: "◐" },
  { id: "provider", label: "Provider", keywords: "api key modelo byok coste", target: "sec-provider-byok", group: "model", glyph: "◇" },
  { id: "budget", label: "Presupuesto", keywords: "tokens usd limite budget", target: "sec-budget-diario", group: "model", glyph: "$" },
  { id: "updates", label: "Actualizaciones", keywords: "update feed canal notas", target: "sec-actualizaciones", group: "general", glyph: "↻" },
  { id: "gates", label: "Gates", keywords: "build typecheck lint tests security visual", target: "sec-gates", group: "agent", glyph: "⊦" },
  { id: "plugins", label: "Plugins", keywords: "commit-guard secret-scan no-console-log tareas", target: "sec-plugins", group: "agent", glyph: "⬡" },
  { id: "agents", label: "Agentes", keywords: "agente rol dominio skills", target: "sec-agentes", group: "agent", glyph: "★" },
  { id: "skills", label: "Skills", keywords: "skill catálogo prioridad", target: "sec-skills", group: "agent", glyph: "✦" },
  { id: "security", label: "Seguridad y tools", keywords: "sandbox docker permisos allow ask deny", target: "sec-sandbox", group: "security", glyph: "⛨" },
  { id: "integrations", label: "Integraciones", keywords: "supabase mcp terceros integraciones", target: "sec-integraciones-terceros", group: "security", glyph: "⇄" },
  { id: "project", label: "Perfil del proyecto", keywords: "perfil workspace recientes", target: "sec-perfil-del-proyecto", group: "project", glyph: "▸" },
];

function Field({ label, children }: { label: string; children: React.ReactNode }): React.ReactElement {
  return (
    <label className="block">
      <span className="mb-1 block text-[12px] text-zinc-500">{label}</span>
      {children}
    </label>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }): React.ReactElement {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "flex items-center gap-2 rounded-control border px-2.5 py-1.5 text-[12px] transition-colors",
        checked ? "border-harness/40 bg-harness/10 text-harness-soft" : "border-hairline bg-surface text-zinc-500 hover:text-zinc-300",
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", checked ? "bg-harness" : "bg-zinc-600")} />
      {label}
    </button>
  );
}

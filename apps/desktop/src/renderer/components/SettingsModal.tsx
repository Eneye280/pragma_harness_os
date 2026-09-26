import { useEffect, useState } from "react";
import {
  KNOWN_PLUGINS,
  KNOWN_PROVIDERS,
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
import { SkillEditor } from "./SkillEditor";

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  settingsState: UseSettingsResult;
  cost: CostSnapshot | null;
  updater: UseUpdaterResult;
  skillsState: UseSkillsResult;
  agentsState: UseAgentsResult;
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

export function SettingsModal({ open, onClose, settingsState, cost, updater, skillsState, agentsState }: SettingsModalProps): React.ReactElement | null {
  const { settings, resolved, saving, error, testResult, save, testProvider, writeProfile, clearProfile } = settingsState;
  const [draft, setDraft] = useState<HarnessSettings | null>(settings);
  const [revealKey, setRevealKey] = useState(false);
  const [skillQuery, setSkillQuery] = useState("");
  const [skillEditor, setSkillEditor] = useState<{ name: string | null } | null>(null);
  const containerRef = useFocusTrap(open, onClose);

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
        className="palette-anim flex max-h-full w-full max-w-[680px] flex-col overflow-hidden rounded-panel border border-hairline bg-surface-raised shadow-2xl shadow-black/60"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
      >
        <div className="flex items-center gap-2 border-b border-hairline px-4 py-3">
          <span id="settings-title" className="text-[13px] font-semibold text-zinc-100">Settings</span>
          <span className="rounded-full bg-zinc-800 px-2 py-[1px] text-[10px] text-zinc-400">{resolved?.provider ?? "—"}</span>
          {resolved ? <span className="font-mono text-[10px] text-zinc-600">{resolved.model}</span> : null}
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar settings"
            className="ml-auto rounded-control p-1 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
          >
            <IconClose width={14} height={14} />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
          <Section title="Provider (BYOK)">
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
                  className="shrink-0 rounded-control border border-hairline px-2 py-1.5 text-[11px] text-zinc-400 transition-colors hover:bg-zinc-800"
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
                className="rounded-control border border-harness/40 bg-harness/10 px-3 py-1.5 text-[11px] text-harness-soft transition-colors hover:bg-harness/20"
              >
                Probar conexión
              </button>
              {testResult ? (
                <span className={cn("text-[11px]", testResult.ok ? "text-emerald-400" : "text-red-400")}>
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
                  <p className="text-[10px] uppercase tracking-widest text-zinc-600">Por dominio</p>
                  {cost.perDomain.length === 0 ? (
                    <p className="mt-1 text-[11px] text-zinc-500">sin uso todavía</p>
                  ) : (
                    <ul className="mt-1 space-y-0.5">
                      {cost.perDomain.map((domain) => (
                        <li key={domain.domain} className="flex items-center justify-between text-[11px]">
                          <span className="text-zinc-400">{domain.domain}</span>
                          <span className="font-mono text-zinc-500">
                            {domain.tokens.toLocaleString()} tok · ${domain.usd.toFixed(4)} · {domain.calls} calls
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <p className="text-[10px] text-zinc-600">
                  token+USD se cuentan por llamada y se persisten en metrics.json
                </p>
              </>
            ) : (
              <p className="text-[11px] text-zinc-500">sin datos de costo</p>
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

          <Section title="Gates">
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
          </Section>

          <Section title={`Agentes (${agentsState.agents.length})`}>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void agentsState.select("")}
                className={cn(
                  "rounded-control border px-2.5 py-1 text-[11px] transition-colors",
                  agentsState.active === null
                    ? "border-harness/40 bg-harness/10 text-harness-soft"
                    : "border-hairline bg-surface text-zinc-400 hover:text-zinc-200",
                )}
              >
                Automático por dominio
              </button>
              <span className="text-[10px] text-zinc-500">
                {agentsState.active ? `activo: ${agentsState.active.name}` : "el harness elige según el dominio"}
              </span>
            </div>
            {agentsState.loading ? (
              <p className="text-[11px] text-zinc-500">cargando agentes…</p>
            ) : (
              <ul className="max-h-[200px] space-y-1 overflow-y-auto">
                {agentsState.agents.map((agent) => (
                  <li key={agent.id} className="flex items-center gap-2 rounded-control border border-hairline bg-surface px-2 py-1.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12px] text-zinc-200">{agent.name}</p>
                      <p className="truncate text-[10px] text-zinc-500">
                        {agent.role} · {agent.domains.join(", ")}
                        {agent.skills.length > 0 ? ` · skills: ${agent.skills.join(", ")}` : ""}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void agentsState.select(agent.active ? "" : agent.id)}
                      className={cn(
                        "shrink-0 rounded-control border px-2 py-1 text-[11px] transition-colors",
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

          <Section title={`Skills (${skillsState.skills.filter((skill) => skill.enabled).length}/${skillsState.skills.length})`}>
            <button
              type="button"
              onClick={() => setSkillEditor({ name: null })}
              className="rounded-control border border-harness/40 px-3 py-1.5 text-[11px] text-harness-soft transition-colors hover:bg-harness/10"
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
              <p className="text-[11px] text-zinc-500">cargando catálogo…</p>
            ) : skillsState.skills.length === 0 ? (
              <p className="text-[11px] text-zinc-500">sin skills en este workspace</p>
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
                        <p className="truncate text-[10px] text-zinc-500">
                          {skill.description || skill.triggers.join(", ") || "sin descripción"}
                        </p>
                      </div>
                      <span className="rounded bg-zinc-800 px-1.5 py-[1px] font-mono text-[10px] text-zinc-400" title="prioridad">
                        {skill.priority}
                      </span>
                      <button
                        type="button"
                        aria-label={`Editar ${skill.name}`}
                        onClick={() => setSkillEditor({ name: skill.name })}
                        className="rounded-control border border-hairline px-2 py-1 text-[10px] text-zinc-400 transition-colors hover:bg-zinc-800"
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

          <Section title="Sandbox">
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
          </Section>

          <Section title="Actualizaciones">
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  "rounded-full px-2 py-[1px] text-[10px]",
                  updater.status?.stage === "downloaded"
                    ? "bg-emerald-500/15 text-emerald-300"
                    : updater.status?.stage === "error"
                      ? "bg-red-500/15 text-red-300"
                      : "bg-zinc-800 text-zinc-400",
                )}
              >
                {UPDATE_STAGE_LABEL[updater.status?.stage ?? "idle"] ?? "—"}
              </span>
              <span className="font-mono text-[10px] text-zinc-600">
                v{updater.status?.currentVersion ?? "—"}
                {updater.status?.version ? ` → v${updater.status.version}` : ""}
                {typeof updater.status?.percent === "number" ? ` · ${updater.status.percent}%` : ""}
              </span>
            </div>
            {updater.status?.message ? <p className="text-[11px] text-zinc-500">{updater.status.message}</p> : null}
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={updater.busy || updater.status?.stage === "disabled"}
                onClick={() => void updater.check()}
                className="rounded-control border border-hairline px-3 py-1.5 text-[11px] text-zinc-300 transition-colors hover:bg-zinc-800 disabled:opacity-40"
              >
                Buscar actualizaciones
              </button>
              {updater.status?.stage === "available" ? (
                <button
                  type="button"
                  disabled={updater.busy}
                  onClick={() => void updater.download()}
                  className="rounded-control border border-harness/40 bg-harness/10 px-3 py-1.5 text-[11px] text-harness-soft hover:bg-harness/20 disabled:opacity-40"
                >
                  Descargar
                </button>
              ) : null}
              {updater.status?.stage === "downloaded" ? (
                <button
                  type="button"
                  onClick={() => void updater.install()}
                  className="rounded-control bg-harness px-3 py-1.5 text-[11px] font-medium text-white hover:bg-harness-strong"
                >
                  Reiniciar e instalar
                </button>
              ) : null}
            </div>
            <p className="text-[10px] text-zinc-600">feed: GitHub Releases · autoDownload on</p>
          </Section>

          <Section title="Perfil del proyecto">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "rounded-full px-2 py-[1px] text-[10px]",
                  resolved?.profile.active ? "bg-harness/15 text-harness-soft" : "bg-zinc-800 text-zinc-400",
                )}
              >
                {resolved?.profile.active ? `perfil: ${resolved.profile.name ?? "sin nombre"}` : "sin perfil"}
              </span>
              {resolved?.profile.path ? (
                <span className="truncate font-mono text-[10px] text-zinc-500" title={resolved.profile.path}>
                  {resolved.profile.path}
                </span>
              ) : null}
            </div>
            <p className="text-[10px] text-zinc-500">
              Un perfil en <span className="font-mono">.pragma-harness/profile.json</span> sobreescribe la config global
              (provider, gates, plugins, sandbox) sólo para este proyecto.
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void writeProfile()}
                className="rounded-control border border-harness/40 bg-harness/10 px-3 py-1.5 text-[11px] text-harness-soft transition-colors hover:bg-harness/20"
              >
                Guardar settings actuales como perfil
              </button>
              {resolved?.profile.active ? (
                <button
                  type="button"
                  onClick={() => void clearProfile()}
                  className="rounded-control border border-hairline px-3 py-1.5 text-[11px] text-zinc-400 transition-colors hover:bg-zinc-800"
                >
                  Eliminar perfil
                </button>
              ) : null}
            </div>
          </Section>

          {error ? <p className="text-[11px] text-red-400">{error}</p> : null}
        </div>

        <div className="flex items-center gap-2 border-t border-hairline px-4 py-3">
          <span className="font-mono text-[10px] text-zinc-600">{resolved?.configPath}</span>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto rounded-control border border-hairline px-3 py-1.5 text-[11px] text-zinc-400 transition-colors hover:bg-zinc-800"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void save(draft).then((ok) => (ok ? onClose() : undefined))}
            className="rounded-control bg-harness px-3 py-1.5 text-[11px] font-medium text-white transition-colors hover:bg-harness-strong disabled:opacity-50"
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
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }): React.ReactElement {
  return (
    <section>
      <h2 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">{title}</h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }): React.ReactElement {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] text-zinc-500">{label}</span>
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
        "flex items-center gap-2 rounded-control border px-2.5 py-1.5 text-[11px] transition-colors",
        checked ? "border-harness/40 bg-harness/10 text-harness-soft" : "border-hairline bg-surface text-zinc-500 hover:text-zinc-300",
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", checked ? "bg-harness" : "bg-zinc-600")} />
      {label}
    </button>
  );
}

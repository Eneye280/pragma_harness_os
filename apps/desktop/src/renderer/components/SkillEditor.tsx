import { useEffect, useState } from "react";
import {
  defaultSkillBody,
  KNOWN_NEEDS,
  parseSkillDoc,
  serializeSkillDoc,
  validateSkillDoc,
} from "@shared/skill-authoring";
import { MarkdownView } from "../chat/MarkdownView";
import { useFocusTrap } from "../shell/use-focus-trap";

interface SkillEditorProps {
  open: boolean;
  onClose: () => void;
  initialName?: string | null;
  onSaved: () => void;
}

const EMPTY = { name: "", description: "", triggers: "", needs: "", priority: "10" };

export function SkillEditor({ open, onClose, initialName, onSaved }: SkillEditorProps): React.ReactElement | null {
  const [fields, setFields] = useState(EMPTY);
  const [body, setBody] = useState(defaultSkillBody());
  const [scope, setScope] = useState<"project" | "global">("project");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const containerRef = useFocusTrap(open, onClose);

  useEffect(() => {
    if (!open) return;
    setMessage(null);
    if (!initialName) {
      setFields(EMPTY);
      setBody(defaultSkillBody());
      setScope("project");
      return;
    }
    void window.harness?.skills.get(initialName).then((result) => {
      if (!result?.ok || !result.content) return;
      const parsed = parseSkillDoc(result.content);
      setFields({
        name: parsed.frontmatter.name,
        description: parsed.frontmatter.description,
        triggers: parsed.frontmatter.triggers.join(", "),
        needs: parsed.frontmatter.needs.join(", "),
        priority: String(parsed.frontmatter.priority),
      });
      setBody(parsed.body);
      setScope(result.scope ?? "project");
    });
  }, [open, initialName]);

  if (!open) return null;

  const serialized = serializeSkillDoc(
    {
      name: fields.name,
      description: fields.description,
      triggers: fields.triggers.split(",").map((entry) => entry.trim()).filter(Boolean),
      needs: fields.needs.split(",").map((entry) => entry.trim()).filter(Boolean),
      priority: Number(fields.priority) || 99,
    },
    body
  );
  const validation = validateSkillDoc(serialized);

  async function save(): Promise<void> {
    setBusy(true);
    try {
      const result = await window.harness?.skills.save({ name: fields.name, content: serialized, scope });
      if (result?.ok) {
        setMessage("guardada");
        onSaved();
      } else {
        setMessage([result?.error, ...(result?.errors ?? [])].filter(Boolean).join(" · ") || "no se pudo guardar");
      }
    } finally {
      setBusy(false);
    }
  }

  async function duplicate(): Promise<void> {
    const newName = window.prompt("nombre de la copia", `${fields.name}-copy`);
    if (!newName) return;
    setBusy(true);
    try {
      const result = await window.harness?.skills.duplicate({ name: fields.name, newName, scope });
      if (result?.ok) {
        setMessage("duplicada");
        onSaved();
        onClose();
      } else {
        setMessage(result?.error ?? "no se pudo duplicar");
      }
    } finally {
      setBusy(false);
    }
  }

  async function remove(): Promise<void> {
    if (!window.confirm(`¿Borrar la skill ${fields.name}?`)) return;
    setBusy(true);
    try {
      const result = await window.harness?.skills.delete(fields.name);
      if (result?.ok) {
        onSaved();
        onClose();
      } else {
        setMessage(result?.error ?? "no se pudo borrar");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6" role="dialog" aria-modal="true" aria-label="Editor de skill">
      <div ref={containerRef} className="flex h-[80vh] w-full max-w-4xl flex-col rounded-panel border border-hairline bg-surface shadow-2xl">
        <div className="flex items-center gap-2 border-b border-hairline px-3 py-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-harness-soft">{initialName ? "Editar skill" : "Nueva skill"}</span>
          <select
            value={scope}
            aria-label="Destino de la skill"
            onChange={(event) => setScope(event.target.value === "global" ? "global" : "project")}
            className="ml-auto rounded-control border border-hairline bg-surface px-2 py-1 text-[11px] text-zinc-300 outline-none"
          >
            <option value="project">proyecto</option>
            <option value="global">global</option>
          </select>
          <button type="button" onClick={onClose} className="rounded-control border border-hairline px-2 py-1 text-[11px] text-zinc-400 hover:bg-zinc-800">
            Cerrar
          </button>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-2 divide-x divide-hairline">
          <div className="flex min-h-0 flex-col gap-2 overflow-y-auto p-3">
            <Field label="name"><input aria-label="name" value={fields.name} onChange={(event) => setFields({ ...fields, name: event.target.value })} className={INPUT} /></Field>
            <Field label="description"><input aria-label="description" value={fields.description} onChange={(event) => setFields({ ...fields, description: event.target.value })} className={INPUT} /></Field>
            <Field label="triggers (coma)"><input aria-label="triggers" value={fields.triggers} onChange={(event) => setFields({ ...fields, triggers: event.target.value })} className={INPUT} /></Field>
            <Field label={`needs (${KNOWN_NEEDS.join(", ")})`}><input aria-label="needs" value={fields.needs} onChange={(event) => setFields({ ...fields, needs: event.target.value })} className={INPUT} /></Field>
            <Field label="priority"><input aria-label="priority" value={fields.priority} onChange={(event) => setFields({ ...fields, priority: event.target.value })} className={INPUT} /></Field>
            <label className="block text-[10px] uppercase tracking-widest text-zinc-500">
              cuerpo
              <textarea
                aria-label="cuerpo de la skill"
                value={body}
                onChange={(event) => setBody(event.target.value)}
                className="mt-1 h-56 w-full resize-y rounded-control border border-hairline bg-surface px-2 py-1.5 font-mono text-[11px] text-zinc-300 outline-none"
              />
            </label>
          </div>
          <div className="flex min-h-0 flex-col gap-2 overflow-y-auto p-3">
            <p className="text-[10px] uppercase tracking-widest text-zinc-500">preview</p>
            <MarkdownView text={body} />
            <div className="rounded-control border border-hairline bg-surface-raised p-2">
              {validation.errors.map((error) => <p key={error} className="text-[10px] text-red-400">✕ {error}</p>)}
              {validation.warnings.map((warning) => <p key={warning} className="text-[10px] text-amber-400">! {warning}</p>)}
              {validation.ok && validation.warnings.length === 0 ? <p className="text-[10px] text-emerald-400">✓ válida</p> : null}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 border-t border-hairline px-3 py-2">
          {message ? <p className="text-[11px] text-harness-soft" role="status">{message}</p> : null}
          <div className="ml-auto flex items-center gap-2">
            {initialName ? (
              <>
                <button type="button" onClick={() => void duplicate()} disabled={busy} className={SECONDARY}>Duplicar</button>
                <button type="button" onClick={() => void remove()} disabled={busy} className="rounded-control border border-red-500/40 px-3 py-1.5 text-[11px] text-red-400 hover:bg-red-500/10 disabled:opacity-40">Eliminar</button>
              </>
            ) : null}
            <button type="button" onClick={() => void save()} disabled={busy || !validation.ok} className="rounded-control bg-harness px-4 py-1.5 text-[11px] font-medium text-white hover:bg-harness-strong disabled:opacity-40">
              Guardar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const INPUT = "w-full rounded-control border border-hairline bg-surface px-2 py-1.5 font-mono text-[11px] text-zinc-200 outline-none focus:border-harness/60";
const SECONDARY = "rounded-control border border-hairline px-3 py-1.5 text-[11px] text-zinc-300 hover:bg-zinc-800 disabled:opacity-40";

function Field({ label, children }: { label: string; children: React.ReactNode }): React.ReactElement {
  return (
    <label className="block text-[10px] uppercase tracking-widest text-zinc-500">
      {label}
      <div className="mt-1">{children}</div>
    </label>
  );
}

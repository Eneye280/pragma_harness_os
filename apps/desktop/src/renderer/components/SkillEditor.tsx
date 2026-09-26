import { useEffect, useState } from "react";
import {
  defaultSkillBody,
  KNOWN_NEEDS,
  parseSkillDoc,
  serializeSkillDoc,
  validateSkillDoc,
} from "@shared/skill-authoring";
import { MarkdownView } from "../chat/MarkdownView";
import { Dialog } from "../ui/Dialog";

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
    <Dialog open={open} onClose={onClose} label={initialName ? "Editar skill" : "Nueva skill"} maxWidth="60rem">
      <div className="flex items-center gap-2 border-b border-hairline px-4 py-3">
        <span className="text-[13px] font-semibold text-zinc-100">{initialName ? "Editar skill" : "Nueva skill"}</span>
        <select
          value={scope}
          aria-label="Destino de la skill"
          onChange={(event) => setScope(event.target.value === "global" ? "global" : "project")}
          className="field ml-auto px-2 py-1 text-[12px] text-zinc-300"
        >
          <option value="project">proyecto</option>
          <option value="global">global</option>
        </select>
        <button type="button" onClick={onClose} className="rounded-control border border-hairline px-2.5 py-1 text-[12px] text-zinc-400 hover:bg-surface-raised">
          Cerrar
        </button>
      </div>

      <div className="grid h-[70vh] min-h-0 grid-cols-2 divide-x divide-hairline">
        <div className="flex min-h-0 flex-col gap-2 overflow-y-auto p-4">
          <Field label="name"><input aria-label="name" value={fields.name} onChange={(event) => setFields({ ...fields, name: event.target.value })} className={INPUT} /></Field>
          <Field label="description"><input aria-label="description" value={fields.description} onChange={(event) => setFields({ ...fields, description: event.target.value })} className={INPUT} /></Field>
          <Field label="triggers (coma)"><input aria-label="triggers" value={fields.triggers} onChange={(event) => setFields({ ...fields, triggers: event.target.value })} className={INPUT} /></Field>
          <Field label={`needs (${KNOWN_NEEDS.join(", ")})`}><input aria-label="needs" value={fields.needs} onChange={(event) => setFields({ ...fields, needs: event.target.value })} className={INPUT} /></Field>
          <Field label="priority"><input aria-label="priority" value={fields.priority} onChange={(event) => setFields({ ...fields, priority: event.target.value })} className={INPUT} /></Field>
          <label className="block text-[12px] font-medium text-zinc-500">
            cuerpo
            <textarea
              aria-label="cuerpo de la skill"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              className="field mt-1 h-56 w-full resize-y px-2 py-1.5 font-mono text-[12px] text-zinc-300"
            />
          </label>
        </div>
        <div className="flex min-h-0 flex-col gap-2 overflow-y-auto p-4">
          <p className="text-[12px] font-medium text-zinc-500">preview</p>
          <MarkdownView text={body} />
          <div className="rounded-control border border-hairline bg-surface-raised p-2">
            {validation.errors.map((error) => <p key={error} className="text-[12px] text-red-400">✕ {error}</p>)}
            {validation.warnings.map((warning) => <p key={warning} className="text-[12px] text-amber-400">! {warning}</p>)}
            {validation.ok && validation.warnings.length === 0 ? <p className="text-[12px] text-emerald-400">✓ válida</p> : null}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 border-t border-hairline px-4 py-3">
        {message ? <p className="text-[12px] text-harness-soft" role="status">{message}</p> : null}
        <div className="ml-auto flex items-center gap-2">
          {initialName ? (
            <>
              <button type="button" onClick={() => void duplicate()} disabled={busy} className={SECONDARY}>Duplicar</button>
              <button type="button" onClick={() => void remove()} disabled={busy} className="rounded-control border border-red-500/40 px-3 py-1.5 text-[12px] text-red-400 hover:bg-red-500/10 disabled:opacity-40">Eliminar</button>
            </>
          ) : null}
          <button type="button" onClick={() => void save()} disabled={busy || !validation.ok} className="rounded-control bg-harness px-4 py-1.5 text-[12px] font-medium text-white hover:bg-harness-strong disabled:opacity-40">
            Guardar
          </button>
        </div>
      </div>
    </Dialog>
  );
}

const INPUT = "field w-full px-2 py-1.5 font-mono text-[12px] text-zinc-200";
const SECONDARY = "rounded-control border border-hairline px-3 py-1.5 text-[12px] text-zinc-300 hover:bg-surface-raised disabled:opacity-40";

function Field({ label, children }: { label: string; children: React.ReactNode }): React.ReactElement {
  return (
    <label className="block text-[12px] font-medium text-zinc-500">
      {label}
      <div className="mt-1">{children}</div>
    </label>
  );
}

import { useEffect, useState } from "react";
import {
  createCustomPluginTemplate,
  PLUGIN_ACTIONS,
  PLUGIN_STAGES,
  validateCustomPlugin,
  type CustomPluginAction,
  type CustomPluginDef,
  type CustomPluginStage,
} from "@shared/plugin-authoring";
import { Dialog } from "../ui/Dialog";

interface PluginEditorProps {
  open: boolean;
  initial?: CustomPluginDef | null;
  onClose: () => void;
  onSaved: () => void;
}

export function PluginEditor({ open, initial, onClose, onSaved }: PluginEditorProps): React.ReactElement | null {
  const [def, setDef] = useState<CustomPluginDef>(createCustomPluginTemplate(""));
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setDef(initial ?? createCustomPluginTemplate(""));
      setMessage(null);
    }
  }, [open, initial]);

  if (!open) return null;

  const validation = validateCustomPlugin(def);

  async function save(): Promise<void> {
    setBusy(true);
    try {
      const result = await window.harness?.plugins.save(def);
      if (result?.ok) {
        setMessage("plugin guardado y activado");
        onSaved();
      } else {
        setMessage(result?.errors.join(" · ") || "no se pudo guardar");
      }
    } finally {
      setBusy(false);
    }
  }

  async function remove(): Promise<void> {
    if (!window.confirm(`¿Borrar el plugin ${def.name}?`)) return;
    setBusy(true);
    try {
      const result = await window.harness?.plugins.delete(def.name);
      if (result?.ok) {
        onSaved();
        onClose();
      } else {
        setMessage(result?.errors.join(" · ") || "no se pudo borrar");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} label={initial ? "Editar plugin" : "Nuevo plugin"} maxWidth="48rem">
      <div className="flex items-center gap-2 border-b border-hairline px-4 py-3">
        <span className="text-[13px] font-semibold text-zinc-100">{initial ? "Editar plugin" : "Nuevo plugin"}</span>
        <button type="button" onClick={onClose} className="ml-auto rounded-control border border-hairline px-2.5 py-1 text-[12px] text-zinc-400 hover:bg-surface-raised">
          Cerrar
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 p-4">
        <Field label="name"><input aria-label="plugin name" value={def.name} onChange={(event) => setDef({ ...def, name: event.target.value })} className={INPUT} /></Field>
        <Field label="priority"><input aria-label="plugin priority" value={String(def.priority)} onChange={(event) => setDef({ ...def, priority: Number(event.target.value) || 0 })} className={INPUT} /></Field>
        <Field label="description"><input aria-label="plugin description" value={def.description} onChange={(event) => setDef({ ...def, description: event.target.value })} className={INPUT} /></Field>
        <Field label="stage">
          <select aria-label="plugin stage" value={def.stage} onChange={(event) => setDef({ ...def, stage: event.target.value as CustomPluginStage })} className={INPUT}>
            {PLUGIN_STAGES.map((stage) => <option key={stage} value={stage}>{stage}</option>)}
          </select>
        </Field>
        <Field label="match (regex sobre mensaje/diff)"><input aria-label="plugin match" value={def.match} onChange={(event) => setDef({ ...def, match: event.target.value })} className={INPUT} /></Field>
        <Field label="action">
          <select aria-label="plugin action" value={def.action} onChange={(event) => setDef({ ...def, action: event.target.value as CustomPluginAction })} className={INPUT}>
            {PLUGIN_ACTIONS.map((action) => <option key={action} value={action}>{action}</option>)}
          </select>
        </Field>
        <Field label="message / reason"><input aria-label="plugin message" value={def.message} onChange={(event) => setDef({ ...def, message: event.target.value })} className={INPUT} /></Field>
        <Field label="skillName (inject-skill)"><input aria-label="plugin skill" value={def.skillName} onChange={(event) => setDef({ ...def, skillName: event.target.value })} className={INPUT} /></Field>
      </div>

      <div className="flex items-center gap-2 border-t border-hairline px-4 py-3">
        {message ? <p className="text-[12px] text-harness-soft" role="status">{message}</p> : null}
        {!validation.ok ? <p className="text-[12px] text-red-400">{validation.errors.join(" · ")}</p> : null}
        <div className="ml-auto flex items-center gap-2">
          {initial ? (
            <button type="button" onClick={() => void remove()} disabled={busy} className="rounded-control border border-red-500/40 px-3 py-1.5 text-[12px] text-red-400 hover:bg-red-500/10 disabled:opacity-40">Eliminar</button>
          ) : null}
          <button type="button" onClick={() => void save()} disabled={busy || !validation.ok} className="rounded-control bg-harness px-4 py-1.5 text-[12px] font-medium text-white hover:bg-harness-strong disabled:opacity-40">Guardar</button>
        </div>
      </div>
    </Dialog>
  );
}

const INPUT = "w-full rounded-control border border-hairline bg-surface px-2 py-1.5 font-mono text-[12px] text-zinc-200 outline-none focus:border-harness/60";

function Field({ label, children }: { label: string; children: React.ReactNode }): React.ReactElement {
  return (
    <label className="block text-[12px] uppercase tracking-widest text-zinc-500">
      {label}
      <div className="mt-1">{children}</div>
    </label>
  );
}

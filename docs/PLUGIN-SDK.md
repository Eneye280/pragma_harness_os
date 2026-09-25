# PLUGIN-SDK — Pragma Harness OS

Un **plugin** intercepta el pipeline del harness en un `stage` antes o después
del agente. Sirve para **bloquear** (ahorrar costo/riesgo), **transformar** el
mensaje o **inyectar** contexto/skills. Corre en el proceso main de Electron.

## 1. Interfaz

```ts
export type PluginStage = "pre-classify" | "pre-compile" | "pre-agent" | "post-agent";

export interface PluginContext {
  message: string;
  normalized: string;
  sessionId: string;
  workspaceHash: string;
  workspacePath: string;
  intent?: { domain: string; type: string; effort: string; needs: string[]; confidence: number };
  timestamp: number;
  diff?: string;            // sólo en post-agent
  filesChanged?: string[];
  gitClean?: boolean;
}

export type PluginResult =
  | { action: "pass" }
  | { action: "block"; reason: string }
  | { action: "transform"; message: string; injectContext?: string }
  | { action: "inject-skill"; skillName: string };

export interface HarnessPlugin {
  name: string;
  version: string;
  stage: PluginStage;
  priority: number;         // menor = corre antes
  hook(ctx: PluginContext): Promise<PluginResult>;
}
```

## 2. Un plugin en 10 líneas

```ts
import type { HarnessPlugin } from "harness-sdk";

export const noTodoPlugin: HarnessPlugin = {
  name: "no-todo",
  version: "0.1.0",
  stage: "post-agent",
  priority: 50,
  async hook(ctx) {
    if (ctx.diff?.includes("TODO:")) return { action: "block", reason: "no-todo: TODO sin issue" };
    return { action: "pass" };
  },
};
```

## 3. Stages

| Stage | Cuándo corre | Uso típico |
| --- | --- | --- |
| `pre-classify` | antes de clasificar | reglas de admisión, rate-limit |
| `pre-compile` | antes de compilar contexto | ajustar `needs`, forzar dominio |
| `pre-agent` | antes de llamar al LLM | bloquear por secreto/budget/estado de git |
| `post-agent` | tras el diff del agente | calidad de código, políticas de estilo |

## 4. Resultados

| action | efecto |
| --- | --- |
| `pass` | continúa el pipeline |
| `block` | detiene y responde al usuario **sin llamar al LLM** |
| `transform` | reescribe `message` y opcionalmente añade `injectContext` |
| `inject-skill` | añade una skill al bloque compilado (`skillName`) |

## 5. Registrar el plugin

1. Copia `apps/desktop/plugins/_template/` a `apps/desktop/plugins/mi-plugin/`.
2. Implementa `hook` y exporta el plugin.
3. Añádelo a `SEED_PLUGINS` en `apps/desktop/src/main/plugins/registry.ts`.
4. Añade el nombre a `KNOWN_PLUGINS` en `src/shared/settings.ts` para el toggle.

```ts
// registry.ts
import { miPlugin } from "../../../plugins/mi-plugin";
export const SEED_PLUGINS: HarnessPlugin[] = [commitGuard, secretScan, noConsoleLog, miPlugin];
```

El registro respeta `stage` y `priority`; el `SeedPluginRunner` ejecuta sólo los
habilitados según `config.json` (`plugins: { "mi-plugin": true }`).

## 6. Seed plugins incluidos

| Plugin | Stage | Hace |
| --- | --- | --- |
| `commit-guard` | pre-agent | bloquea si hay cambios sin commitear |
| `secret-scan` | pre-agent | bloquea si mensaje/diff parecen contener secretos (`sk-…`, `ghp_…`, `api_key=`, `password=`) |
| `no-console-log` | post-agent | bloquea si el diff agrega `console.log` |

## 7. Probar un plugin

```ts
import { PluginChain } from "../plugin-chain";
const chain = new PluginChain();
chain.register(miPlugin);
const result = await chain.run(ctx, "post-agent");
expect(result.blocked?.plugin).toBe("mi-plugin");
```

Referencia adicional: `apps/desktop/plugins/README.md`.

## 8. Reglas

- `hook` **rápido** y sin efectos destructivos: corre en el hilo del main.
- No lanzar excepciones sin capturar: devuelve `pass` o `block`.
- No esconder secretos en logs.
- Un plugin que siempre bloquea hace inútil el harness — documenta por qué.

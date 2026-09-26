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

## 9. Autoría in-app (v1.0.1)

Además de escribir el plugin a mano, el harness puede crearlo desde **Settings → Plugins → Nuevo plugin**:

- Los plugins declarativos se guardan en `<workspace>/.pragma-harness/plugins/<name>.json` y se cargan en caliente (sin reiniciar).
- Campos: `name` (kebab-case), `description`, `stage` (`pre-classify`|`pre-compile`|`pre-agent`|`post-agent`), `priority`, `match` (regex sobre mensaje **y** diff), `action` (`block`|`transform`|`inject-skill`) y su payload (`message`/`skillName`).
- Al guardar, el plugin queda **activo** por defecto y aparece como toggle en Settings.
- Validación antes de persistir: name kebab-case, regex compilable y payload presente según la acción.

Las **skills** se editan en la misma sección: frontmatter `name/description/triggers/needs/priority` + cuerpo con secciones (`When to use`, `Procedure`, `Rules`, `Done when`). `needs` conecta la skill con las intenciones del classifier para que `SkillCompiler.resolve` la dispare.

### Ejemplo mínimo (declarativo)

```json
{
  "name": "no-todo",
  "description": "Bloquea cambios que dejan TODO",
  "stage": "post-agent",
  "priority": 30,
  "match": "TODO|FIXME",
  "action": "block",
  "message": "quita el TODO antes de seguir"
}
```

## 10. Hot-reload (v1.0.2)

Los plugins declarativos, las skills y los agentes se recargan en caliente: el harness observa
`<ws>/skills`, `<ws>/.pragma-harness/plugins` y `<ws>/.pragma-harness/agents` (debounce 250ms),
invalida cachés y emite `hotreload:changed`; la UI refresca sin reiniciar. También se puede forzar
con `window.harness.hotreload.reload()`.

# Plugins — Pragma Harness OS

Un plugin es un módulo que intercepta el pipeline del harness en un `stage`
antes (`pre-classify`, `pre-compile`, `pre-agent`) o después (`post-agent`)
del agente. Sirve para **bloquear** (ahorrar costo), **transformar** el
mensaje o **inyectar** contexto/skills.

## Interfaz

```ts
import type { HarnessPlugin, PluginContext, PluginResult } from "../../src/main/harness/plugin-chain";

export const miPlugin: HarnessPlugin = {
  name: "mi-plugin",
  version: "0.1.0",
  stage: "pre-agent",
  priority: 50,
  async hook(ctx: PluginContext): Promise<PluginResult> {
    if (ctx.normalized.includes("prohibido")) {
      return { action: "block", reason: "mi-plugin: mensaje no permitido" };
    }
    return { action: "pass" };
  },
};
```

`PluginResult` puede ser:

| action          | efecto                                                      |
| --------------- | ----------------------------------------------------------- |
| `pass`          | continúa el pipeline                                        |
| `block`         | detiene el pipeline y responde al usuario **sin llamar al LLM** |
| `transform`     | reescribe el mensaje (`message`) y opcionalmente inyecta contexto |
| `inject-skill`  | añade una skill al bloque compilado                         |

`ctx` incluye `message`, `normalized`, `sessionId`, `workspacePath`, `intent`
y, para `post-agent`, `diff` y `filesChanged`.

## Seed plugins

- **commit-guard** (`pre-agent`): bloquea si el workspace tiene archivos
  modificados sin commitear.
- **secret-scan** (`pre-agent`): bloquea si el mensaje o el diff contienen
  algo con pinta de secreto (`sk-…`, `ghp_…`, `api_key=`, `password=`).
- **no-console-log** (`post-agent`): bloquea si el diff agrega `console.log`;
  el agente recibe un fix prompt.

## Activar/desactivar

Cada plugin se prende/apaga desde **Settings → Plugins** y se persiste en
`~/.pragma-harness/config.json` (`plugins: { "no-console-log": true, ... }`).

## Crear uno nuevo

1. Copia `plugins/_template/` a `plugins/mi-plugin/`.
2. Implementa `hook` y registra el plugin en
   `apps/desktop/src/main/plugins/registry.ts`.
3. Añade el nombre a `KNOWN_PLUGINS` en `src/shared/settings.ts` para que
   aparezca el toggle en Settings.

> Los plugins corren dentro del proceso main de Electron. Mantén los `hook`
> rápidos y sin efectos secundarios destructivos.

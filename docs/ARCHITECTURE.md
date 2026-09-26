# Arquitectura — Pragma Harness OS

> SPEC v1.0 (frozen). Un dev con acceso al repo debe poder entender el sistema
> leyendo esto, sin preguntar.

## 1. Qué es

Un **control plane de escritorio** (Electron) que envuelve a un agente LLM con
un **harness determinista**: antes de despertar al modelo, clasifica la tarea y
compila reglas, skills, RAG y archivos relevantes; después, verifica con gates.
El agente **no decide qué contexto recibe** — lo decide el harness.

Tesis medible: menos tokens y más retención de contexto al 4º mensaje que un
agente "harness-less" (ver `src/main/harness/benchmark.ts`).

## 2. Diagrama de alto nivel

```
┌──────────────────────────────────────────────────────────────────────┐
│                         Electron (apps/desktop)                        │
│                                                                        │
│  renderer (React 19 + Tailwind 4)          preload (CJS, sandbox)      │
│  ┌────────────────────────────┐            ┌─────────────────────┐    │
│  │ Explorer │ Chat │ Context  │  window.harness  (contextBridge)     │    │
│  │ Terminal │ Plan │ Settings │◄──────────►│ invoke / on(event)  │    │
│  └────────────────────────────┘            └──────────┬──────────┘    │
│                                                        │ IPC           │
│  main (Node) ──────────────────────────────────────────▼───────────   │
│   ┌──────────┐  ┌─────────────────────────── HARNESS ──────────────┐  │
│   │ Settings │  │ ingress → classify → plugin-chain(pre) → rules    │  │
│   │ Cost     │  │   → skills → RAG → context-assemble → pre-gates   │  │
│   │ Explorer │  │   → [ plan gate ] → agent (LLM stream) → tools    │  │
│   │ Terminal │  │   → post-gates → worktree merge → memory/dreaming │  │
│   │ Workspace│  └───────────────────────────────────────────────────┘  │
│   │ EventLog │  SQLite (userData/pragma-harness/harness.db)            │
│   └──────────┘                                                          │
└──────────────────────────────────────────────────────────────────────┘
          │ BYOK (OpenAI-compatible / Anthropic / Ollama / mock)
          ▼
   deepseek / anthropic / openai / ollama / mock
```

## 3. Monorepo

```
apps/desktop        App Electron (main + preload + renderer)
packages/harness-core   Tipos y contrato de eventos del harness
packages/harness-sdk    Interfaz pública para plugins (HarnessPlugin, PluginResult)
packages/ui-tokens      Tokens de diseño compartidos (layout)
skills/             Skills nativas (SKILL.md con frontmatter)
docs/               HANDBOOK / ARCHITECTURE / PLUGIN-SDK (el resto de /docs es local, no se commitea)
```

El main de Electron se empaqueta con `electron-vite`; los módulos nativos
(`better-sqlite3`, `dockerode`, `chokidar`, `simple-git`, `@hono/node-server`,
`electron-updater`) quedan **externos** al bundle y viven en `node_modules`.

## 4. Pipeline del harness (determinista primero)

| Fase | Módulo | Qué produce |
| --- | --- | --- |
| `ingress` | `harness/ingress.ts` | normaliza, extrae `/comandos` y `@menciones` |
| `classify` | `harness/classifier.ts` | `{domain,type,effort,needs,confidence}` |
| `plugin-chain` | `harness/plugin-chain.ts` | pass / block / transform / inject-skill |
| `rules` | `harness/rule-engine.ts` | G1–G10 + estilo + reglas de dominio + AGENTS.md |
| `skills` | `harness/skills/skill-compiler.ts` | resuelve `needs` → SKILL.md → bloque |
| `rag` | `harness/rag.ts` | top-K del índice semántico del workspace |
| `context` | `harness/context-assembler.ts` | prompt final con **budget** y truncado por prioridad |
| `pre-gates` | `gates/*` | secret / budget / schema → `pass \| block` |
| `plan` | `plan/*` | plan-before-execute para tareas de esfuerzo medio/alto |
| `agent` | `llm/gateway.ts` + `chat/chat-service.ts` | streaming del modelo |
| `tools` | `tools/runner.ts` + `workspace/manager.ts` | fileEdit/etc. dentro de un **git worktree** |
| `post-gates` | `postgates/loop.ts` | build/typecheck/lint/tests/security/visual |
| `close` | `workspace/manager.ts` | merge del worktree a `development` |
| `memory` | `memory/vault.ts` + `dreaming/*` | escribe instintos reutilizables |

El **budget de contexto** se mide sobre el prompt final real (no sobre las
partes), y el truncado respeta prioridad: `rules > skills > RAG > files > history`.

## 5. Persistencia y configuración

- **SQLite** (`better-sqlite3` + Drizzle) en `userData/pragma-harness/harness.db`:
  `workspaces`, `sessions`, `events` (append-only con `seq`). `EventLog`
  expone `replay(sessionId)` y `timeTravel(sessionId, index)`.
- **Config** `~/.pragma-harness/config.json` (BYOK, gates, plugins, sandbox).
- **Métricas** `metrics.json` (tokens/USD por día y por dominio).
- **Memoria** vault de instintos, con overrides por entorno.

Overrides para tests/E2E sin tocar el repo:
`HARNESS_WORKSPACE`, `HARNESS_CONFIG_PATH`, `HARNESS_METRICS_PATH`,
`HARNESS_MEMORY_ROOT`.

## 6. Fronteras de confianza y seguridad

- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`.
- **El preload se emite en CJS** (`index.cjs`): con `sandbox` no puede ser ESM.
- Todo pasa por IPC tipado; el renderer nunca toca fs/sqlite directo.
- Pre-gate de **secretos** bloquea antes de llamar al LLM; el diff se escanea
  también en post.
- El agente edita **sólo en un worktree**; el merge a `development` es explícito.
- Sandbox Docker opt-in para ejecución aislada.

## 7. Extension points

1. **Skills** — `skills/<name>/SKILL.md` (ver HANDBOOK §5).
2. **Plugins** — interceptan stages (ver `docs/PLUGIN-SDK.md`).
3. **Providers** — BYOK; `mock` por defecto para desarrollo sin red.

## 8. Testing y CI

- `pnpm -r typecheck` + `pnpm --filter desktop test` (262 tests).
- **Gate de cobertura ≥80%** (lines/functions/branches/statements) acotado al
  núcleo determinista: `harness/**`, `gates/**`, event log, `plugins/registry`,
  `postgates/{loop,phases}`. Comando: `pnpm test:coverage`.
- CI local: `pnpm quality-gate`. CI remoto: `.github/workflows/ci.yml`.
- E2E real por CDP sobre la app construida (keyboard nav, gates, pipeline).

## 9. Release

- `pnpm --filter desktop icons` regenera `build/icon.{png,ico}`.
- `pnpm dist` → NSIS (win), dmg/zip (mac), AppImage (linux) + `latest.yml`.
- Auto-update con `electron-updater` desde GitHub Releases
  (`Eneye280/pragma_harness_os`); deshabilitado en dev.

## 10. ADR (Architecture Decision Records)

| # | Decisión | Razón | Consecuencia |
| --- | --- | --- | --- |
| 01 | Electron + electron-vite + React 19 + Tailwind 4 | un solo binario desktop, HMR rápido, UI productiva | preload obligatorio CJS; `__dirname` vía `fileURLToPath` |
| 02 | Harness-first (determinista antes del LLM) | recorta tokens y estandariza contexto | el agente no elige contexto; hay que mantener el compilador |
| 03 | Event log append-only con replay/time-travel | auditar y depurar sin re-llamar al LLM | eventos inmutables; el replay cubre sólo fases deterministas |
| 04 | Skills como `SKILL.md` con frontmatter | editables sin recompilar, versionables | requieren mapear `needs`→skill en el compiler |
| 05 | Plugins por stages | política extensible sin tocar el core | corren en el main; deben ser rápidos |
| 06 | Git worktree por tarea + merge a `development` | aislar cambios del agente | un worktree por task; merge explícito |
| 07 | BYOK con `mock` por defecto | privacidad y dev sin red | sin API key cae a mock |
| 08 | Gates pre/post bloquean por defecto | evitar coste y deuda | falsos positivos se desactivan en Settings |
| 09 | Vault + "dreaming" de instintos | memoria reutilizable del harness | requiere curaduría; se escribe en close |
| 10 | Cobertura ≥80% sólo del núcleo determinista | proteger el corazón sin inflar el resto | nuevos dirs de test deben entrar al `include` |
| 11 | Auto-update GitHub Releases (electron-updater) | distribución directa | repo privado requiere token/feed accesible |
| 12 | `/docs` local; sólo HANDBOOK/ARCHITECTURE/PLUGIN-SDK whitelisted | planificación privada, docs de usuario versionadas | editar `.gitignore` para nuevos docs públicos |

Detalle de bugs resueltos que no deben reintroducirse:
- Tailwind 4 exige `@tailwindcss/vite` en `electron.vite.config.ts`.
- `ContextAssembler` debe medir el budget sobre el prompt final con scaffolding.
- `plan-builder` no debe capturar stopwords ("módulo **de** reportes").
- `SettingsGateway` no debe devolver vacío en silencio sin API key.

## 11. Freeze

SPEC **v1.0.0**. Cambios de arquitectura → nuevo ADR + bump de versión.

## 12. v1.0.1 — extensiones de arquitectura

Sobre el freeze v1.0.0 se añadieron módulos aislados con contrato compartido y tests propios:

| Área | Módulo (main) | Contrato (shared) | IPC |
| --- | --- | --- | --- |
| Workspace/perfil | `workspace-folder`, `profile` | `workspace`, `profile` | `workspace:*`, `settings:*` |
| Sesiones | `sessions` (JSON repo) | `session` | `sessions:*` |
| Adjuntos | `attachments` (pdf) | `attachments` | `attachments:extractText` |
| Tareas | `shared/task-list` (derivado), `plan-editor` | `task-list`, `plan-editor` | `plan:*` |
| Autoría | `plugins/custom`, `skills/skill-compiler` | `plugin-authoring`, `skill-authoring` | `plugins:*`, `skills:*`, `tasks:*` |
| RAG | `harness/rag` + `rag-handlers` | `rag` | `rag:*` |
| Grafo | `graph/builder` + `graph-service` | `graph` | `graph:*`, evento `graph:updated` |
| Permisos | `tools` (gate) + `approval-broker` | `settings.tools` | `harness:approveTool`, evento `tool-approval` |
| Sandbox | `sandbox` (docker/local) | — | via `ToolRunner.sandboxExecutor` |
| Gate visual | `visual/png` + `visual-gate` | — | `visual:evaluate` |
| Routing/fallback | `llm/fallback` | `routing` | — |
| Uso | `usage/usage-store` | `usage` | `usage:get`, `usage:csv` |
| Diagnóstico | `diagnostics/health` | — | `diagnostics:*` |
| Updater | `updater/feed` | `settings.updater` | `updater:feed` |
| Migración | `migrations/v1_0_1` | `settings` | — |

Principios sostenidos: **determinista antes que LLM**, contratos `shared` tipados, tests por módulo (no solo e2e), y comportamiento *graceful* ante fallos externos (docker ausente, feed 401/404/offline, provider caído → fallback encadenado).

### Persistencia

- Config global: `~/.pragma-harness/config.json` (`configVersion: 2`).
- Perfil por proyecto: `<workspace>/.pragma-harness/profile.json`.
- Sesiones: `<userData>/pragma-harness/sessions/<id>.json`.
- Plugins/tasks/visual del proyecto: `.pragma-harness/{plugins,tasks.json,visual}/`.
- Uso: `usage.jsonl` junto a `metrics.json`.

## 13. Freeze v1.0.1

SPEC **v1.0.1**. Cambios de arquitectura → nuevo ADR + bump de versión.

# QA Matrix — Pragma Harness OS v1.0.1 (expansión)

> Estado de cobertura por **funcionalidad × capa**. `unit` = test determinista en vitest;
> `E2E` = verificado sobre la app real por CDP; `—` = no aplica.

| Funcionalidad | main (unit) | renderer (unit) | IPC schema | E2E |
| --- | --- | --- | --- | --- |
| Workspace / perfil | `profile`, `workspace-folder` | hook `use-workspace` | `workspace:*` | ✅ folder picker/scaffold |
| Sesiones + reanudar | `sessions` (memoria/JSON) | `session-states` | `sessions:*` | ✅ JSON en disco + resume |
| Adjuntos imagen/PDF/texto | `attachments/pdf` | `attachments` | `harness:sendMessage` | ✅ PDF + texto |
| Plan editar/parcial | `plan-editor`, `plan-builder` | `PlanCanvas` | `plan:*` | ✅ aprobar parcial |
| Tareas por mensaje | `task-list` | `MessageTasks` | — | ✅ panel 4/4 |
| Skills autoría + hot-reload | `catalog`, `skill-compiler`, `hotreload` | `SkillEditor` | `skills:*`, `hotreload:*` | ✅ crear y disparar |
| Plugins autoría | `plugins/custom` | `PluginEditor` | `plugins:*` | ✅ `no-todo` bloquea |
| RAG inspector | `harness/rag` | `RagInspector` | `rag:*` | ✅ exclusión cambia hits |
| Grafo dependencias | `graph/builder`, `graph-service` | `GraphPanel` | `graph:*` | ✅ delta en vivo |
| Permisos + aprobación | `tools/runner`, `approval-broker` | `ChatPanel` card | `harness:approveTool` | ✅ ask/deny/allow |
| Sandbox | `sandbox` (docker/local) | — | — | ⚠️ tests; sin daemon |
| Gate visual + evidencia | `visual`, `evidence` | — | `visual:*`, `evidence:save` | ✅ baseline + diff |
| Routing + fallback | `llm/fallback`, `routing` | — | — | ✅ test de cadena |
| Dashboard de uso | `usage/usage-store` | `UsageDashboard` | `usage:*` | ✅ CSV export |
| Diagnóstico / health | `diagnostics/health` | `DiagnosticsPanel` | `diagnostics:*` | ✅ sin secretos |
| Feed privado updater | `updater/feed` | Settings | `updater:feed` | ✅ 401/404/offline |
| Migración config | `migrations/v1_0_1` | — | — | ✅ config v1.0.0→1.0.1 |
| Notificaciones | `notifications` | `NotificationCenter` | — | ✅ toast+badge |
| Código en chat | `chat/code-block` | `CodeBlock` | — | ✅ DeepSeek real |
| Light/Dark | — | `theme` | — | ✅ data-theme + AA |
| Design tokens v2 | — | `tokens`, `contrast` | — | ✅ blur real medido |
| Settings por categorías | — | `SettingsModal` | `settings:*` | ✅ nav + búsqueda |
| Header / sidebars / chat | — | `TitleBar`, `Menu`, shell | — | ✅ capturas |
| Web + citas | `tools/web` | `chat` (badge) | — | ✅ allowlist + tests |
| Guardrail cuelgue | `stuck` | — | — | ✅ reloj inyectable |
| Seguridad + cifrado | `security/crypto`, `key` | — | — | ✅ round-trip AES-GCM |
| Licencias | `licenses/inventory` | — | `licenses:*` | ✅ GPL bloquea |
| Auto-mejora | `learning` | — | `learning:get` | ✅ propuestas |
| QA runner | `shared/qa` | — | `qa:run` | ✅ health scenario |
| QA perfiles Unity | `shared/qa-profiles` | — | — | ✅ uxml/ugui/play/movement |
| Multi-agente | pendiente (#phs86) | — | — | — |
| Telemetría gráficas | pendiente (#phs87) | — | — | — |

## Cómo reproducir

```bash
pnpm quality-gate            # typecheck + coverage del núcleo + tests
pnpm --filter desktop test   # suite completa (497+ tests)
```

E2E por CDP: `%TEMP%\phs-e2e\cdp.mjs` (evaluate y `--shot`) contra la app con `--remote-debugging-port=9222`.

## Huecos conocidos

- **Sandbox Docker**: sin daemon en la máquina de pruebas; validado por unit tests y por la negativa a ejecutar fuera del contenedor.
- **Multi-agente** y **telemetría con gráficas**: se cierran en #phs86 y #phs87.
- Pruebas con **modelo real**: DeepSeek (solo en config temporal; nunca en el repo).

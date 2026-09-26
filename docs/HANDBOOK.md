# HANDBOOK — Pragma Harness OS

Guía de uso. Si sigues esto de arriba a abajo puedes instalar la app,
configurar tu provider, ejecutar una tarea y crear tu propio plugin/skill
**sin preguntar a nadie**.

---

## 1. Requisitos

- **Node ≥ 20** y **pnpm 9.12** (`corepack enable` incluido con Node).
- Git (el harness aísla cada tarea en un worktree).
- Opcional: Docker (sandbox opt-in), una API key de tu provider LLM.

## 2. Instalar y ejecutar

### Desarrollo

```bash
pnpm install
pnpm dev            # electron-vite: main + preload + renderer con HMR
```

### Verificación rápida

```bash
pnpm quality-gate   # typecheck + tests con cobertura ≥80% del núcleo
pnpm --filter desktop test        # 262 tests
pnpm --filter desktop typecheck
```

### Instalador

```bash
pnpm --filter desktop icons       # regenera build/icon.{png,ico}
pnpm dist                         # NSIS (win) · dmg/zip (mac) · AppImage (linux)
```

En Windows genera `apps/desktop/dist/Pragma Harness OS-Setup-<version>.exe`
(instalador per-user, sin admin). Instala en
`%LOCALAPPDATA%\Programs\Pragma Harness OS\` con su desinstalador.
El auto-update lee `latest.yml` desde GitHub Releases; en dev está deshabilitado.

## 3. Primer arranque

1. Aparece un **onboarding de 3 pasos** (Escribe → El harness compila → Aprueba
   y ejecuta). Pulsa **Entendido**; no vuelve a salir (se guarda en el renderer).
2. El panel **Explorer** (izquierda) muestra el workspace activo. Si no hay,
   verás **"No workspace open"** con un botón **Reintentar**.
3. El workspace se resuelve por `HARNESS_WORKSPACE` o por el directorio de
   trabajo. Abre una carpeta de proyecto para navegar archivos reales.

## 4. Configurar el provider (BYOK)

Abre **Settings** (botón en la barra o `Ctrl/Cmd+,`).

- **Provider**: `mock` (por defecto, sin red), `deepseek`, `anthropic`,
  `openai`, `ollama`.
- **API key** (se guarda en `~/.pragma-harness/config.json`, nunca en el repo).
- **Base URL**: opcional, para endpoints OpenAI-compatible/self-hosted.
- **Modelos**: `classifier` (clasifica rápido y barato) y `executor` (redacta).
- **Probar conexión**: valida credenciales antes de trabajar.

Si no hay API key, el harness usa **mock** y todo el pipeline sigue siendo
observable (útil para desarrollar sin gastar).

### Archivo de configuración

`~/.pragma-harness/config.json` (Windows: `%USERPROFILE%\.pragma-harness\config.json`):

```jsonc
{
  "provider": { "provider": "deepseek", "apiKey": "…", "baseURL": "", "models": { "classifier": "deepseek-chat", "executor": "deepseek-chat" } },
  "budget": { "tokensPerDay": 200000, "usdPerDay": 5 },
  "gates": { "pre": { "enabled": true, "secret": true, "budget": true, "schema": true }, "post": { "enabled": true, "build": true, "typecheck": true, "lint": true, "tests": true, "security": true, "visual": false } },
  "plugins": { "commit-guard": true, "secret-scan": true, "no-console-log": true },
  "sandbox": { "enabled": false, "image": "node:20-alpine" }
}
```

## 5. Ejecutar una tarea

1. Escribe en el chat, p. ej. `agrega un endpoint api /users` y pulsa **Enter**.
2. Mira el **Context Panel** (derecha): verás qué compiló el harness
   (rules, skills, RAG, archivos, tokens). Con ese ejemplo resuelve las skills
   `tdd-workflow` y `api-design`.
3. El **Harness Strip** muestra las fases; si el esfuerzo es medio/alto, aparece
   un **plan** en el canvas: **Aprobar / Revisar / Descartar**.
4. El agente ejecuta **tool calls** (p. ej. `fileEdit`) con su **diff inline**,
   dentro de un **git worktree** aislado.
5. Los **post-gates** (build/typecheck/lint/tests/security) corren y, si pasan,
   el worktree se mergea a `development`.
6. Atajos del composer: `Enter` envía · `Shift+Enter` salto de línea ·
   `Ctrl/Cmd+Enter` fuerza ejecución **sin harness**.

### Atajos globales

| Atajo | Acción |
| --- | --- |
| `Ctrl/Cmd+B` | toggle Explorer |
| `Ctrl/Cmd+Shift+C` | toggle Context |
| `Ctrl/Cmd+`` ` `` | toggle Terminal |
| `Ctrl/Cmd+K` | Command palette |
| `Ctrl/Cmd+P` | buscar archivos |
| `Ctrl/Cmd+,` | Settings |

Todo es navegable **sólo con teclado** (focus rings visibles, skip-link,
focus trap en modales, `Esc` cierra).

## 6. Crear una skill

1. Copia `skills/_template/` a `skills/<mi-skill>/`.
2. Rellena el frontmatter:

```markdown
---
name: mi-skill
description: Cuándo debe compilarse esta skill
triggers: [endpoint, api]
priority: 50
---
# Mi Skill
## When to use
## Procedure
## Rules
## Anti-patterns
## Done when
```

3. Mapea un `need` del classifier a la skill en
   `apps/desktop/src/main/harness/skills/skill-compiler.ts` (`NEEDS_TO_SKILL`).
4. El `SkillCompiler` la resolverá y compilará en el bloque pre-agent.

Skills incluidas: `tdd-workflow`, `security-review`, `api-design`.

## 7. Crear un plugin

Ver **[PLUGIN-SDK.md](./PLUGIN-SDK.md)**. Resumen: copia
`apps/desktop/plugins/_template/`, implementa `hook`, regístralo en
`plugins/registry.ts` y añade su nombre a `KNOWN_PLUGINS` para el toggle.

## 8. Presupuesto y costo

- El coste aparece en la barra (`$hoy / $día`) y en Settings.
- El pre-gate de **budget** bloquea si superas `tokensPerDay`/`usdPerDay`.
- Las métricas se persisten en `metrics.json`.

## 9. Actualizaciones

Settings → **Actualizaciones** muestra el estado y permite **Buscar**,
**Descargar** y **Reiniciar e instalar**. El feed es GitHub Releases.

## 10. Variables de entorno (tests/E2E)

| Variable | Efecto |
| --- | --- |
| `HARNESS_WORKSPACE` | fuerza el workspace |
| `HARNESS_CONFIG_PATH` | ruta alternativa de `config.json` |
| `HARNESS_METRICS_PATH` | ruta alternativa de `metrics.json` |
| `HARNESS_MEMORY_ROOT` | raíz del vault de memoria |

## 11. Troubleshooting

| Síntoma | Causa / solución |
| --- | --- |
| Provider no responde | revisa API key/baseURL en Settings → **Probar conexión** |
| "No workspace open" | define `HARNESS_WORKSPACE` o abre una carpeta con archivos |
| Un gate bloquea siempre | desactívalo en Settings → Gates (documenta por qué) |
| `better-sqlite3` no carga en test | es nativo de Electron; se usa el event log en memoria en vitest |
| `pnpm dist` falla extrayendo winCodeSign | symlinks sin privilegio: pre-pobla `%LOCALAPPDATA%\electron-builder\Cache\winCodeSign\winCodeSign-2.6.0` |
| El auto-update no encuentra versión | repo privado: el feed necesita token; el resto de la app funciona igual |

---

¿Nuevo en el código? Lee primero **[ARCHITECTURE.md](./ARCHITECTURE.md)**.

---

## v1.0.1 — qué cambió

Nueve frentes cerrados sobre el freeze v1.0.0:

- **Workspace y perfiles** — folder picker nativo, recientes, `.pragma-harness/profile.json` con provider/gates/plugins/skills/agent/rag/tools/sandbox por proyecto.
- **Sesiones** — persistentes por workspace (JSON en `userData/pragma-harness/sessions`), panel `Sessions`, sesiones concurrentes, stop + *steering* mid-run y **reanudar** tras reiniciar.
- **Adjuntos** — imágenes (thumbnail + descripción), PDF (extractor propio con `zlib`) y texto plano; bandeja con tokens estimados, límites, drag&drop y pegar.
- **Plan** — canvas editable con pasos (incluir/reordenar/añadir/quitar) y **aprobación parcial**; decisión auditada en el event log.
- **Tareas del mensaje** — cada respuesta deriva `Task[]` con estado (pending/in-progress/done/blocked) y panel por mensaje.
- **Autoría** — skills (`SKILL.md` con `needs` para disparo por intención) y plugins declarativos (`stage`/`match`/`action`) desde la UI, sin reiniciar; tareas del proyecto en `.pragma-harness/tasks.json`.
- **RAG** — inspector con documentos, consulta por score, exclusión de rutas persistida en el perfil y reindex full/incremental con progreso.
- **Grafo de dependencias** — imports TS/JS/C#, ciclos y deltas en vivo (chokidar); panel flotante que recuerda posición/colapso por proyecto.
- **Permisos y sandbox** — `askBeforeTools` + política `allow|ask|deny` por tool con presets seguro/autónomo y tarjeta Aprobar/Rechazar/Recordar; sandbox Docker (red off, worktree `:ro`, límites de cpu/memoria) con negativa explícita si el daemon no está.
- **Tools del agente** — `runTests`/`runBuild`/`runLint` reutilizando post-gates y `terminal` con **allowlist**.
- **Gate visual** — diff de PNG contra baseline por umbral (`visual:evaluate`).
- **Routing/fallback de providers**, **dashboard de uso** (por día/sesión/proyecto, harness vs bypass, CSV), **diagnóstico/health** (checks reales + reporte sin secretos) y **feed privado de auto-update** (token/canal/notas, tolerante a 401/404/offline).
- **UX** — design system flotante (tokens de elevación/blur/radio), **docking persistente**, **centro de ayuda con búsqueda + tour contextual**, y migración de config v1.0.0→v1.0.1 idempotente.

### Migración v1.0.0 → v1.0.1

Al arrancar, `SettingsStore` ejecuta `migrateSettingsV1_0_1`: agrega `tools`, `routing`, `updater` y los campos nuevos de `sandbox` **preservando** provider/budget/gates/plugins/skills/agent/workspace, y sella `configVersion: 2`. Es idempotente (una segunda pasada no cambia nada) y nunca pierde valores.

---

## v1.0.2 — expansión de v1.0.1 (22 tasks)

Cierra la lista de mejoras pedida. Lo visible:

- **Diseño**: tokens v2 (glass + neumorfismo sutil), **header reagrupado** con menú `⋯`, **sidebars flotantes**, **chat** con tarjetas glass y bloque de código resaltado con copiar, **settings por categorías** con búsqueda y descripciones, **light/dark**, sombras al 50%.
- **Notificaciones in-app** (toasts + centro + badge) para runs, errores, gates y presupuesto.
- **Código en el chat**: resaltado por lenguaje (TS/JS, C#, GLSL, Lua, SQL, JSON/YAML), diffs `+/-` y botón copiar.
- **Hot-reload** de skills, agentes y plugins (chokidar + invalidación) — sin reiniciar.
- **Reglas**: búsqueda web con **allowlist de docs y citas obligatorias** (aviso "sin fuentes"), **guardrail de cuelgue >10 min**, **seguridad primero + cifrado AES-256-GCM** de la API key en reposo, **licencias** (bloquea copyleft incompatible + `THIRD-PARTY.md`), **evidencia visual** en `.pragma-harness/evidence/` (gitignored), **auto-mejora** (postmortems + propuestas sin auto-aplicar).
- **QA interno**: runner de escenarios (request/expectText/click/type/wait) + **perfiles por stack** (Unity: uxml, uGUI, PlayMode, movimiento; web: DOM y a11y).
- **Terceros** (MCP/Supabase) activables en Settings con prueba de credenciales; **multi-agente en paralelo** (waves con límite de concurrencia); **telemetría** con gráficas (barras, sparkline, donut).

### Migración v1.0.1 → v1.0.2

`migrateSettingsV1_0_2` agrega `integrations` con defaults, preserva todo lo demás y sella `configVersion: 3`. Idempotente. El arranque encadena v1.0.0→v1.0.1→v1.0.2.

---

## v1.0.2.1 — rediseño del shell (iteración UX)

Iteración sobre v1.0.2 enfocada en diseño y claridad, sin tocar el motor:

- **Jerarquía y capas**: un único sistema de overlays (`--phs-z-overlay`/`--phs-z-toast`) y un
  solo nivel de paneles. Menús y popups se **portalizan a `body`**, así nunca quedan detrás del
  contenido (arregla el menú “Más”).
- **Explorer proyecto → sesiones**: el workspace es un **proyecto (folder)**; cada proyecto agrupa
  sus sesiones (`groupSessionsByProject`). Abrir/crear sesión dentro de su folder.
- **Chat con pipeline gráfico**: `PipelineTimeline` dibuja las fases reales (clasificar → reglas →
  skills → contexto → plugins → pre-gates → plan → agente) con estado, detalle y progreso. Se
  eliminó el texto de relleno del provider mock.
- **Context hub**: cada bloque explica en una línea qué hace y permite **crear skills** y
  **reindexar RAG** desde ahí.
- **Command palette real**: registry de comandos del app (nueva sesión, abrir proyecto, paneles,
  vistas, settings, tema) con búsqueda sin acentos y ranking; los archivos siguen disponibles.
- **Notificaciones**: popup flotante tipo palette con margen, agrupado por leídas/no leídas, y
  **mensajes reales** (qué se pidió, tools, fallos, duración) construidos desde los eventos.
- **Settings**: secciones en tarjetas con descripción, **foldouts** (estado recordado) y navegación
  agrupada con búsqueda.
- **Tipografía y sombras**: mínimo **12px** en toda la UI, fuentes del sistema más nítidas, y
  sombras reducidas **35%** respecto de v1.0.2.
- **Campos visibles**: clase `.field` + defaults de `input/select/textarea` con borde de contraste
  AA en claro y oscuro.

### Migración v1.0.2 → v1.0.2.1

`migrateSettingsV1_0_2_1` no añade claves obligatorias: rellena defaults, preserva todo y sella
`configVersion: 4`. Idempotente. El arranque encadena v1.0.0 → v1.0.1 → v1.0.2 → v1.0.2.1.

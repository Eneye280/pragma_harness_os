# Changelog — Pragma Harness OS

> **Fuente única de versión:** `apps/desktop/package.json` + `apps/desktop/src/shared/version.ts`
> (`APP_VERSION`). Ambos deben coincidir y con el tag de git.
>
> **Convención de commits:** `{type}(#{ticket}): descripcion en ingles, lower, imperativo`
> (ver `docs/TASK-PLAN.md` §0). El subject **nunca** lleva `(vX.Y.Z)`: la versión va en el tag, no en el commit.
>
> **Historial de releases:** `v1.0.0 → v1.0.1 → v1.0.2 → v1.0.3`. Las micro-etiquetas `v1.0.2.1`–`v1.0.2.5`
> y `v1.0.8` se retiraron: nunca fueron releases; ese trabajo pertenece a la línea **v1.0.3**.

---

## v1.0.3 — 2026-09-27

Siguiente release tras `v1.0.2`. Agrupa dos bloques.

### A. Trabajo posterior al freeze v1.0.2 (antes mal etiquetado como `1.0.2.1`–`1.0.8`)

Reetiquetado con tickets en la convención del repo:

| Ticket | Contenido |
| ------ | --------- |
| `#phs99` | rediseño del shell + fixes de UX |
| `#phs98` | notificaciones precisas del run (3 commits) |
| `#phs100` | tools, grafo, sidebar y diálogos anidados funcionando |
| `#phs101` | resaltado por lenguaje, acentos, multi-proyecto, archivos, reglas y planes inline |
| `#phs102` | notificaciones con expiración, pin/quitar proyecto, contexto real del proyecto |
| `#phs103` | QA real que corre scripts y captura el HTML renderizado |
| `#phs104` | memoria de agente, tools tolerantes, QA multi-package-manager, gate de QA automático, lint, cobertura, tests de UI, a11y, grafo del plan |

### B. Chat visual y grafo en vivo

Plan: `docs/TASK-PLAN-1.0.3.md` (local, no versionado).

- Dock derecho con tabs **Explorer · Context**; el chat ocupa el resto (ADR-0010, `#phs118`).
- Chat responsive a ancho fluido (`#phs119`).
- Se elimina la barra decorativa del agente (`PipelineRail`) y el `HarnessStrip` muerto (`#phs120`).
- Composer con autosize hasta un máximo (`#phs121`).
- Bloques de código formateados por lenguaje: números de línea, wrap y colapso (`#phs122`).
- Preview de imágenes y adjuntos con lightbox (`#phs123`).
- Contrato `RunGraph` + builder determinista (`#phs124`, ADR-0011).
- Canvas del grafo de ejecución en vivo con iluminación y controles (`#phs125`).
- Modo de chat **Conversación ⇄ Grafo** (`#phs126`).
- QA visual, a11y, docs y release (`#phs127`).

---

## v1.0.2 — 2026-09-25

Módulos de la expansión (hot-reload, notificaciones, código en chat, theme, web + citas, stuck monitor,
seguridad, licencias, evidencia, auto-mejora, QA runner, perfiles de QA, terceros, paralelo, telemetría,
migración). Freeze documentado en `docs/ARCHITECTURE.md` §14–§15 (`configVersion: 3`).

## v1.0.1 — 2026-09-25

Extensiones de arquitectura sobre el freeze v1.0.0 (`configVersion: 2`). Ver `ARCHITECTURE.md` §12–§13.

## v1.0.0 — 2026-09-25

Freeze inicial de la SPEC. Pipeline harness-first completo (ingress → classify → plugins → rules →
skills → RAG → context → pre-gates → plan → agent → tools → post-gates → merge), 33 tasks del
`docs/TASK-PLAN.md`. Ver `ARCHITECTURE.md` §11.

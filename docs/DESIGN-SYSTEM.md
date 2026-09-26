# Pragma Harness OS — Design System

> Fuente única de decisiones visuales. Paleta **morada** fija (`--color-harness #8b5cf6`).
> Combina **Glassmorphism + Minimalismo + Neumorfismo sutil + Skeuomorphism**.
> Tokens en `apps/desktop/src/renderer/styles/globals.css`; constantes TS en
> `apps/desktop/src/renderer/theme/tokens.ts`.

## 1. Principios

1. **Jerarquía antes que decoración**: el tamaño/peso comunica importancia; el blur/sombra solo separan planos.
2. **Glass con intención**: `glass` para superficies flotantes (sidebars, popovers, composer); nunca para texto largo.
3. **Neumorfismo sutil**: solo en controles y contenedores `neumorph`; luz arriba-izq, sombra abajo-der, sin exagerar.
4. **Skeuomorphism mínimo**: imperfecciones reales (highlight interior, borde de 1px) para que los planos "existan".
5. **Coherencia**: mismo radio, mismo spacing, misma escala tipográfica en todo.

## 2. Escala tipográfica

| Token | Uso |
| --- | --- |
| `--phs-text-hero` | título de bienvenida/estado vacío |
| `--phs-text-title` | títulos de sección/panel |
| `--phs-text-subtitle` | subtítulos, encabezado de tarjeta |
| `--phs-text-body` | cuerpo (14px) |
| `--phs-text-label` | etiquetas y navegación |
| `--phs-text-caption` | metadatos, timestamps, ayudas |

Clases: `.text-hero`, `.text-title`, `.text-subtitle`, `.text-body`, `.text-label`, `.text-caption`, `.tracking-label`.

## 3. Espaciado y radios

- Espaciado: `--phs-space-1|2|3|4|6|8` (4/8/12/16/24/32px).
- Radios: `--radius-control` (8), `--radius-panel` (12), `--radius-sheet` (18), `--radius-pill`.

## 4. Superficies

| Clase | Cuándo |
| --- | --- |
| `.glass` | popovers, composer, chips flotantes |
| `.glass-strong` | modales/sheets grandes (Settings, Graph) |
| `.floating-panel` | paneles dockables |
| `.sheet` | diálogos principales |
| `.card` | tarjetas dentro de un panel |
| `.neumorph` | contenedores interactivos (segmented, tiles) |
| `.neumorph-inset` | campos/huecos (inputs tipo pozo) |
| `.elevation-1/2/3` | utilidades de sombra sueltas |

## 5. Movimiento

`--phs-motion-fast` (150ms) y `--phs-motion-base` (200ms) con `--phs-easing`
(`cubic-bezier(0.2, 0.8, 0.2, 1)`). Todo respeta `prefers-reduced-motion: reduce`.

## 6. Accesibilidad

- Contraste **AA** verificado por test (`theme/contrast.ts` + `design-system.test.ts`).
- Foco visible (`:focus-visible`, 2px `--color-harness-soft`).
- Cero interactivos sin nombre accesible (auditoría E2E por CDP).

## 7. Referencias (research)

Inspiración, no copia: superficies flotantes y blur (Glassmorphism), profundidad
sutil (Neumorfismo/Soft UI), bordes reales (Skeuomorphism), y jerarquía limpia
(Apple HIG / Material 3). Las capturas comparativas viven en
`.pragma-harness/evidence/` (ignoradas por git).

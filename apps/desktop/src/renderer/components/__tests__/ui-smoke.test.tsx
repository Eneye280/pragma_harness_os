import { beforeAll, describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { HarnessStepState } from "../../chat/chat-reducer";
import type { PlanProposal } from "@shared/plan";
import type { AppNotification } from "@shared/notifications";
import { PlanChatCard } from "../PlanChatCard";
import { PlanCanvas } from "../PlanCanvas";
import { NotificationCenter } from "../NotificationCenter";
import { CommandPalette } from "../CommandPalette";
import { ExplorerPanel } from "../ExplorerPanel";
import { TelemetryCharts } from "../TelemetryCharts";
import { PipelineTimeline } from "../../chat/PipelineTimeline";
import { CodeBlock } from "../../chat/CodeBlock";
import { QaVerify } from "../../qa/QaVerify";
import { Lightbox } from "../../ui/Lightbox";

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
  };
}

beforeAll(() => {
  (globalThis as unknown as { window: unknown }).window = {
    harness: undefined,
    localStorage: memoryStorage(),
    matchMedia: () => ({ matches: false, addEventListener: () => undefined, removeEventListener: () => undefined }),
  };
});

const render = (element: React.ReactElement): string => renderToStaticMarkup(element);

describe("UI smoke (render)", () => {
  it("renders the plan card with approval actions and intent", () => {
    const plan: PlanProposal = {
      sessionId: "s",
      title: "Plan — calculadora",
      markdown: "# Plan\n\n## Pasos\n1. Crear index.html",
      files: ["index.html"],
      intent: { domain: "web", type: "feature", effort: "medium", needs: ["tdd-workflow"] },
      revised: false,
      createdAt: 0,
    };
    const html = render(<PlanChatCard plan={plan} onApprove={() => undefined} onRevise={() => undefined} onDiscard={() => undefined} />);
    expect(html).toContain("Plan propuesto");
    expect(html).toContain("requiere aprobación");
    expect(html).toContain("Aprobar y ejecutar");
    expect(html).toContain("Editar plan");
    expect(html).toContain("Ver como grafo");
    expect(html).toContain("Descartar");
    expect(html).toContain("web · feature · effort medium");
  });

  it("renders the plan as a connected task graph", () => {
    const plan: PlanProposal = {
      sessionId: "s",
      title: "Plan — calculadora",
      markdown: ["# Plan", "", "## Pensamiento", "- Stack detectado: Web", "", "## Pasos", "1. Crear index.html", "2. Escribir styles.css", "3. Implementar la lógica", "", "## Verificación", "- abre sin errores"].join("\n"),
      files: ["index.html"],
      intent: { domain: "web", type: "feature", effort: "medium", needs: [] },
      revised: false,
      createdAt: 0,
    };
    const html = render(<PlanCanvas plan={plan} />);
    expect(html).toContain("Grafo del plan");
    expect(html).toContain("Pensamiento");
    expect(html).toContain("Crear index.html");
    expect(html).toContain("Implementar la lógica");
    expect(html).toContain("Verificación");
  });

  it("renders notifications with real messages", () => {
    const notification: AppNotification = { id: "1", kind: "error", title: "Tool falló: runTests", message: "3 tests fallaron", source: "tools", ts: Date.now(), read: false };
    const html = render(<NotificationCenter toasts={[notification]} notifications={[notification]} open onClose={() => undefined} onMarkAll={() => undefined} onMarkOne={() => undefined} onDismiss={() => undefined} />);
    expect(html).toContain("Tool falló: runTests");
    expect(html).toContain("3 tests fallaron");
    expect(html).toContain("Notificaciones");
    expect(html).toContain("Marcar todas");
  });

  it("renders the command palette as an action launcher", () => {
    const commands = [
      { id: "new-session", label: "Nueva sesión", hint: "⌘N", group: "run" as const, run: () => undefined },
      { id: "theme-dark", label: "Tema: oscuro", group: "appearance" as const, run: () => undefined },
    ];
    const html = render(<CommandPalette open onClose={() => undefined} commands={commands} files={["a.ts"]} onOpenFile={() => undefined} />);
    expect(html).toContain("Nueva sesión");
    expect(html).toContain("Tema: oscuro");
    expect(html).toContain("a.ts");
  });

  it("renders the explorer with project, sessions and the search box", () => {
    const active = "C:\\repo\\01";
    const explorer = {
      search: "",
      setSearch: () => undefined,
      root: active,
      fileCount: 0,
      visibleNodes: [],
      expanded: new Set<string>(),
      toggleDir: () => undefined,
      refresh: () => undefined,
      loading: false,
      error: null,
      files: [],
    };
    const sessions = [{ id: "s1", title: "hola", workspacePath: active, workspaceHash: "h", createdAt: 0, updatedAt: 0, messageCount: 1 }];
    const html = render(
      <ExplorerPanel
        explorer={explorer as never}
        selectedPath={null}
        onSelectFile={() => undefined}
        onOpenFolder={() => undefined}
        recents={[]}
        onPickRecent={() => undefined}
        activePath={active}
        sessions={sessions}
        currentSessionId="s1"
        runningSessions={[]}
        onOpenSession={() => undefined}
        onNewSession={() => undefined}
      />,
    );
    expect(html).toContain("Buscar sesiones o archivos");
    expect(html).toContain("hola");
    expect(html).toContain("Arrastra archivos aquí");
  });

  it("renders telemetry charts and the pipeline", () => {
    const buckets = [{ day: "2026-09-26", tokens: 10, usd: 0.01, calls: 1, bypassTokens: 0, harnessTokens: 10 }];
    const charts = render(<TelemetryCharts buckets={buckets as never} comparison={{ harness: { tokens: 10 }, bypass: { tokens: 2 } }} />);
    expect(charts).toContain("Harness vs bypass");
    expect(charts).toContain("Tokens por periodo");

    const steps: HarnessStepState[] = [
      { phase: "classify", status: "done", label: "web/feature/medium" },
      { phase: "skills", status: "running", label: "2 skills" },
    ];
    const timeline = render(<PipelineTimeline steps={steps} running />);
    expect(timeline).toContain("Pipeline del harness");
    expect(timeline).toContain("Clasificar la petición");
    expect(timeline).toContain("Ejecutar el agente");
  });

  it("renders code with per-language token classes plus line numbers and wrap control", () => {
    const html = render(<CodeBlock lang="js" content={'const a = "hola"; // nota'} />);
    expect(html).toContain("JS");
    expect(html).toContain("tok-keyword");
    expect(html).toContain("tok-string");
    expect(html).toContain("tok-comment");
    expect(html).toContain("ajustar");
  });

  it("renders the QA verify button", () => {
    const html = render(<QaVerify />);
    expect(html).toContain("Verificar (QA)");
  });

  it("renders the image lightbox with zoom controls", () => {
    const html = render(<Lightbox image={{ src: "data:image/png;base64,AAAA", alt: "captura.png" }} onClose={() => undefined} />);
    expect(html).toContain("captura.png");
    expect(html).toContain("Acercar");
    expect(html).toContain("Alejar");
    expect(html).toContain("Cerrar");
    expect(html).toContain("100%");
  });
});

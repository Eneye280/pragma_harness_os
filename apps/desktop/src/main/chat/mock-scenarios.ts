export interface MockScenario {
  id: string;
  match: RegExp;
  tool: "fileEdit" | "runTests" | "terminal";
  args: Record<string, unknown>;
  intro: string;
}

const CALCULATOR_JS = `function add(a, b) { return a + b; }
function sub(a, b) { return a - b; }
function mul(a, b) { return a * b; }
function div(a, b) {
  if (b === 0) throw new Error("division by zero");
  return a / b;
}

module.exports = { add, sub, mul, div };
`;

const CALCULATOR_TEST = `const test = require("node:test");
const assert = require("node:assert");
const { add, sub, mul, div } = require("./calculator.js");

test("suma", () => assert.strictEqual(add(2, 3), 5));
test("resta", () => assert.strictEqual(sub(10, 4), 6));
test("multiplica", () => assert.strictEqual(mul(6, 7), 42));
test("divide", () => assert.strictEqual(div(9, 3), 3));
test("division por cero falla", () => assert.throws(() => div(1, 0), /division by zero/));
`;

const PACKAGE_JSON = `{
  "name": "calculadora-harness",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "test": "node --test"
  }
}
`;

const CALCULATOR_HTML = `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <title>Calculadora</title>
    <style>
      body { font-family: system-ui, sans-serif; background:#09090b; color:#f4f4f5; display:grid; place-items:center; height:100vh; margin:0; }
      .calc { background:#18181b; padding:16px; border-radius:12px; border:1px solid #27272a; width:260px; }
      .screen { background:#09090b; border:1px solid #27272a; border-radius:8px; padding:10px; text-align:right; font-size:24px; margin-bottom:10px; min-height:34px; }
      .keys { display:grid; grid-template-columns:repeat(4,1fr); gap:8px; }
      button { padding:12px; border-radius:8px; border:1px solid #27272a; background:#27272a; color:#f4f4f5; font-size:16px; cursor:pointer; }
      button.op { background:#8b5cf6; border-color:#7c3aed; }
    </style>
  </head>
  <body>
    <div class="calc">
      <div class="screen" id="screen">0</div>
      <div class="keys">
        <button data-k="7">7</button><button data-k="8">8</button><button data-k="9">9</button><button class="op" data-k="/">÷</button>
        <button data-k="4">4</button><button data-k="5">5</button><button data-k="6">6</button><button class="op" data-k="*">×</button>
        <button data-k="1">1</button><button data-k="2">2</button><button data-k="3">3</button><button class="op" data-k="-">−</button>
        <button data-k="0">0</button><button data-k=".">.</button><button class="op" data-k="=">=</button><button class="op" data-k="+">+</button>
        <button data-k="C" style="grid-column:span 4">C</button>
      </div>
    </div>
    <script>
      const screen = document.getElementById("screen");
      let expr = "";
      const render = () => (screen.textContent = expr || "0");
      document.querySelectorAll("button").forEach((button) =>
        button.addEventListener("click", () => {
          const key = button.dataset.k;
          if (key === "C") { expr = ""; return render(); }
          if (key === "=") {
            try { expr = String(Function("return (" + expr + ")")()); } catch { expr = "error"; }
            return render();
          }
          expr += key;
          render();
        })
      );
    </script>
  </body>
</html>
`;

// Deterministic fixtures for the mock provider (dev only). No LLM required.
export const MOCK_SCENARIOS: MockScenario[] = [
  {
    id: "calculator-js",
    match: /calculator\.js|calculadora\.js|l[oó]gica de la calculadora|l[oó]gica calculadora/i,
    tool: "fileEdit",
    args: { path: "calculator.js", content: CALCULATOR_JS },
    intro: "Escribo la lógica de la calculadora:",
  },
  {
    id: "calculator-test",
    match: /test.*calculadora|calculadora.*test|test.*calculator|calculator.*test|prueba.*calculadora/i,
    tool: "fileEdit",
    args: { path: "calculator.test.js", content: CALCULATOR_TEST },
    intro: "Escribo los tests de la calculadora:",
  },
  {
    id: "package",
    match: /package\.json|package json|manifiesto del proyecto/i,
    tool: "fileEdit",
    args: { path: "package.json", content: PACKAGE_JSON },
    intro: "Creo el package.json:",
  },
  {
    id: "calculator-html",
    match: /calculadora|calculator/i,
    tool: "fileEdit",
    args: { path: "index.html", content: CALCULATOR_HTML },
    intro: "Escribo la calculadora web:",
  },
];

export function matchScenario(prompt: string): MockScenario | null {
  return MOCK_SCENARIOS.find((scenario) => scenario.match.test(prompt)) ?? null;
}

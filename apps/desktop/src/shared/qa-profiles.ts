export interface QaCheck {
  id: string;
  label: string;
  patterns: string[];
  docs: string;
  case: string;
}

export interface QaStackProfile {
  stack: string;
  label: string;
  checks: QaCheck[];
}

export const QA_PROFILES: Record<string, QaStackProfile> = {
  unity: {
    stack: "unity",
    label: "Unity 6",
    checks: [
      {
        id: "uxml",
        label: "UI Toolkit (UXML/USS)",
        patterns: ["\\.uxml\\b", "UnityEngine\\.UIElements", "VisualElement", "\\bUIDocument\\b"],
        docs: "https://docs.unity3d.com/Manual/UIElements.html",
        case: "Abrir la pantalla, validar el árbol UXML y que los USS apliquen sin warnings de layout.",
      },
      {
        id: "ugui",
        label: "uGUI (Canvas/EventSystem)",
        patterns: ["\\bCanvas\\b", "\\bEventSystem\\b", "UnityEngine\\.UI\\b", "\\bGraphicRaycaster\\b"],
        docs: "https://docs.unity3d.com/Manual/UISystem.html",
        case: "Instanciar el Canvas, comprobar EventSystem único y que los botones reciban raycast.",
      },
      {
        id: "play",
        label: "Play mode / PlayMode tests",
        patterns: ["\\bPlayMode\\b", "EditorApplication\\.isPlaying", "\\bPlayModeTest\\b", "RequiresPlayMode"],
        docs: "https://docs.unity3d.com/Manual/testing-editortestsrunner.html",
        case: "Correr los PlayMode tests y verificar que pasa a Play sin excepciones en consola.",
      },
      {
        id: "movement",
        label: "Movimiento del player",
        patterns: ["\\bRigidbody\\b", "\\bCharacterController\\b", "\\bNavMeshAgent\\b", "CharacterMotor", "PlayerController"],
        docs: "https://docs.unity3d.com/Manual/class-Rigidbody.html",
        case: "Mover al player con input y comprobar desplazamiento, fricción y no atravesar colliders.",
      },
    ],
  },
  web: {
    stack: "web",
    label: "Web / Frontend",
    checks: [
      { id: "dom", label: "DOM y rutas", patterns: ["route", "router", "useNavigate"], docs: "https://developer.mozilla.org/en-US/docs/Web/API/Document_Object_Model", case: "Navegar rutas y validar render sin errores." },
      { id: "a11y", label: "Accesibilidad", patterns: ["aria-", "role=", "tabIndex"], docs: "https://developer.mozilla.org/en-US/docs/Web/Accessibility", case: "Auditar nombre accesible y navegación por teclado." },
    ],
  },
};

export function profileFor(stack: string): QaStackProfile | null {
  return QA_PROFILES[stack.trim().toLowerCase()] ?? null;
}

export function suggestCases(stack: string, changedFiles: string[]): Array<{ check: QaCheck; matches: string[] }> {
  const profile = profileFor(stack);
  if (!profile) return [];
  const suggestions: Array<{ check: QaCheck; matches: string[] }> = [];
  for (const check of profile.checks) {
    const regexes = check.patterns.map((pattern) => new RegExp(pattern, "i"));
    const matches = changedFiles.filter((file) => regexes.some((regex) => regex.test(file)) || file.endsWith(".cs"));
    if (matches.length > 0 || changedFiles.length === 0) suggestions.push({ check, matches });
  }
  return suggestions;
}

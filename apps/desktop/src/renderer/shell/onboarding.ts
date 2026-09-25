export const ONBOARDING_STORAGE_KEY = "phs:onboarding:v1";

export interface OnboardingStep {
  title: string;
  body: string;
}

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    title: "1 · Escribe",
    body: "Pide lo que necesitas en lenguaje natural. El agente no arranca todavía.",
  },
  {
    title: "2 · El harness compila",
    body: "Clasifica la tarea y junta reglas, skills, RAG y archivos relevantes antes de llamar al modelo.",
  },
  {
    title: "3 · Aprueba y ejecuta",
    body: "Revisa el plan, apruébalo y observa los tool calls con su diff. Los gates bloquean si algo falla.",
  },
];

export function shouldShowOnboarding(storedValue: string | null): boolean {
  return storedValue !== "done";
}

export function nextOnboardingStep(current: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(current + 1, total - 1);
}

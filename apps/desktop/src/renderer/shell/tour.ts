export interface TourStep {
  id: string;
  panel: string;
  title: string;
  body: string;
  target: string;
}

export const TOUR_STEPS: TourStep[] = [
  { id: "explorer", panel: "explorer", title: "Explorador", body: "Aquí abres archivos y ves el árbol del proyecto.", target: '[aria-label="Explorer"]' },
  { id: "chat", panel: "chat", title: "Chat del harness", body: "Escribe tu petición; el harness compila reglas, skills y contexto antes del agente.", target: 'textarea[aria-label="Mensaje para el harness"]' },
  { id: "context", panel: "context", title: "Contexto", body: "Mira qué compiló el harness: skills, RAG, reglas e instintos.", target: '[aria-label="Context"]' },
];

export interface TourState {
  seen: string[];
  active: boolean;
  stepIndex: number;
}

export const INITIAL_TOUR_STATE: TourState = { seen: [], active: false, stepIndex: 0 };

export const TOUR_STORAGE_KEY = "pragma-harness:tour";

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function pendingSteps(state: TourState, steps: TourStep[] = TOUR_STEPS): TourStep[] {
  return steps.filter((step) => !state.seen.includes(step.id));
}

export function startTour(state: TourState, steps: TourStep[] = TOUR_STEPS): TourState {
  const pending = pendingSteps({ ...state, seen: [] }, steps);
  return { ...state, active: pending.length > 0, stepIndex: 0, seen: [] };
}

export function advanceTour(state: TourState, steps: TourStep[] = TOUR_STEPS): TourState {
  const nextIndex = state.stepIndex + 1;
  if (nextIndex >= steps.length) return { ...state, active: false };
  return { ...state, stepIndex: nextIndex };
}

export function completeTour(state: TourState, steps: TourStep[] = TOUR_STEPS): TourState {
  return { ...state, seen: [...new Set([...state.seen, ...steps.map((step) => step.id)])], active: false, stepIndex: 0 };
}

export function dismissStep(state: TourState, steps: TourStep[] = TOUR_STEPS): TourState {
  const step = steps[state.stepIndex];
  const seen = step ? [...new Set([...state.seen, step.id])] : state.seen;
  const remaining = steps.filter((candidate) => !seen.includes(candidate.id));
  return { ...state, seen, active: remaining.length > 0, stepIndex: 0 };
}

export function loadTourState(storage: StorageLike): TourState {
  try {
    const raw = storage.getItem(TOUR_STORAGE_KEY);
    if (!raw) return INITIAL_TOUR_STATE;
    const parsed = JSON.parse(raw) as Partial<TourState>;
    return { seen: Array.isArray(parsed.seen) ? parsed.seen : [], active: false, stepIndex: 0 };
  } catch {
    return INITIAL_TOUR_STATE;
  }
}

export function saveTourState(storage: StorageLike, state: TourState): void {
  try {
    storage.setItem(TOUR_STORAGE_KEY, JSON.stringify({ seen: state.seen }));
  } catch {
    // ignore storage failures
  }
}

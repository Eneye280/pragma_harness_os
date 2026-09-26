import { describe, expect, it } from "vitest";
import {
  advanceTour,
  completeTour,
  dismissStep,
  loadTourState,
  pendingSteps,
  saveTourState,
  startTour,
  TOUR_STEPS,
  type StorageLike,
} from "../tour";

function memoryStorage(): StorageLike {
  const data: Record<string, string> = {};
  return { getItem: (key) => data[key] ?? null, setItem: (key, value) => { data[key] = value; } };
}

describe("contextual tour", () => {
  it("starts with every step pending", () => {
    const started = startTour({ seen: [], active: false, stepIndex: 0 });
    expect(started.active).toBe(true);
    expect(started.stepIndex).toBe(0);
    expect(pendingSteps(started)).toHaveLength(TOUR_STEPS.length);
  });

  it("advances and ends after the last step", () => {
    let state = startTour({ seen: [], active: false, stepIndex: 0 });
    for (let index = 0; index < TOUR_STEPS.length - 1; index++) state = advanceTour(state);
    expect(state.stepIndex).toBe(TOUR_STEPS.length - 1);
    state = advanceTour(state);
    expect(state.active).toBe(false);
  });

  it("dismisses one step and keeps the rest pending", () => {
    const state = dismissStep(startTour({ seen: [], active: false, stepIndex: 0 }));
    expect(state.seen).toContain(TOUR_STEPS[0].id);
    expect(pendingSteps(state)).toHaveLength(TOUR_STEPS.length - 1);
  });

  it("completes the tour and persists the seen steps", () => {
    const storage = memoryStorage();
    const done = completeTour(startTour({ seen: [], active: false, stepIndex: 0 }));
    saveTourState(storage, done);
    const reloaded = loadTourState(storage);
    expect(reloaded.seen).toHaveLength(TOUR_STEPS.length);
    expect(pendingSteps(reloaded)).toHaveLength(0);
  });

  it("survives corrupt storage", () => {
    const storage: StorageLike = { getItem: () => "{bad", setItem: () => undefined };
    expect(loadTourState(storage).seen).toEqual([]);
  });
});

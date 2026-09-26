import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { decodePng } from "./png";

export interface VisualDiff {
  changed: boolean;
  changedRatio: number;
  threshold: number;
  dimensionMismatch: boolean;
  baselineMissing: boolean;
  width: number;
  height: number;
}

export interface VisualGateResult extends VisualDiff {
  name: string;
  reason: string;
}

const DEFAULT_THRESHOLD = 0.01;

export function comparePngScreenshots(baseline: Buffer, current: Buffer, threshold = DEFAULT_THRESHOLD): VisualDiff {
  const before = decodePng(baseline);
  const after = decodePng(current);
  if (before.width !== after.width || before.height !== after.height) {
    return {
      changed: true,
      changedRatio: 1,
      threshold,
      dimensionMismatch: true,
      baselineMissing: false,
      width: after.width,
      height: after.height,
    };
  }
  const totalPixels = after.width * after.height;
  let changedPixels = 0;
  for (let pixel = 0; pixel < totalPixels; pixel++) {
    const offset = pixel * 4;
    const delta =
      Math.abs(before.rgba[offset] - after.rgba[offset]) +
      Math.abs(before.rgba[offset + 1] - after.rgba[offset + 1]) +
      Math.abs(before.rgba[offset + 2] - after.rgba[offset + 2]) +
      Math.abs(before.rgba[offset + 3] - after.rgba[offset + 3]);
    if (delta > 30) changedPixels += 1;
  }
  const changedRatio = totalPixels === 0 ? 0 : changedPixels / totalPixels;
  return {
    changed: changedRatio > threshold,
    changedRatio: Number(changedRatio.toFixed(4)),
    threshold,
    dimensionMismatch: false,
    baselineMissing: false,
    width: after.width,
    height: after.height,
  };
}

export function visualBaselinePath(workspacePath: string, name: string): string {
  return join(workspacePath, ".pragma-harness", "visual", `${name}.png`);
}

export function evaluateVisual(
  workspacePath: string,
  name: string,
  currentPng: Buffer,
  options: { threshold?: number; updateBaseline?: boolean } = {}
): VisualGateResult {
  const threshold = options.threshold ?? DEFAULT_THRESHOLD;
  const baselinePath = visualBaselinePath(workspacePath, name);
  if (!existsSync(baselinePath)) {
    mkdirSync(dirname(baselinePath), { recursive: true });
    writeFileSync(baselinePath, currentPng);
    return {
      name,
      changed: false,
      changedRatio: 0,
      threshold,
      dimensionMismatch: false,
      baselineMissing: true,
      width: 0,
      height: 0,
      reason: "baseline creado (primera captura)",
    };
  }
  const baseline = readFileSync(baselinePath);
  const diff = comparePngScreenshots(baseline, currentPng, threshold);
  if (options.updateBaseline) writeFileSync(baselinePath, currentPng);
  return {
    name,
    ...diff,
    reason: diff.dimensionMismatch
      ? "dimensiones distintas al baseline"
      : diff.changed
        ? `diff ${(diff.changedRatio * 100).toFixed(2)}% supera el umbral ${(threshold * 100).toFixed(2)}%`
        : `diff ${(diff.changedRatio * 100).toFixed(2)}% dentro del umbral`,
  };
}

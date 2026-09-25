export type UpdateStage =
  | "idle"
  | "disabled"
  | "checking"
  | "available"
  | "not-available"
  | "downloading"
  | "downloaded"
  | "error";

export interface UpdateStatus {
  stage: UpdateStage;
  currentVersion: string;
  version?: string;
  percent?: number;
  message?: string;
  checkedAt: number;
}

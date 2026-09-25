export type WorktreeStatus = "active" | "merged" | "discarded";

export interface WorktreeRecord {
  taskId: string;
  branchName: string;
  worktreePath: string;
  baseBranch: string;
  createdAt: number;
  status: WorktreeStatus;
}

export interface ChangedFileEntry {
  path: string;
  status: string;
}

export interface VerifyReport {
  worktreePath: string;
  branchName: string;
  isClean: boolean;
  changedFiles: ChangedFileEntry[];
}

export interface ConflictPrediction {
  branchName: string;
  baseBranch: string;
  mergeBase: string;
  hasConflicts: boolean;
  conflictingFiles: string[];
}

export interface MergeOutcome {
  branchName: string;
  baseBranch: string;
  mergedCommit: string;
  hadConflicts: boolean;
}

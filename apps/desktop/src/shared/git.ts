export interface GitStatus {
  isRepo: boolean;
  branch: string | null;
  detached: boolean;
  ahead: number;
  behind: number;
  dirty: boolean;
  changedCount: number;
}

export const EMPTY_GIT_STATUS: GitStatus = {
  isRepo: false,
  branch: null,
  detached: false,
  ahead: 0,
  behind: 0,
  dirty: false,
  changedCount: 0,
};

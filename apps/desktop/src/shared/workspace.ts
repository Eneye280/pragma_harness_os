export interface WorkspaceState {
  active: string;
  recents: string[];
}

export interface WorkspacePickResult {
  canceled: boolean;
  state: WorkspaceState;
  error?: string;
}

export interface WorkspaceChangedPayload {
  active: string;
  recents: string[];
}

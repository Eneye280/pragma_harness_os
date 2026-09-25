import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join, resolve } from "path";
import { simpleGit, type SimpleGit } from "simple-git";
import type {
  ChangedFileEntry,
  ConflictPrediction,
  MergeOutcome,
  VerifyReport,
  WorktreeRecord,
  WorktreeStatus,
} from "./types";

export interface WorkspaceManagerOptions {
  worktreeRoot?: string;
  baseBranch?: string;
}

const REGISTRY_FILE = ".pragma-worktrees.json";
const TASK_BRANCH_PREFIX = "harness-task/";

function defaultWorktreeRoot(repoRoot: string): string {
  const fallbackRoot = join(tmpdir(), "pragma-harness-worktrees");
  try {
    const siblingRoot = join(resolve(repoRoot, ".."), `${repoRoot.split(/[\\/]/).pop()}-worktrees`);
    mkdirSync(siblingRoot, { recursive: true });
    return siblingRoot;
  } catch {
    mkdirSync(fallbackRoot, { recursive: true });
    return fallbackRoot;
  }
}

function sanitizeTaskId(taskId: string): string {
  const sanitized = taskId.replace(/[^a-zA-Z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  if (!sanitized) throw new Error("WorkspaceManager: empty task id after sanitize");
  return sanitized.slice(0, 64);
}

function parsePorcelainStatus(porcelainOutput: string): ChangedFileEntry[] {
  return porcelainOutput
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const status = line.slice(0, 2).trim() || "?";
      const path = line.slice(3).trim().replace(/^"(.+)"$/, "$1");
      return { path, status };
    });
}

function extractChangedInBothFiles(mergeTreeOutput: string): string[] {
  const conflictingPaths = new Set<string>();
  const outputLines = mergeTreeOutput.split("\n");
  for (let lineIndex = 0; lineIndex < outputLines.length; lineIndex++) {
    if (outputLines[lineIndex].trim() !== "changed in both") continue;
    for (let lookAhead = 1; lookAhead <= 3 && lineIndex + lookAhead < outputLines.length; lookAhead++) {
      const detailLine = outputLines[lineIndex + lookAhead].trim();
      if (!detailLine.startsWith("our ")) continue;
      const ourTokens = detailLine.split(/\s+/);
      const conflictPath = ourTokens[ourTokens.length - 1];
      if (conflictPath) conflictingPaths.add(conflictPath);
    }
  }
  return [...conflictingPaths];
}

export class WorkspaceManager {
  private readonly repoGit: SimpleGit;
  private readonly worktreeRoot: string;
  private readonly defaultBaseBranch: string;

  constructor(
    private readonly repoRoot: string,
    options: WorkspaceManagerOptions = {}
  ) {
    this.repoGit = simpleGit(resolve(repoRoot));
    this.worktreeRoot = options.worktreeRoot ?? defaultWorktreeRoot(repoRoot);
    mkdirSync(this.worktreeRoot, { recursive: true });
    this.defaultBaseBranch = options.baseBranch ?? "development";
  }

  taskBranchName(taskId: string): string {
    return `${TASK_BRANCH_PREFIX}${sanitizeTaskId(taskId)}`;
  }

  taskWorktreePath(taskId: string): string {
    return join(this.worktreeRoot, sanitizeTaskId(taskId));
  }

  private registryPath(): string {
    return join(this.worktreeRoot, REGISTRY_FILE);
  }

  private readRegistry(): WorktreeRecord[] {
    const registryPath = this.registryPath();
    if (!existsSync(registryPath)) return [];
    try {
      const parsed: unknown = JSON.parse(readFileSync(registryPath, "utf8"));
      if (!Array.isArray(parsed)) return [];
      return parsed as WorktreeRecord[];
    } catch {
      return [];
    }
  }

  private writeRegistry(records: WorktreeRecord[]): void {
    writeFileSync(this.registryPath(), JSON.stringify(records, null, 2), "utf8");
  }

  private upsertRecord(record: WorktreeRecord): void {
    const records = this.readRegistry().filter((entry) => entry.taskId !== record.taskId);
    records.push(record);
    this.writeRegistry(records);
  }

  list(): WorktreeRecord[] {
    return this.readRegistry();
  }

  get(taskId: string): WorktreeRecord | null {
    return this.readRegistry().find((entry) => entry.taskId === sanitizeTaskId(taskId)) ?? null;
  }

  async create(taskId: string, baseBranch?: string): Promise<WorktreeRecord> {
    const sanitizedTaskId = sanitizeTaskId(taskId);
    const resolvedBase = baseBranch ?? this.defaultBaseBranch;
    const branchName = this.taskBranchName(sanitizedTaskId);
    const worktreePath = this.taskWorktreePath(sanitizedTaskId);

    const existingRecord = this.get(sanitizedTaskId);
    if (existingRecord && existingRecord.status === "active" && existsSync(existingRecord.worktreePath)) {
      return existingRecord;
    }

    const preCheckBranches = await this.repoGit.branchLocal();
    if (!preCheckBranches.all.includes(resolvedBase)) {
      throw new Error(`WorkspaceManager: base branch not found: ${resolvedBase} (local: ${preCheckBranches.all.join(", ")})`);
    }

    const prediction = await this.predictMergeConflicts(branchName, resolvedBase).catch(() => null);
    if (prediction && prediction.hasConflicts) {
      throw new Error(
        `WorkspaceManager: refusing worktree for ${branchName}, predicted conflicts with ${resolvedBase}: ${prediction.conflictingFiles.join(", ")}`
      );
    }

    const localBranches = await this.repoGit.branchLocal();
    if (!localBranches.all.includes(branchName)) {
      await this.repoGit.branch([branchName, resolvedBase]);
    }

    if (!existsSync(worktreePath)) {
      await this.repoGit.raw(["worktree", "add", worktreePath, branchName]);
    } else {
      await this.repoGit.raw(["worktree", "add", "--force", worktreePath, branchName]).catch(() => undefined);
    }

    const record: WorktreeRecord = {
      taskId: sanitizedTaskId,
      branchName,
      worktreePath,
      baseBranch: resolvedBase,
      createdAt: Date.now(),
      status: "active",
    };
    this.upsertRecord(record);
    return record;
  }

  async verify(worktreePath: string): Promise<VerifyReport> {
    const worktreeGit = simpleGit(resolve(worktreePath));
    const branchName = (await worktreeGit.revparse(["--abbrev-ref", "HEAD"])).trim();
    const porcelain = await worktreeGit.raw(["status", "--porcelain"]);
    const changedFiles = parsePorcelainStatus(porcelain);
    return { worktreePath: resolve(worktreePath), branchName, isClean: changedFiles.length === 0, changedFiles };
  }

  async predictMergeConflicts(branchName: string, baseBranch?: string): Promise<ConflictPrediction> {
    const resolvedBase = baseBranch ?? this.defaultBaseBranch;
    const localBranches = await this.repoGit.branchLocal();
    if (!localBranches.all.includes(branchName)) {
      const mergeBase = (await this.repoGit.revparse([resolvedBase])).trim();
      return { branchName, baseBranch: resolvedBase, mergeBase, hasConflicts: false, conflictingFiles: [] };
    }
    const mergeBase = (await this.repoGit.raw(["merge-base", resolvedBase, branchName])).trim();
    const mergeTreeOutput = await this.repoGit.raw(["merge-tree", mergeBase, resolvedBase, branchName]);
    const hasConflicts = /<{7} /m.test(mergeTreeOutput);
    const conflictingFiles = hasConflicts ? extractChangedInBothFiles(mergeTreeOutput) : [];
    return {
      branchName,
      baseBranch: resolvedBase,
      mergeBase,
      hasConflicts,
      conflictingFiles: hasConflicts && conflictingFiles.length === 0 ? ["unknown"] : conflictingFiles,
    };
  }

  async merge(taskId: string): Promise<MergeOutcome> {
    const record = this.get(taskId);
    if (!record) throw new Error(`WorkspaceManager: unknown task: ${taskId}`);
    const prediction = await this.predictMergeConflicts(record.branchName, record.baseBranch);
    if (prediction.hasConflicts) {
      throw new Error(`WorkspaceManager: merge blocked, conflicts in: ${prediction.conflictingFiles.join(", ")}`);
    }
    await this.repoGit.checkout(record.baseBranch);
    await this.repoGit.merge([record.branchName, "--no-ff", "-m", `merge(${record.branchName}): integrate task ${record.taskId}`]);
    const mergedCommit = (await this.repoGit.revparse(["HEAD"])).trim();
    await this.removeWorktree(record.branchName, record.worktreePath);
    this.upsertRecord({ ...record, status: "merged" satisfies WorktreeStatus });
    return { branchName: record.branchName, baseBranch: record.baseBranch, mergedCommit, hadConflicts: false };
  }

  async discard(taskId: string): Promise<void> {
    const record = this.get(taskId);
    if (!record) throw new Error(`WorkspaceManager: unknown task: ${taskId}`);
    await this.removeWorktree(record.branchName, record.worktreePath);
    try {
      await this.repoGit.branch(["-D", record.branchName]);
    } catch {
      await this.repoGit.branch(["-d", record.branchName]).catch(() => undefined);
    }
    this.upsertRecord({ ...record, status: "discarded" satisfies WorktreeStatus });
  }

  private async removeWorktree(branchName: string, worktreePath: string): Promise<void> {
    if (existsSync(worktreePath)) {
      await this.repoGit.raw(["worktree", "remove", "--force", worktreePath]).catch(() => undefined);
    }
    await this.repoGit.raw(["worktree", "prune"]).catch(() => undefined);
    void branchName;
  }

  async gc(maxAgeMs: number): Promise<string[]> {
    const now = Date.now();
    const removedTaskIds: string[] = [];
    for (const record of this.readRegistry()) {
      if (record.status !== "active") continue;
      if (now - record.createdAt < maxAgeMs) continue;
      await this.removeWorktree(record.branchName, record.worktreePath);
      try {
        await this.repoGit.branch(["-D", record.branchName]);
      } catch {
        await this.repoGit.branch(["-d", record.branchName]).catch(() => undefined);
      }
      this.upsertRecord({ ...record, status: "discarded" satisfies WorktreeStatus });
      removedTaskIds.push(record.taskId);
    }
    return removedTaskIds;
  }

  scopeToolInput<T extends { workspacePath: string; workspaceHash: string }>(toolInput: T, worktreePath: string): T {
    return { ...toolInput, workspacePath: resolve(worktreePath) };
  }
}

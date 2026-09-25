import { simpleGit } from "simple-git";
import { EMPTY_GIT_STATUS, type GitStatus } from "../../shared/git";

export class GitStatusService {
  async getStatus(workspacePath: string): Promise<GitStatus> {
    try {
      const git = simpleGit(workspacePath);
      if (!(await git.checkIsRepo())) return { ...EMPTY_GIT_STATUS };
      const status = await git.status();
      return {
        isRepo: true,
        branch: status.current,
        detached: !status.current,
        ahead: status.ahead,
        behind: status.behind,
        dirty: !status.isClean(),
        changedCount: status.files.length,
      };
    } catch {
      return { ...EMPTY_GIT_STATUS };
    }
  }
}

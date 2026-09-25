import { existsSync, mkdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import type { ProjectProfile, ProjectProfileInfo } from "../../shared/profile";
import { PROFILE_DIRECTORY, PROFILE_FILENAME } from "../../shared/profile";
import { ProjectProfileSchema } from "./schema";

interface CachedProfile {
  mtimeMs: number;
  profile: ProjectProfile | null;
}

export function profilePath(workspacePath: string): string {
  return join(workspacePath, PROFILE_DIRECTORY, PROFILE_FILENAME);
}

export class ProjectProfileStore {
  private readonly cache = new Map<string, CachedProfile>();

  read(workspacePath: string): ProjectProfile | null {
    const file = profilePath(workspacePath);
    if (!existsSync(file)) {
      this.cache.delete(file);
      return null;
    }
    try {
      const mtimeMs = statSync(file).mtimeMs;
      const cached = this.cache.get(file);
      if (cached && cached.mtimeMs === mtimeMs) return cached.profile;
      const parsedJson: unknown = JSON.parse(readFileSync(file, "utf8"));
      const result = ProjectProfileSchema.safeParse(parsedJson);
      const profile = result.success ? (result.data as ProjectProfile) : null;
      this.cache.set(file, { mtimeMs, profile });
      return profile;
    } catch {
      return null;
    }
  }

  write(workspacePath: string, profile: ProjectProfile): ProjectProfileInfo {
    const file = profilePath(workspacePath);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, `${JSON.stringify(profile, null, 2)}\n`, "utf8");
    this.cache.delete(file);
    return this.info(workspacePath);
  }

  clear(workspacePath: string): ProjectProfileInfo {
    const file = profilePath(workspacePath);
    if (existsSync(file)) unlinkSync(file);
    this.cache.delete(file);
    return this.info(workspacePath);
  }

  info(workspacePath: string): ProjectProfileInfo {
    const profile = this.read(workspacePath);
    return { active: profile !== null, path: profilePath(workspacePath), name: profile?.name ?? null };
  }
}

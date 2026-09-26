import { z } from "zod";
import { ExplorerService } from "./service";

export const ReadFileSchema = z.object({ path: z.string().min(1).max(1024) });

export const WriteFileSchema = z.object({
  path: z.string().min(1).max(1024),
  content: z.string().max(20_000_000),
  encoding: z.enum(["utf8", "base64"]).default("utf8"),
});

export class ExplorerController {
  readonly service: ExplorerService;

  constructor(workspacePath: string) {
    this.service = new ExplorerService(workspacePath);
  }

  get workspacePath(): string {
    return this.service.root;
  }

  getTree() {
    return this.service.getTree();
  }

  readFile(relativePath: string) {
    return this.service.readFile(relativePath);
  }

  writeFile(relativePath: string, content: string, encoding: "utf8" | "base64") {
    return this.service.writeFile(relativePath, content, encoding);
  }
}

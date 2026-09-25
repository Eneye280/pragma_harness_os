import { z } from "zod";
import { ExplorerService } from "./service";

export const ReadFileSchema = z.object({ path: z.string().min(1).max(1024) });

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
}

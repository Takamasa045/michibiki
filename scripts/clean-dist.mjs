import fs from "node:fs/promises";
import path from "node:path";

const workspaceDirs = ["apps", "packages"];

for (const workspaceDir of workspaceDirs) {
  const entries = await fs.readdir(workspaceDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    await fs.rm(path.join(workspaceDir, entry.name, "dist"), {
      recursive: true,
      force: true
    });
  }
}

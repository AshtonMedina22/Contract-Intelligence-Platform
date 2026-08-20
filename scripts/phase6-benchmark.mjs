import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const win = process.platform === "win32";
const python = path.join(root, "services", "processor", ".venv", win ? "Scripts/python.exe" : "bin/python");
if (!existsSync(python)) {
  console.error("Missing processor venv. From services/processor: python -m venv .venv && pip install -e \".[dev]\"");
  process.exit(1);
}
const result = spawnSync(python, ["-m", "pytest"], {
  cwd: path.join(root, "services", "processor"),
  stdio: "inherit",
});
process.exit(result.status ?? 1);

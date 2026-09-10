import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.resolve(scriptDir, "..");
const repoRoot = path.resolve(desktopRoot, "..", "..");
const servicesRoot = path.join(repoRoot, "backend");
const prepareOnly = process.argv.includes("--prepare-only");
const refreshFrontend = process.argv.includes("--refresh-frontend");
const executableSuffix = process.platform === "win32" ? ".exe" : "";
const venvBin = process.platform === "win32"
  ? path.join(servicesRoot, ".venv", "Scripts")
  : path.join(servicesRoot, ".venv", "bin");
const venvPython = path.join(
  venvBin,
  process.platform === "win32" ? "python.exe" : "python",
);

function run(command, args, options = {}) {
  console.log(`[desktop-local] ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, {
    cwd: options.cwd || repoRoot,
    env: options.env || process.env,
    stdio: "inherit",
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`${command} exited with status ${result.status}`);
  }
}

if (!fs.existsSync(venvPython)) {
  run("uv", ["sync", "--project", servicesRoot, "--locked", "--all-extras"]);
}

const requiredBackendBinaries = ["rust_api", "retain-jobsd", "retainpdf-agent"]
  .map((name) => path.join(repoRoot, "target", "release", `${name}${executableSuffix}`));
if (requiredBackendBinaries.some((candidate) => !fs.existsSync(candidate))) {
  run("cargo", [
    "build",
    "--release",
    "--locked",
    "--workspace",
    "--bins",
    "--manifest-path",
    path.join(repoRoot, "Cargo.toml"),
  ]);
}

if (refreshFrontend) {
  const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
  run(npmCommand, ["--prefix", path.join(repoRoot, "frontend", "web"), "run", "build"]);
}

const localEnv = {
  ...process.env,
  PATH: `${venvBin}${path.delimiter}${process.env.PATH || ""}`,
  RETAIN_PDF_SERVICES_ROOT: servicesRoot,
};
run(process.execPath, [path.join(scriptDir, "prepare-app.mjs")], { env: localEnv });

if (!prepareOnly) {
  const electronBinary = process.platform === "win32"
    ? path.join(repoRoot, "node_modules", ".bin", "electron.cmd")
    : path.join(repoRoot, "node_modules", ".bin", "electron");
  run(electronBinary, [desktopRoot], { cwd: desktopRoot, env: localEnv });
}

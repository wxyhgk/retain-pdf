import { spawnSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const desktopRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(desktopRoot, "..");

function runStep(command, args, extraEnv = {}) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    stdio: "inherit",
    env: {
      ...process.env,
      ...extraEnv,
    },
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

runStep("npm", ["--prefix", "frontend", "run", "build:css"]);
runStep("node", ["desktop/scripts/prepare-app.mjs"], {
  RETAIN_PDF_DESKTOP_PLATFORM: "win32",
  RETAIN_PDF_SKIP_BUNDLED_RUNTIME_VERIFICATION: "1",
});


import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const buildOrder = [
  "@retainpdf/contracts",
  "@retainpdf/domain",
  "@retainpdf/ui",
  "@retainpdf/api",
  "@retainpdf/reader",
];

function runNpm(args) {
  const npmCli = process.env.npm_execpath;
  if (npmCli) {
    execFileSync(process.execPath, [npmCli, ...args], {
      cwd: repoRoot,
      stdio: "inherit",
    });
    return;
  }
  execFileSync("npm", args, { cwd: repoRoot, stdio: "inherit" });
}

for (const workspace of buildOrder) {
  runNpm(["run", "build", "--workspace", workspace]);
}

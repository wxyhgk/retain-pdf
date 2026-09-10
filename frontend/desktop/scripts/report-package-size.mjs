import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";


const scriptRoot = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.resolve(scriptRoot, "..");
const artifactExtensions = new Set([".deb", ".dmg", ".exe"]);

function pathSizeBytes(target) {
  if (!fs.existsSync(target)) {
    return 0;
  }
  const stats = fs.lstatSync(target);
  if (stats.isSymbolicLink()) {
    return 0;
  }
  if (stats.isFile()) {
    return stats.size;
  }
  if (!stats.isDirectory()) {
    return 0;
  }
  return fs.readdirSync(target).reduce(
    (total, entry) => total + pathSizeBytes(path.join(target, entry)),
    0,
  );
}

function collectArtifacts(root, results = []) {
  if (!fs.existsSync(root)) {
    return results;
  }
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const target = path.join(root, entry.name);
    if (entry.isDirectory()) {
      collectArtifacts(target, results);
    } else if (entry.isFile() && artifactExtensions.has(path.extname(entry.name).toLowerCase())) {
      results.push(target);
    }
  }
  return results;
}

function formatMiB(bytes) {
  return `${(bytes / (1024 * 1024)).toFixed(2)} MiB`;
}

const rows = [];
for (const relativePath of [
  "app/frontend",
  "app/backend",
  "app/backend/python",
  "app/backend/fonts",
  "app/backend/typst",
  "app/backend/pipeline",
  "app/backend/ai_service",
  "app/backend/bin",
]) {
  const target = path.join(desktopRoot, relativePath);
  if (fs.existsSync(target)) {
    rows.push({ path: relativePath, sizeBytes: pathSizeBytes(target) });
  }
}
for (const outputName of ["mac", "win", "linux"]) {
  const outputRoot = path.join(desktopRoot, outputName);
  for (const artifact of collectArtifacts(outputRoot)) {
    rows.push({
      path: path.relative(desktopRoot, artifact),
      sizeBytes: pathSizeBytes(artifact),
    });
  }
}

for (const row of rows) {
  console.log(`${row.path}\t${formatMiB(row.sizeBytes)}`);
}

const summaryPath = `${process.env.GITHUB_STEP_SUMMARY || ""}`.trim();
if (summaryPath && rows.length > 0) {
  const markdown = [
    "### Desktop package size",
    "",
    "| Path | Size |",
    "| --- | ---: |",
    ...rows.map((row) => `| \`${row.path}\` | ${formatMiB(row.sizeBytes)} |`),
    "",
  ].join("\n");
  fs.appendFileSync(summaryPath, `${markdown}\n`, "utf8");
}

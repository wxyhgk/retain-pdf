import test, { before } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath, pathToFileURL } from "node:url";

const execFileAsync = promisify(execFile);
const REPO_ROOT = fileURLToPath(new URL("../../../../", import.meta.url));
const WEB_ROOT = join(REPO_ROOT, "frontend/web");
const WEB_REACT_ROOT = join(REPO_ROOT, "frontend/web-react");
const READER_ROOT = join(REPO_ROOT, "frontend/packages/reader");
const READER_SOURCE_ROOT = join(READER_ROOT, "src");
const REQUIRED_EXPORTS = [
  ".",
  "./adapters",
  "./boot",
  "./ai",
  "./runtime/ai",
  "./runtime/config",
  "./runtime/content",
  "./runtime/data",
  "./runtime/state",
  "./ai.css",
  "./styles.css",
];
const SOURCE_EXTENSIONS = new Set([".js", ".jsx", ".mjs", ".ts", ".tsx"]);

let readerPackage;
let packedFiles;

function sourceFilesUnder(root) {
  if (!existsSync(root)) return [];
  const pending = [root];
  const files = [];
  while (pending.length > 0) {
    const current = pending.pop();
    const stat = statSync(current);
    if (stat.isDirectory()) {
      for (const entry of readdirSync(current)) pending.push(join(current, entry));
    } else if (SOURCE_EXTENSIONS.has(current.slice(current.lastIndexOf(".")))) {
      files.push(current);
    }
  }
  return files.sort();
}

function exportTargets(value) {
  if (typeof value === "string") return [value];
  if (!value || typeof value !== "object") return [];
  return Object.values(value).flatMap(exportTargets);
}

function importSpecifiers(source) {
  const pattern = /\b(?:import\s*(?:\(|(?:type\s+)?(?:[^"'();]*?\s+from\s+)?)|export\s+(?:type\s+)?[^"';]*?\s+from\s+|require\s*\()\s*["']([^"']+)["']/g;
  return Array.from(source.matchAll(pattern), (match) => match[1]);
}

function resolvesInsideReaderSource(importer, specifier) {
  if (!specifier.startsWith(".")) return false;
  const target = resolve(dirname(importer), specifier);
  return target === READER_SOURCE_ROOT || target.startsWith(`${READER_SOURCE_ROOT}${sep}`);
}

before(async () => {
  readerPackage = JSON.parse(readFileSync(join(READER_ROOT, "package.json"), "utf8"));
  const { stdout } = await execFileAsync("npm", ["pack", "--dry-run", "--json"], {
    cwd: READER_ROOT,
    timeout: 120_000,
    maxBuffer: 10 * 1024 * 1024,
  });
  const [packResult] = JSON.parse(stdout);
  packedFiles = new Set(packResult.files.map(({ path }) => path));
});

test("reader package exports only built, packed public entrypoints", () => {
  assert.ok(readerPackage.exports, "frontend/packages/reader/package.json must define exports");

  for (const exportName of REQUIRED_EXPORTS) {
    assert.ok(
      Object.hasOwn(readerPackage.exports, exportName),
      `missing public export ${exportName}`,
    );

    const targets = exportTargets(readerPackage.exports[exportName]);
    assert.ok(targets.length > 0, `${exportName} must resolve to at least one file`);
    for (const target of targets) {
      assert.ok(target.startsWith("./"), `${exportName} target must be package-relative: ${target}`);
      assert.ok(!target.startsWith("./src/"), `${exportName} must not expose source files: ${target}`);
      assert.ok(existsSync(join(READER_ROOT, target)), `${exportName} target missing after build: ${target}`);
      assert.ok(packedFiles.has(target.slice(2)), `${exportName} target missing from npm pack: ${target}`);
    }
  }

  const styleTargets = ["./ai.css", "./styles.css"]
    .flatMap((exportName) => exportTargets(readerPackage.exports[exportName]))
    .filter((target) => target.endsWith(".css"));
  assert.equal(styleTargets.length, 2, "reader must publish full and AI-only compiled CSS");
  for (const target of styleTargets) {
    const css = readFileSync(join(READER_ROOT, target), "utf8");
    assert.doesNotMatch(
      css,
      /@(import|tailwind|theme|custom-variant|utility|apply|source|layer)\b/,
      `${target} still contains an uncompiled Tailwind directive`,
    );
  }
});

test("importing Reader root and runtime exports does not require or mutate the DOM", async () => {
  const importUrls = [
    ".",
    "./runtime/ai",
    "./runtime/config",
    "./runtime/content",
    "./runtime/data",
    "./runtime/state",
  ].map((exportName) => {
    const packageExport = readerPackage.exports[exportName];
    const target = typeof packageExport === "string" ? packageExport : packageExport.import;
    assert.equal(typeof target, "string", `${exportName} needs an import target`);
    return pathToFileURL(join(READER_ROOT, target)).href;
  });
  const probe = [
    "assertNoDom();",
    "for (const entryUrl of process.argv.slice(1)) await import(entryUrl);",
    "assertNoDom();",
    "function assertNoDom() {",
    "  if ('document' in globalThis || 'window' in globalThis) {",
    "    throw new Error('reader root import created or required browser globals');",
    "  }",
    "}",
  ].join("\n");

  await execFileAsync(process.execPath, ["--input-type=module", "--eval", probe, ...importUrls], {
    cwd: REPO_ROOT,
    timeout: 30_000,
    maxBuffer: 10 * 1024 * 1024,
  });
});

test("production consumers do not deep-link into frontend/packages/reader/src", () => {
  const files = [
    ...sourceFilesUnder(join(WEB_ROOT, "src")),
    ...sourceFilesUnder(join(WEB_REACT_ROOT, "src")),
  ];
  const offenders = files.flatMap((file) => importSpecifiers(readFileSync(file, "utf8"))
    .filter((specifier) => resolvesInsideReaderSource(file, specifier))
    .map((specifier) => `${relative(REPO_ROOT, file)} -> ${specifier}`));

  assert.deepEqual(offenders, []);

  // Reader 宿主适配层已随按功能重组迁至 src/features/reader/domain/host。
  const hostRoot = join(WEB_ROOT, "src/features/reader/domain/host");
  assert.deepEqual(
    sourceFilesUnder(hostRoot).map((file) => relative(hostRoot, file)),
    ["ai.ts", "config.ts", "content.ts", "data.ts", "state.ts"],
    "frontend/web must keep exactly five Reader host adapter entries",
  );

  for (const configFile of [
    join(WEB_ROOT, "scripts/build-js-bundle.mjs"),
    join(WEB_REACT_ROOT, "vite.config.ts"),
  ].filter((file) => existsSync(file))) {
    assert.doesNotMatch(
      readFileSync(configFile, "utf8"),
      /packages\/reader\/src/,
      `${relative(REPO_ROOT, configFile)} must resolve Reader through package exports`,
    );
  }
});

test("reader changes trigger downstream workflows and CI typecheck", () => {
  const triggerCounts = new Map([
    ["publish-current-web.yml", 1],
    ["desktop-frontend-sync.yml", 2],
  ]);
  for (const [workflowName, expectedCount] of triggerCounts) {
    const source = readFileSync(join(REPO_ROOT, ".github/workflows", workflowName), "utf8");
    const matches = source.match(/^\s*-\s+["']?frontend\/packages\/reader\/\*\*["']?\s*$/gm) ?? [];
    assert.equal(
      matches.length,
      expectedCount,
      `${workflowName} must trigger for frontend/packages/reader/** in every push/PR path filter`,
    );
  }

  const testsWorkflow = readFileSync(join(REPO_ROOT, ".github/workflows/tests.yml"), "utf8");
  assert.match(
    testsWorkflow,
    /npm\s+--prefix\s+frontend\/packages\/reader\s+run\s+typecheck/,
    "tests.yml must run the reader typecheck",
  );
});

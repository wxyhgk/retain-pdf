import test, { before } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath, pathToFileURL } from "node:url";

import { importSpecifiers } from "../helpers/source-text.mjs";

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
  "./contracts",
  "./runtime/config",
  "./runtime/content",
  "./runtime/data",
  "./runtime/state",
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

// 从 vite.config.ts 文本解析 build.lib.entry 的 <entryKey, 源码路径> 表。
// 不 import 配置(会执行 defineConfig),只按文本解析,门禁保持只读。
function parseViteEntrySources(configText) {
  const entryAt = configText.indexOf("entry:");
  assert.ok(entryAt !== -1, "reader/vite.config.ts must declare build.lib.entry");
  const openAt = configText.indexOf("{", entryAt);
  assert.notEqual(openAt, -1, "reader/vite.config.ts build.lib.entry must be an object literal");
  let depth = 0;
  let closeAt = -1;
  for (let i = openAt; i < configText.length; i += 1) {
    if (configText[i] === "{") depth += 1;
    else if (configText[i] === "}") {
      depth -= 1;
      if (depth === 0) {
        closeAt = i;
        break;
      }
    }
  }
  assert.notEqual(closeAt, -1, "reader/vite.config.ts build.lib.entry object is unclosed");
  const block = configText.slice(openAt + 1, closeAt);
  const entries = new Map();
  const pattern = /(?:"([^"]+)"|'([^']+)'|([A-Za-z0-9_./-]+))\s*:\s*path\.resolve\(\s*__dirname\s*,\s*["']([^"']+)["']\s*\)/g;
  for (const match of block.matchAll(pattern)) {
    entries.set(match[1] ?? match[2] ?? match[3], match[4]);
  }
  return entries;
}

// Soft navigation is shared implementation, not a host adapter: the package
// has no public navigation subpath yet and its dist is frozen, so
// @retainpdf/reader exposes soft-reader as source and the web shell re-exports
// it. Every other Reader deep-link stays forbidden.
const SHARED_NAVIGATION_ALLOWLIST = new Set([
  join(READER_SOURCE_ROOT, "shared/navigation/soft-reader.js"),
  join(READER_SOURCE_ROOT, "shared/navigation/soft-reader.ts"),
]);

function resolvesInsideReaderSource(importer, specifier) {
  if (!specifier.startsWith(".")) return false;
  const target = resolve(dirname(importer), specifier);
  if (SHARED_NAVIGATION_ALLOWLIST.has(target)) return false;
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

  const styleTargets = ["./styles.css"]
    .flatMap((exportName) => exportTargets(readerPackage.exports[exportName]))
    .filter((target) => target.endsWith(".css"));
  assert.equal(styleTargets.length, 1, "reader must publish its compiled CSS");
  for (const target of styleTargets) {
    const css = readFileSync(join(READER_ROOT, target), "utf8");
    assert.doesNotMatch(
      css,
      /@(import|tailwind|theme|custom-variant|utility|apply|source|layer)\b/,
      `${target} still contains an uncompiled Tailwind directive`,
    );
  }
});

test("reader exports align with vite build entries and resolve into dist", () => {
  const configText = readFileSync(join(READER_ROOT, "vite.config.ts"), "utf8");
  const entrySources = parseViteEntrySources(configText);
  assert.ok(entrySources.size > 0, "vite.config.ts parsed no build.lib.entry sources");

  const problems = [];
  const exportedEntryKeys = new Set();
  for (const [exportName, value] of Object.entries(readerPackage.exports)) {
    // 纯 CSS 子路径由 tailwind 单独产出,不经 vite lib entry。
    if (typeof value === "string") continue;
    if (!value || typeof value !== "object" || typeof value.import !== "string") {
      problems.push(`${exportName} 缺少 import 目标`);
      continue;
    }
    if (!value.import.startsWith("./dist/")) {
      problems.push(`${exportName} 的 import 必须指向 dist/**:${value.import}`);
    }
    const entryKey = value.import.replace(/^\.\/dist\//, "").replace(/\.[^./]+$/, "");
    exportedEntryKeys.add(entryKey);
    const source = entrySources.get(entryKey);
    if (source === undefined) {
      problems.push(`${exportName} -> ${value.import} 在 vite.config.ts 无对应 entry "${entryKey}"`);
      continue;
    }
    if (!existsSync(join(READER_ROOT, source))) {
      problems.push(`${exportName} 的 vite 源码入口不存在:${source}`);
    }
  }

  const orphanEntries = [...entrySources.keys()].filter((key) => !exportedEntryKeys.has(key));
  if (orphanEntries.length > 0) {
    problems.push(`vite entry 未作为公开子路径导出:${orphanEntries.join(", ")}`);
  }

  assert.deepEqual(problems, [], `reader exports 与 vite entry 不齐:\n${problems.join("\n")}`);
});

test("importing Reader root and runtime exports does not require or mutate the DOM", async () => {
  const importUrls = [
    ".",
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

test("Reader live translation implementation depends on package contracts, not API transport", () => {
  const migratedFiles = [
    "hooks/use-live-translation.ts",
    "shared/data/live-translation-state.ts",
    "pdf/LiveTranslationOverlay.tsx",
    "pdf/PdfPageSlot.tsx",
  ];
  const offenders = migratedFiles.flatMap((relativePath) => {
    const file = join(READER_SOURCE_ROOT, relativePath);
    return importSpecifiers(readFileSync(file, "utf8"))
      .filter((specifier) => specifier === "@retainpdf/api/live-translation")
      .map((specifier) => `${relativePath} -> ${specifier}`);
  });
  assert.deepEqual(offenders, []);
});

// 这里曾有三条守 AI 问答面板的端口边界（ask / conversation / operation）。那个
// 面板整个删了，三条也跟着走。留个记号是因为第三条当时**是空过的**：它遍历
// components/react-pdf/assistant 目录找越界 import，目录删掉之后 sourceFilesUnder
// 返回空数组，assert.deepEqual([], []) 恒真 —— 功能没了它照样绿。

test("session hooks consume the dedicated SessionDataPort accessor", () => {
  for (const relativePath of [
    "hooks/reader-session/session-assets.ts",
    "hooks/reader-session/job-status.ts",
    "hooks/use-reader-session.ts",
  ]) {
    const source = readFileSync(join(READER_SOURCE_ROOT, relativePath), "utf8");
    assert.match(source, /readerSessionDataPort/);
    assert.doesNotMatch(source, /defaultReaderDataPort/);
  }
});

test("PDF implementation consumes the dedicated PDF port accessor", () => {
  for (const relativePath of [
    "pdf/useProtectedPdfFile.ts",
    "pdf/setup-react-pdf.ts",
    "pdf/PdfDocumentPane.tsx",
  ]) {
    const source = readFileSync(join(READER_SOURCE_ROOT, relativePath), "utf8");
    assert.match(source, /readerPdfPort/);
    assert.doesNotMatch(source, /import \{ (?:fetchProtected|resolvePdfjsVendorUrl) \} from "\.\.\/external\.js"/);
  }
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
    ["config.ts", "content.ts", "data.ts", "state.ts"],
    "frontend/web must keep exactly four Reader host adapter entries",
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

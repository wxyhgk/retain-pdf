// 只跑和这次改动有关的前端测试（npm run test:changed）。
//
// 2026-11-22 用户：改一个链接也要跑全部 2000 多个测试、机器忙时十几分钟，不合理。
// 全量照旧由 CI 在 main 上跑；本地合并前用这个。
//
// 怎么挑：
// 1. 改了哪些文件：和 --base（默认 origin/main 的合并基点）比，再加上工作区里没提交、没跟踪的文件。
// 2. 顺着 import 往回找：测试 import 源码、源码再 import 别的，谁一路用到了改过的文件就跑谁。
//    @/ 别名、相对路径、.js→.ts/.tsx、目录 index 都认；@retainpdf/<包> 指向整个包目录
//    （测试拿的是包的 dist，包里任何文件改了都算）。
// 3. 测试里直接写了改过的文件路径的也跑（按路径读源码文本的那类测试）。
// 4. 改了源码或样式就总跑 tests/architecture（它们扫全部源码，很快）。
// 5. 选不准就跑全量：改了测试加载器、package.json、lockfile、tsconfig、构建包的脚本，
//    或者挑出来的超过全部测试的七成。
//
// 用法：
//   npm run test:changed                 先 prepare:workspace，再跑挑出来的测试
//   node scripts/pick-tests.mjs --list   只列出挑了哪些、为什么，不跑
//
// 文件名不能叫 test-*.mjs：node --test 的默认匹配会把它当成测试文件跑（2026-11-22 叫 test-changed.mjs 时，
// 全量 npm test 会顺带执行它、再起一轮测试）。下面也拦了一道：在测试运行器里被加载时不执行。
//   --base <ref>                         和哪个提交比（默认 origin/main，没有就 main）
//   --all                                直接跑全量
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { importSpecifiers } from "../tests/helpers/source-text.mjs";

const WEB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const REPO_ROOT = resolve(WEB_ROOT, "../..");

/** 改了这些就跑全量：测试加载、依赖、编译设置一变，哪个测试都可能受影响。 */
export const FULL_RUN_TRIGGERS = [
  /^frontend\/web\/tests\/helpers\/(register-jsx|jsx-loader)\.mjs$/,
  /^frontend\/web\/package\.json$/,
  /^package(-lock)?\.json$/,
  /^frontend\/web\/tsconfig[^/]*\.json$/,
  /^frontend\/web\/scripts\/build-workspace-packages\.mjs$/,
  /^frontend\/packages\/[^/]+\/(package\.json|tsconfig[^/]*\.json)$/,
];

/** 挑出来的超过全部测试的这个比例，就直接跑全量。 */
export const FULL_RUN_RATIO = 0.7;

const CODE_EXT = /\.(ts|tsx|js|jsx|mjs)$/;
const RESOLVE_ORDER = {
  ".js": [".ts", ".tsx", ".js", ".jsx"],
  ".jsx": [".tsx", ".jsx"],
  ".mjs": [".mjs", ".mts"],
  ".ts": [".ts", ".tsx"],
  ".tsx": [".tsx"],
  "": [".ts", ".tsx", ".js", ".jsx", ".mjs"],
};

const toPosix = (path) => path.split(sep).join("/");
const repoPath = (abs, root = REPO_ROOT) => toPosix(relative(root, abs));

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === "dist" || name.startsWith(".")) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (CODE_EXT.test(name)) out.push(full);
  }
  return out;
}

/** 工作区里的包：@retainpdf/<名字> → 包目录（仓库相对）。 */
export function workspacePackages(root = REPO_ROOT) {
  const dirs = [
    ...readdirSync(join(root, "frontend/packages")).map((name) => join(root, "frontend/packages", name)),
    join(root, "contracts"),
  ];
  const packages = new Map();
  for (const dir of dirs) {
    const manifest = join(dir, "package.json");
    if (!existsSync(manifest)) continue;
    const name = JSON.parse(readFileSync(manifest, "utf8")).name;
    if (name) packages.set(name, repoPath(dir, root));
  }
  return packages;
}

function resolveFile(base) {
  const ext = extname(base);
  const stem = ext && RESOLVE_ORDER[ext] ? base.slice(0, -ext.length) : base;
  for (const candidate of RESOLVE_ORDER[RESOLVE_ORDER[ext] ? ext : ""]) {
    const hit = `${stem}${candidate}`;
    if (existsSync(hit) && statSync(hit).isFile()) return hit;
  }
  if (existsSync(base) && statSync(base).isFile()) return base;
  if (existsSync(base) && statSync(base).isDirectory()) {
    for (const index of ["index.ts", "index.tsx", "index.js", "index.mjs"]) {
      if (existsSync(join(base, index))) return join(base, index);
    }
  }
  return null;
}

/**
 * 一个 import 说明符指向什么：仓库相对的文件路径，或者 "pkg:<包目录>"（整个工作区包）。
 * 第三方包、node: 内置、认不出的返回 null。
 */
export function resolveSpecifier(specifier, fromFile, { root = REPO_ROOT, packages = workspacePackages(root) } = {}) {
  if (specifier.startsWith("@/")) {
    const hit = resolveFile(join(root, "frontend/web/src", specifier.slice(2)));
    return hit ? repoPath(hit, root) : null;
  }
  if (specifier.startsWith("./") || specifier.startsWith("../")) {
    const hit = resolveFile(resolve(dirname(fromFile), specifier));
    return hit ? repoPath(hit, root) : null;
  }
  const scoped = specifier.match(/^(@retainpdf\/[^/]+)/);
  if (scoped && packages.has(scoped[1])) return `pkg:${packages.get(scoped[1])}`;
  return null;
}

/** 每个文件直接依赖谁（文件路径或 pkg:<目录>）。扫 web 的 src、tests 和各工作区包的源码。 */
export function buildDependencyIndex(root = REPO_ROOT) {
  const packages = workspacePackages(root);
  const files = [
    ...walk(join(root, "frontend/web/src")),
    ...walk(join(root, "frontend/web/tests")),
    ...[...packages.values()].flatMap((dir) => walk(join(root, dir, "src"))),
  ];
  const deps = new Map();
  for (const file of files) {
    const targets = new Set();
    for (const specifier of importSpecifiers(readFileSync(file, "utf8"))) {
      const target = resolveSpecifier(specifier, file, { root, packages });
      if (target) targets.add(target);
    }
    deps.set(repoPath(file, root), targets);
  }
  return { deps, packages };
}

/** 一个改过的文件会被哪些依赖节点认出来：它自己，以及它所在的工作区包。 */
function nodesForChange(path, packages) {
  const nodes = [path];
  for (const dir of packages.values()) {
    if (path === dir || path.startsWith(`${dir}/`)) nodes.push(`pkg:${dir}`);
  }
  return nodes;
}

/** 测试文本里认这些写法：仓库相对路径、web 相对路径（src/...），带不带扩展名都算。 */
function mentionKeys(path) {
  const keys = new Set([path]);
  if (path.startsWith("frontend/web/")) keys.add(path.slice("frontend/web/".length));
  for (const key of [...keys]) {
    const ext = extname(key);
    if (ext) keys.add(key.slice(0, -ext.length));
  }
  return [...keys].filter((key) => key.includes("/"));
}

/**
 * 按改动挑测试。返回 { mode: "full" | "selected" | "none", tests, reasons }。
 * tests 是仓库相对路径；reasons 是 测试 → 为什么选它。
 */
export function selectTests(changed, { root = REPO_ROOT, index = buildDependencyIndex(root), readText } = {}) {
  const read = readText || ((path) => readFileSync(join(root, path), "utf8"));
  const { deps, packages } = index;
  const allTests = [...deps.keys()].filter((path) => path.startsWith("frontend/web/tests/") && path.endsWith(".test.mjs")).sort();
  const trigger = changed.find((path) => FULL_RUN_TRIGGERS.some((pattern) => pattern.test(path)));
  if (trigger) return { mode: "full", tests: allTests, reasons: new Map(), why: `改了 ${trigger}` };

  // 反向图：谁依赖了这个节点。包节点 pkg:<目录> 依赖它目录下的每个文件。
  const dependents = new Map();
  const link = (from, to) => {
    if (!dependents.has(to)) dependents.set(to, new Set());
    dependents.get(to).add(from);
  };
  for (const [file, targets] of deps) {
    for (const target of targets) link(file, target);
    for (const node of nodesForChange(file, packages)) if (node !== file) link(node, file);
  }

  const reasons = new Map();
  const note = (test, why) => { if (!reasons.has(test)) reasons.set(test, why); };
  for (const path of changed) {
    if (allTests.includes(path)) note(path, "测试本身改了");
    const seen = new Set();
    const queue = nodesForChange(path, packages);
    while (queue.length) {
      const node = queue.shift();
      if (seen.has(node)) continue;
      seen.add(node);
      if (allTests.includes(node) && node !== path) note(node, `import 链用到 ${path}`);
      for (const parent of dependents.get(node) || []) queue.push(parent);
    }
  }

  const textChanged = changed.filter((path) => !allTests.includes(path));
  if (textChanged.length) {
    for (const test of allTests) {
      if (reasons.has(test)) continue;
      const text = read(test);
      const hit = textChanged.find((path) => mentionKeys(path).some((key) => text.includes(key)));
      if (hit) note(test, `测试里写了 ${hit} 的路径`);
    }
  }

  const touchesFrontend = changed.some((path) => /^frontend\/(web\/src|packages\/[^/]+\/(src|styles))\//.test(path)
    || /^frontend\/web\/styles?\b/.test(path));
  if (touchesFrontend) {
    for (const test of allTests.filter((path) => path.startsWith("frontend/web/tests/architecture/"))) {
      note(test, "改了源码或样式，架构门禁总跑");
    }
  }

  const tests = [...reasons.keys()].sort();
  if (!tests.length) return { mode: "none", tests, reasons };
  if (tests.length > allTests.length * FULL_RUN_RATIO) {
    return { mode: "full", tests: allTests, reasons, why: `挑出 ${tests.length}/${allTests.length} 个，超过七成` };
  }
  return { mode: "selected", tests, reasons };
}

function git(args) {
  return execFileSync("git", args, { cwd: REPO_ROOT, encoding: "utf8" }).trim();
}

/** 和 base 比改过的文件，加上工作区里没提交、没跟踪的（仓库相对路径，删掉的也算）。 */
export function changedFiles(base) {
  const ref = base || (spawnSync("git", ["rev-parse", "--verify", "-q", "origin/main"], { cwd: REPO_ROOT }).status === 0 ? "origin/main" : "main");
  const mergeBase = git(["merge-base", ref, "HEAD"]);
  const lines = [
    git(["diff", "--name-only", `${mergeBase}...HEAD`]),
    git(["diff", "--name-only", "HEAD"]),
    git(["ls-files", "--others", "--exclude-standard"]),
  ].join("\n");
  return { ref, files: [...new Set(lines.split("\n").map((line) => line.trim()).filter(Boolean))].sort() };
}

function main(argv) {
  const list = argv.includes("--list");
  const baseIndex = argv.indexOf("--base");
  const base = baseIndex >= 0 ? argv[baseIndex + 1] : "";
  const { ref, files } = changedFiles(base);
  const result = argv.includes("--all")
    ? { mode: "full", tests: selectTests([], {}).tests, reasons: new Map(), why: "--all" }
    : selectTests(files);
  const all = result.mode === "full";
  console.log(`和 ${ref} 比改了 ${files.length} 个文件；${all ? `跑全量（${result.why}）` : `挑出 ${result.tests.length} 个测试文件`}`);
  if (list || !all) {
    for (const test of result.tests) {
      const why = result.reasons.get(test);
      if (!all || list) console.log(`  ${relative(WEB_ROOT, join(REPO_ROOT, test))}${why ? `  ← ${why}` : ""}`);
    }
  }
  if (list) return 0;
  if (result.mode === "none") {
    console.log("没有要跑的前端测试。");
    return 0;
  }
  const args = ["--import", "./tests/helpers/register-jsx.mjs", "--test", "--test-force-exit", "--test-concurrency=4"];
  const targets = all ? [] : result.tests.map((test) => relative(WEB_ROOT, join(REPO_ROOT, test)));
  const run = spawnSync(process.execPath, [...args, ...targets], { cwd: WEB_ROOT, stdio: "inherit" });
  return run.status ?? 1;
}

if (!process.env.NODE_TEST_CONTEXT && process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(main(process.argv.slice(2)));
}

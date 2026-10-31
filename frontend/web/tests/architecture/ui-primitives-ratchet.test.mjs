// 基础组件棘轮门禁（docs/ops/planning/frontend-migration/20261031-基础组件与刻度.md 第四节）。
//
// 背景：按钮、下拉、输入框各个功能自己手写，按钮类名长到 125 种、字号 50 种、圆角 37 种。基础组件在
// @retainpdf/ui 里，这条门禁防止迁移期间回潮，按文件记数（同 module-size / strict-ratchet）：
//   - 手写的 <button> / <select> / <input> / <textarea>，以及 shadcn 旧按钮 LegacyButton / legacyButtonVariants；
//   - CSS 里写死的 font-size、border-radius（不是 var(--…)）；
//   - 按钮一类的类名（*-btn、*-button）：只许用登记过的，新造的报错。
// 不在 baseline 的文件（含新文件）必须是 0；在 baseline 的不许涨；降了就要拧紧（只减不增）。
// 扫描 web 的 src 和阅读器包（src、styles）；基础组件自己（packages/ui）不算。
//
// 迁完一块后运行 `UPDATE_UI_PRIMITIVES_BASELINE=1 node --import ./tests/helpers/register-jsx.mjs --test tests/architecture/ui-primitives-ratchet.test.mjs`
// 重新生成 baseline。baseline: tests/architecture/helpers/ui-primitives-baseline.json

import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PROJECT_ROOT, stripCommentsAndStrings, toRelative } from "./helpers/source-scan.mjs";

const BASELINE_PATH = join(PROJECT_ROOT, "tests/architecture/helpers/ui-primitives-baseline.json");
const UPDATE_ENV = "UPDATE_UI_PRIMITIVES_BASELINE";
const SCAN_ROOTS = ["src", "../packages/reader/src", "../packages/reader/styles"].map((dir) => join(PROJECT_ROOT, dir));
const EXCLUDED = ["src/platform/api/mocks/", "src/platform/mock/", "src/platform/generated/"];

const CONTROL_PATTERNS = {
  button: /<button\b/g,
  select: /<select\b/g,
  input: /<input\b/g,
  textarea: /<textarea\b/g,
  legacyButton: /\b(LegacyButton|legacyButtonVariants)\b/g,
};
const CSS_PATTERNS = {
  fontSize: /font-size\s*:\s*-?[\d.]+(px|rem|em)\b/g,
  borderRadius: /border-radius\s*:\s*(?![^;]*var\()[^;]*\d+(px|rem|em)\b[^;]*;/g,
};
const BUTTON_CLASS_NAME = /\b[a-z][a-z0-9]*(?:-[a-z0-9]+)*-(?:btn|button)\b/g;
// baseline 里的类名把 - 存成 _：这个文件在 Tailwind 的自动扫描范围里，原样写类名会让同名的 @utility
// 被生成出来（改变 CSS 产物，哪怕没有元素用它）。
const encodeName = (name) => name.replaceAll("-", "_");
const decodeName = (name) => name.replaceAll("_", "-");

function walk(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.(tsx?|css)$/.test(name)) out.push(full);
  }
  return out;
}

function scannedFiles() {
  return SCAN_ROOTS.flatMap(walk)
    .map((full) => ({ full, rel: toRelative(full) }))
    .filter(({ rel }) => !EXCLUDED.some((prefix) => rel.startsWith(prefix)))
    .sort((a, b) => a.rel.localeCompare(b.rel));
}

function countAll(text, patterns) {
  const counts = {};
  for (const [key, pattern] of Object.entries(patterns)) {
    const n = (text.match(pattern) || []).length;
    if (n) counts[key] = n;
  }
  return counts;
}

function stripCssComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

function measure() {
  const controls = {};
  const cssLiterals = {};
  const names = new Set();
  for (const { full, rel } of scannedFiles()) {
    const raw = readFileSync(full, "utf8");
    if (rel.endsWith(".css")) {
      const css = stripCssComments(raw);
      const counts = countAll(css, CSS_PATTERNS);
      if (Object.keys(counts).length) cssLiterals[rel] = counts;
      for (const name of css.match(BUTTON_CLASS_NAME) || []) names.add(name);
    } else {
      const counts = countAll(stripCommentsAndStrings(raw), CONTROL_PATTERNS);
      if (Object.keys(counts).length) controls[rel] = counts;
      if (rel.endsWith(".tsx")) for (const name of raw.match(BUTTON_CLASS_NAME) || []) names.add(name);
    }
  }
  return { controls, cssLiterals, buttonClassNames: [...names].sort() };
}

function baselineOf(measured) {
  return { ...measured, buttonClassNames: measured.buttonClassNames.map(encodeName) };
}

function readBaseline() {
  const saved = JSON.parse(readFileSync(BASELINE_PATH, "utf8"));
  return { ...saved, buttonClassNames: saved.buttonClassNames.map(decodeName) };
}

/** 比较两层计数表：返回涨了的（失败）和降了的（baseline 陈旧）。 */
function compareCounts(current, baseline) {
  const grew = [];
  const shrank = [];
  for (const file of new Set([...Object.keys(current), ...Object.keys(baseline)])) {
    const now = current[file] || {};
    const allowed = baseline[file] || {};
    for (const key of new Set([...Object.keys(now), ...Object.keys(allowed)])) {
      const n = now[key] || 0;
      const limit = allowed[key] || 0;
      if (n > limit) grew.push(`${file}: ${key} ${n}（上限 ${limit}）`);
      else if (n < limit) shrank.push(`${file}: ${key} ${n} < baseline ${limit}`);
    }
  }
  return { grew, shrank };
}

const current = measure();

if (process.env[UPDATE_ENV] === "1") {
  writeFileSync(BASELINE_PATH, `${JSON.stringify(baselineOf(current), null, 2)}\n`);
}

test("手写控件只减不增：新代码用 @retainpdf/ui 的 Button、IconButton、Select、Input、Textarea", () => {
  const { grew } = compareCounts(current.controls, readBaseline().controls);
  assert.deepEqual(grew, [], `以下文件手写控件变多了，改用基础组件：\n  ${grew.join("\n  ")}`);
});

test("CSS 写死的字号、圆角只减不增：用 var(--ui-text-*)、var(--ui-radius-*)", () => {
  const { grew } = compareCounts(current.cssLiterals, readBaseline().cssLiterals);
  assert.deepEqual(grew, [], `以下样式文件写死的字号或圆角变多了，改用刻度变量：\n  ${grew.join("\n  ")}`);
});

test("不再新造按钮类名（*-btn、*-button）：用 Button / IconButton", () => {
  const known = new Set(readBaseline().buttonClassNames);
  const added = current.buttonClassNames.filter((name) => !known.has(name));
  assert.deepEqual(added, [], `新造了按钮类名，改用 Button / IconButton：${added.join(", ")}`);
});

test("baseline 没有虚高（迁完要拧紧）", () => {
  if (process.env[UPDATE_ENV] === "1") return;
  const baseline = readBaseline();
  const stale = [
    ...compareCounts(current.controls, baseline.controls).shrank,
    ...compareCounts(current.cssLiterals, baseline.cssLiterals).shrank,
    ...baseline.buttonClassNames.filter((name) => !current.buttonClassNames.includes(name)).map((name) => `类名 ${name} 已不再使用`),
  ];
  assert.deepEqual(stale, [], `迁移成果没有固化，运行 ${UPDATE_ENV}=1 拧紧棘轮：\n  ${stale.join("\n  ")}`);
});

test("基础组件只有 @retainpdf/ui 一份", () => {
  const appComponents = join(PROJECT_ROOT, "src/ui/components");
  const leftovers = walk(appComponents).map(toRelative);
  assert.deepEqual(leftovers, [], "src/ui/components 下不再放组件，基础组件在 frontend/packages/ui");
  const deepImports = scannedFiles()
    .filter(({ rel }) => !rel.endsWith(".css"))
    .filter(({ full }) => /from\s+"@retainpdf\/ui\/components\//.test(readFileSync(full, "utf8")))
    .map(({ rel }) => rel);
  assert.deepEqual(deepImports, [], "从 @retainpdf/ui 的根引基础组件，不要引包里的子路径");
});

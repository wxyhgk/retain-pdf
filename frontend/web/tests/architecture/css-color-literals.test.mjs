import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

// CSS 字面色值棘轮门禁。
//
// 目标状态:src/styles 里除 themes/(皮肤真值)外,不出现任何字面色值
// (hex / rgb / rgba / hsl),全部走语义变量 var(--ink|--paper|--surface|
// --shadow-color|…) 或 color-mix 派生——否则装饰主题/深色皮肤下这些
// 颜色不跟随换肤(night 主题曾因此半坏)。
//
// 现状离目标还有几百处,一次清完不现实。本测试做"棘轮":
// - 每个文件的字面色值数只许 ≤ baseline,新增即失败;
// - 收敛后运行 UPDATE_CSS_COLOR_BASELINE=1 npm test 拧紧棘轮
//   (baseline 只减不增,减少的部分会被固化)。
// baseline: tests/helpers/css-color-literals-baseline.json

const PROJECT_ROOT = process.cwd();
const STYLES_ROOT = join(PROJECT_ROOT, "src/styles");
const THEMES_ROOT = join(PROJECT_ROOT, "src/styles/themes");
const BASELINE_PATH = join(PROJECT_ROOT, "tests/helpers/css-color-literals-baseline.json");

// hex 色 / rgb(a) / hsl(a) 函数。CSS 变量名里的数字不含 #,不会误命中。
const COLOR_LITERAL_RE = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?)\(/g;

function walkCss(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (full === THEMES_ROOT) continue; // 皮肤真值,唯一允许字面色的地方
      walkCss(full, out);
    } else if (name.endsWith(".css")) {
      out.push(full);
    }
  }
  return out;
}

function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

function countLiterals(file) {
  const css = stripComments(readFileSync(file, "utf8"));
  return (css.match(COLOR_LITERAL_RE) || []).length;
}

function currentCounts() {
  const counts = {};
  for (const file of walkCss(STYLES_ROOT).sort()) {
    const n = countLiterals(file);
    if (n > 0) counts[relative(PROJECT_ROOT, file)] = n;
  }
  return counts;
}

test("CSS 字面色值只减不增(棘轮,皮肤文件除外)", () => {
  const counts = currentCounts();

  if (process.env.UPDATE_CSS_COLOR_BASELINE === "1") {
    writeFileSync(BASELINE_PATH, `${JSON.stringify(counts, null, 2)}\n`);
    return; // 拧紧棘轮后本轮直接通过
  }

  const baseline = JSON.parse(readFileSync(BASELINE_PATH, "utf8"));
  const regressions = [];
  for (const [file, n] of Object.entries(counts)) {
    const allowed = baseline[file] ?? 0; // 新文件必须零字面色
    if (n > allowed) {
      regressions.push(`${file}: ${n} 处(棘轮上限 ${allowed})`);
    }
  }

  assert.deepEqual(
    regressions,
    [],
    `以下文件新增了字面色值,请改用语义变量(var(--ink|--paper|--surface|--shadow-color|…) 或 color-mix):\n  ${regressions.join("\n  ")}\n收敛后用 UPDATE_CSS_COLOR_BASELINE=1 npm test 拧紧棘轮。`,
  );
});

test("棘轮 baseline 没有虚高(已收敛的文件应拧紧)", () => {
  if (process.env.UPDATE_CSS_COLOR_BASELINE === "1") return;
  const counts = currentCounts();
  const baseline = JSON.parse(readFileSync(BASELINE_PATH, "utf8"));
  const stale = [];
  for (const [file, allowed] of Object.entries(baseline)) {
    const n = counts[file] ?? 0;
    if (n < allowed) stale.push(`${file}: 实际 ${n} < baseline ${allowed}`);
  }
  assert.deepEqual(
    stale,
    [],
    `收敛成果未固化,运行 UPDATE_CSS_COLOR_BASELINE=1 npm test 拧紧棘轮:\n  ${stale.join("\n  ")}`,
  );
});

import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

// TSX/JSX 主题盲颜色棘轮门禁——css-color-literals 的姊妹篇,补上它的盲区:
// className 里的 bg-white/text-black 等 Tailwind 工具类、任意值 [rgba(...)]、
// 内联 style 字面色,CSS 棘轮(只扫 src/styles)全都看不见,night/装饰主题下
// 这些颜色不跟随换肤(图书馆改版曾因此积累 30+ 处)。
//
// 规则同款:每文件命中数只许 ≤ baseline,新文件必须为 0;
// 收敛后 UPDATE_TSX_COLOR_BASELINE=1 npm test 拧紧。
// 语义替代:bg-paper/bg-ink/bg-scrim 等(@theme 映射见 core/tailwind-theme.css)。

const PROJECT_ROOT = process.cwd();
// src/features 自批次 1 起就漏在棘轮之外——330 个已迁文件从迁移当天就脱离了
// 主题盲颜色约束。补进来（实测 0 命中，无历史债）。
const SCAN_ROOTS = ["src/app", "src/ui", "src/features"]
  .map((p) => join(PROJECT_ROOT, p));
// 皮肤真值(预览色块数据)所在地,豁免
const EXEMPT = [join(PROJECT_ROOT, "src/ui/theme")];
const BASELINE_PATH = join(PROJECT_ROOT, "tests/helpers/tsx-color-literals-baseline.json");

// 1) 主题盲工具类:white/black 系(含 /alpha 变体与 hover: 等前缀后的形式)
const UTILITY_RE = /\b(?:bg|text|border|ring|from|to|via|fill|stroke|divide|outline|decoration|caret|accent)-(?:white|black)(?:\/\d+)?\b/g;
// 2) 字面色:rgba()/rgb()/hsl()/6+ 位 hex(任意值类、内联 style、常量都算)
const LITERAL_RE = /\brgba?\(|\bhsla?\(|#[0-9a-fA-F]{6}\b/g;

function walk(dir, out = []) {
  // 原先这里用 try/catch 吞掉缺失目录并返回 []：扫描根一被搬走，棘轮就静默变绿。
  // 现在缺目录直接抛错，由 currentCounts 的存在性断言点名是哪个根失效。
  const entries = readdirSync(dir);
  for (const name of entries) {
    const full = join(dir, name);
    if (EXEMPT.some((e) => full === e || full.startsWith(`${e}/`))) continue;
    if (statSync(full).isDirectory()) {
      walk(full, out);
    } else if (/\.(?:tsx|jsx)$/.test(name)) {
      out.push(full);
    }
  }
  return out;
}

function stripComments(source) {
  // 保守剥离:块注释 + 整行 // 注释(不动行尾 //,避免误伤 URL)
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

function countFile(file) {
  const source = stripComments(readFileSync(file, "utf8"));
  const utilities = (source.match(UTILITY_RE) || []).length;
  const literals = (source.match(LITERAL_RE) || []).length;
  return utilities + literals;
}

function currentCounts() {
  const counts = {};
  for (const root of SCAN_ROOTS) {
    assert.ok(existsSync(root), `扫描根不存在，颜色棘轮已失效: ${relative(PROJECT_ROOT, root)}`);
    for (const file of walk(root).sort()) {
      const n = countFile(file);
      if (n > 0) counts[relative(PROJECT_ROOT, file)] = n;
    }
  }
  return counts;
}

test("TSX 主题盲颜色只减不增(棘轮)", () => {
  const counts = currentCounts();

  if (process.env.UPDATE_TSX_COLOR_BASELINE === "1") {
    writeFileSync(BASELINE_PATH, `${JSON.stringify(counts, null, 2)}\n`);
    return;
  }

  const baseline = JSON.parse(readFileSync(BASELINE_PATH, "utf8"));
  const regressions = [];
  for (const [file, n] of Object.entries(counts)) {
    const allowed = baseline[file] ?? 0;
    if (n > allowed) regressions.push(`${file}: ${n} 处(棘轮上限 ${allowed})`);
  }
  assert.deepEqual(
    regressions,
    [],
    `以下文件新增了主题盲颜色(bg-white/rgba(...)等),请改用语义类 bg-paper/bg-ink/bg-scrim 或 var(--…):\n  ${regressions.join("\n  ")}\n收敛后 UPDATE_TSX_COLOR_BASELINE=1 npm test 拧紧棘轮。`,
  );
});

test("TSX 棘轮 baseline 没有虚高", () => {
  if (process.env.UPDATE_TSX_COLOR_BASELINE === "1") return;
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
    `收敛成果未固化,运行 UPDATE_TSX_COLOR_BASELINE=1 npm test:\n  ${stale.join("\n  ")}`,
  );
});

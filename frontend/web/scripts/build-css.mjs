// 按页编译 CSS：home / detail / reader 独立产物，切断「一份 styles.css 打天下」。
// 挂载对照（HTML → 源 → 产物，?v= 由 stamp-cache-version.mjs 按内容哈希重写）：
//   index.html  → src/styles/entries/home.css   → dist/css/home.css
//   detail.html → src/styles/entries/detail.css → dist/css/detail.css
//   reader.html → src/styles/entries/reader.css → dist/css/reader.css (仅 react-pdf，legacy 已删除)
// 对应 JS bundle 见 build-js-bundle.mjs；三 entry 共享启动壳见 src/app/shell-boot.ts。
//
// 兼容：仍写一份 styles.css = home 的副本，避免外部脚本/文档旧路径立刻挂掉。

import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, existsSync, readdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { computeReaderCssFingerprint, FINGERPRINT_PATH } from "./css-source-fingerprint.mjs";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const ENTRIES = [
  { in: "src/styles/entries/home.css", out: "dist/css/home.css" },
  { in: "src/styles/entries/detail.css", out: "dist/css/detail.css" },
  { in: "src/styles/entries/reader.css", out: "dist/css/reader.css" },
  // admin.html → src/styles/entries/admin.css → dist/css/admin.css
  { in: "src/styles/entries/admin.css", out: "dist/css/admin.css" },
];

mkdirSync(join(ROOT, "dist/css"), { recursive: true });

const minify = !process.argv.includes("--no-minify");
const watch = process.argv.includes("--watch");


// KaTeX 的字体必须跟着 CSS 一起发布。
//
// katex.min.css 经 @retainpdf/reader/ai.css 内联进这三个入口，里面的引用是
// `url(fonts/KaTeX_*.woff2)`——相对 CSS 文件解析，也就是 dist/css/fonts/。字体此前
// 只存在于 node_modules,浏览器请求 /dist/css/fonts/... 全部 404。
//
// KaTeX 的排版完全依赖自己的字体:括号靠字体里的专用拼接字符撑高、大号运算符是独立
// 字形、数学斜体与正体是不同字族。404 之后全部回退到浏览器默认衬线体,于是括号撑不
// 开、求和号大小不对、字形全错——看起来就是「公式渲染很丑」,但结构上完全正常,
// 所以从 DOM 上查不出问题。
function copyKatexFonts() {
  const require = createRequire(import.meta.url);
  let fontsDir;
  try {
    fontsDir = join(dirname(require.resolve("katex/package.json")), "dist/fonts");
  } catch {
    console.warn("[build-css] 找不到 katex 包，跳过字体拷贝——公式会回退到默认字体");
    return;
  }
  if (!existsSync(fontsDir)) {
    console.warn(`[build-css] katex 字体目录不存在：${fontsDir}`);
    return;
  }
  const target = join(ROOT, "dist/css/fonts");
  mkdirSync(target, { recursive: true });
  let copied = 0;
  for (const name of readdirSync(fontsDir)) {
    if (!/^KaTeX_.*\.(woff2|woff|ttf)$/.test(name)) continue;
    copyFileSync(join(fontsDir, name), join(target, name));
    copied += 1;
  }
  console.log(`[build-css] dist/css/fonts ← katex (${copied} 个字体)`);
}

function runOne(entry, { watchMode = false } = {}) {
  const tailwindBin = join(ROOT, "node_modules/.bin/tailwindcss");
  const useDirect = existsSync(tailwindBin);
  const baseArgs = ["-i", join(ROOT, entry.in), "-o", join(ROOT, entry.out)];
  if (minify && !watchMode) baseArgs.push("--minify");
  if (watchMode) baseArgs.push("--watch");
  const args = useDirect ? baseArgs : ["tailwindcss", ...baseArgs];
  const cmd = useDirect ? tailwindBin : "npx";
  console.log(`[build-css] ${entry.in} → ${entry.out}${useDirect ? " (direct)" : ""}`);
  const r = spawnSync(cmd, args, {
    cwd: ROOT,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (r.status !== 0) {
    process.exit(r.status || 1);
  }
}

if (watch) {
  // 并行 watch 三个入口
  const tailwindBin = join(ROOT, "node_modules/.bin/tailwindcss");
  const useDirect = existsSync(tailwindBin);
  const kids = ENTRIES.map((entry) => {
    const baseArgs = ["-i", join(ROOT, entry.in), "-o", join(ROOT, entry.out), "--watch"];
    const args = useDirect ? baseArgs : ["tailwindcss", ...baseArgs];
    const cmd = useDirect ? tailwindBin : "npx";
    console.log(`[build-css:watch] ${entry.in} → ${entry.out}${useDirect ? " (direct)" : ""}`);
    return spawnSync(cmd, args, {
      cwd: ROOT,
      stdio: "inherit",
      shell: process.platform === "win32",
    });
  });
  process.exit(kids.some((k) => k.status !== 0) ? 1 : 0);
}

for (const entry of ENTRIES) {
  runOne(entry);
}

// 兼容旧路径 styles.css（= 主页包）
const homeOut = join(ROOT, "dist/css/home.css");
const legacyOut = join(ROOT, "styles.css");
if (existsSync(homeOut)) {
  copyFileSync(homeOut, legacyOut);
  console.log("[build-css] styles.css ← dist/css/home.css (compat)");
}

copyKatexFonts();

// 源 CSS 的内容指纹。tests/layout/* 量的是 dist/css/reader.css，而 npm test 和 CI
// 都不重建它 —— 门禁靠重算这个指纹来判断「产物是不是上次 build 的那一份」。
// 详见 scripts/css-source-fingerprint.mjs 的文件头。
writeFileSync(FINGERPRINT_PATH, `${computeReaderCssFingerprint()}\n`);
console.log("[build-css] reader 源指纹已写入");

console.log("[build-css] done");

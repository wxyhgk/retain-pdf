// 按页编译 CSS：home / detail / reader 独立产物，切断「一份 styles.css 打天下」。
// 挂载对照（HTML → 源 → 产物，?v= 由 stamp-cache-version.mjs 按内容哈希重写）：
//   index.html  → src/styles/entries/home.css   → dist/css/home.css
//   detail.html → src/styles/entries/detail.css → dist/css/detail.css
//   reader.html → src/styles/entries/reader.css → dist/css/reader.css (仅 react-pdf，legacy 已删除)
// 对应 JS bundle 见 build-js-bundle.mjs；三 entry 共享启动壳见 src/app/shell-boot.ts。
//
// 兼容：仍写一份 styles.css = home 的副本，避免外部脚本/文档旧路径立刻挂掉。

import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const ENTRIES = [
  { in: "src/styles/entries/home.css", out: "dist/css/home.css" },
  { in: "src/styles/entries/detail.css", out: "dist/css/detail.css" },
  { in: "src/styles/entries/reader.css", out: "dist/css/reader.css" },
];

mkdirSync(join(ROOT, "dist/css"), { recursive: true });

const minify = !process.argv.includes("--no-minify");
const watch = process.argv.includes("--watch");

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

console.log("[build-css] done");

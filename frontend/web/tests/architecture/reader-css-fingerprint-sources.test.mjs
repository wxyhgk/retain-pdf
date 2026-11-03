// reader.css 的源指纹必须覆盖入口用相对路径引入的宿主分片。
// 不覆盖的话：改了 features/reader/ui/*.css 却忘了 build:css，指纹不变，
// layout 门禁读的还是旧产物，照样绿（见 scripts/css-source-fingerprint.mjs 文件头）。
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { readerCssSourceFiles } from "../../scripts/css-source-fingerprint.mjs";

const WEB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const ENTRY = join(WEB_ROOT, "src/styles/entries/reader.css");

test("reader 源指纹包含入口里每个相对 @import 的分片", () => {
  const sources = new Set(readerCssSourceFiles());
  const imported = [...readFileSync(ENTRY, "utf8").matchAll(/@import\s+"(\.{1,2}\/[^"]+\.css)"/g)]
    .map((m) => join(dirname(ENTRY), m[1]));
  // 宿主自己的分片（fx 终端、画板）随 RetainPDF 自己的 AI 删了（2026-11-03），现在只剩阅读器包的样式树那一个。
  assert.ok(imported.length >= 1, "入口里应当有相对 @import（阅读器包的样式树）");
  for (const file of imported) assert.ok(sources.has(file), `${file} 不在指纹源里`);
});

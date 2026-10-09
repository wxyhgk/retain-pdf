/** 主页首屏不同步加载「点过去才用得到」的功能。
 *
 * AI 问答自带一整套 Markdown 流式渲染（markstream-react + stream-markdown-parser，约 600KB），
 * 曾经占主页首屏的三分之一；任务中心、书籍详情也只在点开时才出现。它们由 HomeApp 用
 * React.lazy 动态 import。这里从主页入口沿**静态** import 走一遍，任何一条静态引用
 * 把它们拉回首屏都会在这里红，而不是悄悄让首屏重新变胖。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";

import { SRC_DIR, buildGraph, toRepoPath } from "../../scripts/import-cycles.mjs";

const LAZY_ENTRIES = [
  "features/ask/index.ts",
  "features/task-center/index.ts",
  "features/book-detail/index.ts",
];

function staticClosure(entry) {
  const { byFile, external } = buildGraph({ includeDynamic: false });
  const seen = new Set();
  const stack = [entry];
  while (stack.length) {
    const file = stack.pop();
    if (seen.has(file)) continue;
    seen.add(file);
    for (const dep of byFile.get(file) || []) stack.push(dep);
  }
  return { seen, external };
}

test("主页首屏的静态 import 图里没有按需加载的功能", () => {
  const { seen, external } = staticClosure(join(SRC_DIR, "app/home/entry.tsx"));
  assert.ok(seen.has(join(SRC_DIR, "app/home/HomeApp.tsx")), "前提：从入口走得到 HomeApp");
  for (const lazyEntry of LAZY_ENTRIES) {
    assert.equal(seen.has(join(SRC_DIR, lazyEntry)), false, `${lazyEntry} 被静态引用进了主页首屏`);
  }
  const markdownImporters = [...seen]
    .filter((file) => (external.get(file) || []).some((spec) => spec === "@retainpdf/reader/ai"))
    .map(toRepoPath);
  assert.deepEqual(markdownImporters, [], "AI 问答的 Markdown 渲染（@retainpdf/reader/ai）被拉进了主页首屏");
});

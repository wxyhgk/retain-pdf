// npm run test:changed 按改动挑测试（scripts/test-changed.mjs）。用真仓库的依赖图验几种典型改动。
import test from "node:test";
import assert from "node:assert/strict";

import { buildDependencyIndex, selectTests } from "../../scripts/test-changed.mjs";

const index = buildDependencyIndex();
const pick = (changed) => selectTests(changed, { index });
const T = (path) => `frontend/web/tests/${path}`;

test("改一个源码文件：挑出 import 链上用到它的测试，加上架构门禁；无关的不跑", () => {
  const result = pick(["frontend/web/src/platform/config/providers.ts"]);
  assert.equal(result.mode, "selected");
  assert.ok(result.tests.includes(T("ingest/glm-ocr-payload.test.mjs")), "直接 import 的");
  assert.ok(result.tests.includes(T("architecture/module-size.test.mjs")), "架构门禁总跑");
  assert.ok(!result.tests.includes(T("reader/reader-markdown-blocks.test.mjs")), "阅读页 Markdown 块和它无关");
  assert.ok(result.tests.length < index.deps.size, "不是全量");
});

test("改阅读器包的源码：相对路径直接 import 的测试、经 @retainpdf/reader 用到的测试都挑上", () => {
  const result = pick(["frontend/packages/reader/src/shared/data/reader-regions.ts"]);
  assert.ok(result.tests.includes(T("reader/reader-markdown-blocks.test.mjs")));
  assert.match(result.reasons.get(T("reader/reader-markdown-blocks.test.mjs")), /import 链/);
});

test("测试本身改了就跑它；只改文档不跑测试", () => {
  const changed = pick([T("book-detail/retranslate-model.test.mjs")]);
  assert.deepEqual(changed.tests, [T("book-detail/retranslate-model.test.mjs")]);
  // 路径拼出来写：直接写字面量的话，这个测试文件自己就「写了这个路径」，会被挑上。
  const docs = ["docs", "ops", "devlog", "2026-11.csv"].join("/");
  assert.equal(pick([docs]).mode, "none");
});

test("改了测试加载器、依赖清单、tsconfig：选不准，跑全量", () => {
  for (const path of [
    "frontend/web/tests/helpers/jsx-loader.mjs",
    "package-lock.json",
    "frontend/web/package.json",
    "frontend/web/tsconfig.json",
  ]) {
    assert.equal(pick([path]).mode, "full", path);
  }
});

test("测试里按路径读源码文本的，也算用到了", () => {
  const result = selectTests(["frontend/web/src/styles/pages/home/translation-workflow.utilities.css"], {
    index,
    readText: (path) => (path.endsWith("ingest/glm-ocr-payload.test.mjs") ? 'readFileSync("src/styles/pages/home/translation-workflow.utilities.css")' : ""),
  });
  assert.match(result.reasons.get(T("ingest/glm-ocr-payload.test.mjs")) || "", /写了 .*translation-workflow\.utilities\.css 的路径/);
});

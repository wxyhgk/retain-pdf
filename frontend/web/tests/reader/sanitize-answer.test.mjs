import test from "node:test";
import assert from "node:assert/strict";
import { sanitizeAssistantAnswer } from "../../src/features/reader/domain.ts";

test("maps bracketed block_id to [n]", () => {
  const out = sanitizeAssistantAnswer(
    "制备氯取代的螺环吖啶（SA）前体 [p002-b0004] 已完成。",
    [{ ref: 2, block_id: "p002-b0004", page_idx: 1, snippet: "x" }],
  );
  assert.equal(out, "制备氯取代的螺环吖啶（SA）前体 [2] 已完成。");
});

test("strips unknown block_id markers", () => {
  const out = sanitizeAssistantAnswer("文本 [p009-b0010] 结束", []);
  assert.equal(out, "文本 结束");
});

test("maps bare block_id", () => {
  const out = sanitizeAssistantAnswer(
    "见 p003-b0001 处",
    [{ ref: 1, block_id: "p003-b0001", page_idx: 2 }],
  );
  assert.equal(out, "见 [1] 处");
});

// citation protect/restore for markdown
import {
  protectNumericCitations,
  restoreNumericCitations,
} from "../../src/features/reader/domain.ts";

test("protectNumericCitations survives marked-like processing", async () => {
  const { marked } = await import("../../vendor/marked/lib/marked.esm.js");
  const src = "结论成立 [1]，详见实验 [2]。";
  const { text, refs } = protectNumericCitations(src);
  assert.equal(refs.join(","), "1,2");
  assert.ok(!text.includes("[1]"));
  const html = String(marked.parse(text, { async: false }));
  const restored = restoreNumericCitations(html, refs);
  assert.match(restored, /\[1\]/);
  assert.match(restored, /\[2\]/);
});

// 代码保护(审计 P1-6 回归锁):围栏/行内代码不受空白压扁与 block_id 清洗影响
test("fenced code keeps indentation and internal spacing", () => {
  const code = "```python\ndef f():\n    if x:\n        return  [1, 2]\n```";
  const out = sanitizeAssistantAnswer(`结论如下：\n${code}\n完毕   了`, []);
  assert.ok(out.includes("    if x:"), "四空格缩进保留");
  assert.ok(out.includes("        return  [1, 2]"), "八空格缩进与双空格保留");
  assert.ok(out.includes("完毕 了"), "代码外的多空格仍被压缩");
});

test("unclosed fence at stream end is still protected", () => {
  const out = sanitizeAssistantAnswer("看代码：\n```\n    indented", []);
  assert.ok(out.includes("    indented"), "流式未闭合围栏内缩进保留");
});

test("inline code keeps content, block ids inside code untouched", () => {
  const out = sanitizeAssistantAnswer("字段 `p002-b0004  x` 不该被动", []);
  assert.ok(out.includes("`p002-b0004  x`"), "行内代码里的 block_id 与双空格原样");
});

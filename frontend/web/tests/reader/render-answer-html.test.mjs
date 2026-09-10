import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

// AI 回答渲染的 XSS 向量锁（审计 P0-1 回归锁）。
// renderFinalAnswerHtml 的输出经 root.innerHTML 注入,本文件锁死:
// 模型输出的任何原始 HTML 只能以"转义文本"形态出现,不得成为活的元素/属性。
// 改消毒策略必须让这些向量全部继续通过。

const dom = new JSDOM("<!doctype html><body></body>");
globalThis.document = dom.window.document;

const { renderFinalAnswerHtml, renderStreamingPreviewHtml } = await import(
  "../../src/features/reader/domain.ts"
);

/** 把输出重新解析,断言不存在任何危险活元素/属性 */
function assertInert(html, label) {
  const template = dom.window.document.createElement("template");
  template.innerHTML = html;
  const bad = template.content.querySelectorAll(
    "script, iframe, object, embed, base, link, meta, form, [srcdoc]",
  );
  assert.equal(bad.length, 0, `${label}: 存在危险元素 ${bad[0]?.outerHTML?.slice(0, 80) || ""}`);
  for (const node of template.content.querySelectorAll("*")) {
    for (const attribute of [...node.attributes]) {
      assert.ok(!/^on/i.test(attribute.name), `${label}: 存在 ${attribute.name} 事件属性`);
      if (["href", "src"].includes(attribute.name.toLowerCase())) {
        assert.ok(
          !/^\s*(javascript|vbscript|data:text\/html)/i.test(attribute.value),
          `${label}: 危险 URL ${attribute.value.slice(0, 60)}`,
        );
      }
    }
  }
}

test("iframe srcdoc 向量(实证过的绕过)被中和", async () => {
  const html = await renderFinalAnswerHtml(
    '结论如下 <iframe srcdoc="&lt;script&gt;alert(4)&lt;/script&gt;"></iframe> [1]',
  );
  assertInert(html, "iframe-srcdoc");
  assert.ok(html.includes("[1]"), "引用标记保留");
});

test("script/object/embed/on*/javascript: 全家桶被中和", async () => {
  const html = await renderFinalAnswerHtml(
    [
      "<script>alert(1)</script>",
      '<object data="x"></object>',
      '<embed src="x">',
      '<img src=x onerror="alert(2)">',
      '<a href="javascript:alert(3)">点我</a>',
      '<a href="vbscript:x">v</a>',
      '<a href="data:text/html,<script>1</script>">d</a>',
    ].join("\n\n"),
  );
  assertInert(html, "全家桶");
});

test("正常 Markdown 能力不受影响:加粗/代码/链接/引用标记", async () => {
  const html = await renderFinalAnswerHtml(
    "**结论** 与 `code` 成立 [2]，见 [文档](https://example.com/a)。",
  );
  assert.ok(html.includes("<strong>结论</strong>"));
  assert.ok(html.includes("<code>code</code>"));
  assert.ok(/href="https:\/\/example\.com\/a"/.test(html));
  assert.ok(!/target=/.test(html), "target 属性被剥离(Electron window.open 守卫)");
  assert.ok(html.includes("[2]"));
});

test("流式预览是全转义的,原始 HTML 以文本呈现", () => {
  const html = renderStreamingPreviewHtml('<img src=x onerror=alert(1)> **加粗** [3]');
  assert.ok(!html.includes("<img"));
  assert.ok(html.includes("&lt;img"));
  assert.ok(html.includes("<strong>加粗</strong>"));
  assert.ok(html.includes("[3]"));
});

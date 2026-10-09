/** 任务失败时，界面得说清「为什么」和「该怎么办」。
 *
 * 起因：DB 里 17/17 的失败一直都有完整的 failure_json（分类、上游、可重试、建议），
 * job 详情端点也带，**但书籍详情页只吃 document jobs 列表、从不打详情端点**。
 * 于是用户看到的只有「失败」两个字。
 *
 * 真实分布（15 本书 61 个任务里的 17 次失败）：
 *     provider/ocr 6 · translation 4 · timeout/ocr 3 · render 2 · internal 2
 * 全部 retryable=true。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { JSDOM } from "jsdom";

import {
  failureAdvice,
  failureDiagnosticText,
  failureSubtitle,
} from "../../src/features/book-detail/domain/job-failure-model.ts";
import { pickFailureDetailText } from "../../src/features/book-detail/domain/job-failure-detail.ts";
import { JobFailureCard } from "../../src/features/book-detail/ui/panels/processing/JobFailureCard.tsx";

const mineru = {
  category: "provider", stage: "ocr", retryable: true,
  summary: "任务失败，但暂未识别出明确根因",
  root_cause: "MinerU batch task failed: parsing failed, please try again later",
  suggestion: "查看 log_tail 和完整错误日志进一步排查",
  provider: "mineru",
};

// ------------------------------------------------------------ 建议

test("每个真实分类都有自己的说法，不是一句通用废话", () => {
  // 后端那句 summary 常常是「任务失败，但暂未识别出明确根因」—— 对用户零信息量。
  const seen = new Set();
  for (const category of ["provider", "timeout", "translation", "render", "internal"]) {
    const advice = failureAdvice({ ...mineru, category });
    assert.ok(advice.title && advice.action, `${category} 没有建议`);
    seen.add(advice.action);
  }
  assert.equal(seen.size, 5, "五个分类给的是同一句话，等于没分类");
});

test("后端说不可重试时，不能怂恿用户去点重试", () => {
  const advice = failureAdvice({ ...mineru, retryable: false });
  assert.equal(advice.retryLikelyHelps, false);
  assert.match(advice.action, /重试解决不了/);
});

test("认不出的分类也要给得出话来，不能空着", () => {
  const advice = failureAdvice({ ...mineru, category: "something-new" });
  assert.ok(advice.title && advice.action);
  assert.equal(failureAdvice(null).title.length > 0, true);
});

test("副标题说清是谁、哪一段", () => {
  assert.equal(failureSubtitle(mineru), "OCR · mineru");
  assert.equal(failureSubtitle({ ...mineru, provider: undefined }), "OCR");
  assert.equal(failureSubtitle({ ...mineru, stage: "translation", provider: "" }), "翻译");
});

// ------------------------------------------------------------ 诊断文本

test("复制出来的是纯文本，不是 JSON", () => {
  // 用户是粘进聊天框发出来的，JSON 在那里会被折行糊成一团。
  const text = failureDiagnosticText({ failure: mineru, jobId: "job-1", detail: "Traceback..." });
  assert.doesNotMatch(text, /^[[{]/, "复制出来是 JSON");
  assert.match(text, /任务: job-1/);
  assert.match(text, /分类: provider \/ ocr/);
  assert.match(text, /上游: mineru/);
  assert.match(text, /可重试: 是/);
  assert.match(text, /MinerU batch task failed/);
  assert.match(text, /完整错误:/);
});

test("没有完整错误时也拼得出来，不会出现空的「完整错误:」段", () => {
  const text = failureDiagnosticText({ failure: mineru, jobId: "job-1" });
  assert.doesNotMatch(text, /完整错误:/);
  assert.match(text, /任务: job-1/);
});

// ------------------------------------------------------------ 详情抽取

test("完整错误优先取最具体的那一个", () => {
  // traceback > error > raw_excerpt > log_tail。全堆上去没意义 —— 实测
  // raw_excerpt / last_log_line / raw_error_excerpt 常常是同一句话。
  const withTraceback = {
    data: { error: "短错误", failure: { raw_excerpt: "摘要", raw_diagnostic: { traceback: "Traceback (most recent call last):\n  ..." } } },
  };
  assert.match(pickFailureDetailText(withTraceback), /^Traceback/);
  assert.equal(pickFailureDetailText({ data: { error: "短错误" } }), "短错误");
  assert.equal(pickFailureDetailText({ data: { failure: { raw_excerpt: "摘要" } } }), "摘要");
  assert.equal(pickFailureDetailText({ data: { log_tail: ["a", "b"] } }), "a\nb");
  assert.equal(pickFailureDetailText(null), "");
});

test("信封拆不拆都认 —— 端点返回 {data:…}，单测喂裸对象", () => {
  assert.equal(pickFailureDetailText({ error: "裸的" }), "裸的");
  assert.equal(pickFailureDetailText({ data: { error: "带信封的" } }), "带信封的");
});

// ------------------------------------------------------------ 真渲染

function render(props) {
  const html = renderToStaticMarkup(createElement(JobFailureCard, props));
  return new JSDOM(`<body>${html}</body>`).window.document.body;
}

test("卡片把根因和建议都画出来了", () => {
  const body = render({ failure: mineru, jobId: "job-1" });
  assert.ok(body.querySelector("[data-job-failure]"), "卡片没渲染出来");
  assert.match(body.textContent, /上游服务没能处理这份文件/, "没画分类建议");
  assert.match(body.textContent, /MinerU batch task failed/, "没画后端给的根因");
});

test("没给主动作就不画主按钮 —— 点了没反应的按钮比没有更糟", () => {
  const without = render({ failure: mineru, jobId: "job-1" });
  assert.equal(without.querySelector("#book-detail-retry-failed-btn"), null);
  const withPrimary = render({
    failure: mineru,
    jobId: "job-1",
    primary: { label: "从渲染继续", hint: "沿用已有译文，只重新排版。", onClick() {} },
  });
  const button = withPrimary.querySelector("#book-detail-retry-failed-btn");
  assert.ok(button, "给了主动作却没有按钮");
  assert.match(button.textContent, /从渲染继续/, "按钮要说清从哪一步开始，不是笼统的「重试」");
  assert.match(withPrimary.textContent, /沿用已有译文/, "按钮下面要说沿用什么、花不花钱");
});

test("没有主动作时显示原因；主动作提交失败的原因就地显示", () => {
  const body = render({ failure: mineru, jobId: "job-1", notice: "OCR 没有完成", actionError: "网络断了" });
  assert.equal(body.querySelector("#book-detail-retry-failed-btn"), null);
  assert.match(body.textContent, /OCR 没有完成/);
  assert.match(body.querySelector('[role="alert"]')?.textContent || "", /网络断了/);
});

test("没给 loadDetail 就不画「展开完整错误」", () => {
  const body = render({ failure: mineru, jobId: "job-1" });
  assert.doesNotMatch(body.textContent, /展开完整错误/);
  const withLoad = render({ failure: mineru, jobId: "job-1", loadDetail: async () => "x" });
  assert.match(withLoad.textContent, /展开完整错误/);
});

test("卡片不把后端那句无信息量的 summary 摆给用户", () => {
  // 原来这条写的是 `doesNotMatch(advice.summary ?? "", /暂未识别出明确根因/)`，而
  // **FailureAdvice 上没有 summary 字段** —— 恒为 undefined，断言在任何实现下都绿。
  // 把 `{failure?.summary}` 加进卡片，1953 条照样全绿（子 agent 实测）。
  // 守的东西在 DOM 上：用户看不到那句话。
  assert.match(mineru.summary, /暂未识别出明确根因/, "正对照：fixture 里得真带着那句话");
  const body = render({ failure: mineru, jobId: "job-1" });
  assert.doesNotMatch(body.textContent, /暂未识别出明确根因/,
    "卡片把后端那句「暂未识别出明确根因」摆上去了 —— 对用户零信息量");
  assert.match(body.textContent, /上游服务没能处理这份文件/, "该说的分类建议没说");
});

test("复制按钮永远在 —— 它不依赖任何回调", () => {
  // 排查信息是用户唯一能带走的东西，不该因为缺哪个 prop 就消失。
  const body = render({ failure: mineru });
  assert.match(body.textContent, /复制诊断信息/);
});

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
import { pickFailureDetailText, pickFailureFacts } from "../../src/features/book-detail/domain/job-failure-detail.ts";
import { JobFailureCard } from "../../src/features/book-detail/ui/panels/processing/JobFailureCard.tsx";
import { HomeSettingsHubContext } from "../../src/ui/context/home-services-context.tsx";
import { makeDom } from "../helpers/dom.mjs";
import { waitFor } from "../helpers/async.mjs";

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

test("Key 被拒（auth，后端一律标不可重试）时，保留「去设置换 Key」，不能盖成「复制诊断信息」", () => {
  // 11-10 后端把翻译 Key 被拒归成 auth_failed、retryable=false。以前这里一见不可重试就把建议
  // 换成「这次失败重试解决不了，请复制诊断信息」，用户就不知道该去换 Key 了。
  const advice = failureAdvice({ ...mineru, category: "auth", stage: "translation", retryable: false });
  assert.equal(advice.retryLikelyHelps, false);
  assert.match(advice.action, /换一个有效的 Key/);
  assert.doesNotMatch(advice.action, /复制诊断信息/);
  assert.equal(advice.settingsAction, "去设置换 Key");
  // 换文件、换解析方式这两类本来就有自己的说法，同样不盖。
  assert.match(failureAdvice({ ...mineru, category: "input", retryable: false }).action, /换一份文件/);
  assert.match(failureAdvice({ ...mineru, category: "normalization", retryable: false }).action, /换一种解析方式/);
});

test("上游余额不足（billing，402）：说充值或换 Key，不写死从哪一步继续，给「去设置」", () => {
  const advice = failureAdvice({ ...mineru, category: "billing", stage: "translation", retryable: false });
  assert.equal(advice.retryLikelyHelps, false);
  assert.match(advice.action, /充值/);
  assert.doesNotMatch(advice.action, /从翻译继续|复制诊断信息/);
  assert.equal(advice.settingsAction, "去设置");
});

test("认不出的分类也要给得出话来，不能空着", () => {
  const advice = failureAdvice({ ...mineru, category: "something-new" });
  assert.ok(advice.title && advice.action);
  assert.equal(failureAdvice(null).title.length > 0, true);
});

test("副标题说清是谁、哪一段", () => {
  assert.equal(failureSubtitle(mineru), "OCR · MinerU", "厂商编号换成设置里看到的名字");
  assert.equal(failureSubtitle({ ...mineru, provider: undefined }), "OCR");
  assert.equal(failureSubtitle({ ...mineru, provider: "ocr" }), "OCR", "「OCR · ocr」不说明任何事");
  assert.equal(
    failureSubtitle({ ...mineru, stage: "translation", provider: "translation", upstream: { provider: "zhipu", http_status: 429, code: "1113" } }),
    "翻译 · 智谱",
    "有 upstream 时说是哪家",
  );
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

test("诊断信息带上失败码、上游的码和地址、这次用的 OCR 和模型、版本，不带 Key", () => {
  const facts = pickFailureFacts({
    data: {
      failure: {
        failure_code: "upstream_quota_exhausted", failed_stage: "ocr", provider: "glm_ocr",
        provider_code: "1113", upstream_host: "open.bigmodel.cn", recovery_hint: "充值后重试",
      },
      request_payload: {
        ocr: { provider: "glm_ocr" },
        translation: { model: "glm-5.3-flash", base_url: "https://open.bigmodel.cn/api/paas/v4?x=1", api_key: "sk-secret" },
      },
      error: "GLM-OCR quota exhausted",
    },
  });
  assert.equal(facts.translationHost, "open.bigmodel.cn", "翻译接口只留主机名");
  const text = failureDiagnosticText({ failure: mineru, jobId: "job-9", facts, environment: "2026.11.22 · 桌面版 darwin" });
  assert.match(text, /版本: 2026\.11\.22 · 桌面版 darwin/);
  assert.match(text, /失败码: upstream_quota_exhausted/);
  assert.match(text, /上游: glm_ocr · 码 1113 · open\.bigmodel\.cn/);
  assert.match(text, /OCR: glm_ocr/);
  assert.match(text, /翻译模型: glm-5\.3-flash @ open\.bigmodel\.cn/);
  assert.match(text, /建议: 充值后重试/);
  assert.match(text, /完整错误:\nGLM-OCR quota exhausted/, "没展开过完整错误时用详情里的");
  assert.doesNotMatch(text, /sk-secret|api_key/, "不带 Key");
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

test("主按钮在状态行上，这一块只说它沿用什么、花不花钱；重试有没有用画成小标签", () => {
  const body = render({ failure: mineru, jobId: "job-1", hint: "沿用已有译文，只重新排版。" });
  assert.equal(body.querySelector("#book-detail-retry-failed-btn"), null, "主按钮挪到状态行了，这里不该再有一个");
  assert.match(body.querySelector("[data-failure-hint]")?.textContent || "", /沿用已有译文/, "要说沿用什么、花不花钱");
  assert.equal(body.querySelector("[data-failure-chip='retry']")?.dataset.retryHelps, "true");
  assert.match(body.querySelector("[data-failure-chip='source']")?.textContent || "", /OCR · MinerU/);
});

test("重试解决不了的失败：小标签变成「重试解决不了」，并写出该做什么", () => {
  const body = render({ failure: { ...mineru, category: "auth", retryable: false }, jobId: "job-1" });
  assert.equal(body.querySelector("[data-failure-chip='retry']")?.dataset.retryHelps, "false");
  assert.match(body.textContent, /重试解决不了/);
});

test("Key 被拒的卡片上有「去设置换 Key」，点了打开设置的接口页", async () => {
  const dom = makeDom("", { html: "<!doctype html><html><body><div id='root'></div></body></html>" });
  const React = await import("react");
  const { createRoot } = await import("react-dom/client");
  const opened = [];
  const hub = { dialogStore: { open: (payload) => opened.push(payload) } };
  const failure = { ...mineru, category: "auth", stage: "translation", retryable: false };
  const root = createRoot(dom.window.document.getElementById("root"));
  try {
    root.render(React.createElement(HomeSettingsHubContext.Provider, { value: hub }, React.createElement(JobFailureCard, { failure, jobId: "job-1" })));
    await waitFor(() => dom.window.document.querySelector("[data-failure-open-settings]"), "画出「去设置换 Key」");
    const button = dom.window.document.querySelector("[data-failure-open-settings]");
    assert.match(button.textContent, /去设置换 Key/);
    button.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
    assert.deepEqual(opened, [{ tab: "api" }]);
  } finally {
    root.unmount();
    dom.window.close();
  }
});

test("不是 Key 的问题、或者取不到设置入口时，不画「去设置」", () => {
  const hub = { dialogStore: { open: () => {} } };
  const withHub = (failure) => new JSDOM(`<body>${renderToStaticMarkup(createElement(HomeSettingsHubContext.Provider, { value: hub }, createElement(JobFailureCard, { failure, jobId: "job-1" })))}</body>`).window.document.body;
  assert.equal(withHub(mineru).querySelector("[data-failure-open-settings]"), null, "上游临时故障不该引去设置");
  assert.equal(render({ failure: { ...mineru, category: "auth", retryable: false }, jobId: "job-1" }).querySelector("[data-failure-open-settings]"), null, "没有设置入口时不画");
});

test("两段都失败时，不在状态行上的那段带自己的按钮", () => {
  const body = render({ failure: mineru, jobId: "job-1", action: createElement("button", { id: "own" }, "重新 OCR") });
  assert.ok(body.querySelector(".book-detail-failure-tools #own"));
});

test("没有主动作时显示原因；主动作提交失败的原因就地显示", () => {
  const body = render({ failure: mineru, jobId: "job-1", notice: "OCR 没有完成", actionError: "网络断了" });
  assert.equal(body.querySelector("#book-detail-retry-failed-btn"), null);
  assert.match(body.textContent, /OCR 没有完成/);
  assert.match(body.querySelector('[role="alert"]')?.textContent || "", /网络断了/);
});

test("没给 loadDetail 就不画「完整错误」", () => {
  const body = render({ failure: mineru, jobId: "job-1" });
  assert.doesNotMatch(body.textContent, /完整错误/);
  const withLoad = render({ failure: mineru, jobId: "job-1", loadDetail: async () => "x" });
  assert.match(withLoad.textContent, /完整错误/);
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
  assert.ok(body.querySelector('button[aria-label="复制诊断信息"]'), "复制是一个图标按钮，读屏名字是「复制诊断信息」");
});

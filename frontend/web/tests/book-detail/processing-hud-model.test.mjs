// 「进度」页 HUD 面板的数：进度环（各状态各说什么）、耗时分段、模型、token；算不出来的块不出，不编数。
import test from "node:test";
import assert from "node:assert/strict";

import { clockText, modelLogo, processingHudModel } from "../../src/features/book-detail/ui/tabs/processing-hud-model.ts";
import { timelineFromJobPayload } from "../../src/features/book-detail/domain/assembly-line-model.ts";
import { usageViewModel } from "../../src/features/usage/domain/usage-view-model.ts";

const T0 = Date.parse("2026-10-30T14:25:29Z");
const iso = (seconds) => new Date(T0 + seconds * 1000).toISOString();
const FINISHED = timelineFromJobPayload({ runtime: { stage_history: [
  { stage: "queued", enter_at: iso(0), exit_at: iso(0), duration_ms: 0 },
  { stage: "ocr_submitting", enter_at: iso(0), exit_at: iso(88), duration_ms: 88_000 },
  { stage: "translating", enter_at: iso(88), exit_at: iso(155), duration_ms: 67_000 },
  { stage: "rendering", enter_at: iso(155), exit_at: iso(171), duration_ms: 16_000 },
  { stage: "finished", enter_at: iso(171), exit_at: iso(171), duration_ms: 0 },
] } }, T0);
const COVERAGE = {
  page_count: 134, translated_pages: 134, contributing_jobs: 1, segments: [],
  jobs: [{ job_id: "job-1", workflow: "book", status: "succeeded", model: "claude-haiku-5-5", engine: "legacy", pages: [], supplied_pages: 134 }],
};
const bucket = (input, output) => ({
  input_tokens: input, output_tokens: output, total_tokens: input + output, requests: 365, requests_without_usage: 0,
  cache_hit_tokens: 0, cache_reported_input_tokens: 0, cache_write_tokens: 0, reasoning_tokens: 0,
});
const USAGE = usageViewModel({
  schema: "token-usage.v1", scope: "document", totals: bucket(980_000, 307_000),
  by_stage: [], by_model: [], by_month: [], jobs_counted: 1, jobs_estimated_from_reports: 0, first_at: null, last_at: null,
});
const base = {
  tone: "done", jobActive: false, runningPercent: null, liveCount: null, stoppedAt: "", stationsDone: 4,
  coverage: COVERAGE, translationJobId: "job-1", pageCount: 134, timeline: FINISHED, now: T0 + 200_000, usage: USAGE,
};

test("HUD 上的时间写成 m:ss / h:mm:ss；按模型名认出服务商标志", () => {
  assert.equal(clockText(171_000), "2:51");
  assert.equal(clockText(16_000), "0:16");
  assert.equal(clockText(3_723_000), "1:02:03");
  assert.match(modelLogo("claude-haiku-5-5"), /anthropic/);
  assert.match(modelLogo("glm-5.3-flash"), /zai/);
  assert.equal(modelLogo("my-own-model"), "");
});

test("完成：环写翻了几页，总耗时、模型、token 都在", () => {
  const hud = processingHudModel(base);
  assert.deepEqual([hud.gauge.value, hud.gauge.text, hud.gauge.title], [1, "134/134", "已翻译 134 / 134 页"]);
  assert.equal(hud.time.text, "2:51");
  assert.equal(hud.time.title, "共用时 2 分 51 秒");
  assert.equal(hud.model.name, "claude-haiku-5-5");
  assert.match(hud.model.logo, /anthropic/);
  assert.equal(hud.tokens.text, "128.7 万");
  // 各站小标签：OCR 站页数，翻译站模型标志（这里没有按环节的用量，就没有 token）。
  assert.deepEqual(hud.stationChips.ocr.map((chip) => [chip.kind, chip.text]), [["pages", "134"]]);
  assert.deepEqual(hud.stationChips.translate.map((chip) => chip.kind), ["model"]);
  assert.match(hud.stationChips.translate[0].logo, /anthropic/);
});

test("在跑：环跟进度、写第几批；token 还在涨不摆", () => {
  const hud = processingHudModel({ ...base, tone: "active", jobActive: true, runningPercent: 13, liveCount: "120 / 900 批" });
  assert.equal(hud.gauge.value, 0.13);
  assert.equal(hud.gauge.text, "120 / 900 批");
  assert.equal(hud.tokens, null);
});

test("停下：环是走到第几站，写停在哪站", () => {
  const hud = processingHudModel({ ...base, tone: "failed", stoppedAt: "渲染", stationsDone: 3 });
  assert.equal(hud.gauge.value, 0.75);
  assert.equal(hud.gauge.text, "渲染");
  assert.equal(hud.gauge.title, "停在渲染");
});

test("算不出来的块不出：没有计时、没有模型、没有用量", () => {
  const hud = processingHudModel({ ...base, tone: "idle", stationsDone: 0, coverage: null, timeline: null, usage: null });
  assert.equal(hud.time, null);
  assert.equal(hud.model, null);
  assert.equal(hud.tokens, null);
  assert.equal(hud.gauge.text, "134 页");
});

test("各站 token：翻译和译前准备加在一起挂翻译站，精修挂版面站，助手不挂；在跑时都不挂", () => {
  const usage = usageViewModel({
    schema: "token-usage.v1", scope: "document", totals: bucket(980_000, 307_000),
    by_stage: [
      { stage: "translate", group: "translation", label: "翻译", ...bucket(600_000, 27_000) },
      { stage: "glossary", group: "preparation", label: "术语", ...bucket(70_000, 10_000) },
      { stage: "review", group: "refine", label: "审校", ...bucket(130_000, 11_000) },
      { stage: "ask", group: "assistant", label: "问答", ...bucket(20_000, 7_000) },
    ],
    by_model: [], by_month: [], jobs_counted: 1, jobs_estimated_from_reports: 0, first_at: null, last_at: null,
  });
  const hud = processingHudModel({ ...base, usage });
  assert.equal(hud.stationChips.translate.find((chip) => chip.kind === "tokens").text, "70.7 万");
  assert.equal(hud.stationChips.render.find((chip) => chip.kind === "tokens").text, "14.1 万");
  assert.equal(Object.values(hud.stationChips).flat().filter((chip) => chip.kind === "tokens").length, 2, "助手的用量不挂在哪一站");
  const running = processingHudModel({ ...base, usage, tone: "active", jobActive: true, runningPercent: 10 });
  assert.equal(Object.values(running.stationChips).flat().some((chip) => chip.kind === "tokens"), false);
});

test("OCR 站页数：这次只做了几页时写「2/10」，不是全书页数", () => {
  const partial = { ...COVERAGE, page_count: 10, translated_pages: 2, jobs: [{ ...COVERAGE.jobs[0], pages: [1, 2] }] };
  const hud = processingHudModel({ ...base, coverage: partial, pageCount: 10 });
  assert.deepEqual(hud.stationChips.ocr.map((chip) => [chip.text, chip.title]), [["2/10", "这次识别了 2 / 10 页"]]);
  const whole = processingHudModel({ ...base, coverage: { ...COVERAGE, jobs: [{ ...COVERAGE.jobs[0], pages: Array.from({ length: 134 }, (_, i) => i + 1) }] } });
  assert.equal(whole.stationChips.ocr[0].text, "134");
});


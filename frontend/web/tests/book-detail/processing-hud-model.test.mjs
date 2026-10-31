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

test("完成：环写翻了几页，耗时按站分段，模型、token 都在", () => {
  const hud = processingHudModel(base);
  assert.deepEqual([hud.gauge.value, hud.gauge.text, hud.gauge.title], [1, "134/134", "已翻译 134 / 134 页"]);
  assert.equal(hud.time.text, "2:51");
  assert.deepEqual(hud.time.segments.map((s) => [s.key, s.text]), [["ocr", "1:28"], ["translate", "1:07"], ["render", "0:16"]], "0 秒的段不占位");
  assert.equal(hud.model.name, "claude-haiku-5-5");
  assert.match(hud.model.logo, /anthropic/);
  assert.equal(hud.tokens.text, "128.7 万");
  assert.ok(Math.abs(hud.tokens.input.share - 980 / 1287) < 0.001);
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

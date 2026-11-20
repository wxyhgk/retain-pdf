// 一本书花了多少钱（token-usage.v1 的 estimated_cost_usd，后端按 models.dev 标价估）：
// 界面按人民币（汇率用后端 pricing.usd_cny，旧后端没有按 7.16）写「约 ¥3.09」、不足 1 分「< ¥0.01」、0 不显示；查不到价、按官方标价、价目没同步各注一句；
// 用量里排在最前面，按环节一组一个金额；进度页 HUD 跑完才摆。
import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { DEFAULT_USD_TO_CNY, formatCost, usageCost, usageViewModel, usdToCnyRate } from "../../src/features/usage/domain/usage-view-model.js";
import { UsageCompact } from "../../src/features/usage/ui/UsageCompact.jsx";
import { processingHudModel } from "../../src/features/book-detail/ui/tabs/processing-hud-model.js";

function bucket(overrides = {}) {
  return {
    requests: 100, requests_without_usage: 0, input_tokens: 4_000_000, output_tokens: 1_470_000,
    total_tokens: 5_470_000, cache_hit_tokens: 0, cache_reported_input_tokens: 0, cache_write_tokens: 0,
    reasoning_tokens: 0, estimated_cost_usd: 0.432123, priced_requests: 100, list_priced_requests: 0, unpriced_requests: 0,
    ...overrides,
  };
}
function view(overrides = {}) {
  return {
    scope: "document", totals: bucket(), by_stage: [], by_model: [], by_month: [],
    jobs_counted: 2, jobs_estimated_from_reports: 0, first_at: null, last_at: null,
    pricing: { source: "https://models.dev/api.json", synced_at: "2026-11-19T00:00:00Z", snapshot_date: "2026-11-19", currency: "USD" },
    ...overrides,
  };
}

test("金额（入参美元、显示人民币）：约 ¥3.09；不足 1 分 < ¥0.01；100 元以上取整加逗号；0 和没给是空；汇率读后端的", () => {
  assert.equal(DEFAULT_USD_TO_CNY, 7.16);
  assert.equal(usdToCnyRate({ pricing: { usd_cny: 7 } }), 7);
  assert.equal(usdToCnyRate({ pricing: {} }), 7.16, "旧后端没给汇率");
  assert.equal(formatCost(0.432123), "约 ¥3.09");
  assert.equal(formatCost(0.432123, 7), "约 ¥3.02");
  assert.equal(formatCost(0.001), "< ¥0.01");
  assert.equal(formatCost(0.004), "约 ¥0.03");
  assert.equal(formatCost(32.316088), "约 ¥231");
  assert.equal(formatCost(1234.6), "约 ¥8,840");
  assert.equal(formatCost(0), "");
  assert.equal(formatCost(undefined), "");
});

test("花费的说明：查不到价、按官方标价、价目没同步各一句；旧后端没字段、0 花费又没查不到价的不显示", () => {
  const plain = usageCost(view());
  assert.equal(plain.cost.text, "约 ¥3.09");
  assert.match(plain.cost.title, /¥3\.0940（\$0\.432123）.*models\.dev.*1 美元按 7\.16 元折算.*不含折扣/);
  assert.deepEqual(plain.notes, []);

  const noisy = usageCost(view({
    totals: bucket({ unpriced_requests: 3, list_priced_requests: 7 }),
    pricing: { source: "x", synced_at: null, snapshot_date: "2026-11-01", currency: "USD" },
  }));
  assert.deepEqual(noisy.notes, [
    "有 3 次请求的模型查不到价，没算进花费。",
    "有 7 次请求的接口地址对不上服务商，按官方标价估算。",
    "价格还没同步过，用的是内置价目（2026-11-01）。",
  ]);

  const { estimated_cost_usd: _drop, ...oldTotals } = bucket();
  assert.equal(usageCost(view({ totals: oldTotals })).cost, null, "旧后端没这个字段");
  assert.equal(usageCost(view({ totals: bucket({ estimated_cost_usd: 0 }) })).cost, null);
  assert.equal(usageCost(view({ totals: bucket({ estimated_cost_usd: 0, unpriced_requests: 5 }) })).cost.text, "—", "全查不到价：写「—」并说明");
});

test("用量里花费排最前、说明并进 notes；按环节每组一个金额；紧凑版画出来", () => {
  const model = usageViewModel(view({
    by_stage: [
      { stage: "translation", label: "翻译", group: "translation", ...bucket({ estimated_cost_usd: 0.31 }) },
      { stage: "term_prescan", label: "术语预扫", group: "preparation", ...bucket({ total_tokens: 100, estimated_cost_usd: 0 }) },
    ],
    totals: bucket({ unpriced_requests: 2 }),
  }));
  assert.equal(model.metrics[0].key, "cost");
  assert.equal(model.metrics[0].value, "约 ¥3.09");
  assert.ok(model.notes.some((note) => /2 次请求的模型查不到价/.test(note)));
  assert.equal(model.stageGroups.find((group) => group.key === "translation").cost, "约 ¥2.22");
  assert.equal(model.stageGroups.find((group) => group.key === "preparation").cost, "");

  const html = renderToStaticMarkup(createElement(UsageCompact, { model }));
  assert.match(html, /data-usage-metric="cost"[^>]*title="估算花费 ¥3\.0940/);
  assert.match(html, /data-usage-cost="translation"[^>]*>约 ¥2\.22</);
  assert.doesNotMatch(html, /data-usage-cost="preparation"/);
});

test("进度页 HUD：跑完才摆这次任务的花费，在跑时还在涨不摆；没花费不摆", () => {
  const base = {
    tone: "done", jobActive: false, runningPercent: null, liveCount: null, stoppedAt: "", stationsDone: 4,
    coverage: null, translationJobId: "", pageCount: 10, timeline: null, now: 0,
  };
  const usage = usageViewModel(view());
  assert.deepEqual(processingHudModel({ ...base, usage }).cost, { text: "约 ¥3.09", title: `这次任务${usage.cost.title}` });
  assert.equal(processingHudModel({ ...base, usage, tone: "active", jobActive: true, runningPercent: 10 }).cost, null);
  assert.equal(processingHudModel({ ...base, usage: usageViewModel(view({ totals: bucket({ estimated_cost_usd: 0 }) })) }).cost, null);
});

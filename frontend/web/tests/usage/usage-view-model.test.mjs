// 用量的显示规则：未报、思考 0、缓存写入、说明。
import test from "node:test";
import assert from "node:assert/strict";
import { usageViewModel } from "../../src/features/usage/domain/usage-view-model.js";

function bucket(overrides = {}) {
  return {
    requests: 100, requests_without_usage: 0, input_tokens: 4_000_000, output_tokens: 1_470_000,
    total_tokens: 5_470_000, cache_hit_tokens: 0, cache_reported_input_tokens: 0, cache_write_tokens: 0,
    reasoning_tokens: 0, ...overrides,
  };
}
function view(overrides = {}) {
  return {
    scope: "all", totals: bucket(), by_stage: [], by_model: [], by_month: [],
    jobs_counted: 29, jobs_estimated_from_reports: 0, first_at: null, last_at: null, ...overrides,
  };
}
const metric = (model, key) => model.metrics.find((item) => item.key === key);

test("千问这类不报缓存的：缓存写「未报」，思考写「—」，不显示缓存写入", () => {
  const model = usageViewModel(view());
  assert.equal(metric(model, "cache").value, "未报");
  assert.equal(metric(model, "reasoning").value, "—");
  assert.equal(metric(model, "cache_write"), undefined);
  assert.equal(metric(model, "total").value, "547.0 万");
  assert.equal(metric(model, "total").exact, "5,470,000");
  assert.equal(model.summaryLine, "计入 29 个任务");
});

test("报了缓存和思考的：命中率、思考量、Anthropic 的缓存写入", () => {
  const model = usageViewModel(view({
    totals: bucket({ cache_hit_tokens: 417_000, cache_reported_input_tokens: 1_000_000, reasoning_tokens: 52_000, cache_write_tokens: 3_000 }),
  }));
  assert.equal(metric(model, "cache").value, "41.7 万");
  assert.equal(metric(model, "cache").note, "命中率 42%");
  assert.equal(metric(model, "reasoning").value, "5.2 万");
  assert.equal(metric(model, "cache_write").value, "3,000");
});

test("没报用量的请求、按旧报告折算的任务各注明一句", () => {
  const model = usageViewModel(view({ totals: bucket({ requests_without_usage: 3 }), jobs_estimated_from_reports: 29 }));
  assert.deepEqual(model.notes, [
    "有 3 次请求服务商没报用量，没算进来。",
    "其中 29 个早期任务按当时的报告折算，缓存与思考明细可能不全。",
  ]);
});

test("按环节分组、组按用量排；按月写成「2026 年 9 月」", () => {
  const model = usageViewModel(view({
    by_stage: [
      { stage: "translation", label: "翻译", group: "translation", ...bucket({ total_tokens: 3_900_000 }) },
      { stage: "refine_review", label: "审校挑错", group: "refine", ...bucket({ total_tokens: 880_000 }) },
      { stage: "refine_fix", label: "局部修改", group: "refine", ...bucket({ total_tokens: 140_000 }) },
      { stage: "brand_new", label: "新环节", group: "unknown_group", ...bucket({ total_tokens: 10 }) },
    ],
    by_month: [
      { month: "2026-09", ...bucket({ total_tokens: 1_296_000 }) },
      { month: "2026-10", ...bucket({ total_tokens: 4_174_000 }) },
    ],
  }));
  assert.deepEqual(model.stageGroups.map((group) => [group.label, group.value, group.rows.length]), [
    ["翻译", "390.0 万", 1],
    ["精修与编辑部", "102.0 万", 2],
    ["其它", "10", 1],
  ]);
  assert.deepEqual(model.months.map((row) => [row.label, row.value]), [["2026 年 9 月", "129.6 万"], ["2026 年 10 月", "417.4 万"]]);
  assert.equal(model.months[1].share, 1);
});

test("没有任何用量时是空状态", () => {
  assert.equal(usageViewModel(null).empty, true);
  assert.equal(usageViewModel(view({ totals: bucket({ total_tokens: 0 }), jobs_counted: 0 })).empty, true);
});

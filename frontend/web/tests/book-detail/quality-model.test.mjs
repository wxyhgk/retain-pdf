// 「译文质量」卡：按严重程度说、公式不算漏翻、缩字不算问题、译前准备不完整要提醒。
import test from "node:test";
import assert from "node:assert/strict";
import { qualityModel } from "../../src/features/book-detail/domain/quality-model.js";
import { fetchQualitySummary } from "../../src/platform/api/mocks/quality.js";

const row = (model, key) => model.rows.find((item) => item.key === key);

test("真实书的数字：只把一般以上、留给你确认、溢出和缩得太小算「要看」", async () => {
  const model = qualityModel(await fetchQualitySummary("job-1"));
  assert.equal(row(model, "qa").value, "85 处要看");
  assert.match(row(model, "qa").detail, /轻微 465（多是格式细节）/);
  assert.equal(row(model, "qa").breakdown[0].label, "术语括注");
  assert.equal(row(model, "refine").value, "问题 664 → 534（少了 20%）");
  assert.match(row(model, "refine").detail, /留给你确认 84/);
  assert.deepEqual(row(model, "refine").lists.map((link) => link.kind), ["revisions", "escalated"], "精修行有两个入口：改了哪些、留给你确认的");
  assert.equal(row(model, "layout").value, "49 处要看");
  assert.match(row(model, "layout").detail, /16 块溢出（第 12、18、23、31、40、47 等 10 页）/);
  assert.equal(row(model, "untranslated").value, "没有");
  assert.match(row(model, "untranslated").detail, /86 块按原样保留/);
  assert.equal(model.attentionCount, 85 + 84 + 16 + 31 + 2);
  assert.equal(model.warnings.length, 2);
  assert.match(model.warnings[0], /120 批里有 3 批没抽出来/);
  assert.match(model.warnings[1], /风格指南没生成成功/);
});

test("干净的书：没有提醒，各行是好消息；缩了字号也不算问题", () => {
  const model = qualityModel({
    job_id: "j",
    preparation: { mode: "terms", term_base: null, style_guide: null, problems: [] },
    qa: { generated_at: "", item_count: 10, checked_item_count: 10, violation_count: 3, by_severity: { minor: 3 }, by_check: { punctuation: 3 }, by_type: {} },
    layout: { blocks: 10, shrunk_blocks: 4, small_blocks: 0, small_scale_threshold: 0.75, overflow_blocks: 0, overflow_pages: [], min_scale: 0.9, min_final_font_size: 9, math_formulas: 0, math_failed: 0 },
    refine: null,
    untranslated: { failed: 0, formula: 0, model_kept: 0, other: 0 },
  });
  assert.deepEqual(model.warnings, []);
  assert.equal(row(model, "qa").value, "没有要看的问题");
  assert.equal(row(model, "qa").lists, undefined);
  assert.equal(row(model, "layout").value, "都装得下");
  assert.match(row(model, "layout").detail, /4 块缩了字号/);
  assert.equal(row(model, "refine"), undefined, "没精修过就不显示这一行");
  assert.equal(model.attentionCount, 0);
});

test("真失败才算漏翻；没有任何报告时是空的", () => {
  const model = qualityModel({ job_id: "j", preparation: null, qa: null, layout: null, refine: null, untranslated: { failed: 2, formula: 10, model_kept: 1, other: 0 } });
  assert.equal(model.empty, true, "只有 untranslated 不算有报告");
  const withQa = qualityModel({ job_id: "j", preparation: null, qa: { generated_at: "", item_count: 1, checked_item_count: 1, violation_count: 0, by_severity: {}, by_check: {}, by_type: {} }, layout: null, refine: null, untranslated: { failed: 2, formula: 10, model_kept: 1, other: 0 } });
  assert.equal(row(withQa, "untranslated").value, "2 块没翻成");
  assert.equal(row(withQa, "untranslated").lists[0].kind, "untranslated");
  assert.match(withQa.warnings[0], /2 块翻译失败/);
});


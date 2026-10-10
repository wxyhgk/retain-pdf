// 质量明细：各列表对应的取数写法，以及排版「溢出 + 缩得太小」的合并。
import test from "node:test";
import assert from "node:assert/strict";
import { createQualityListLoader } from "../../src/features/book-detail/ui/quality-list-loader.js";

function fakeFetch(handler) {
  const calls = [];
  const fetchData = async (jobId, apiPrefix, dataset, query) => {
    calls.push({ dataset, query });
    return handler(dataset, query);
  };
  return { fetchData, calls };
}
const view = (rows, total = rows.length) => ({ job_id: "j", dataset: "x", kind: "rows", available: true, total, offset: 0, limit: 50, rows });

test("排版：溢出的全拿，缩得太小的从按缩放排序的一页里挑，按页合并；跳转用四位编号", async () => {
  const { fetchData, calls } = fakeFetch((dataset, query) => (query.filters?.overflow
    ? view([{ item_id: "p012-b004", reader_item_id: "p012-b0004", page: 12, overflow: true, overflow_pt: 8.5, final_font_size: 6.2, scale: 0.6 }], 16)
    : view([
        { item_id: "p012-b004", reader_item_id: "p012-b0004", page: 12, overflow: true, scale: 0.6 },
        { item_id: "p005-b001", reader_item_id: "p005-b0001", page: 5, overflow: false, scale: 0.44, final_font_size: 4.8 },
        { item_id: "p006-b001", reader_item_id: "p006-b0001", page: 6, overflow: false, scale: 0.9 },
      ])));
  const list = await createQualityListLoader(fetchData)("j", "layout");
  assert.deepEqual(calls.map((c) => [c.dataset, c.query.filters?.overflow ?? null, c.query.sort]), [["layout_blocks", true, "page"], ["layout_blocks", null, "scale"]]);
  assert.deepEqual(list.items.map((item) => [item.page, item.readerItemId, item.title]), [
    [5, "p005-b0001", "字缩得太小（缩到 44%）"],
    [12, "p012-b0004", "溢出"],
  ]);
  assert.equal(list.total, 16 + 1);
});

test("精修改了哪些：只看精修来源、最新的在前，第二行是改前改后", async () => {
  const { fetchData, calls } = fakeFetch(() => view([
    { revision_id: "r1", item_id: "p003-b001", reader_item_id: "p003-b0001", page: 3, reason: "terminology: identity → 单位元", previous_text: "恒等元", new_text: "单位元" },
  ], 155));
  const list = await createQualityListLoader(fetchData)("j", "revisions");
  assert.deepEqual(calls[0], { dataset: "revisions", query: { filters: { source: "refine" }, sort: "-ts", limit: 50 } });
  assert.equal(list.total, 155);
  assert.equal(list.items[0].title, "terminology: identity → 单位元");
  assert.equal(list.items[0].detail, "原：恒等元\n改：单位元");
});

test("留给你确认、自动检查、没翻成：各自的数据集和筛选", async () => {
  const { fetchData, calls } = fakeFetch((dataset) => view(dataset === "escalated"
    ? [{ item_id: "p002-b001", reader_item_id: "p002-b0001", page: 2, reason: "2 轮后仍未解决", categories: ["terminology"], attempts: ["patch:rejected", "rewrite:applied"] }]
    : []));
  const loader = createQualityListLoader(fetchData);
  const escalated = await loader("j", "escalated");
  assert.equal(escalated.items[0].title, "2 轮后仍未解决（terminology）");
  assert.equal(escalated.items[0].detail, "试过：patch:rejected；rewrite:applied");
  await loader("j", "qa");
  await loader("j", "untranslated");
  assert.deepEqual(calls.slice(1).map((c) => [c.dataset, JSON.stringify(c.query.filters)]), [
    ["qa_violations", '{"severity":["critical","major"]}'],
    ["translation_items", '{"final_status":"failed"}'],
  ]);
});

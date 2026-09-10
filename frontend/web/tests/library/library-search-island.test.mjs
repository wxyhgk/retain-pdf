import test from "node:test";
import assert from "node:assert/strict";
import {
  READING_STATUS_META,
  filterDocuments,
  highlightSegments,
  nextReadingStatus,
} from "../../src/features/library/ui/island/view-model.js";

test("highlightSegments 把 [ ] 包裹的命中词拆成高亮分段", () => {
  assert.deepEqual(highlightSegments("…考察了[光谱]系列中的[交换]反应…"), [
    { text: "…考察了", hit: false },
    { text: "光谱", hit: true },
    { text: "系列中的", hit: false },
    { text: "交换", hit: true },
    { text: "反应…", hit: false },
  ]);
  assert.deepEqual(highlightSegments("无命中"), [{ text: "无命中", hit: false }]);
  assert.deepEqual(highlightSegments(""), []);
});

test("nextReadingStatus 按 未读→在读→读完 循环", () => {
  assert.equal(nextReadingStatus("unread"), "reading");
  assert.equal(nextReadingStatus("reading"), "done");
  assert.equal(nextReadingStatus("done"), "unread");
  assert.equal(nextReadingStatus("bogus"), "unread");
  assert.deepEqual(Object.keys(READING_STATUS_META), ["unread", "reading", "done"]);
});

test("filterDocuments 按标题/文件名/标签匹配并叠加状态过滤", () => {
  const documents = [
    { document_id: "a", title: "光谱分析", source_filename: "spec.pdf", tags: [], reading_status: "reading" },
    { document_id: "b", title: "Attention", source_filename: "attn.pdf", tags: ["机器学习"], reading_status: "done" },
    { document_id: "c", title: "Scaling", source_filename: "scaling.pdf", tags: [], reading_status: "unread" },
  ];
  assert.deepEqual(filterDocuments(documents, { query: "光谱" }).map((d) => d.document_id), ["a"]);
  assert.deepEqual(filterDocuments(documents, { query: "机器学习" }).map((d) => d.document_id), ["b"]);
  assert.deepEqual(filterDocuments(documents, { query: "pdf" }).map((d) => d.document_id), ["a", "b", "c"]);
  assert.deepEqual(filterDocuments(documents, { query: "pdf", readingStatus: "done" }).map((d) => d.document_id), ["b"]);
  assert.deepEqual(filterDocuments(documents, {}).length, 3);
});

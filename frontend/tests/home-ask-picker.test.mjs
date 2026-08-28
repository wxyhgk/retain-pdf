import test from "node:test";
import assert from "node:assert/strict";
import {
  filterDocumentOptions,
  parseAtQuery,
} from "../src/pages/home/features/home-ask/document-picker.js";

test("parseAtQuery: phân tích khi con trỏ đứng sau @query", () => {
  const text = "帮我总结 @halogen";
  const caret = text.length;
  const parsed = parseAtQuery(text, caret);
  assert.deepEqual(parsed, { start: text.indexOf("@"), query: "halogen" });
});

test("parseAtQuery: không kích hoạt với văn bản thông thường", () => {
  assert.equal(parseAtQuery("hello world", 5), null);
  assert.equal(parseAtQuery("email@x.com", 11), null);
});

test("parseAtQuery: có thể phân tích @ ở đầu dòng", () => {
  assert.deepEqual(parseAtQuery("@doc", 4), { start: 0, query: "doc" });
});

test("filterDocumentOptions: loại mục đã chọn và lọc theo tiêu đề", () => {
  const options = [
    { kind: "document", id: "a", title: "Alpha paper" },
    { kind: "document", id: "b", title: "Beta notes" },
    { kind: "document", id: "c", title: "Gamma" },
  ];
  const filtered = filterDocumentOptions(options, "beta", ["document:a"]);
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].id, "b");
});

test("filterDocumentOptions: có thể khớp bộ sưu tập", () => {
  const options = [
    { kind: "collection", id: "col-1", title: "量子化学", document_count: 4 },
    { kind: "document", id: "d1", title: "Other paper" },
  ];
  const filtered = filterDocumentOptions(options, "量子", []);
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].kind, "collection");
  assert.equal(filtered[0].id, "col-1");
});

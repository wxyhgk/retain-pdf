import test from "node:test";
import assert from "node:assert/strict";
import {
  filterDocumentOptions,
  parseAtQuery,
} from "../../src/features/ask/domain/document-picker.js";

test("parseAtQuery: 光标在 @query 后时解析", () => {
  const text = "帮我总结 @halogen";
  const caret = text.length;
  const parsed = parseAtQuery(text, caret);
  assert.deepEqual(parsed, { start: text.indexOf("@"), query: "halogen" });
});

test("parseAtQuery: 普通文本不触发", () => {
  assert.equal(parseAtQuery("hello world", 5), null);
  assert.equal(parseAtQuery("email@x.com", 11), null);
});

test("parseAtQuery: 行首 @ 可解析", () => {
  assert.deepEqual(parseAtQuery("@doc", 4), { start: 0, query: "doc" });
});

test("filterDocumentOptions: 排除已选并按标题过滤", () => {
  const options = [
    { kind: "document", id: "a", title: "Alpha paper" },
    { kind: "document", id: "b", title: "Beta notes" },
    { kind: "document", id: "c", title: "Gamma" },
  ];
  const filtered = filterDocumentOptions(options, "beta", ["document:a"]);
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].id, "b");
});

test("filterDocumentOptions: 可匹配合集", () => {
  const options = [
    { kind: "collection", id: "col-1", title: "量子化学", document_count: 4 },
    { kind: "document", id: "d1", title: "Other paper" },
  ];
  const filtered = filterDocumentOptions(options, "量子", []);
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].kind, "collection");
  assert.equal(filtered[0].id, "col-1");
});

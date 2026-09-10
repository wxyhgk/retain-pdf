import test from "node:test";
import assert from "node:assert/strict";
import {
  ANNOTATION_KIND_META,
  annotationAnchor,
  buildAnnotationsMarkdown,
  groupAnnotationsByPage,
  sortAnnotations,
} from "../../src/features/reader/domain.js";

// 造一条最小批注:测试里只覆写关心的字段
function makeAnnotation(overrides = {}) {
  return {
    favoriteId: "fav-1",
    documentId: "doc-1",
    jobId: "job-1",
    pageIdx: 0,
    blockId: "blk-1",
    kind: "sentence",
    quoteText: "原文",
    translatedQuoteText: "",
    note: "",
    createdAt: "2026-07-01T00:00:00Z",
    ...overrides,
  };
}

test("sortAnnotations 先按页码升序,同页按创建时间升序", () => {
  const annotations = [
    makeAnnotation({ favoriteId: "c", pageIdx: 2, createdAt: "2026-07-01T00:00:00Z" }),
    makeAnnotation({ favoriteId: "b", pageIdx: 0, createdAt: "2026-07-02T00:00:00Z" }),
    makeAnnotation({ favoriteId: "a", pageIdx: 0, createdAt: "2026-07-01T00:00:00Z" }),
  ];
  assert.deepEqual(sortAnnotations(annotations).map((item) => item.favoriteId), ["a", "b", "c"]);
  // 不改动入参数组本身
  assert.deepEqual(annotations.map((item) => item.favoriteId), ["c", "b", "a"]);
});

test("sortAnnotations 非数组入参返回空数组", () => {
  assert.deepEqual(sortAnnotations(null), []);
  assert.deepEqual(sortAnnotations(undefined), []);
  assert.deepEqual(sortAnnotations("oops"), []);
});

test("groupAnnotationsByPage 按页分组且组内保持时间序", () => {
  const groups = groupAnnotationsByPage([
    makeAnnotation({ favoriteId: "p3", pageIdx: 3 }),
    makeAnnotation({ favoriteId: "p0-late", pageIdx: 0, createdAt: "2026-07-02T00:00:00Z" }),
    makeAnnotation({ favoriteId: "p0-early", pageIdx: 0, createdAt: "2026-07-01T00:00:00Z" }),
  ]);
  assert.deepEqual(
    groups.map((group) => ({ pageIdx: group.pageIdx, ids: group.items.map((item) => item.favoriteId) })),
    [
      { pageIdx: 0, ids: ["p0-early", "p0-late"] },
      { pageIdx: 3, ids: ["p3"] },
    ],
  );
  assert.deepEqual(groupAnnotationsByPage([]), []);
});

test("buildAnnotationsMarkdown 输出标题/页小节/引用块/译文/笔记", () => {
  const markdown = buildAnnotationsMarkdown({
    title: "Attention",
    annotations: [
      // 故意乱序传入,导出应先排序再分组
      makeAnnotation({ favoriteId: "f2", pageIdx: 1, quoteText: "第二页数据", kind: "data" }),
      makeAnnotation({
        favoriteId: "f1",
        pageIdx: 0,
        quoteText: "line1\nline2",
        translatedQuoteText: "trans1\ntrans2",
        note: "重要",
        createdAt: "2026-07-02T00:00:00Z",
      }),
      makeAnnotation({ favoriteId: "f0", pageIdx: 0, quoteText: "图注", kind: "figure" }),
    ],
  });
  assert.equal(
    markdown,
    "# Attention 批注\n" +
      "\n" +
      "## 第 1 页\n" +
      "\n" +
      "> 图注\n" +
      "\n" +
      "> line1\n" +
      "> line2\n" +
      "> —— trans1\n" +
      "> trans2\n" +
      "\n" +
      "笔记:重要\n" +
      "\n" +
      "## 第 2 页\n" +
      "\n" +
      "> 第二页数据\n",
  );
});

test("buildAnnotationsMarkdown 空列表输出占位文案", () => {
  assert.equal(buildAnnotationsMarkdown({ title: "Attention", annotations: [] }), "# Attention 批注\n\n(暂无批注)\n");
  assert.equal(buildAnnotationsMarkdown({}), "# 批注\n\n(暂无批注)\n");
});

test("annotationAnchor 只暴露跳转所需的页码与块 id", () => {
  assert.deepEqual(annotationAnchor(makeAnnotation({ pageIdx: 4, blockId: "blk-9" })), { pageIdx: 4, blockId: "blk-9" });
});

test("ANNOTATION_KIND_META 覆盖三种批注类型", () => {
  assert.deepEqual(Object.keys(ANNOTATION_KIND_META), ["sentence", "data", "figure"]);
});

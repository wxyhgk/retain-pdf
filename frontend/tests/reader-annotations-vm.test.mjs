import test from "node:test";
import assert from "node:assert/strict";
import {
  ANNOTATION_KIND_META,
  annotationAnchor,
  buildAnnotationsMarkdown,
  groupAnnotationsByPage,
  sortAnnotations,
} from "../src/js/reader/annotations/view-model.js";

// Tạo một chú thích tối thiểu: trong kiểm thử chỉ ghi đè các trường quan tâm
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

test("sortAnnotations sắp xếp theo số trang tăng dần, cùng trang theo thời gian tạo tăng dần", () => {
  const annotations = [
    makeAnnotation({ favoriteId: "c", pageIdx: 2, createdAt: "2026-07-01T00:00:00Z" }),
    makeAnnotation({ favoriteId: "b", pageIdx: 0, createdAt: "2026-07-02T00:00:00Z" }),
    makeAnnotation({ favoriteId: "a", pageIdx: 0, createdAt: "2026-07-01T00:00:00Z" }),
  ];
  assert.deepEqual(sortAnnotations(annotations).map((item) => item.favoriteId), ["a", "b", "c"]);
  // không sửa đổi mảng đầu vào
  assert.deepEqual(annotations.map((item) => item.favoriteId), ["c", "b", "a"]);
});

test("sortAnnotations với đầu vào không phải mảng trả về mảng rỗng", () => {
  assert.deepEqual(sortAnnotations(null), []);
  assert.deepEqual(sortAnnotations(undefined), []);
  assert.deepEqual(sortAnnotations("oops"), []);
});

test("groupAnnotationsByPage nhóm theo trang và giữ thứ tự thời gian trong nhóm", () => {
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

test("buildAnnotationsMarkdown xuất tiêu đề/mục trang/khối trích dẫn/bản dịch/ghi chú", () => {
  const markdown = buildAnnotationsMarkdown({
    title: "Attention",
    annotations: [
      // cố ý truyền vào không theo thứ tự, xuất ra nên sắp xếp trước rồi mới nhóm
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
    "# Chú thích Attention\n" +
      "\n" +
      "## Trang 1\n" +
      "\n" +
      "> 图注\n" +
      "\n" +
      "> line1\n" +
      "> line2\n" +
      "> —— trans1\n" +
      "> trans2\n" +
      "\n" +
      "Ghi chú: quan trọng\n" +
      "\n" +
      "## Trang 2\n" +
      "\n" +
      "> 第二页数据\n",
  );
});

test("buildAnnotationsMarkdown danh sách rỗng xuất văn bản giữ chỗ", () => {
  assert.equal(buildAnnotationsMarkdown({ title: "Attention", annotations: [] }), "# Chú thích Attention\n\n(Không có chú thích)\n");
  assert.equal(buildAnnotationsMarkdown({}), "# Chú thích\n\n(Không có chú thích)\n");
});

test("annotationAnchor chỉ hiển thị số trang và block id cần cho chuyển hướng", () => {
  assert.deepEqual(annotationAnchor(makeAnnotation({ pageIdx: 4, blockId: "blk-9" })), { pageIdx: 4, blockId: "blk-9" });
});

test("ANNOTATION_KIND_META bao phủ ba loại chú thích", () => {
  assert.deepEqual(Object.keys(ANNOTATION_KIND_META), ["sentence", "data", "figure"]);
});

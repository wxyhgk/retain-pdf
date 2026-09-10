import test from "node:test";
import assert from "node:assert/strict";

const { deriveLibraryPageState } = await import(
  "../../src/features/library/domain/library-page-state.js"
);

test("library page state: 有卡片时始终保持列表，普通刷新不显示加载占位", () => {
  assert.deepEqual(deriveLibraryPageState({
    items: [{ document_id: "doc-1" }],
    loadingState: "ready",
    error: "",
    query: "",
    viewMode: "loading",
  }), {
    mode: "list",
    loadMoreLoading: false,
    errorMessage: "暂无最近任务",
    emptyMessage: "暂无最近任务",
  });
});

test("library page state: 有卡片的 loading 只映射为 load-more loading", () => {
  assert.deepEqual(deriveLibraryPageState({
    items: [{ document_id: "doc-1" }],
    loadingState: "loading",
  }), {
    mode: "list",
    loadMoreLoading: true,
    errorMessage: "暂无最近任务",
    emptyMessage: "暂无最近任务",
  });
});

test("library page state: 空列表初次加载显示 loading", () => {
  assert.equal(deriveLibraryPageState({
    items: [],
    loadingState: "loading",
  }).mode, "loading");
});

test("library page state: home error 是空列表的权威错误通道", () => {
  assert.deepEqual(deriveLibraryPageState({
    items: [],
    loadingState: "error",
    error: "network down",
  }), {
    mode: "error",
    loadMoreLoading: false,
    errorMessage: "network down",
    emptyMessage: "暂无最近任务",
  });
});

test("library page state: 兼容 view error 保留旧边缘错误文案优先级", () => {
  assert.deepEqual(deriveLibraryPageState({
    items: [],
    loadingState: "ready",
    error: "home error",
    viewMode: "error",
    viewMessage: "legacy edge error",
  }), {
    mode: "error",
    loadMoreLoading: false,
    errorMessage: "legacy edge error",
    emptyMessage: "暂无最近任务",
  });
});

test("library page state: 搜索空结果使用搜索文案，输入会被 trim", () => {
  assert.deepEqual(deriveLibraryPageState({
    items: [],
    loadingState: "ready",
    query: "  quantum  ",
  }), {
    mode: "empty",
    loadMoreLoading: false,
    errorMessage: "暂无最近任务",
    emptyMessage: "没有匹配的书籍",
  });
});

test("library page state: 有旧列表时刷新失败仍展示列表", () => {
  assert.deepEqual(deriveLibraryPageState({
    items: [{ document_id: "doc-old" }],
    loadingState: "error",
    error: "refresh failed",
  }), {
    mode: "list",
    loadMoreLoading: false,
    errorMessage: "refresh failed",
    emptyMessage: "暂无最近任务",
  });
});

import test from "node:test";
import assert from "node:assert/strict";
import {
  createReaderServerFavoritesPort,
  dedupeServerFavorites,
  normalizeServerFavorite,
} from "../../src/features/reader/domain.js";
import { deleteFavorite } from "@/platform/api/legacy/favorites.js";

const API_FAVORITE = {
  favorite_id: "fav-1",
  document_id: "doc-1",
  job_id: "job-1",
  page_idx: 3,
  block_id: "b-3-7",
  kind: "sentence",
  quote_text: "引文快照",
  translated_quote_text: "translated snapshot",
  note: "",
  created_at: "2026-07-01T08:00:00Z",
};

// ===== 归一化:API snake_case → 阅读器视图记录 =====

test("normalizeServerFavorite:API 收藏转视图记录,page_idx 保持 0 基", () => {
  const record = normalizeServerFavorite(API_FAVORITE);
  assert.deepEqual(record, {
    favoriteId: "fav-1",
    documentId: "doc-1",
    jobId: "job-1",
    pageIdx: 3,
    blockId: "b-3-7",
    kind: "sentence",
    quoteText: "引文快照",
    translatedQuoteText: "translated snapshot",
    note: "",
    createdAt: "2026-07-01T08:00:00Z",
  });
});

test("normalizeServerFavorite:缺 favorite_id/quote_text 丢弃,非法 page_idx 归 0,kind 默认 sentence", () => {
  assert.equal(normalizeServerFavorite({ ...API_FAVORITE, favorite_id: "" }), null);
  assert.equal(normalizeServerFavorite({ ...API_FAVORITE, quote_text: "  " }), null);
  assert.equal(normalizeServerFavorite(null), null);
  const fallback = normalizeServerFavorite({ ...API_FAVORITE, page_idx: "abc", kind: "" });
  assert.equal(fallback.pageIdx, 0);
  assert.equal(fallback.kind, "sentence");
});

test("loadServerFavorites:按 job_id 直查 document_id 并归一化,脏数据被过滤", async () => {
  const loadCalls = [];
  const port = createReaderServerFavoritesPort({
    jobId: "job-1",
    apiPrefix: "/api/v1",
    documentByJobId: async (_apiPrefix, jobId) => (jobId === "job-1"
      ? { document_id: "doc-1", active_job_id: "job-1" }
      : null),
    loadFavorites: async (apiPrefix, options) => {
      loadCalls.push({ apiPrefix, options });
      return {
        favorites: [
          API_FAVORITE,
          { ...API_FAVORITE, favorite_id: "fav-bad", quote_text: "" },
        ],
      };
    },
  });
  const records = await port.loadServerFavorites();
  assert.deepEqual(loadCalls, [{ apiPrefix: "/api/v1", options: { documentId: "doc-1" } }]);
  assert.equal(records.length, 1);
  assert.equal(records[0].favoriteId, "fav-1");
  assert.equal(await port.resolveDocumentId(), "doc-1");
});

test("loadServerFavorites:查不到文档/请求失败一律静默返回空数组", async () => {
  // mock 模式不再短路:api 层自带 mock 分支,基线与 e2e 依赖 mock 全流程可用
  const missingPort = createReaderServerFavoritesPort({
    jobId: "job-x",
    documentByJobId: async () => null,
    loadFavorites: async () => {
      throw new Error("should not be called");
    },
  });
  assert.deepEqual(await missingPort.loadServerFavorites(), []);

  const failingPort = createReaderServerFavoritesPort({
    jobId: "job-1",
    documentByJobId: async () => ({ document_id: "doc-1", active_job_id: "job-1" }),
    loadFavorites: async () => {
      throw new Error("network down");
    },
  });
  assert.deepEqual(await failingPort.loadServerFavorites(), []);
});

// ===== 去重:本地已同步(serverFavoriteId)的记录不在云端区重复展示 =====

test("dedupeServerFavorites:favorite_id 命中本地 serverFavoriteId 时剔除", () => {
  const serverRecords = [
    normalizeServerFavorite(API_FAVORITE),
    normalizeServerFavorite({ ...API_FAVORITE, favorite_id: "fav-2", quote_text: "另一条" }),
  ];
  const localItems = [
    { id: "local-1", serverFavoriteId: "fav-1" },
    { id: "local-2" },
  ];
  const visible = dedupeServerFavorites(serverRecords, localItems);
  assert.deepEqual(visible.map((item) => item.favoriteId), ["fav-2"]);
  assert.deepEqual(
    dedupeServerFavorites(serverRecords, []).map((item) => item.favoriteId),
    ["fav-1", "fav-2"],
  );
  assert.deepEqual(dedupeServerFavorites(null, null), []);
});

// ===== 删除流程:端口尽力而为 + API 层真正发 DELETE =====

test("removeServerFavorite:成功返回 true,失败/空 id 返回 false", async () => {
  const deleteCalls = [];
  const port = createReaderServerFavoritesPort({
    jobId: "job-1",
    apiPrefix: "/api/v1",
    removeFavorite: async (apiPrefix, favoriteId) => {
      deleteCalls.push({ apiPrefix, favoriteId });
      return { deleted: true };
    },
  });
  assert.equal(await port.removeServerFavorite("fav-1"), true);
  assert.deepEqual(deleteCalls, [{ apiPrefix: "/api/v1", favoriteId: "fav-1" }]);
  assert.equal(await port.removeServerFavorite(""), false);

  const failingPort = createReaderServerFavoritesPort({
    jobId: "job-1",
    removeFavorite: async () => {
      throw new Error("500");
    },
  });
  assert.equal(await failingPort.removeServerFavorite("fav-1"), false, "删除失败不抛错,返回 false");
});

test("deleteFavorite API:对 /favorites/:favorite_id 发 DELETE(mock fetch)", async () => {
  const originalWindow = globalThis.window;
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.window = { location: { search: "", protocol: "http:", hostname: "127.0.0.1" } };
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url, options });
    return {
      ok: true,
      json: async () => ({ code: 0, data: { deleted: true }, message: "ok" }),
    };
  };
  try {
    const result = await deleteFavorite("/api/v1", "fav 中文/id");
    assert.equal(calls.length, 1);
    assert.equal(calls[0].options.method, "DELETE");
    assert.match(calls[0].url, /\/api\/v1\/favorites\/fav%20%E4%B8%AD%E6%96%87%2Fid$/);
    assert.deepEqual(result, { deleted: true });
    await assert.rejects(() => deleteFavorite("/api/v1", "   "), /favorite_id/);
  } finally {
    globalThis.window = originalWindow;
    globalThis.fetch = originalFetch;
  }
});

import test from "node:test";
import assert from "node:assert/strict";
import {
  MOCK_DOCUMENT_ID,
  createMockFavorite,
  deleteMockFavorite,
  getMockDocument,
  getMockDocumentList,
  getMockFavorites,
  getMockSearchHits,
  countMockFavoritesByJob,
  patchMockDocument,
  translateMockDocument,
  deleteMockDocument,
} from "@/platform/mock/documents.js";
import { MOCK_JOB_ID } from "@/platform/mock/constants.js";
import { createRecentJobActions } from "../../src/features/library/domain/recent-jobs/actions.js";

// ===== documents:形状与语义(与后端对接说明对齐) =====

test("mock 文档列表支持 reading_status 与 tag 过滤", () => {
  const all = getMockDocumentList();
  assert.ok(all.documents.length >= 3);
  for (const doc of all.documents) {
    assert.ok(doc.document_id);
    // 文档中心模型:active_job_id 可空(馆藏态,只入库未翻译),不再是硬不变量。
    assert.ok(["unread", "reading", "done"].includes(doc.reading_status));
    assert.ok(Array.isArray(doc.tags));
    // API 层给每篇文档填三个媒体 URL(镜像后端 with_document_media_urls)。
    assert.ok(doc.source_pdf_url, "source_pdf_url 让馆藏文档也能读原文");
    assert.ok(doc.cover_url);
    assert.ok(doc.thumbnail_url);
  }
  // 既有翻译过的文档、也有馆藏态文档(无 active_job_id)。
  assert.ok(all.documents.some((doc) => `${doc.active_job_id || ""}`.trim()), "存在已翻译文档");
  assert.ok(
    all.documents.some((doc) => !`${doc.active_job_id || ""}`.trim()),
    "存在馆藏态文档(无 active_job_id)",
  );
  const reading = getMockDocumentList({ readingStatus: "reading" });
  assert.ok(reading.documents.every((doc) => doc.reading_status === "reading"));
  const tagged = getMockDocumentList({ tag: "化学" });
  assert.ok(tagged.documents.length >= 1);
  assert.ok(tagged.documents.every((doc) => doc.tags.includes("化学")));
});

test("translateMockDocument:给馆藏文档挂 active_job_id 并返回提交视图", () => {
  const before = getMockDocumentList().documents.find((doc) => !`${doc.active_job_id || ""}`.trim());
  assert.ok(before, "至少一篇馆藏文档");
  const submission = translateMockDocument(before.document_id);
  assert.equal(submission.document_id, before.document_id);
  assert.ok(submission.job_id, "返回 job_id");
  assert.ok(["queued", "running", "pending"].includes(submission.status));
  const after = getMockDocument(before.document_id);
  assert.equal(after.active_job_id, submission.job_id, "馆藏文档挂上 active_job_id");
  // 幂等保护:已在翻译流程中再发起应报错。
  assert.throws(() => translateMockDocument(before.document_id), /409/);
});

test("deleteMockDocument:删除后从列表消失,再取抛 404", () => {
  // 用第二篇馆藏文档(其它 test 不碰它,避免跨用例状态串扰)。
  const target = "doc-ref-9b7e04";
  assert.ok(getMockDocumentList({ limit: 999 }).documents.some((doc) => doc.document_id === target));
  const result = deleteMockDocument(target);
  assert.equal(result.deleted, true);
  assert.equal(result.document_id, target);
  assert.equal(
    getMockDocumentList({ limit: 999 }).documents.some((doc) => doc.document_id === target),
    false,
    "删除后不在列表里",
  );
  assert.throws(() => getMockDocument(target), /404/);
  assert.throws(() => deleteMockDocument(target), /404/, "再删一次报 404");
});

test("deleteMockDocument:被收藏引用时报 409", () => {
  // MOCK_DOCUMENT_ID 有两条 mock 收藏(fav-001/fav-002)→ 删除应被挡下。
  assert.throws(() => deleteMockDocument(MOCK_DOCUMENT_ID), /409/);
});

test("PATCH 文档:reading_status 校验与 tags 整体替换语义", () => {
  assert.throws(() => patchMockDocument(MOCK_DOCUMENT_ID, { reading_status: "archived" }), /400/);
  const updated = patchMockDocument(MOCK_DOCUMENT_ID, { tags: ["新标签"] });
  assert.deepEqual(updated.tags, ["新标签"]);
  const cleared = patchMockDocument(MOCK_DOCUMENT_ID, { tags: [] });
  assert.deepEqual(cleared.tags, [], "传 [] 即清空");
  patchMockDocument(MOCK_DOCUMENT_ID, { reading_status: "done" });
  assert.equal(getMockDocument(MOCK_DOCUMENT_ID).reading_status, "done");
});

// ===== favorites:必填校验、active_job_id 锚定、排序 =====

test("创建收藏:必填字段校验与 job_id 自动锚定 active_job_id", () => {
  assert.throws(() => createMockFavorite({ document_id: MOCK_DOCUMENT_ID }), /400/);
  const favorite = createMockFavorite({
    document_id: MOCK_DOCUMENT_ID,
    page_idx: 5,
    block_id: "b-test-1",
    quote_text: "测试引文快照",
  });
  assert.equal(favorite.job_id, getMockDocument(MOCK_DOCUMENT_ID).active_job_id, "不传 job_id 时锚定文档的 active_job_id");
  assert.equal(favorite.kind, "sentence", "kind 默认 sentence");
  deleteMockFavorite(favorite.favorite_id);
});

test("收藏列表:按文档过滤时按页码排序", () => {
  const byDocument = getMockFavorites({ documentId: MOCK_DOCUMENT_ID });
  const pages = byDocument.favorites.map((item) => item.page_idx);
  assert.deepEqual(pages, [...pages].sort((a, b) => a - b));
  for (const item of byDocument.favorites) {
    // 锚点四元组齐备,job_id + page + block 即阅读器定位坐标
    assert.ok(item.document_id && item.job_id && item.block_id);
    assert.equal(typeof item.page_idx, "number");
    assert.ok(item.quote_text, "quote_text 引文快照必存在");
  }
});

// ===== search:命中形状与高亮包裹 =====

test("检索命中带锚点四元组,命中词以 [ ] 包裹", () => {
  const { hits } = getMockSearchHits("光谱");
  assert.ok(hits.length > 0);
  for (const hit of hits) {
    assert.ok(hit.document_id && hit.job_id && hit.block_id);
    assert.equal(typeof hit.page_idx, "number");
    assert.match(hit.source_snippet, /\[光谱\]/);
  }
  assert.deepEqual(getMockSearchHits("").hits, []);
});

// ===== 删除保护:409 呈现为友好文案,绝不自动 force =====

test("删除被收藏引用的 job:呈现收藏数量提示而非自动强删", async () => {
  assert.ok(countMockFavoritesByJob(MOCK_JOB_ID) > 0, "前置:mock job 存在收藏引用");
  const errors = [];
  const deleteCalls = [];
  const actions = createRecentJobActions({
    apiPrefix: "/api/v1",
    navigationPort: { openJob() {}, openReader() {} },
    deleteLibraryBook: async (_prefix, jobId, options = {}) => {
      deleteCalls.push([jobId, options]);
      const conflict = new Error(`该 job 被 3 条收藏引用(409)`);
      conflict.status = 409;
      throw conflict;
    },
    renderCurrentRecentJobs() {},
    renderRecentJobsEmpty() {},
    renderRecentJobsError: (message) => errors.push(message),
    statePort: {
      removeJobFamily() {
        throw new Error("409 时不应继续删除本地条目");
      },
      getSnapshot: () => ({ items: [] }),
    },
  });

  await actions.deleteJob(MOCK_JOB_ID);

  assert.equal(deleteCalls.length, 1, "绝不自动 force 重试");
  assert.deepEqual(deleteCalls[0][1], {});
  assert.equal(errors.length, 1);
  assert.match(errors[0], /该文档有 3 条收藏，请先删除收藏/);
});

test("按 job_id 直查文档:active_job_id 命中 + 历史 run 也解析到同一文档", async () => {
  // isMockMode 靠 window.location.search 的 ?mock=,置好后再动态 import api 层
  globalThis.window = { location: { search: "?mock=succeeded", protocol: "http:", hostname: "127.0.0.1" } };
  const { fetchDocumentByJobId } = await import("@/platform/api/legacy/documents.js");
  // active_job_id 命中
  const active = await fetchDocumentByJobId("/api/v1", MOCK_JOB_ID);
  assert.equal(active?.document_id, MOCK_DOCUMENT_ID);
  // 历史 run(非 active)——正是 #1 要解决的:反查列表会漏,直查能命中
  const historical = await fetchDocumentByJobId("/api/v1", "mock-job-20260101-old");
  assert.equal(historical?.document_id, MOCK_DOCUMENT_ID, "历史 run 解析到所属文档");
  // 不属于任何文档 → null
  assert.equal(await fetchDocumentByJobId("/api/v1", "job-nonexistent"), null);
  assert.equal(await fetchDocumentByJobId("/api/v1", ""), null);
});

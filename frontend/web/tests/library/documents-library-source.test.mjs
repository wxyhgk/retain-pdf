import test from "node:test";
import assert from "node:assert/strict";
import {
  shapeDocumentCardItem,
  syntheticLibraryJobId,
  isLibraryOnlyItem,
  LIBRARY_ONLY_JOB_PREFIX,
} from "../../src/features/library/domain/documents/document-card-item.js";
import { collectDocumentLibraryPage } from "../../src/features/library/domain/documents/document-library-source.js";

// ===== shapeDocumentCardItem:三种文档态映射 =====

test("已翻译文档:合并 library/books 活态,保留真实 job_id 与文档身份", () => {
  const document = {
    document_id: "docA",
    title: "共轭选择性",
    source_filename: "a.pdf",
    page_count: 10,
    active_job_id: "20260601-a",
    reading_status: "reading",
    tags: ["化学"],
    source_pdf_url: "/api/v1/documents/docA/source.pdf",
    cover_url: "/api/v1/documents/docA/cover",
    updated_at: "2026-06-01T12:00:00Z",
  };
  const book = {
    id: "20260601-a",
    job_id: "20260601-a",
    title: "a.pdf",
    status: "succeeded",
    stage: "finished",
    progress: { current: 10, total: 10, percent: 100, unit: "none" },
    cover_url: "/api/v1/library/books/20260601-a/cover",
    page_count: 10,
    updated_at: "2026-06-01T12:00:00Z",
  };
  const item = shapeDocumentCardItem(document, book);
  assert.equal(item.library_only, false);
  assert.equal(item.job_id, "20260601-a", "保留真实 job_id → 轮询/对照阅读可用");
  assert.equal(item.document_id, "docA");
  assert.equal(item.status, "succeeded");
  assert.equal(item.reading_status, "reading");
  assert.deepEqual(item.tags, ["化学"]);
  assert.equal(item.source_pdf_url, "/api/v1/documents/docA/source.pdf");
  // book 带了 cover → 用 book 的(与现网格视觉一致)
  assert.equal(item.cover_url, "/api/v1/library/books/20260601-a/cover");
});

test("已翻译但 book 缺 cover:封面回退到文档级 cover_url", () => {
  const item = shapeDocumentCardItem(
    { document_id: "docA", active_job_id: "j1", cover_url: "/api/v1/documents/docA/cover" },
    { job_id: "j1", status: "running", progress: {} },
  );
  assert.equal(item.cover_url, "/api/v1/documents/docA/cover");
});

test("馆藏文档(无 active_job_id):合成 job_id + library_only 标记", () => {
  const item = shapeDocumentCardItem({
    document_id: "docRef",
    title: "工具书",
    source_filename: "ref.pdf",
    page_count: 42,
    active_job_id: null,
    reading_status: "unread",
    tags: ["工具书"],
    source_pdf_url: "/api/v1/documents/docRef/source.pdf",
    cover_url: "/api/v1/documents/docRef/cover",
    updated_at: "2026-06-10T09:00:00Z",
  }, null);
  assert.equal(item.library_only, true);
  assert.equal(item.job_id, `${LIBRARY_ONLY_JOB_PREFIX}docRef`);
  assert.equal(item.job_id, syntheticLibraryJobId("docRef"));
  assert.ok(isLibraryOnlyItem(item));
  assert.equal(item.active_job_id, "");
  assert.equal(item.status, "");
  assert.equal(item.title, "工具书");
  assert.equal(item.cover_url, "/api/v1/documents/docRef/cover");
  assert.equal(item.source_pdf_url, "/api/v1/documents/docRef/source.pdf");
});

test("空字符串 active_job_id 也当馆藏处理", () => {
  const item = shapeDocumentCardItem({ document_id: "d", active_job_id: "" }, null);
  assert.equal(item.library_only, true);
  assert.equal(item.job_id, syntheticLibraryJobId("d"));
});

test("有 active_job_id 但 book 缺失:保留真实 job_id,非馆藏,状态空", () => {
  const item = shapeDocumentCardItem(
    { document_id: "d", active_job_id: "j-missing", title: "x", page_count: 3 },
    null,
  );
  assert.equal(item.library_only, false);
  assert.equal(item.job_id, "j-missing");
  assert.equal(item.status, "");
});

test("OCR-only active job falls back to canonical job payload and keeps readiness", async () => {
  const calls = [];
  const page = await collectDocumentLibraryPage({
    fetchDocumentList: async () => ({
      documents: [{
        document_id: "doc-ocr",
        active_job_id: "job-ocr-root",
        title: "OCR source",
        source_filename: "ocr-source.pdf",
        page_count: 12,
      }],
      total: 1,
    }),
    fetchLibraryBookList: async (_apiPrefix, { jobIds }) => {
      calls.push(["books", jobIds]);
      return { items: [] };
    },
    fetchJobPayload: async (jobId, options) => {
      calls.push(["job", jobId, options]);
      return {
        job_id: jobId,
        workflow: "ocr",
        status: "succeeded",
        stage_snapshot: {
          source: "display-stage",
          publicStage: "done",
          stageKey: "done",
          progress: { current: 12, total: 12, percent: 100, unit: "page" },
        },
        output_pdf_ready: false,
        markdown_ready: true,
        artifacts: {
          normalized_document: {
            ready: true,
            url: `/api/v1/jobs/${jobId}/normalized-document`,
          },
        },
      };
    },
    apiPrefix: "/api/v1",
    startOffset: 0,
    pageSize: 24,
    existingJobIds: new Set(),
  });

  assert.equal(page.collected.length, 1, "one document remains one card");
  const [item] = page.collected;
  assert.equal(item.document_id, "doc-ocr");
  assert.equal(item.job_id, "job-ocr-root");
  assert.equal(item.library_only, false);
  assert.equal(item.workflow, "ocr");
  assert.equal(item.status, "succeeded");
  assert.equal(item.markdown_ready, true);
  assert.equal(item.artifacts.normalized_document.ready, true);
  assert.deepEqual(calls, [
    ["books", ["job-ocr-root"]],
    ["job", "job-ocr-root", { apiPrefix: "/api/v1" }],
  ]);
});

test("OCR-only job fallback is best effort", async () => {
  const page = await collectDocumentLibraryPage({
    fetchDocumentList: async () => ({
      documents: [{ document_id: "doc-ocr-missing", active_job_id: "job-ocr-missing" }],
      total: 1,
    }),
    fetchLibraryBookList: async () => ({ items: [] }),
    fetchJobPayload: async () => {
      throw new Error("temporary unavailable");
    },
    apiPrefix: "/api/v1",
    startOffset: 0,
    pageSize: 24,
    existingJobIds: new Set(),
  });

  assert.equal(page.collected.length, 1);
  assert.equal(page.collected[0].job_id, "job-ocr-missing");
  assert.equal(page.collected[0].status, "");
});

// ===== collectDocumentLibraryPage:分页 + 合并 + 去重 + 搜索 =====

function makeFetchers({ documents, total, books }) {
  const calls = { documentQuery: null, bookJobIds: null };
  const fetchDocumentList = async (_prefix, params) => {
    calls.documentQuery = params;
    const offset = params.offset || 0;
    const limit = params.limit || documents.length;
    return { documents: documents.slice(offset, offset + limit), total, limit, offset };
  };
  const fetchLibraryBookList = async (_prefix, { jobIds = [] } = {}) => {
    calls.bookJobIds = jobIds;
    const wanted = new Set(jobIds);
    return { items: books.filter((b) => wanted.has(b.job_id)) };
  };
  return { fetchDocumentList, fetchLibraryBookList, calls };
}

test("整合一页:已翻译合并 book,馆藏用合成 id,hasMore 由 total 决定", async () => {
  const documents = [
    { document_id: "d1", active_job_id: "j1", title: "已翻译一", page_count: 5 },
    { document_id: "d2", active_job_id: null, title: "馆藏二", page_count: 8 },
    { document_id: "d3", active_job_id: "j3", title: "已翻译三", page_count: 9 },
  ];
  const books = [
    { job_id: "j1", status: "succeeded", progress: { percent: 100 } },
    { job_id: "j3", status: "running", progress: { percent: 40 } },
  ];
  const { fetchDocumentList, fetchLibraryBookList, calls } = makeFetchers({ documents, total: 5, books });

  const page = await collectDocumentLibraryPage({
    fetchDocumentList,
    fetchLibraryBookList,
    apiPrefix: "/api/v1",
    startOffset: 0,
    pageSize: 3,
    existingJobIds: new Set(),
    query: "",
  });

  assert.equal(page.collected.length, 3);
  assert.deepEqual(calls.bookJobIds, ["j1", "j3"], "只对有 active_job_id 的文档取 book");
  assert.equal(page.collected[0].status, "succeeded");
  assert.equal(page.collected[1].library_only, true);
  assert.equal(page.collected[1].job_id, syntheticLibraryJobId("d2"));
  assert.equal(page.collected[2].status, "running");
  assert.equal(page.hasMore, true, "3/5 → 还有更多");
  assert.equal(page.nextOffset, 3);
});

test("分页严格使用后端 total，并按实际返回条数推进 offset", async () => {
  const requested = [];
  const fetchDocumentList = async (_prefix, params) => {
    requested.push(params);
    return {
      documents: [
        { document_id: "d3", active_job_id: null, title: "第三篇" },
        { document_id: "d4", active_job_id: null, title: "第四篇" },
      ],
      total: 7,
      limit: 2,
      offset: 2,
    };
  };

  const page = await collectDocumentLibraryPage({
    fetchDocumentList,
    fetchLibraryBookList: async () => ({ items: [] }),
    apiPrefix: "/api/v1",
    startOffset: 2,
    pageSize: 24,
    existingJobIds: new Set(),
    query: "",
  });

  assert.deepEqual(requested, [{ limit: 24, offset: 2 }]);
  assert.equal(page.hasMore, true, "服务端 total=7，因此当前返回 2 条后仍有下一页");
  assert.equal(page.nextOffset, 4, "服务端可能限制页大小，不能直接跳过 24 条");
});

test("跨页去重:existingJobIds 命中的(含合成 id)不重复收集", async () => {
  const documents = [
    { document_id: "d1", active_job_id: "j1", title: "a" },
    { document_id: "d2", active_job_id: null, title: "b" },
  ];
  const { fetchDocumentList, fetchLibraryBookList } = makeFetchers({ documents, total: 2, books: [{ job_id: "j1", status: "succeeded" }] });
  const page = await collectDocumentLibraryPage({
    fetchDocumentList,
    fetchLibraryBookList,
    apiPrefix: "/api/v1",
    startOffset: 0,
    pageSize: 10,
    existingJobIds: new Set(["j1", syntheticLibraryJobId("d2")]),
    query: "",
  });
  assert.equal(page.collected.length, 0, "两条都已在既有集合里");
  assert.equal(page.hasMore, false);
});

test("跨页去重接受稳定 document identity", async () => {
  const { fetchDocumentList, fetchLibraryBookList } = makeFetchers({
    documents: [{ document_id: "d1", active_job_id: "job-retry", title: "a" }],
    total: 1,
    books: [{ job_id: "job-retry", status: "running" }],
  });
  const page = await collectDocumentLibraryPage({
    fetchDocumentList,
    fetchLibraryBookList,
    apiPrefix: "/api/v1",
    startOffset: 0,
    pageSize: 10,
    existingJobIds: new Set(["document:d1"]),
    query: "",
  });

  assert.deepEqual(page.collected, []);
});

test("搜索:客户端按标题过滤,hasMore 关闭", async () => {
  const documents = [
    { document_id: "d1", active_job_id: null, title: "量子化学导论" },
    { document_id: "d2", active_job_id: null, title: "机器学习基础" },
    { document_id: "d3", active_job_id: null, source_filename: "quantum-notes.pdf" },
  ];
  const { fetchDocumentList, fetchLibraryBookList, calls } = makeFetchers({ documents, total: 3, books: [] });
  const page = await collectDocumentLibraryPage({
    fetchDocumentList,
    fetchLibraryBookList,
    apiPrefix: "/api/v1",
    startOffset: 0,
    pageSize: 2,
    existingJobIds: new Set(),
    query: "量子",
  });
  assert.equal(page.collected.length, 1);
  assert.equal(page.collected[0].document_id, "d1");
  assert.equal(page.hasMore, false, "搜索态关闭继续分页");
  assert.ok((calls.documentQuery.limit || 0) >= 200, "搜索时一次多拉一批");
});

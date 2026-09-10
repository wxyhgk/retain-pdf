import { MOCK_JOB_ID } from "./constants.js";
import {
  buildLiveMockJobPayload,
  isLiveMockJobActive,
  registerLiveMockJob,
} from "./live-jobs.js";
import type { JobSubmissionView } from "@/platform/contracts/library-payloads.js";

export const MOCK_DOCUMENT_ID = "doc-9f2a41c8e77b";

/** API-shaped document record (mirrors backend documents layer). */
export type MockReadingStatus = "unread" | "reading" | "done";

export interface MockDocument {
  document_id: string;
  title: string;
  source_filename: string;
  page_count: number;
  bytes: number;
  active_job_id: string | null;
  reading_status: MockReadingStatus | string;
  tags: string[];
  added_at: string;
  updated_at: string;
  last_opened_at?: string | null;
  [key: string]: unknown;
}

/** Document after API media-url enrichment. */
export interface MockDocumentWithMedia extends MockDocument {
  source_pdf_url: string;
  cover_url: string;
  thumbnail_url: string;
}

export interface MockDocumentListQuery {
  limit?: number;
  offset?: number;
  readingStatus?: string;
  tag?: string;
  collectionId?: string;
}

export interface MockDocumentListResult {
  documents: MockDocumentWithMedia[];
  total: number;
  limit: number;
  offset: number;
}

export interface MockDocumentPatch {
  title?: string;
  reading_status?: MockReadingStatus | string;
  tags?: string[];
}

export interface MockCollection {
  collection_id: string;
  name: string;
  parent_id: string | null;
  sort_order: number;
  created_at: string;
}

export interface MockCollectionWithCount extends MockCollection {
  document_count: number;
}

export interface MockCollectionCreate {
  name?: string;
  parent_id?: string | null;
}

export interface MockCollectionPatch {
  name?: string;
  sort_order?: number;
}

export type MockFavoriteKind = "sentence" | "data" | "figure" | string;

export interface MockFavorite {
  favorite_id: string;
  document_id: string;
  job_id: string;
  page_idx: number;
  block_id: string;
  kind: MockFavoriteKind;
  quote_text: string;
  translated_quote_text: string;
  note: string;
  created_at: string;
  char_start?: number;
  char_end?: number;
}

export interface MockFavoriteCreatePayload {
  document_id?: string;
  job_id?: string;
  page_idx?: number;
  block_id?: string;
  kind?: MockFavoriteKind;
  quote_text?: string;
  translated_quote_text?: string;
  note?: string;
  char_start?: number;
  char_end?: number;
}

export interface MockSearchHit {
  document_id: string;
  job_id: string;
  page_idx: number;
  block_id: string;
  source_snippet: string;
  translated_snippet: string;
}

type HttpStatusError = Error & { status?: number };

// 与后端 documents 数据层形状一致(见后端对接说明):
// document = 按内容哈希去重的稳定身份,job 是文档名下的处理记录
function buildMockDocuments(): MockDocument[] {
  return [
    {
      document_id: MOCK_DOCUMENT_ID,
      title: "共轭在卤素-锂交换选择性中的作用",
      source_filename: "halogen-lithium-exchange.pdf",
      page_count: 10,
      bytes: 2_621_440,
      active_job_id: MOCK_JOB_ID,
      reading_status: "reading",
      tags: ["化学", "有机合成"],
      added_at: "2026-06-01T10:00:00Z",
      updated_at: "2026-06-01T12:00:00Z",
    },
    {
      document_id: "doc-1b8c52d9a304",
      title: "Attention Is All You Need",
      source_filename: "attention.pdf",
      page_count: 15,
      bytes: 1_843_200,
      active_job_id: "20260520-att-001",
      reading_status: "done",
      tags: ["机器学习"],
      added_at: "2026-05-20T08:00:00Z",
      updated_at: "2026-05-21T09:30:00Z",
    },
    {
      document_id: "doc-77e0fa3c1d55",
      title: "Scaling Laws for Neural Language Models",
      source_filename: "scaling-laws.pdf",
      page_count: 30,
      bytes: 4_115_000,
      active_job_id: "20260601-scl-002",
      reading_status: "unread",
      tags: [],
      added_at: "2026-06-08T14:00:00Z",
      updated_at: "2026-06-08T14:00:00Z",
    },
    // 馆藏态(只入库、未翻译):active_job_id 为空。文档中心网格要能显示它们,
    // 阅读器要能只读原文,卡片要能"以后再翻"。
    {
      document_id: "doc-ref-6a1f2c",
      title: "Reaxys Retrosynthesis 手册(仅馆藏)",
      source_filename: "reaxys-handbook.pdf",
      page_count: 42,
      bytes: 3_200_000,
      active_job_id: null,
      reading_status: "unread",
      tags: ["工具书"],
      added_at: "2026-06-10T09:00:00Z",
      updated_at: "2026-06-10T09:00:00Z",
    },
    {
      document_id: "doc-ref-9b7e04",
      title: "Group Theory Lecture Notes(仅馆藏)",
      source_filename: "group-theory-notes.pdf",
      page_count: 88,
      bytes: 5_600_000,
      active_job_id: "",
      reading_status: "reading",
      tags: [],
      added_at: "2026-06-12T15:30:00Z",
      updated_at: "2026-06-12T15:30:00Z",
    },
  ];
}

// 镜像后端 with_document_media_urls。封面/缩略图走 mock://，
// 避免 /api/v1/documents/.../cover 在纯前端 mock 下 404 导致空封面。
export const MOCK_DOCUMENT_SOURCE_PDF_URL = "mock://document-source.pdf";
export const MOCK_DOCUMENT_COVER_URL = "mock://document-cover.png";
export const MOCK_DOCUMENT_THUMB_URL = "mock://document-thumb.png";

function withMockDocumentMediaUrls(document: MockDocument): MockDocumentWithMedia {
  return {
    ...document,
    source_pdf_url: MOCK_DOCUMENT_SOURCE_PDF_URL,
    cover_url: MOCK_DOCUMENT_COVER_URL,
    thumbnail_url: MOCK_DOCUMENT_THUMB_URL,
  };
}

let mockDocuments: MockDocument[] | null = null;

function documents(): MockDocument[] {
  if (!mockDocuments) {
    mockDocuments = buildMockDocuments();
  }
  return mockDocuments;
}

export function getMockDocumentList({
  limit = 50,
  offset = 0,
  readingStatus = "",
  tag = "",
  collectionId = "",
}: MockDocumentListQuery = {}): MockDocumentListResult {
  let list = documents();
  if (`${readingStatus}`.trim()) {
    list = list.filter((item) => item.reading_status === `${readingStatus}`.trim());
  }
  if (`${tag}`.trim()) {
    list = list.filter((item) => item.tags.includes(`${tag}`.trim()));
  }
  if (`${collectionId}`.trim()) {
    const memberIds = collectionMembership(`${collectionId}`.trim());
    list = list.filter((item) => memberIds.has(item.document_id));
  }
  return {
    documents: list.slice(offset, offset + limit).map(withMockDocumentMediaUrls),
    total: list.length,
    limit,
    offset,
  };
}

export function getMockDocument(documentId: string): MockDocumentWithMedia {
  const found = documents().find((item) => item.document_id === documentId);
  if (!found) {
    throw new Error("未找到该文档。(404)");
  }
  return withMockDocumentMediaUrls(found);
}

// 后端按 job_id 直查所属文档:active_job_id 命中当然算,
// 历史 run(同一文档的旧翻译记录)也应解析到同一文档——用一张历史映射证明这条路可用。
const MOCK_HISTORICAL_JOB_TO_DOCUMENT: Record<string, string> = {
  "mock-job-20260101-old": MOCK_DOCUMENT_ID,
};

export function getMockDocumentByJobId(jobId: string): MockDocumentWithMedia | null {
  const normalized = `${jobId || ""}`.trim();
  if (!normalized) {
    return null;
  }
  const byActive = documents().find((item) => item.active_job_id === normalized);
  if (byActive) {
    return withMockDocumentMediaUrls(byActive);
  }
  const historicalDocId = MOCK_HISTORICAL_JOB_TO_DOCUMENT[normalized];
  if (historicalDocId) {
    const doc = documents().find((item) => item.document_id === historicalDocId);
    return doc ? withMockDocumentMediaUrls(doc) : null;
  }
  return null;
}

/**
 * 重试/新 job 绑定到文档：更新 active_job_id，并登记历史映射，
 * 使 getMockDocumentByJobId(新 id) 仍能取到书名/封面。
 */
export function bindMockDocumentActiveJob(
  documentId?: string | null,
  jobId?: string | null,
  options: { previousJobId?: string | null } = {},
): MockDocumentWithMedia | null {
  const docId = `${documentId || ""}`.trim();
  const nextJobId = `${jobId || ""}`.trim();
  if (!docId || !nextJobId) {
    return null;
  }
  const found = documents().find((item) => item.document_id === docId);
  if (!found) {
    return null;
  }
  const previous = `${options.previousJobId || found.active_job_id || ""}`.trim();
  found.active_job_id = nextJobId;
  found.updated_at = new Date().toISOString();
  if (previous && previous !== nextJobId) {
    MOCK_HISTORICAL_JOB_TO_DOCUMENT[previous] = docId;
  }
  MOCK_HISTORICAL_JOB_TO_DOCUMENT[nextJobId] = docId;
  return withMockDocumentMediaUrls(found);
}

// mock 版 DELETE /documents/:id:从 mock 文档表移除该文档(连同其合集成员关系)。
// 被收藏引用时抛 409(镜像后端收藏保护)。
export function deleteMockDocument(documentId: string): {
  deleted: boolean;
  document_id: string;
  removed_paths: string[];
} {
  const list = documents();
  const index = list.findIndex((item) => item.document_id === documentId);
  if (index < 0) {
    throw new Error("未找到该文档。(404)");
  }
  const favoriteCount = favorites().filter((item) => item.document_id === documentId).length;
  if (favoriteCount > 0) {
    const error: HttpStatusError = new Error(
      `该文档有 ${favoriteCount} 条收藏，请先删除收藏后再删除文档。(409)`,
    );
    error.status = 409;
    throw error;
  }
  list.splice(index, 1);
  if (mockCollectionMembership) {
    for (const members of mockCollectionMembership.values()) {
      members.delete(documentId);
    }
  }
  return { deleted: true, document_id: documentId, removed_paths: [] };
}

const READING_STATUSES: MockReadingStatus[] = ["unread", "reading", "done"];

export function patchMockDocument(
  documentId: string,
  { title, reading_status: readingStatus, tags }: MockDocumentPatch = {},
): MockDocumentWithMedia {
  const found = documents().find((item) => item.document_id === documentId);
  if (!found) {
    throw new Error("未找到该文档。(404)");
  }
  if (readingStatus !== undefined && !READING_STATUSES.includes(readingStatus as MockReadingStatus)) {
    throw new Error("reading_status 仅支持 unread | reading | done。(400)");
  }
  if (title !== undefined) {
    found.title = `${title}`;
  }
  if (readingStatus !== undefined) {
    found.reading_status = readingStatus;
  }
  if (tags !== undefined) {
    // 整体替换语义
    found.tags = Array.isArray(tags) ? tags.map((item) => `${item}`) : [];
  }
  found.updated_at = new Date().toISOString();
  return withMockDocumentMediaUrls(found);
}

// mock 版 POST /documents/:id/translate：登记 live 可推进任务，
// 轮询 getMockJobPayload 会随时间走 OCR→翻译→渲染→完成（见 mock/live-jobs）。
// 运行中再次提交 → 409；已终态可重新提交（方便反复演示）。
export function translateMockDocument(documentId: string): JobSubmissionView {
  const found = documents().find((item) => item.document_id === documentId);
  if (!found) {
    throw new Error("未找到该文档。(404)");
  }
  const existingId = `${found.active_job_id || ""}`.trim();
  if (existingId && isLiveMockJobActive(existingId)) {
    throw new Error("该文档已在翻译流程中。(409)");
  }
  const live = registerLiveMockJob({
    documentId: found.document_id,
    title: found.title,
    pageCount: found.page_count,
  });
  found.active_job_id = live.jobId;
  found.updated_at = new Date().toISOString();
  const snapshot = buildLiveMockJobPayload(live.jobId) || {};
  return {
    job_id: live.jobId,
    document_id: found.document_id,
    workflow: "book",
    status: `${snapshot.status || "queued"}`,
    stage: `${snapshot.stage || "queued"}`,
    display_stage: `${snapshot.display_stage || "ocr"}`,
    stage_detail: `${snapshot.stage_detail || "正在读取任务状态..."}`,
  };
}

export function ocrMockDocument(documentId: string): JobSubmissionView {
  const found = documents().find((item) => item.document_id === documentId);
  if (!found) {
    throw new Error("未找到该文档。(404)");
  }
  const previous = `${found.active_job_id || ""}`.trim();
  const jobId = `mock-ocr-${Date.now()}`;
  if (previous) MOCK_HISTORICAL_JOB_TO_DOCUMENT[previous] = found.document_id;
  MOCK_HISTORICAL_JOB_TO_DOCUMENT[jobId] = found.document_id;
  found.active_job_id = jobId;
  found.updated_at = new Date().toISOString();
  return {
    job_id: jobId,
    document_id: found.document_id,
    workflow: "ocr",
    status: "queued",
    stage: "queued",
    display_stage: "ocr",
  };
}

export function getMockDocumentJobs(documentId: string) {
  const found = documents().find((item) => item.document_id === documentId);
  if (!found) {
    throw new Error("未找到该文档。(404)");
  }
  const jobId = `${found.active_job_id || ""}`.trim();
  if (!jobId) return { items: [], invocation_summary: {} };
  const isOcr = jobId.startsWith("mock-ocr-");
  const live = isOcr ? null : buildLiveMockJobPayload(jobId);
  const status = `${live?.status || (isOcr ? "queued" : "succeeded")}`;
  const stage = `${live?.stage || (isOcr ? "queued" : "finished")}`;
  const displayStage = `${live?.display_stage || (isOcr ? "ocr" : "done")}`;
  const stageDetail = `${live?.stage_detail || (isOcr ? "OCR 任务已排队" : "任务完成")}`;
  const liveProgress: any = live?.progress || {};
  return {
    items: [{
      job_id: jobId,
      workflow: isOcr ? "ocr" : "book",
      status,
      stage_snapshot: {
        display_stage: displayStage,
        stage,
        stage_detail: stageDetail,
        progress: isOcr
          ? { current: 0, total: found.page_count }
          : {
              current: Number(liveProgress.current) || found.page_count,
              total: Number(liveProgress.total) || found.page_count,
              percent: Number(liveProgress.percent),
            },
      },
      created_at: found.updated_at,
      updated_at: found.updated_at,
      markdown_ready: !isOcr && status === "succeeded",
      output_pdf_ready: !isOcr && status === "succeeded",
    }],
    invocation_summary: {},
  };
}

// ===== 分类(合集):建文件夹给 PDF 分组 =====
// 与 js/api/collections.js 同构(collection_id/name/parent_id/sort_order/
// created_at/document_count);membership 单独存一张 collection_id → Set<document_id>
// 表,和真实后端 collection_documents 表同样的建模方式。

let mockCollections: MockCollection[] | null = null;
let mockCollectionMembership: Map<string, Set<string>> | null = null;
let collectionSeq = 0;

function seedMockCollections(): void {
  collectionSeq = 2;
  mockCollections = [
    { collection_id: "col-001", name: "化学", parent_id: null, sort_order: 0, created_at: "2026-06-01T10:30:00Z" },
    { collection_id: "col-002", name: "机器学习", parent_id: null, sort_order: 1, created_at: "2026-06-08T15:00:00Z" },
  ];
  // mock 的"最近任务"列表(js/mock/index.js#getMockJobList)目前只有 MOCK_JOB_ID
  // 这一条真实数据,doc-1b8c52d9a304/doc-77e0fa3c1d55 的 active_job_id 在
  // job 列表里查不到——"机器学习"文件夹留空,顺便覆盖"空文件夹"这个真实 UI 态。
  mockCollectionMembership = new Map([
    ["col-001", new Set([MOCK_DOCUMENT_ID])],
    ["col-002", new Set()],
  ]);
}

function collectionsList(): MockCollection[] {
  if (!mockCollections) {
    seedMockCollections();
  }
  return mockCollections!;
}

function collectionMembership(collectionId: string): Set<string> {
  if (!mockCollectionMembership) {
    seedMockCollections();
  }
  if (!mockCollectionMembership!.has(collectionId)) {
    mockCollectionMembership!.set(collectionId, new Set());
  }
  return mockCollectionMembership!.get(collectionId)!;
}

function collectionWithCount(record: MockCollection): MockCollectionWithCount {
  return { ...record, document_count: collectionMembership(record.collection_id).size };
}

export function getMockCollectionList(): { collections: MockCollectionWithCount[] } {
  const list = [...collectionsList()].sort((a, b) => a.sort_order - b.sort_order);
  return { collections: list.map(collectionWithCount) };
}

export function createMockCollection({
  name,
  parent_id: parentId = null,
}: MockCollectionCreate = {}): MockCollectionWithCount {
  const trimmed = `${name || ""}`.trim();
  if (!trimmed) {
    throw new Error("name must not be empty. (400)");
  }
  collectionsList(); // 确保种子数据与 collectionSeq 初始化
  collectionSeq += 1;
  const record: MockCollection = {
    collection_id: `col-${String(collectionSeq).padStart(3, "0")}`,
    name: trimmed,
    parent_id: parentId || null,
    sort_order: collectionsList().length,
    created_at: new Date().toISOString(),
  };
  collectionsList().push(record);
  return collectionWithCount(record);
}

export function patchMockCollection(
  collectionId: string,
  { name, sort_order: sortOrder }: MockCollectionPatch = {},
): MockCollectionWithCount {
  const found = collectionsList().find((item) => item.collection_id === collectionId);
  if (!found) {
    throw new Error("未找到该分类。(404)");
  }
  if (name !== undefined) {
    const trimmed = `${name}`.trim();
    if (!trimmed) {
      throw new Error("name must not be empty. (400)");
    }
    found.name = trimmed;
  }
  if (sortOrder !== undefined) {
    found.sort_order = Number(sortOrder) || 0;
  }
  return collectionWithCount(found);
}

export function deleteMockCollection(collectionId: string): { deleted: boolean } {
  const list = collectionsList();
  const index = list.findIndex((item) => item.collection_id === collectionId);
  if (index < 0) {
    throw new Error("未找到该分类。(404)");
  }
  list.splice(index, 1);
  if (mockCollectionMembership) {
    mockCollectionMembership.delete(collectionId);
  }
  return { deleted: true };
}

export function addMockCollectionDocuments(
  collectionId: string,
  documentIds: Array<string | null | undefined> = [],
): MockCollectionWithCount {
  const found = collectionsList().find((item) => item.collection_id === collectionId);
  if (!found) {
    throw new Error("未找到该分类。(404)");
  }
  const members = collectionMembership(collectionId);
  for (const documentId of documentIds) {
    const normalized = `${documentId || ""}`.trim();
    if (!normalized) {
      continue;
    }
    if (!documents().some((item) => item.document_id === normalized)) {
      throw new Error(`未找到该文档: ${normalized}(404)`);
    }
    members.add(normalized);
  }
  return collectionWithCount(found);
}

export function removeMockCollectionDocument(
  collectionId: string,
  documentId: string,
): { removed: boolean } {
  const members = collectionMembership(collectionId);
  const normalized = `${documentId || ""}`.trim();
  if (!members.has(normalized)) {
    throw new Error("该文档不在此分类中。(404)");
  }
  members.delete(normalized);
  return { removed: true };
}

// ===== 收藏 =====

let mockFavorites: MockFavorite[] | null = null;
let favoriteSeq = 0;

function favorites(): MockFavorite[] {
  if (!mockFavorites) {
    favoriteSeq = 2;
    mockFavorites = [
      {
        favorite_id: "fav-001",
        document_id: MOCK_DOCUMENT_ID,
        job_id: MOCK_JOB_ID,
        page_idx: 0,
        block_id: "b-intro-3",
        kind: "sentence",
        quote_text: "现代有机合成已达到极高的精密水平。",
        translated_quote_text: "",
        note: "",
        created_at: "2026-06-01T11:00:00Z",
      },
      {
        favorite_id: "fav-002",
        document_id: MOCK_DOCUMENT_ID,
        job_id: MOCK_JOB_ID,
        page_idx: 2,
        block_id: "b-scheme-1b",
        kind: "figure",
        quote_text: "Scheme 1b",
        translated_quote_text: "",
        note: "萘系刚性对位阻的影响",
        created_at: "2026-06-01T11:20:00Z",
      },
    ];
  }
  return mockFavorites;
}

export function createMockFavorite(payload: MockFavoriteCreatePayload = {}): MockFavorite {
  const quoteText = `${payload.quote_text || ""}`.trim();
  const jobId = `${payload.job_id || ""}`.trim();
  // document_id 可缺省:给了 job_id 时后端解析所属文档(含历史 run)。二者至少有一。
  const doc = `${payload.document_id || ""}`.trim()
    ? documents().find((item) => item.document_id === `${payload.document_id}`.trim())
    : (jobId ? getMockDocumentByJobId(jobId) : null);
  if (!doc || payload.page_idx === undefined || !payload.block_id || !quoteText) {
    throw new Error("document_id 或 job_id、page_idx、block_id、quote_text 为必填。(400)");
  }
  favorites(); // 先确保种子数据与 favoriteSeq 初始化,再分配新 id
  favoriteSeq += 1;
  const favorite: MockFavorite = {
    favorite_id: `fav-${String(favoriteSeq).padStart(3, "0")}`,
    document_id: doc.document_id,
    // job_id 不传时锚定文档的 active_job_id
    job_id: jobId || doc.active_job_id || "",
    page_idx: Number(payload.page_idx) || 0,
    block_id: `${payload.block_id}`,
    kind: ["sentence", "data", "figure"].includes(payload.kind as string) ? payload.kind! : "sentence",
    quote_text: quoteText,
    translated_quote_text: `${payload.translated_quote_text || ""}`,
    note: `${payload.note || ""}`,
    char_start: payload.char_start,
    char_end: payload.char_end,
    created_at: new Date().toISOString(),
  };
  favorites().push(favorite);
  return { ...favorite };
}

export function getMockFavorites({ documentId = "" }: { documentId?: string } = {}): {
  favorites: MockFavorite[];
} {
  const normalized = `${documentId || ""}`.trim();
  const list = normalized
    ? favorites().filter((item) => item.document_id === normalized)
        .sort((a, b) => a.page_idx - b.page_idx)
    : [...favorites()].sort((a, b) => `${b.created_at}`.localeCompare(`${a.created_at}`));
  return { favorites: list.map((item) => ({ ...item })) };
}

export function deleteMockFavorite(favoriteId: string): { favorite_id: string } {
  const list = favorites();
  const index = list.findIndex((item) => item.favorite_id === favoriteId);
  if (index < 0) {
    throw new Error("未找到该收藏。(404)");
  }
  list.splice(index, 1);
  return { favorite_id: favoriteId };
}

export function countMockFavoritesByJob(jobId: string): number {
  return favorites().filter((item) => item.job_id === `${jobId || ""}`.trim()).length;
}

// ===== 全文检索 =====

export function getMockSearchHits(
  q = "",
  { limit = 20 }: { limit?: number } = {},
): { hits: MockSearchHit[] } {
  const query = `${q || ""}`.trim();
  if (!query) {
    return { hits: [] };
  }
  const hits: MockSearchHit[] = [
    {
      document_id: MOCK_DOCUMENT_ID,
      job_id: MOCK_JOB_ID,
      page_idx: 0,
      block_id: "b-intro-3",
      source_snippet: `…the halogen–lithium exchange in [${query}] series was investigated…`,
      translated_snippet: `…考察了[${query}]系列中的卤素-锂交换…`,
    },
    {
      document_id: "doc-1b8c52d9a304",
      job_id: "20260520-att-001",
      page_idx: 3,
      block_id: "b-sec3-2",
      source_snippet: `…scaled dot-product attention relates to [${query}] in the encoder…`,
      translated_snippet: `…缩放点积注意力与编码器中的[${query}]相关…`,
    },
  ];
  return { hits: hits.slice(0, limit) };
}

// ===== 阅读区域(锚点/选区取文 e2e 用) =====

export function getMockReaderRegions() {
  return {
    items: [
      {
        item_id: "b-intro-3",
        region_type: "paragraph",
        status: "translated",
        source: {
          page: 1,
          bbox: [57, 52, 540, 96],
          text: "Source PDF",
        },
        translated: {
          page: 1,
          bbox: [57, 52, 540, 96],
          text: "原始 PDF",
        },
      },
      {
        item_id: "b-body-1",
        region_type: "paragraph",
        status: "translated",
        source: {
          page: 1,
          bbox: [57, 100, 540, 150],
          text: "RetainPDF Mock Preview",
        },
        translated: {
          page: 1,
          bbox: [57, 100, 540, 150],
          text: "RetainPDF 联调预览",
        },
      },
    ],
  };
}

// 文档中心网格的卡片 item 形状(计划 wondrous-baking-donut.md 的 F2)。
//
// 设计要点(见 memory f2-document-centric-grid-design):图书馆网格改成"每篇文档
// 一张卡",但底层复用 features/recent-jobs 那套按 job_id 键控的 store/去重/轮询
// 引擎(一行不改)。于是:
// - 有 active job 的文档(翻译或 OCR-only):卡片带真实 job_id，并把
//   library/books 或 canonical job detail 的实时 status/stage/readiness 合并进来。
// - 馆藏文档(active_job_id 为 null/空):给一个**合成命名空间 job_id**
//   `doc:<document_id>`,让它能原样穿过按 job_id 去重的 dedupeRecentJobs / store,
//   不被"空 job_id 直接丢弃"的逻辑滤掉;卡片靠 library_only 布尔分支馆藏态
//   (禁用对照阅读、显示"未翻译"、走翻译/读原文),不去解析这个合成 id。

import { flattenStageSnapshot } from "@retainpdf/domain/job";

export const LIBRARY_ONLY_JOB_PREFIX = "doc:";

export function syntheticLibraryJobId(documentId) {
  const normalized = `${documentId || ""}`.trim();
  return normalized ? `${LIBRARY_ONLY_JOB_PREFIX}${normalized}` : "";
}

export function isLibraryOnlyItem(item: any = {}) {
  return item?.library_only === true;
}

function firstUrl(...candidates) {
  for (const candidate of candidates) {
    const url = `${candidate || ""}`.trim();
    if (url) {
      return url;
    }
  }
  return "";
}

/** book 标题若是 job_id / job_id.pdf / Mock…，改用文档真名 */
function pickCardTitle(bookTitle, document, jobId) {
  const book = `${bookTitle || ""}`.trim();
  const docTitle = `${document?.title || document?.source_filename || ""}`.trim();
  const id = `${jobId || ""}`.trim();
  const bookIsPlaceholder = !book
    || (id && (book === id || book === `${id}.pdf`))
    || /^Mock(\s|重试|-|_)/i.test(book)
    || /^mock-/i.test(book);
  if (bookIsPlaceholder && docTitle) {
    return docTitle;
  }
  return book || docTitle || id || "";
}

// document + 可选的 active-job 投影 → 一张网格卡片 item。
// 命中时以 job 活态为主，叠加文档身份；缺失时保留 active_job_id，
// 等待后续轮询/恢复。
//
// job/document 身份规则:
// - 文档身份(document_id/reading_status/tags/source_pdf_url/bytes/added_at/
//   last_opened_at)恒由 document 侧提供,三分支共享(sharedDocumentIdentity);
// - job 身份(job_id/active_job_id/library_only):有投影取投影 job_id(回落
//   activeJobId);投影未命中保留真实 activeJobId(library_only=false,等轮询);
//   无 active_job_id 则合成 `doc:<document_id>`(library_only=true),只为穿过
//   按 job_id 键控的 store/去重,不被解析;
// - 封面/标题:job 活态优先、文档兜底;book 占位标题(job_id/Mock)改用文档真名。
export function shapeDocumentCardItem(document: any = {}, jobProjection = null) {
  const documentId = `${document.document_id || ""}`.trim();
  const activeJobId = `${document.active_job_id || ""}`.trim();
  const sharedDocumentIdentity = {
    document_id: documentId,
    reading_status: document.reading_status || "",
    tags: Array.isArray(document.tags) ? document.tags : [],
    source_pdf_url: document.source_pdf_url || "",
    bytes: document.bytes,
    added_at: document.added_at || "",
    last_opened_at: document.last_opened_at || null,
  };

  if (activeJobId && jobProjection && typeof jobProjection === "object") {
    const flattenedJobProjection = flattenStageSnapshot(jobProjection);
    const jobId = `${flattenedJobProjection.job_id || jobProjection.job_id || activeJobId}`.trim();
    return {
      ...flattenedJobProjection,
      ...sharedDocumentIdentity,
      job_id: jobId,
      active_job_id: activeJobId,
      library_only: false,
      // 封面/页数：book 活态优先、文档级兜底（与现网格视觉一致）；
      // 标题：禁止 book 用 job_id.pdf 盖掉真书名
      cover_url: firstUrl(flattenedJobProjection.cover_url, jobProjection.cover_url, document.cover_url),
      thumbnail_url: firstUrl(flattenedJobProjection.thumbnail_url, jobProjection.thumbnail_url, document.thumbnail_url),
      page_count: document.page_count || flattenedJobProjection.page_count || 0,
      updated_at: flattenedJobProjection.updated_at || document.updated_at || "",
      title: pickCardTitle(flattenedJobProjection.title || jobProjection.title, document, jobId),
      display_name: pickCardTitle(
        flattenedJobProjection.display_name || flattenedJobProjection.title || jobProjection.display_name || jobProjection.title,
        document,
        jobId,
      ),
    };
  }

  if (activeJobId) {
    // 有 active_job_id 但所有投影都未命中(少见边角:job 刚建/被清)。保留真实
    // job_id 让轮询/对照阅读仍可用,但没有成品活态,按未完成处理(reader 禁用)。
    return {
      ...sharedDocumentIdentity,
      job_id: activeJobId,
      active_job_id: activeJobId,
      library_only: false,
      status: "",
      title: document.title || document.source_filename || "",
      display_name: document.title || document.source_filename || "",
      source_file_name: document.source_filename || "",
      page_count: document.page_count || 0,
      cover_url: firstUrl(document.cover_url),
      thumbnail_url: firstUrl(document.thumbnail_url),
      updated_at: document.updated_at || "",
    };
  }

  // 馆藏态(未翻译):合成 job_id 让它穿过按 job_id 键控的引擎;library_only 打标。
  return {
    ...sharedDocumentIdentity,
    job_id: syntheticLibraryJobId(documentId),
    active_job_id: "",
    library_only: true,
    status: "",
    title: document.title || document.source_filename || "",
    display_name: document.title || document.source_filename || "",
    source_file_name: document.source_filename || "",
    page_count: document.page_count || 0,
    cover_url: firstUrl(document.cover_url),
    thumbnail_url: firstUrl(document.thumbnail_url),
    updated_at: document.updated_at || "",
  };
}

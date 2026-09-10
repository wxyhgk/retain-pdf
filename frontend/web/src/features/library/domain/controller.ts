// 图书馆(文档)域的动作集合 —— 从 composition.js 抽出来的(重构①)。
//
// composition.js 只负责 new 一次 + 把返回值接进 services.library.actions。
//
// 依赖经参数注入(不直接 import composition 作用域的东西):
// - documentRef / libraryEventPort / reloadRecentJobs / deleteJob / buildTranslateConfig
// - startPolling: job-runtime 开始盯某个 job（composition 传闭包,调用时再取 feature）
// - hideStatusArea: 静默接进度时不要抬起主页工作流状态区
//
// 进度接入契约（与 selectJob 刻意分叉）:
// - selectJob（recent-jobs/actions）→ 打开工作流弹窗 + startPolling
// - attachJobProgress（本 controller）→ 只 startPolling，不弹窗、不亮主状态区
//   供书籍详情「翻译」Tab 内嵌 StatusCard 使用。

import { createDialogStore } from "@/platform/store/dialog-store.js";
import type {
  DeleteCardTarget,
  DeleteDocumentsResult,
  JobSubmissionView,
  LibraryCardItem,
  LibraryController,
  LibraryControllerDeps,
  ReloadRecentJobsOptions,
  TranslateDocumentPayload,
  OcrDocumentPayload,
  UpdateDocumentPayload,
} from "./types.js";
import {
  isRecentJobActive,
} from "./card/recent-job-card-presenter.js";
import {
  API_PREFIX,
} from "@/platform/config/api-constants.js";
import {
  APP_EVENTS,
} from "@/platform/contracts/app-contract.js";
import {
  deleteDocument,
  fetchDocumentByJobId,
  fetchDocumentJobs,
  fetchJobStageActions,
  ocrDocument,
  patchDocument,
  retryJobStage,
  translateDocument,
} from "@/platform/api/index.js";
import { mergeTranslatePayload } from "./translation-ocr-reuse.js";

type ErrorLike = {
  message?: string;
  status?: number;
  errorCode?: string;
  reason?: string;
} | string | null | undefined;

export function createLibraryController({
  documentRef,
  libraryEventPort,
  reloadRecentJobs,
  removeLibraryDocuments,
  patchLibraryDocumentItem,
  deleteJob,
  buildTranslateConfig,
  buildOcrConfig,
  startPolling,
  hideStatusArea,
  recentJobsStatePort,
}: LibraryControllerDeps = {}): LibraryController {
  // payload = 被点开的那张网格卡片 item；弹窗再按 document_id 拉完整文档补齐元数据。
  const bookDetailStore = createDialogStore<LibraryCardItem | null>(null);
  const translatingDocumentIds = new Set<string>();
  const ocrDocumentIds = new Set<string>();

  function dispatchAppEvent(name: string, detail?: unknown) {
    if (documentRef?.dispatchEvent && typeof globalThis.CustomEvent === "function") {
      documentRef.dispatchEvent(
        new globalThis.CustomEvent(name, detail === undefined ? undefined : { detail }),
      );
    }
  }

  async function reload(opts?: ReloadRecentJobsOptions) {
    await reloadRecentJobs?.(opts);
  }

  // 前置条件: documentId 非空(去 trim 后);空串直接 return,无副作用。
  // F4 馆藏文档"读原文":无 job,派发带 documentId 的 openReaderRequested,
  // ReaderDialog 用 document_id 打开只读源文档阅读器(与卡片对照阅读同一事件契约)。
  function openSourceReader(documentId?: string | null) {
    const normalizedId = `${documentId || ""}`.trim();
    if (!normalizedId) {
      return;
    }
    dispatchAppEvent(APP_EVENTS.openReaderRequested, { documentId: normalizedId, pageIdx: null, blockId: "" });
  }

  // 前置条件: 无(纯事件转发);调用方需保证上传会话已就绪,后端已建 document。
  // F3 "只入库,不翻译":PDF 在**上传完成那一刻**后端就已经建好 document 了
  // (POST /uploads → upsert_document_from_upload,document_id = 内容哈希),
  // 所以"只入库"不需要任何新接口——就是**不提交翻译 job**:关掉工作流对话框
  // (其 close() 顺带 resetUploadSession + bindings 里 scheduleRefresh soft)。
  // 不再额外 force refresh，避免关对话框连闪两次。
  function storeUploadedDocumentOnly() {
    dispatchAppEvent(APP_EVENTS.closeTranslationWorkflow);
  }

  // 翻译失败的友好文案:后端最常见的失败是"没配 OCR/翻译凭据"
  // (如 paddle_token is required),原文对用户没意义,给一句可操作提示;其余
  // 错误至少把后端消息透出来(不再静默)。
  function friendlyTranslateError(error: ErrorLike, { reusingOcr = false } = {}) {
    const message = typeof error === "string" ? error : `${error?.message || error || ""}`;
    const errorCode = typeof error === "object" && error
      ? `${error.errorCode || error.reason || ""}`.trim()
      : "";
    const structured = `${errorCode} ${message}`;
    if (/OCR_PAGE_COVERAGE_MISMATCH/i.test(structured)) {
      return "现有 OCR 未覆盖所选页码，未自动重新识别。请先为缺失页码执行 OCR。";
    }
    if (/OCR_(?:JOB_NOT_FOUND|JOB_NOT_SUCCEEDED|ARTIFACT_MISSING|ARTIFACT_NOT_REUSABLE)/i.test(structured)) {
      return "现有 OCR 产物暂时无法复用，未自动重新识别。请重新执行 OCR 后再试。";
    }
    const credentialish = /(token|key|凭据|令牌|密钥|credential)/i.test(message);
    const missing = /(required|需要|缺|未配置|not configured|missing)/i.test(message);
    if (credentialish && missing) {
      return reusingOcr
        ? "翻译需要先在「设置」里配置翻译 API 后再试。"
        : "翻译需要先在「设置」里配置 OCR / 翻译凭据后再试。";
    }
    return message || "发起翻译失败，请稍后重试。";
  }

  // F5 馆藏文档"以后再翻":复用文档已存的 upload 起 book 翻译 job,后端回填
  // active_job_id;随后整页重载一次——该文档会以真实 job_id 重新进网格,现有
  // 轮询引擎(active-refresh 按 job_id 拉 job payload)自然接管进度。
  //
  // 失败时**抛给调用方**(书籍详情弹窗在弹窗内 setError 展示 + 不关闭弹窗)。
  // 早期这里往网格 renderError,但翻译入口已从卡片挪进弹窗,而网格错误条只在
  // "网格为空"时才显示、满网格时用户根本看不到——表现成"点了没反应"(缺
  // OCR 凭据时的真实 bug)。
  // 前置条件: buildTranslateConfig 已注入(缺省回 {});overrides 仅叠页码/复用字段。
  // 组装真正发给后端的 job 配置:先从已配置凭据拼出完整的 ocr(PaddleOCR)+
  // translation(DeepSeek)基座(buildTranslateConfig),再把弹窗传来的页码范围
  // (普通流程用 ocr.page_ranges + translation.start/end；OCR 复用流程用
  // translation.page_ranges 一基数组)叠上去。
  // 不带凭据的话后端收不到 provider,会默认到已废弃的 OCR provider 而失败。
  function assembleTranslatePayload(overrides: TranslateDocumentPayload = {}): TranslateDocumentPayload {
    const pageRanges = `${overrides?.ocr?.page_ranges || ""}`.trim();
    const base = (buildTranslateConfig?.(pageRanges) || {}) as TranslateDocumentPayload;
    return mergeTranslatePayload(base, overrides);
  }

  function assembleOcrPayload(overrides: OcrDocumentPayload = {}): OcrDocumentPayload {
    const pageRanges = `${overrides?.ocr?.page_ranges || ""}`.trim();
    const base = (buildOcrConfig?.(pageRanges) || {}) as OcrDocumentPayload;
    return {
      ...base,
      workflow: "ocr",
      ocr: { ...(base.ocr || {}), ...(overrides.ocr || {}) },
    };
  }

  // 前置条件: jobId 为真实 id(非空、非 `doc:` 合成);合成 id 直接 return。
  /**
   * 静默接入任务进度（书籍详情处理 Tab → bd-job-status-inner）。
   * - silent startPolling：只写 statusCardStore，不抬工作流区、不广播 create
   * - 绝不 dispatch openTranslationWorkflow（进度主场在详情，不在弹窗）
   * - 强制 hide 主状态区，避免 #status-section / 主 StatusCard 抢戏
   */
  function attachJobProgress(jobId?: string | null, options: { recovering?: boolean } = {}) {
    const id = `${jobId || ""}`.trim();
    if (!id || id.startsWith("doc:")) {
      return;
    }
    hideStatusArea?.();
    startPolling?.(id, {
      silent: true,
      showWorkflow: false,
      publishLibrary: false,
      recovering: Boolean(options.recovering),
    });
    hideStatusArea?.();
  }

  // 前置条件: result 含 job_id/id;缺失直接 return,不碰详情/网格/轮询。
  /**
   * 翻译成功后的即时反馈（不等整页重载）:
   * 1) 详情 payload 立刻挂上真实 job_id → 处理 Tab 切到 StatusCard
   * 2) attachJobProgress → 进度环/阶段流马上动
   * 3) publishJobUpdated 按 document_id 就地更新原卡（禁止插第二张）
   * 4) 后台 silent 刷新对齐服务端，不闪 loading
   */
  function promoteDocumentToJob(
    documentId: string,
    result: JobSubmissionView | null | undefined,
    sourceJobId = "",
  ) {
    const jobId = `${result?.job_id || result?.id || ""}`.trim();
    if (!jobId) {
      return;
    }
    const dialogState = bookDetailStore.getState();
    const base = (dialogState.payload || {}) as LibraryCardItem;
    const status = `${result?.status || "queued"}`.trim() || "queued";
    const stage = `${result?.stage || result?.display_stage || "queued"}`.trim() || "queued";
    const workflow = `${result?.workflow || ""}`.trim();
    const reuseProjection = {
      ...(typeof result?.ocr_reused === "boolean" ? { ocr_reused: result.ocr_reused } : {}),
      ...(result?.source_artifact_job_id
        ? { source_artifact_job_id: result.source_artifact_job_id }
        : {}),
      ...(result?.stages ? { stages: result.stages } : {}),
    };

    if (dialogState.open && `${base.document_id || ""}`.trim() === documentId) {
      bookDetailStore.open({
        ...base,
        job_id: jobId,
        active_job_id: jobId,
        library_only: false,
        status,
        stage,
        display_stage: `${result?.display_stage || stage}`,
        ...(workflow ? { workflow, job_type: workflow } : {}),
        ...reuseProjection,
      });
    }

    // 用 JobUpdated：按 document_id 就地改原卡，禁止主页再插一张新书
    const originJobId = `${sourceJobId || base.job_id || ""}`.trim();
    libraryEventPort?.publishJobUpdated?.({
      job_id: jobId,
      source_job_id: originJobId && originJobId !== jobId ? originJobId : undefined,
      document_id: documentId,
      active_job_id: jobId,
      library_only: false,
      status,
      stage,
      display_stage: `${result?.display_stage || stage}`,
      ...(workflow ? { workflow, job_type: workflow } : {}),
      ...reuseProjection,
      title: base.title,
      display_name: base.display_name || base.title,
      page_count: base.page_count,
      cover_url: base.cover_url,
      thumbnail_url: base.thumbnail_url,
    });
    attachJobProgress(jobId);
  }

  // 前置条件: documentId 非空且未在翻译中(并发守卫);失败 throw 友好文案。
  async function translateLibraryDocument(
    documentId?: string | null,
    payload: TranslateDocumentPayload = {},
  ): Promise<JobSubmissionView | null> {
    const normalizedId = `${documentId || ""}`.trim();
    if (!normalizedId || translatingDocumentIds.has(normalizedId)) {
      return null;
    }
    translatingDocumentIds.add(normalizedId);
    let result: JobSubmissionView | null = null;
    const reusingOcr = Boolean(`${payload.source?.artifact_job_id || ""}`.trim());
    try {
      result = (await translateDocument(
        API_PREFIX,
        normalizedId,
        assembleTranslatePayload(payload),
      )) as JobSubmissionView;
    } catch (error) {
      throw new Error(friendlyTranslateError(error as ErrorLike, { reusingOcr }));
    } finally {
      translatingDocumentIds.delete(normalizedId);
    }

    // 立刻接进度 + 更新详情/网格；不再整页 reload（运行中由单卡 patch 推进）
    promoteDocumentToJob(normalizedId, result);
    return result;
  }

  // 前置条件: documentId 非空且未在 OCR 中;凭据缺失 throw 专项提示。
  async function ocrLibraryDocument(
    documentId?: string | null,
    payload: OcrDocumentPayload = {},
  ): Promise<JobSubmissionView | null> {
    const normalizedId = `${documentId || ""}`.trim();
    if (!normalizedId || ocrDocumentIds.has(normalizedId)) return null;
    ocrDocumentIds.add(normalizedId);
    let result: JobSubmissionView | null = null;
    try {
      result = (await ocrDocument(
        API_PREFIX,
        normalizedId,
        assembleOcrPayload(payload),
      )) as JobSubmissionView;
    } catch (error) {
      const message = typeof error === "string" ? error : `${(error as Error)?.message || error || ""}`;
      if (/(token|key|凭据|令牌|密钥|credential)/i.test(message)) {
        throw new Error("OCR 需要先在「设置」里配置 OCR 凭据后再试。");
      }
      throw new Error(message || "发起 OCR 失败，请稍后重试。");
    } finally {
      ocrDocumentIds.delete(normalizedId);
    }
    promoteDocumentToJob(normalizedId, { ...result, workflow: "ocr" });
    return result;
  }

  // 前置条件: 无;仅按 payload.workflow 分流,不改载荷组装。
  // 统一提交入口：仅按 workflow 分流，不改载荷组装。
  // - workflow=ocr → ocrLibraryDocument（Paddle 凭据经 buildOcrConfig，
  //   页码沿用 ocr.page_ranges "s-e" 串格式）。
  // - 其余（book/translate/缺省）→ translateLibraryDocument（DeepSeek 凭据/
  //   余额门禁经 buildTranslateConfig；artifact_job_id 复用时由
  //   mergeTranslatePayload 删 ocr 字段并置 workflow=translate）。
  // 旧函数原样保留（别处调用兼容）。
  async function submitLibraryDocument(
    documentId?: string | null,
    payload: TranslateDocumentPayload & OcrDocumentPayload = {},
  ): Promise<JobSubmissionView | null> {
    const workflow = `${(payload as any)?.workflow || ""}`.trim().toLowerCase();
    if (workflow === "ocr") {
      return ocrLibraryDocument(documentId, payload as OcrDocumentPayload);
    }
    return translateLibraryDocument(documentId, payload as TranslateDocumentPayload);
  }

  // 前置条件: documentId 非空;空返回 { items: [] }。
  async function getDocumentJobs(documentId?: string | null) {
    const normalizedId = `${documentId || ""}`.trim();
    if (!normalizedId) return { items: [] };
    return fetchDocumentJobs(API_PREFIX, normalizedId) as Promise<any>;
  }

  // 前置条件: jobId 为真实 id(合成 `doc:` 返回 null)。
  async function getDocumentByJobId(jobId?: string | null) {
    const normalizedId = `${jobId || ""}`.trim();
    if (!normalizedId || normalizedId.startsWith("doc:")) return null;
    return fetchDocumentByJobId(API_PREFIX, normalizedId) as Promise<LibraryCardItem | null>;
  }

  // 前置条件: jobId 为真实 id(合成 `doc:` 返回 null)。
  async function getJobStageActions(jobId?: string | null) {
    const normalizedId = `${jobId || ""}`.trim();
    if (!normalizedId || normalizedId.startsWith("doc:")) return null;
    return fetchJobStageActions(normalizedId, API_PREFIX);
  }

  // 前置条件: jobId/stage 均非空;document_id 取 overrides 回落详情 payload。
  async function retryDocumentJobStage(
    jobId?: string | null,
    stage?: string | null,
    overrides: Record<string, unknown> = {},
  ): Promise<JobSubmissionView | null> {
    const normalizedJobId = `${jobId || ""}`.trim();
    const normalizedStage = `${stage || ""}`.trim();
    if (!normalizedJobId || !normalizedStage) return null;
    const dialogState = bookDetailStore.getState();
    const base = (dialogState.payload || {}) as LibraryCardItem;
    const documentId = `${overrides.document_id || base.document_id || ""}`.trim();
    const currentTranslation = normalizedStage === "translation"
      ? ((buildTranslateConfig?.("") as TranslateDocumentPayload | undefined)?.translation || {})
      : null;
    const requestedOverrides = overrides.overrides && typeof overrides.overrides === "object"
      ? overrides.overrides as Record<string, unknown>
      : {};
    const stageOverrides = currentTranslation
      ? {
          ...requestedOverrides,
          translation: {
            ...((requestedOverrides.translation && typeof requestedOverrides.translation === "object")
              ? requestedOverrides.translation as Record<string, unknown>
              : {}),
            ...currentTranslation,
          },
        }
      : requestedOverrides;
    const result = await retryJobStage(normalizedJobId, API_PREFIX, normalizedStage, {
      document_id: documentId,
      title: base.title,
      display_name: base.display_name || base.title,
      cover_url: base.cover_url,
      thumbnail_url: base.thumbnail_url,
      page_count: base.page_count,
      ...overrides,
      ...(Object.keys(stageOverrides).length ? { overrides: stageOverrides } : {}),
    }) as JobSubmissionView;
    if (result && documentId) promoteDocumentToJob(documentId, result, normalizedJobId);
    return result || null;
  }

  // 文档级删除(后端补了 DELETE /documents/:id 之后):删掉 document + 名下所有
  // job/upload/文件。馆藏文档和已翻译文档统一走这条(卡片都带 document_id)。
  function friendlyDocumentDeleteError(error: ErrorLike) {
    const message = typeof error === "string" ? error : `${error?.message || error || ""}`;
    const status = typeof error === "object" && error ? error.status : undefined;
    if (status === 409 || message.includes("(409)")) {
      const count = message.match(/\d+/)?.[0];
      return count
        ? `该文档有 ${count} 条收藏，请先删除收藏后再删除文档。`
        : "该文档存在收藏引用，请先删除相关收藏后再删除文档。";
    }
    return message || "删除文档失败";
  }

  // 前置条件: documentId 非空;成功后乐观删卡+silent soft reload,失败 throw。
  // 同翻译:失败抛给调用方(弹窗内展示)。成功后乐观删卡 + 静默 soft reload，
  // 不再 await 非 silent 整页 loading（主页闪空根因之一）。
  async function deleteLibraryDocument(documentId?: string | null) {
    const normalizedId = `${documentId || ""}`.trim();
    if (!normalizedId) {
      return;
    }
    try {
      await deleteDocument(API_PREFIX, normalizedId);
    } catch (error) {
      throw new Error(friendlyDocumentDeleteError(error as ErrorLike));
    }
    removeLibraryDocuments?.([normalizedId]);
    void reload({ reset: true, silent: true });
  }

  // 前置条件: ids 去重去空后非空;空返回 { confirmed: 0, failed: 0 }。
  // 批量删除:API 仍逐个 delete；网格乐观一次移除 + 单次 silent soft reload。
  async function deleteLibraryDocuments(
    documentIds: Array<string | null | undefined> = [],
  ): Promise<DeleteDocumentsResult> {
    const ids = [...new Set((documentIds || []).map((id) => `${id || ""}`.trim()).filter(Boolean))];
    if (!ids.length) {
      return { confirmed: 0, failed: 0 };
    }
    const results = await Promise.allSettled(ids.map((id) => deleteDocument(API_PREFIX, id)));
    const confirmedIds = ids.filter((_, index) => results[index]?.status === "fulfilled");
    const confirmed = confirmedIds.length;
    if (confirmedIds.length) {
      removeLibraryDocuments?.(confirmedIds);
    }
    void reload({ reset: true, silent: true });
    return { confirmed, failed: results.length - confirmed };
  }

  // 前置条件: 无;有 documentId 走文档级删除,无则退回 job 删除(兼容旧项)。
  // 卡片删除入口:有 document_id 走文档级删除(删整篇文档 + 名下所有 job);
  // 没有(极少见的运行时插入 job 项)退回老的 job 删除,保留原行为。
  function deleteCard(target: DeleteCardTarget = {}) {
    const documentId = `${target?.documentId || ""}`.trim();
    if (documentId) {
      // fire-and-forget:deleteLibraryDocument 现在会 throw,吞掉避免未处理拒绝
      // (这条卡片级入口目前无消费方,卡片删除已并进详情弹窗)。
      void deleteLibraryDocument(documentId).catch(() => {});
      return;
    }
    deleteJob?.(`${target?.jobId || ""}`.trim());
  }

  function shouldPreferTranslateTab(item?: LibraryCardItem | null) {
    return Boolean(item?.prefer_translate_tab);
  }

  // 前置条件: item 非空且含 document_id 或真实 job_id;仅活跃 job 才接管轮询。
  // 书籍详情弹窗：点击卡片统一落概览。
  //
  // 只有这张卡本身仍在执行时，才允许它接管全局 currentJob 轮询。
  // 已完成/失败的书只是被“查看”，不能覆盖另一本仍在后台运行的任务；否则
  // fetchJob 读到旧书终态后会清掉 retainpdf.activeJobId，退出详情/阅读器时用户
  // 就会看到真实运行任务的状态凭空消失。
  // 只有 selectJobForDetail 等明确处理入口才携带 prefer_translate_tab。
  function openBookDetail(item?: LibraryCardItem | null) {
    if (!item) return;
    const documentId = `${item.document_id || ""}`.trim();
    const jobId = `${item.job_id || item.active_job_id || ""}`.trim();
    // 至少要有 document_id 或真实 job_id
    if (!documentId && (!jobId || jobId.startsWith("doc:"))) {
      return;
    }
    const prefer = shouldPreferTranslateTab(item);
    bookDetailStore.open({
      ...item,
      prefer_translate_tab: prefer || Boolean(item.prefer_translate_tab),
    });
    if (jobId && !jobId.startsWith("doc:") && isRecentJobActive(item)) {
      attachJobProgress(jobId, { recovering: true });
    }
  }

  // 前置条件: jobId 非空;findItem 未命中也用 job_id 开详情壳,不弹旧窗。
  /**
   * 网格「选中任务」：一律进详情处理 Tab + silent 进度。
   * 不再 fallback 到 openTranslationWorkflow（旧弹窗只留给底部「添加」）。
   */
  function selectJobForDetail(
    jobId?: string | null,
    options: {
      findItem?: (jobId: string) => LibraryCardItem | null | undefined;
      /** @deprecated 图书馆网格不再弹工作流；保留参数兼容测试注入 */
      fallbackSelectJob?: (jobId: string) => void;
    } = {},
  ) {
    const id = `${jobId || ""}`.trim();
    if (!id) {
      return;
    }
    const item = options.findItem?.(id) || null;
    if (item) {
      openBookDetail({
        ...item,
        prefer_translate_tab: true,
      });
      return;
    }
    // 网格里暂时找不到行：仍用 job_id 打开详情壳 + silent 轮询，不弹旧窗
    openBookDetail({
      job_id: id,
      prefer_translate_tab: true,
      status: "running",
    });
  }

  // 前置条件: documentId 非空;空返回 null,仅 title/tags/reading_status 可 patch。
  // 详情弹窗里改标题/标签/阅读状态:PATCH 后乐观写网格/详情，再后台 silent soft 对齐。
  async function updateLibraryDocument(
    documentId?: string | null,
    payload: UpdateDocumentPayload = {},
  ): Promise<unknown> {
    const normalizedId = `${documentId || ""}`.trim();
    if (!normalizedId) {
      return null;
    }
    const updated = await patchDocument(API_PREFIX, normalizedId, payload) as Record<string, unknown> | null;
    const patch: Partial<LibraryCardItem> = {
      ...(payload.title !== undefined
        ? {
          title: `${updated?.title ?? payload.title ?? ""}`,
          display_name: `${updated?.title ?? payload.title ?? ""}`,
        }
        : {}),
      ...(payload.reading_status !== undefined
        ? { reading_status: `${updated?.reading_status ?? payload.reading_status ?? ""}` }
        : {}),
      ...(payload.tags !== undefined
        ? { tags: (Array.isArray(updated?.tags) ? updated.tags : payload.tags) as string[] }
        : {}),
    };
    if (Object.keys(patch).length) {
      patchLibraryDocumentItem?.(normalizedId, patch);
      const dialogState = bookDetailStore.getState();
      const base = dialogState.payload;
      if (dialogState.open && base && `${base.document_id || ""}`.trim() === normalizedId) {
        bookDetailStore.open({ ...base, ...patch });
      }
    }
    void reload({ reset: true, silent: true });
    return updated;
  }

  // 前置条件: jobId 非空;findItem 直读 recentJobsStatePort(job/active 双键)。
  /**
   * 网格选任务 → 详情处理 Tab（永不弹 #translation-workflow-dialog）。
   * 业务内聚到 controller：findItem 直接读 recentJobsStatePort，不再由外层 composition 拼闭包。
   */
  function selectJob(jobId: string) {
    const id = `${jobId || ""}`.trim();
    if (!id) return;
    const findItem = (targetId: string): LibraryCardItem | null => {
      const items = (recentJobsStatePort?.getSnapshot?.().items || []) as LibraryCardItem[];
      return (
        (items.find((row) => `${(row as any)?.job_id || ""}`.trim() === targetId) as LibraryCardItem) ||
        (items.find((row) => `${(row as any)?.active_job_id || ""}`.trim() === targetId) as LibraryCardItem) ||
        null
      );
    };
    selectJobForDetail(id, { findItem });
  }

  const controller = {
    bookDetailStore,
    // 键名对齐 services.library.actions 的既有契约(消费方 RecentJobsLibrary /
    // BookDetailDialog / CategoriesView 不用改)。
    openSourceReader,
    storeOnly: storeUploadedDocumentOnly,
    translateDocument: translateLibraryDocument,
    ocrDocument: ocrLibraryDocument,
    getDocumentJobs,
    getDocumentByJobId,
    getJobStageActions,
    retryJobStage: retryDocumentJobStage,
    deleteDocument: deleteLibraryDocument,
    deleteDocuments: deleteLibraryDocuments,
    deleteCard,
    openBookDetail,
    selectJobForDetail,
    selectJob,
    updateDocument: updateLibraryDocument,
    /** 详情内嵌进度：静默轮询，不弹 #translation-workflow-dialog */
    attachJobProgress,
  };
  // submitDocument 为统一提交入口（按 workflow 分流到 ocr/translate 旧函数）；
  // 经变量中转返回以兼容 LibraryController 契约（actions 侧以 any 消费）。
  return { ...controller, submitDocument: submitLibraryDocument } as LibraryController;
}

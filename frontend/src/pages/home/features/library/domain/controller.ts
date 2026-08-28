// Bộ tập hợp hành động cho miền thư viện (tài liệu) —— tách từ composition.js (tái cấu trúc ①).
//
// composition.js chỉ chịu trách nhiệm khởi tạo một lần và đưa giá trị trả về vào services.library.actions.
//
// Các phụ thuộc được tiêm qua tham số (không import trực tiếp từ phạm vi composition):
// - documentRef / libraryEventPort / reloadRecentJobs / deleteJob / buildTranslateConfig
// - startPolling: job-runtime bắt đầu theo dõi một job (composition truyền closure, lấy feature khi gọi)
// - hideStatusArea: khi tích hợp tiến độ một cách im lặng, không hiển thị khu vực trạng thái workflow trên trang chủ
//
// Hợp đồng tích hợp tiến độ (tách biệt có chủ ý với selectJob):
// - selectJob (recent-jobs/actions) → mở hộp thoại workflow + startPolling
// - attachJobProgress (controller này) → chỉ startPolling, không mở hộp thoại, không làm nổi bật khu vực trạng thái chính
//   Dùng cho tab "Dịch" trong chi tiết sách để nhúng StatusCard.

import { createBookDetailDialogStore } from "../detail/book-detail-dialog-store.js";
import type {
  DeleteCardTarget,
  DeleteDocumentsResult,
  JobSubmissionView,
  LibraryCardItem,
  LibraryController,
  LibraryControllerDeps,
  ReloadRecentJobsOptions,
  TranslateDocumentPayload,
  UpdateDocumentPayload,
} from "../types.js";
import {
  translateDocument,
  deleteDocument,
  patchDocument,
  API_PREFIX,
  APP_EVENTS,
} from "../../../composition/external.js";

type ErrorLike = {
  message?: string;
  status?: number;
} | string | null | undefined;

export function createLibraryController({
  documentRef,
  libraryEventPort,
  reloadRecentJobs,
  removeLibraryDocuments,
  patchLibraryDocumentItem,
  deleteJob,
  buildTranslateConfig,
  startPolling,
  hideStatusArea,
}: LibraryControllerDeps = {}): LibraryController {
  const bookDetailStore = createBookDetailDialogStore();
  const translatingDocumentIds = new Set<string>();

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

  // F4 "Đọc tài liệu gốc" trong thư viện: không có job, phát sự kiện openReaderRequested kèm documentId,
  // ReaderDialog sử dụng document_id để mở trình đọc tài liệu gốc chỉ đọc (hợp đồng sự kiện giống với chế độ đối chiếu khi đọc thẻ).
  function openSourceReader(documentId?: string | null) {
    const normalizedId = `${documentId || ""}`.trim();
    if (!normalizedId) {
      return;
    }
    dispatchAppEvent(APP_EVENTS.openReaderRequested, { documentId: normalizedId, pageIdx: null, blockId: "" });
  }

  // F3 "Chỉ lưu vào thư viện, không dịch": PDF ngay khi **hoàn tất tải lên** đã được backend tạo document
  // (POST /uploads → upsert_document_from_upload, document_id = mã băm nội dung),
  // do đó "chỉ lưu vào thư viện" không cần bất kỳ API mới nào —— **không gửi job dịch**: chỉ cần đóng hộp thoại workflow
  // (hàm close() sẽ tự động resetUploadSession + scheduleRefresh trong bindings).
  // Không force refresh thêm để tránh hộp thoại nhấp nháy hai lần khi đóng.
  function storeUploadedDocumentOnly() {
    dispatchAppEvent(APP_EVENTS.closeTranslationWorkflow);
  }

  // Thông báo lỗi dịch thân thiện: lỗi phổ biến nhất từ backend là "chưa cấu hình thông tin xác thực OCR/dịch"
  // (ví dụ: paddle_token is required), thông báo gốc không có ý nghĩa với người dùng, thay bằng gợi ý có thể thực hiện;
  // các lỗi khác ít nhất cũng hiển thị thông báo từ backend (không im lặng nữa).
  function friendlyTranslateError(error: ErrorLike) {
    const message = typeof error === "string" ? error : `${error?.message || error || ""}`;
    const credentialish = /(token|key|thông tin xác thực|credential)/i.test(message);
    const missing = /(required|cần|thiếu|chưa cấu hình|not configured|missing)/i.test(message);
    if (credentialish && missing) {
      return "Cần cấu hình thông tin xác thực OCR / dịch trong «Cài đặt» trước khi dịch.";
    }
    return message || "Bắt đầu dịch thất bại, vui lòng thử lại.";
  }

  // F5 "Dịch sau" cho tài liệu trong thư viện: tái sử dụng upload đã có của tài liệu để khởi tạo job dịch book,
  // backend sẽ điền lại active_job_id; sau đó tải lại toàn bộ trang —— tài liệu đó sẽ được đưa vào lưới với job_id thực,
  // công cụ polling hiện tại (active-refresh lấy job payload theo job_id) sẽ tự động tiếp quản tiến độ.
  //
  // Khi thất bại **ném lỗi cho bên gọi** (hộp thoại chi tiết sách sẽ hiển thị lỗi bằng setError bên trong và không đóng hộp thoại).
  // Ban đầu lỗi được render vào lưới, nhưng cổng dịch đã được chuyển từ thẻ vào hộp thoại,
  // trong khi thanh lỗi lưới chỉ hiển thị khi "lưới trống", khi lưới đầy người dùng sẽ không thấy gì —— biểu hiện là "nhấn không phản hồi"
  // (lỗi thực tế khi thiếu thông tin xác thực OCR).
  // Lắp ráp cấu hình job gửi cho backend: đầu tiên lấy cấu hình OCR (PaddleOCR) +
  // dịch (DeepSeek) đầy đủ từ thông tin xác thực đã cấu hình (buildTranslateConfig),
  // sau đó chồng thêm phạm vi trang từ hộp thoại (payload.ocr.page_ranges / payload.translation.start_page-end_page).
  // Nếu không có thông tin xác thực, backend sẽ không nhận được provider và sẽ mặc định sử dụng OCR provider đã bị loại bỏ, dẫn đến thất bại.
  function assembleTranslatePayload(overrides: TranslateDocumentPayload = {}): TranslateDocumentPayload {
    const pageRanges = `${overrides?.ocr?.page_ranges || ""}`.trim();
    const base = (buildTranslateConfig?.(pageRanges) || {}) as TranslateDocumentPayload;
    return {
      ...(base.ocr ? { ocr: { ...base.ocr, ...(overrides.ocr || {}) } } : (overrides.ocr ? { ocr: overrides.ocr } : {})),
      ...(base.translation ? { translation: { ...base.translation, ...(overrides.translation || {}) } } : (overrides.translation ? { translation: overrides.translation } : {})),
    };
  }

  /**
   * Tích hợp tiến độ nhiệm vụ một cách im lặng (tab Dịch trong chi tiết sách → bd-job-status-inner).
   * - startPolling im lặng: chỉ ghi vào statusCardStore, không hiển thị khu vực workflow, không phát sự kiện create
   * - Tuyệt đối không dispatch openTranslationWorkflow (tiến độ chính nằm trong chi tiết, không phải trong hộp thoại)
   * - Ẩn khu vực trạng thái chính để tránh #status-section / StatusCard chính tranh chấp
   */
  function attachJobProgress(jobId?: string | null) {
    const id = `${jobId || ""}`.trim();
    if (!id || id.startsWith("doc:")) {
      return;
    }
    hideStatusArea?.();
    startPolling?.(id, { silent: true, showWorkflow: false, publishLibrary: false });
    hideStatusArea?.();
  }

  /**
    * Phản hồi tức thì sau khi dịch thành công (không đợi tải lại toàn trang):
    * 1) Payload chi tiết ngay lập tức gắn job_id thực → tab Dịch chuyển sang StatusCard
    * 2) attachJobProgress → vòng tiến độ/giai đoạn bắt đầu hoạt động ngay
    * 3) publishJobUpdated cập nhật thẻ gốc theo document_id (cấm chèn thẻ thứ hai)
    * 4) Làm mới im lặng ở chế độ nền để đồng bộ với máy chủ, không nhấp nháy loading
    */
  function promoteDocumentToJob(
    documentId: string,
    result: JobSubmissionView | null | undefined,
  ) {
    const jobId = `${result?.job_id || result?.id || ""}`.trim();
    if (!jobId) {
      return;
    }
    const dialogState = bookDetailStore.getState();
    const base = (dialogState.payload || {}) as LibraryCardItem;
    const status = `${result?.status || "queued"}`.trim() || "queued";
    const stage = `${result?.stage || result?.display_stage || "queued"}`.trim() || "queued";

    if (dialogState.open && `${base.document_id || ""}`.trim() === documentId) {
      bookDetailStore.open({
        ...base,
        job_id: jobId,
        active_job_id: jobId,
        library_only: false,
        status,
        stage,
        display_stage: `${result?.display_stage || stage}`,
      });
    }

    // Dùng JobUpdated: sửa thẻ gốc tại chỗ theo document_id, cấm trang chủ chèn thêm một sách mới
    const previousJobId = `${base.job_id || ""}`.trim();
    libraryEventPort?.publishJobUpdated?.({
      job_id: jobId,
      source_job_id: previousJobId && previousJobId !== jobId ? previousJobId : undefined,
      document_id: documentId,
      active_job_id: jobId,
      library_only: false,
      status,
      stage,
      display_stage: `${result?.display_stage || stage}`,
      title: base.title,
      display_name: base.display_name || base.title,
      page_count: base.page_count,
      cover_url: base.cover_url,
      thumbnail_url: base.thumbnail_url,
    });
    attachJobProgress(jobId);
  }

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
    try {
      result = (await translateDocument(
        API_PREFIX,
        normalizedId,
        assembleTranslatePayload(payload),
      )) as JobSubmissionView;
    } catch (error) {
      throw new Error(friendlyTranslateError(error as ErrorLike));
    } finally {
      translatingDocumentIds.delete(normalizedId);
    }

    // Nhận tiến độ ngay + cập nhật chi tiết/lưới; không reload cả trang nữa (khi đang chạy tiến độ do patch từng thẻ thúc đẩy)
    promoteDocumentToJob(normalizedId, result);
    return result;
  }

  // Xóa ở cấp độ tài liệu (sau khi backend bổ sung DELETE /documents/:id): xóa document cùng tất cả
  // job/upload/tệp thuộc về nó. Tài liệu thư viện và tài liệu đã dịch đều sử dụng chung phương thức này (thẻ nào cũng có document_id).
  function friendlyDocumentDeleteError(error: ErrorLike) {
    const message = typeof error === "string" ? error : `${error?.message || error || ""}`;
    const status = typeof error === "object" && error ? error.status : undefined;
    if (status === 409 || message.includes("(409)")) {
      const count = message.match(/\d+/)?.[0];
      return count
        ? `Tài liệu này có ${count} mục yêu thích, vui lòng xóa các mục yêu thích trước khi xóa tài liệu.`
        : "Tài liệu này có tham chiếu yêu thích, vui lòng xóa các mục yêu thích liên quan trước khi xóa tài liệu.";
    }
    return message || "Xóa tài liệu thất bại";
  }

  // Tương tự như dịch: thất bại ném cho bên gọi (hiển thị trong hộp thoại). Thành công thì xóa thẻ lạc quan + làm mới im lặng,
  // không còn await tải lại toàn trang không im lặng (một trong những nguyên nhân gây trống trang chủ).
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

  // Xóa hàng loạt: API vẫn xóa từng cái một; lưới lạc quan xóa tất cả cùng lúc + làm mới im lặng một lần.
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

  // Cổng xóa thẻ: nếu có document_id thì xóa ở cấp độ tài liệu (xóa toàn bộ tài liệu + tất cả job thuộc về nó);
  // nếu không có (trường hợp hiếm khi chèn job lúc runtime) thì quay lại xóa job theo cách cũ, giữ nguyên hành vi cũ.
  function deleteCard(target: DeleteCardTarget = {}) {
    const documentId = `${target?.documentId || ""}`.trim();
    if (documentId) {
      // fire-and-forget: deleteLibraryDocument hiện sẽ throw; trả về lỗi để tránh unhandled rejection
      // (cổng xóa cấp thẻ này hiện không có consumer, việc xóa thẻ đã gộp vào hộp thoại chi tiết).
      void deleteLibraryDocument(documentId).catch(() => {});
      return;
    }
    deleteJob?.(`${target?.jobId || ""}`.trim());
  }

  function shouldPreferTranslateTab(item?: LibraryCardItem | null) {
    if (item?.prefer_translate_tab) return true;
    const status = `${item?.status || ""}`.trim().toLowerCase();
    if (status === "failed" || status === "running" || status === "queued" || status === "pending") {
      return true;
    }
    const jobId = `${item?.job_id || item?.active_job_id || ""}`.trim();
    // Có job thực và không phải ID tổng hợp của thư viện → mặc định xem tiến độ trong tab Dịch
    if (jobId && !jobId.startsWith("doc:") && !item?.library_only) {
      return true;
    }
    return false;
  }

  // Hộp thoại chi tiết sách: nhấn vào thẻ để mở. Khi đang chạy/thất bại mặc định chuyển đến tab Dịch + tiến độ im lặng,
  // tuyệt đối không mở #translation-workflow-dialog.
  function openBookDetail(item?: LibraryCardItem | null) {
    if (!item) return;
    const documentId = `${item.document_id || ""}`.trim();
    const jobId = `${item.job_id || item.active_job_id || ""}`.trim();
    // Ít nhất phải có document_id hoặc job_id thực
    if (!documentId && (!jobId || jobId.startsWith("doc:"))) {
      return;
    }
    const prefer = shouldPreferTranslateTab(item);
    bookDetailStore.open({
      ...item,
      prefer_translate_tab: prefer || Boolean(item.prefer_translate_tab),
    });
    if (jobId && !jobId.startsWith("doc:")) {
      attachJobProgress(jobId);
    }
  }

  /**
    * "Chọn nhiệm vụ" trong lưới: luôn chuyển đến tab Dịch trong chi tiết + tiến độ im lặng.
    * Không còn fallback về openTranslationWorkflow (hộp thoại cũ chỉ dành cho nút "Thêm" ở dưới cùng).
    */
  function selectJobForDetail(
    jobId?: string | null,
    options: {
      findItem?: (jobId: string) => LibraryCardItem | null | undefined;
      /** @deprecated Lưới thư viện không còn mở workflow; giữ tham số để tương thích injection trong test */
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
    // Tạm thời không tìm thấy dòng trong lưới: vẫn mở khung chi tiết bằng job_id + polling silent, không mở cửa sổ cũ
    openBookDetail({
      job_id: id,
      prefer_translate_tab: true,
      status: "running",
    });
  }

  // Đổi tiêu đề/nhãn/trạng thái đọc trong hộp thoại chi tiết: sau PATCH ghi lạc quan vào lưới/chi tiết, rồi đồng bộ so khớp mềm silent nền.
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

  return {
    bookDetailStore,
    // Tên key theo hợp đồng sẵn có của services.library.actions (consumer RecentJobsLibrary /
    // BookDetailDialog / CategoriesView không phải đổi).
    openSourceReader,
    storeOnly: storeUploadedDocumentOnly,
    translateDocument: translateLibraryDocument,
    deleteDocument: deleteLibraryDocument,
    deleteDocuments: deleteLibraryDocuments,
    deleteCard,
    openBookDetail,
    selectJobForDetail,
    updateDocument: updateLibraryDocument,
    /** Tiến độ nhúng trong chi tiết: polling silent, không mở #translation-workflow-dialog */
    attachJobProgress,
  };
}

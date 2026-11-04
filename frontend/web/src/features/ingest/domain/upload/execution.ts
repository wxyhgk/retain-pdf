// 选文件后的上传执行：大小/页数校验、提交请求、成功后落会话状态与页码范围。
//
// 从 controller.ts 抽出。依赖全部经参数注入，controller 只做装配。

import { withTimeout } from "@/platform/utils/async-timeout.js";
import { isRefusedSubmission } from "@/platform/api/index.js";
import { buildErrorDiagnostic } from "@/platform/utils/error-diagnostics.js";
import type { UploadPayload, UploadState, UploadStatePort } from "./state.js";
import { currentPageCap, type PageCap, type SizeCap, type UploadConfigPortLike, type UploadResponsePayload, type UploadViewPort } from "./ports.js";

const BALANCE_CHECK_TIMEOUT_MS = 12000;

export interface FileUploadHandlerDeps {
  viewPort: UploadViewPort;
  uploadState: Partial<UploadStatePort>;
  updateUploadState: (payload?: UploadPayload) => UploadState;
  updateAppliedPageRange: (value?: string) => UploadState;
  renderPageRangeSummary: () => void;
  currentPageRanges: () => string;
  resetUploadedFile?: () => void;
  resetUploadProgress?: () => void;
  clearFileInputValue?: () => void;
  setText: (id: string, value?: unknown) => void;
  applyWorkflowMode: () => void;
  refreshSubmitControls: () => void;
  refreshDeepSeekBalance?: ((options?: {
    silent?: boolean;
  }) => Promise<{ status?: string } | unknown>) | null;
  configPort: UploadConfigPortLike;
  apiPrefix?: string;
  frontMaxBytes: SizeCap;
  sizeLimitHint?: (maxBytes: number) => string;
  frontMaxPageCount: PageCap;
  pageLimitHint?: (max: number) => string;
  countPdfPages?: (file: File) => Promise<number> | number;
  defaultFileLabel: string;
  collectUploadFormData: (file: File) => FormData | unknown;
  submitUploadRequest: (
    url: string,
    formData: unknown,
    setProgress?: (loaded: number, total: number) => void,
  ) => Promise<UploadResponsePayload>;
  setUploadProgress?: (loaded: number, total: number) => void;
}

function formatByteLimit(bytes: unknown): string {
  const mb = Number(bytes) / (1024 * 1024);
  return Number.isFinite(mb) && mb > 0 ? `${Math.round(mb)}MB` : "当前";
}

export function createFileUploadHandler(deps: FileUploadHandlerDeps) {
  const {
    viewPort,
    uploadState,
    updateUploadState,
    updateAppliedPageRange,
    renderPageRangeSummary,
    currentPageRanges,
    resetUploadedFile,
    resetUploadProgress,
    clearFileInputValue,
    setText,
    applyWorkflowMode,
    refreshSubmitControls,
    refreshDeepSeekBalance,
    configPort,
    apiPrefix,
    frontMaxBytes,
    frontMaxPageCount,
    sizeLimitHint,
    pageLimitHint,
    countPdfPages,
    defaultFileLabel,
    collectUploadFormData,
    submitUploadRequest,
    setUploadProgress,
  } = deps;

  async function handleFileSelected(): Promise<void> {
    const file = viewPort.selectedFile();
    uploadState.reset?.();
    resetUploadedFile?.();
    resetUploadProgress?.();
    viewPort.clearPageRanges();
    renderPageRangeSummary();
    applyWorkflowMode();
    viewPort.setFileLabel(file, defaultFileLabel);
    if (!file) {
      return;
    }
    const maxBytes = currentPageCap(frontMaxBytes);
    if (maxBytes && file.size > maxBytes) {
      const hint = sizeLimitHint?.(maxBytes);
      setText("error-box", `当前限制为 ${formatByteLimit(maxBytes)} 以内 PDF${hint ? `（${hint}）` : ""}`);
      viewPort.showUploadStatus("文件超出大小限制");
      return;
    }
    // 这会儿的上限：按设置里选的 OCR（GLM-OCR 不限页数）。
    const maxPages = currentPageCap(frontMaxPageCount);
    if (maxPages && countPdfPages) {
      viewPort.showUploadStatus("正在校验页数…");
      try {
        const localPageCount = await countPdfPages(file);
        if (!Number.isFinite(localPageCount) || localPageCount <= 0) {
          setText("error-box", "PDF 解析失败，请检查文件是否损坏或可访问性异常。");
          viewPort.showUploadStatus("文件校验失败");
          clearFileInputValue?.();
          return;
        }
        if (localPageCount > maxPages) {
          const hint = pageLimitHint?.(maxPages);
          setText("error-box", `PDF 页数超过限制：最多 ${maxPages} 页${hint ? `。${hint}` : ""}`);
          viewPort.showUploadStatus("文件超出页数限制");
          clearFileInputValue?.();
          return;
        }
      } catch (err) {
        setText("error-box", buildErrorDiagnostic(err, {
          operation: "校验 PDF 文件",
          details: {
            file_name: file.name,
            file_size: file.size,
            max_pages: maxPages,
          },
        }));
        viewPort.showUploadStatus("文件校验失败");
        clearFileInputValue?.();
        return;
      }
    }
    setText("error-box", "-");
    viewPort.showUploadStatus("正在上传…");

    const uploadUrl = configPort.buildUploadUrl(apiPrefix);
    try {
      const payload = await submitUploadRequest(
        uploadUrl,
        collectUploadFormData(file),
        setUploadProgress,
      );
      const uploadedPageCount = Number(payload.page_count || 0);
      if (maxPages > 0 && uploadedPageCount > maxPages) {
        const hint = pageLimitHint?.(maxPages);
        setText("error-box", `PDF 页数超过限制：最多 ${maxPages} 页${hint ? `。${hint}` : ""}`);
        viewPort.showUploadStatus("文件超出页数限制");
        clearFileInputValue?.();
        resetUploadedFile?.();
        return;
      }
      const snapshot = updateUploadState({
        uploadId: payload.upload_id || "",
        documentId: payload.document_id || "",
        uploadedFileName: payload.filename || file.name,
        uploadedPageCount,
        uploadedBytes: Number(payload.bytes || file.size || 0),
      });
      viewPort.writePageRanges({
        start: uploadedPageCount > 0 ? "1" : "",
        end: uploadedPageCount > 0 ? `${uploadedPageCount}` : "",
      });
      updateAppliedPageRange(currentPageRanges());
      viewPort.markUploadReady(!!snapshot.uploadId);
      // 成功态只落一条稳定文案：余额检查全程静默，只在失败/缺失时追加一句，
      // 不再覆盖成功态（曾在 800ms 内连刷三条状态造成闪烁）。
      const uploadDoneStatus = "上传完成：请选择仅收藏、仅 OCR 或翻译。";
      viewPort.showUploadStatus(uploadDoneStatus);
      clearFileInputValue?.();
      renderPageRangeSummary();
      refreshSubmitControls();
      if (refreshDeepSeekBalance) {
        void withTimeout(
          refreshDeepSeekBalance({ silent: true }),
          BALANCE_CHECK_TIMEOUT_MS,
          "DeepSeek 余额检测超时",
        )
          .then((result) => {
            const status = `${(result as { status?: string } | null | undefined)?.status || ""}`;
            if (status === "network_error" || status === "missing_key") {
              viewPort.showUploadStatus(`${uploadDoneStatus}翻译接口状态未确认，提交前会再次检查。`);
            }
          })
          .catch(() => {
            viewPort.showUploadStatus(`${uploadDoneStatus}翻译接口状态未确认，提交前会再次检查。`);
          })
          .finally(() => {
            refreshSubmitControls();
          });
      }
    } catch (err) {
      resetUploadedFile?.();
      clearFileInputValue?.();
      if (isRefusedSubmission(err)) {
        // 磁盘空间不够这类不是故障：只显示那句中文，不给诊断。
        setText("error-box", (err as Error).message);
        viewPort.showUploadStatus("上传失败");
        applyWorkflowMode();
        return;
      }
      setText("error-box", buildErrorDiagnostic(err, {
        operation: "上传 PDF 文件",
        url: uploadUrl,
        details: {
          file_name: file.name,
          file_size: file.size,
          max_pages: maxPages,
        },
      }));
      viewPort.showUploadStatus("上传失败");
      applyWorkflowMode();
    }
  }

  return { handleFileSelected };
}

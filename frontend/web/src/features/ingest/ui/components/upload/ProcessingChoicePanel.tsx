// 展示组件边界：只收 props 发回调，不直连 services/store；
// 提交禁用/文案由 UploadTile 容器按凭据·预算就绪态映射为 submit* props。
import type { ReactNode } from "react";
import { Languages, Loader2, ScanSearch, SlidersHorizontal } from "lucide-react";

type ProcessingChoicePanelProps = {
  visible: boolean;
  uploadReady: boolean;
  submitBusy: boolean;
  submitDisabled: boolean;
  submitLabel: string;
  ocrOnly: boolean;
  pageRangeButtonVisible: boolean;
  pageRangeOpen: boolean;
  onToggleTranslationOptions: () => void;
  onStoreOnly: () => void;
  translationOptionsSlot: ReactNode;
};

export function ProcessingChoicePanel({
  visible,
  uploadReady,
  submitBusy,
  submitDisabled,
  submitLabel,
  ocrOnly,
  pageRangeButtonVisible,
  pageRangeOpen,
  onToggleTranslationOptions,
  onStoreOnly,
  translationOptionsSlot,
}: ProcessingChoicePanelProps) {
  return (
    <div id="upload-action-slot" className={`upload-action-slot${visible ? "" : " hidden"}`}>
      <div className="upload-action-group">
        <button
          id="page-range-btn"
          type="button"
          className={`page-range-mini secondary${pageRangeButtonVisible && !ocrOnly ? "" : " hidden"}`}
          aria-label="翻译选项"
          aria-expanded={pageRangeOpen}
          title="设置页码范围和术语表"
          onClick={onToggleTranslationOptions}
        >
          <SlidersHorizontal aria-hidden="true" />
          选项
        </button>
        <button
          id="store-only-btn"
          type="button"
          className={`secondary${uploadReady ? "" : " hidden"}`}
          disabled={!uploadReady || submitBusy}
          title="只加入书架，稍后再处理"
          onClick={onStoreOnly}
        >
          仅收藏
        </button>
        <button
          id="submit-btn"
          type="submit"
          disabled={submitDisabled || submitBusy}
          {...(submitBusy ? { "data-busy": "1" } : {})}
          title={ocrOnly ? "上传完成后开始 OCR" : "上传完成后开始翻译"}
        >
          {submitBusy ? (
            <Loader2 className="animate-spin" aria-hidden="true" />
          ) : ocrOnly ? (
            <ScanSearch aria-hidden="true" />
          ) : (
            <Languages aria-hidden="true" />
          )}
          {submitBusy ? "提交中…" : ocrOnly ? "开始 OCR" : submitLabel || "直接翻译"}
        </button>
      </div>

      {translationOptionsSlot}
    </div>
  );
}

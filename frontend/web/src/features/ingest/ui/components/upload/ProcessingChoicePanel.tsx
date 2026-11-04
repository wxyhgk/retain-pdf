// 展示组件边界：只收 props 发回调，不直连 services/store；
// 提交禁用/文案由 UploadTile 容器按凭据·预算就绪态映射为 submit* props。
// 提交按钮常显：不可提交时保持禁用（样式上半透明 + not-allowed），用 title
// 说明原因。只有「文件已就绪却被凭据拦住」时才在下方出一行 submit-hint
// （补凭据 / 设术语表），hint 内的动作按钮派发凭据设置事件，不新增 props。
// 缺文件 / 上传中不出 hint：上方拖放区（大加号 + 「单个 PDF / 最大 512MB」
// / 上传进度）已经把这件事说清楚，再来一行等于同一屏说两遍。
import type { ReactNode } from "react";
import { Languages, Loader2, ScanSearch, SlidersHorizontal } from "lucide-react";
import { APP_EVENTS } from "@/platform/contracts/app-contract.js";

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
  // 禁用原因与下一步：仅凭 uploadReady/submitDisabled 即可区分
  // 「缺文件」与「文件就绪但被凭据·预算·源任务拦住」两类。
  const blocked = submitDisabled && !submitBusy;
  const missingUpload = !uploadReady;
  let submitTitle = ocrOnly ? "上传完成后开始 OCR" : "上传完成后开始翻译";
  let hintText = "";
  let hintActionLabel = "";
  if (blocked && missingUpload) {
    submitTitle = "请先选择 PDF 文件并等待上传完成";
  } else if (blocked) {
    submitTitle = "请先完成接口设置后再提交";
    hintText = "文件已就绪，提交前请先完成接口设置，也可在选项中设置术语表。";
    hintActionLabel = "打开设置";
  }

  // hint 动作：已就绪被拦 → 打开浏览器凭据设置（与 CredentialGateNotice 同一事件）。
  function handleHintAction() {
    if (typeof document === "undefined") return;
    document.dispatchEvent(new CustomEvent(APP_EVENTS.openBrowserCredentials));
  }

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
          {...(blocked && hintText ? { "aria-describedby": "submit-hint" } : {})}
          title={submitTitle}
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

      {hintText ? (
        <p id="submit-hint" className="submit-hint" aria-live="polite">
          <span className="submit-hint-text">{hintText}</span>
          <button type="button" className="submit-hint-action" onClick={handleHintAction}>
            {hintActionLabel}
          </button>
        </p>
      ) : null}

      {translationOptionsSlot}
    </div>
  );
}

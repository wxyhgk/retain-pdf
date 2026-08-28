import { $ } from "../../dom/query.js";
import { APP_EVENTS } from "../../contracts/app-contract.js";

export interface ResetMissingUploadStateOptions {
  uploadStatePort?: {
    reset?: (options?: { includePageRange?: boolean }) => void;
  };
  resetUploadedFile?: () => void;
  setText?: (id: string, text: string) => void;
}

export function setSubmitBusy(busy) {
  document.dispatchEvent(new CustomEvent(APP_EVENTS.submitBusyChanged, {
    detail: { busy: !!busy },
  }));
  const button = $("submit-btn") as HTMLButtonElement | null;
  if (button) {
    button.disabled = !!busy;
    button.dataset.busy = busy ? "1" : "0";
  }
}

export function resetMissingUploadState({
  uploadStatePort,
  resetUploadedFile,
  setText,
}: ResetMissingUploadStateOptions = {}) {
  uploadStatePort?.reset?.({ includePageRange: false });
  resetUploadedFile?.();
  setText("error-box", "Tệp đã tải lên hiện không còn hợp lệ. Vui lòng tải lại PDF rồi gửi lại.");
}

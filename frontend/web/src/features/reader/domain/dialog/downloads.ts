import {
  downloadProtectedResponse,
  formatTransferSize,
  prepareDownloadTarget,
} from "@/platform/utils/downloads.js";
import type { DownloadProgressPayload } from "@/platform/utils/downloads.js";
import {
  completeDownloadToast,
  showDownloadPreparing,
  updateDownloadProgress,
} from "@/platform/utils/download-feedback.js";

export function summarizeDownloadProgress(receivedBytes: number, totalBytes: number, percent: number) {
  const receivedText = formatTransferSize(receivedBytes);
  if (Number.isFinite(totalBytes) && totalBytes > 0) {
    const totalText = formatTransferSize(totalBytes);
    const safePercent = Math.max(0, Math.min(100, Number(percent) || 0));
    return `正在下载 ${receivedText} / ${totalText} (${safePercent.toFixed(0)}%)`;
  }
  return receivedText ? `正在下载 ${receivedText}` : "正在下载...";
}

export async function downloadProtectedResource(
  fetchProtected: typeof fetch,
  url: string,
  fallbackName: string,
  preferredName = "",
  onStatus: ((status: DownloadProgressPayload) => void) | null = null,
  onBusy: ((busy: boolean, status?: string) => void) | null = null,
) {
  const trimmedName = `${preferredName || ""}`.trim();
  const suggestedName = trimmedName || fallbackName;
  // 惰性:响应确认成功之后才问保存位置（见 downloads.ts）。
  const downloadTarget = (filename?: string) => prepareDownloadTarget(filename || suggestedName);
  if (typeof onBusy === "function") {
    onBusy(true, "下载中...");
  }
  try {
    showDownloadPreparing(suggestedName);
    return await downloadProtectedResponse({
      fetchResponse: () => fetchProtected(url),
      url,
      fallbackName,
      preferredName: trimmedName,
      target: downloadTarget,
      onProgress: ({ filename, receivedBytes, totalBytes, percent, done }) => {
        if (typeof onStatus === "function") {
          onStatus({ filename, receivedBytes, totalBytes, percent, done });
        }
        if (typeof onBusy === "function") {
          onBusy(
            true,
            done
              ? "已完成"
              : Number.isFinite(percent)
                ? `${Math.max(0, Math.min(100, Number(percent) || 0)).toFixed(0)}%`
                : "下载中...",
          );
        }
        if (done) {
          completeDownloadToast(filename);
          return;
        }
        updateDownloadProgress({ filename, receivedBytes, totalBytes, percent });
      },
    });
  } finally {
    if (typeof onBusy === "function") {
      window.setTimeout(() => onBusy(false), 240);
    }
  }
}

import {
  fileNameFromDisposition,
  formatTransferSize,
  prepareDownloadTarget,
  saveResponseDownload,
} from "@/platform/utils/downloads.js";
import {
  completeDownloadToast,
  showDownloadPreparing,
  updateDownloadProgress,
} from "@/platform/utils/download-feedback.js";

export function summarizeDownloadProgress(receivedBytes, totalBytes, percent) {
  const receivedText = formatTransferSize(receivedBytes);
  if (Number.isFinite(totalBytes) && totalBytes > 0) {
    const totalText = formatTransferSize(totalBytes);
    const safePercent = Math.max(0, Math.min(100, Number(percent) || 0));
    return `正在下载 ${receivedText} / ${totalText} (${safePercent.toFixed(0)}%)`;
  }
  return receivedText ? `正在下载 ${receivedText}` : "正在下载...";
}

export async function downloadProtectedResource(
  fetchProtected,
  url,
  fallbackName,
  preferredName = "",
  onStatus = null,
  onBusy = null,
) {
  const suggestedName = `${preferredName || ""}`.trim() || fallbackName;
  const downloadTarget = await prepareDownloadTarget(suggestedName);
  if (downloadTarget.kind === "aborted") {
    return;
  }
  if (typeof onBusy === "function") {
    onBusy(true, "下载中...");
  }
  try {
    showDownloadPreparing(suggestedName);
    const resp = await fetchProtected(url);
    if (!resp.ok) {
      const text = await resp.text();
      const error: any = new Error(`下载失败: ${resp.status} ${text || "unknown error"}`);
      error.status = resp.status;
      error.url = url;
      throw error;
    }
    const disposition = resp.headers.get("content-disposition") || "";
    const finalName = `${preferredName || ""}`.trim() || fileNameFromDisposition(disposition, fallbackName);
    await saveResponseDownload(resp, {
      target: downloadTarget,
      filename: finalName,
      onProgress: ({ receivedBytes, totalBytes, percent, done }) => {
        if (typeof onStatus === "function") {
          onStatus({ filename: finalName, receivedBytes, totalBytes, percent, done });
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
          completeDownloadToast(finalName);
          return;
        }
        updateDownloadProgress({ filename: finalName, receivedBytes, totalBytes, percent });
      },
    });
  } finally {
    if (typeof onBusy === "function") {
      window.setTimeout(() => onBusy(false), 240);
    }
  }
}

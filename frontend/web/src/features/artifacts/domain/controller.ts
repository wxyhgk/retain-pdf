import {
  fileNameFromDisposition,
  formatTransferSize,
  prepareDownloadTarget,
  saveResponseDownload,
} from "@/platform/utils/downloads.js";
import {
  completeDownloadToast,
  failDownloadToast,
  showDownloadPreparing,
  updateDownloadProgress,
} from "@/platform/utils/download-feedback.js";
import { buildErrorDiagnostic } from "@/platform/utils/error-diagnostics.js";
import {
  downloadActionForLink,
  defaultDownloadNameResolver,
  resolveDownloadActionTarget,
} from "./download-actions.js";
import { createArtifactDownloadsRuntimePort } from "./runtime-port.js";

export function mountArtifactDownloadsFeature({
  state,
  fetchProtected,
  setText,
  runtimePort = createArtifactDownloadsRuntimePort(),
  viewPort,
  downloadNameResolver = defaultDownloadNameResolver,
}: any) {
  function summarizeDownloadProgress(receivedBytes, totalBytes, percent) {
    const receivedText = formatTransferSize(receivedBytes);
    if (Number.isFinite(totalBytes) && totalBytes > 0) {
      const totalText = formatTransferSize(totalBytes);
      const safePercent = Math.max(0, Math.min(100, Number(percent) || 0));
      return `正在下载 ${receivedText} / ${totalText} (${safePercent.toFixed(0)}%)`;
    }
    return receivedText ? `正在下载 ${receivedText}` : "正在下载...";
  }

  async function handleProtectedArtifactClick(event, matchedLink = null) {
    const link = matchedLink || event.currentTarget;
    if (!link) {
      return;
    }
    const disabled = viewPort.isLinkDisabled(link);
    const url = link.dataset.url || "";
    if (disabled || !url) {
      event.preventDefault();
      return;
    }

    event.preventDefault();
    setText("error-box", "-");
    const action = downloadActionForLink(link);
    const jobId = runtimePort.currentJobId(state) || "result";
    const {
      fallbackName,
      preferredName,
      preferSuggestedName,
    } = resolveDownloadActionTarget({
      action,
      state,
      jobId,
      nameResolver: downloadNameResolver,
    });
    const downloadTarget = await prepareDownloadTarget(preferredName);
    if (downloadTarget.kind === "aborted") {
      return;
    }

    try {
      viewPort.setLinkBusy(link, true, "下载中...");
      showDownloadPreparing(preferredName);
      const resp = await fetchProtected(url);
      if (!resp.ok) {
        const text = await resp.text();
        const error: any = new Error(`下载失败: ${resp.status} ${text || "unknown error"}`);
        error.status = resp.status;
        error.url = url;
        throw error;
      }

      const disposition = resp.headers.get("content-disposition") || "";
      const filename = preferSuggestedName
        ? preferredName
        : fileNameFromDisposition(disposition, fallbackName);
      await saveResponseDownload(resp, {
        target: downloadTarget,
        filename,
        onProgress: ({ receivedBytes, totalBytes, percent, done }) => {
          if (done) {
            setText("error-box", `已开始保存 ${filename}`);
            viewPort.setLinkBusy(link, true, "已完成");
            completeDownloadToast(filename);
            return;
          }
          setText("error-box", summarizeDownloadProgress(receivedBytes, totalBytes, percent));
          viewPort.setLinkBusy(
            link,
            true,
            Number.isFinite(percent) ? `${Math.max(0, Math.min(100, Number(percent) || 0)).toFixed(0)}%` : "下载中...",
          );
          updateDownloadProgress({
            filename,
            receivedBytes,
            totalBytes,
            percent,
          });
        },
      });
    } catch (err) {
      setText("error-box", buildErrorDiagnostic(err, {
        operation: "下载任务产物",
        url,
        jobId,
        details: {
          action,
          filename: preferredName,
        },
      }));
      failDownloadToast(err.message || "下载失败");
    } finally {
      viewPort.setLinkBusy(link, false);
    }
  }

  function bindEvents() {
    const unbind = viewPort.bindProtectedLinks(handleProtectedArtifactClick);
    return typeof unbind === "function" ? unbind : () => {};
  }

  return {
    bindEvents,
    handleProtectedArtifactClick,
  };
}

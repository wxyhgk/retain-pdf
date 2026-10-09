import {
  downloadProtectedResponse,
  formatTransferSize,
  prepareDownloadTarget,
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
import type { DownloadNameResolver } from "./download-actions.js";
import { createArtifactDownloadsRuntimePort, type ArtifactDownloadsRuntimePort } from "./runtime-port.js";

/** 下载链接的宿主视图端口（由页面注入，操作真实 <a> 的忙碌态与绑定）。 */
export type ArtifactDownloadsViewPort = {
  isLinkDisabled: (link: HTMLElement) => boolean;
  setLinkBusy: (link: HTMLElement, busy: boolean, label?: string) => unknown;
  bindProtectedLinks: (handler: (event: Event, link: Element) => unknown) => unknown;
};

/** 点击事件中本模块用到的部分。 */
export type ProtectedLinkEvent = {
  currentTarget?: EventTarget | null;
  preventDefault: () => void;
};

export type ArtifactDownloadsFeatureDeps = {
  state: unknown;
  fetchProtected: (url: string) => Promise<Response>;
  setText: (id: string, text?: unknown) => unknown;
  runtimePort?: ArtifactDownloadsRuntimePort;
  viewPort: ArtifactDownloadsViewPort;
  downloadNameResolver?: DownloadNameResolver;
};

export function mountArtifactDownloadsFeature({
  state,
  fetchProtected,
  setText,
  runtimePort = createArtifactDownloadsRuntimePort(),
  viewPort,
  downloadNameResolver = defaultDownloadNameResolver,
}: ArtifactDownloadsFeatureDeps) {
  function summarizeDownloadProgress(receivedBytes: number, totalBytes: number, percent: number) {
    const receivedText = formatTransferSize(receivedBytes);
    if (Number.isFinite(totalBytes) && totalBytes > 0) {
      const totalText = formatTransferSize(totalBytes);
      const safePercent = Math.max(0, Math.min(100, Number(percent) || 0));
      return `正在下载 ${receivedText} / ${totalText} (${safePercent.toFixed(0)}%)`;
    }
    return receivedText ? `正在下载 ${receivedText}` : "正在下载...";
  }

  async function handleProtectedArtifactClick(event: ProtectedLinkEvent, matchedLink: HTMLElement | null = null) {
    // currentTarget 是 EventTarget，这里按调用方约定（事件绑定在 <a> 上）收窄为 HTMLElement。
    const link = (matchedLink || event.currentTarget) as HTMLElement | null;
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
    // 惰性:响应确认成功之后才问保存位置（见 downloads.ts）。
    const downloadTarget = (filename?: string) => prepareDownloadTarget(filename || preferredName);

    try {
      viewPort.setLinkBusy(link, true, "下载中...");
      showDownloadPreparing(preferredName);
      await downloadProtectedResponse({
        fetchResponse: () => fetchProtected(url),
        url,
        fallbackName,
        preferredName: preferSuggestedName ? preferredName : "",
        target: downloadTarget,
        onProgress: ({ filename, receivedBytes, totalBytes, percent, done }) => {
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

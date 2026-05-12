import {
  bindProtectedArtifactLinks,
  downloadBlob,
  isActionLinkDisabled,
} from "./view.js";

export function mountArtifactDownloadsFeature({
  state,
  fetchProtected,
  setText,
}) {
  function fileNameFromDisposition(disposition, fallback) {
    if (!disposition || typeof disposition !== "string") {
      return fallback;
    }
    const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
    if (utf8Match && utf8Match[1]) {
      try {
        return decodeURIComponent(utf8Match[1]);
      } catch (_err) {
        return utf8Match[1];
      }
    }
    const plainMatch = disposition.match(/filename=\"?([^\";]+)\"?/i);
    return plainMatch && plainMatch[1] ? plainMatch[1] : fallback;
  }

  async function handleProtectedArtifactClick(event) {
    const link = event.currentTarget;
    const disabled = isActionLinkDisabled(link);
    const url = link.dataset.url || "";
    if (disabled || !url) {
      event.preventDefault();
      return;
    }

    event.preventDefault();
    setText("error-box", "-");

    try {
      const resp = await fetchProtected(url);
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`下载失败: ${resp.status} ${text || "unknown error"}`);
      }

      const blob = await resp.blob();
      const disposition = resp.headers.get("content-disposition") || "";
      const jobId = state.currentJobId || "result";
      const fallbackName = link.id === "download-btn"
        ? `${jobId}.zip`
        : link.id === "markdown-bundle-btn"
          ? `${jobId}-markdown.zip`
          : link.id === "pdf-btn"
            ? `${jobId}.pdf`
            : link.id === "markdown-raw-btn"
              ? `${jobId}.md`
              : `${jobId}.json`;
      downloadBlob(blob, fileNameFromDisposition(disposition, fallbackName));
    } catch (err) {
      setText("error-box", err.message);
    }
  }

  function bindEvents() {
    bindProtectedArtifactLinks(handleProtectedArtifactClick);
  }

  return {
    bindEvents,
    handleProtectedArtifactClick,
  };
}

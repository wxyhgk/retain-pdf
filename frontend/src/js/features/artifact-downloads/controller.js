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

  function downloadBlob(blob, filename) {
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
  }

  async function handleProtectedArtifactClick(event) {
    const link = event.currentTarget;
    const disabled = link.classList.contains("disabled") || link.getAttribute("aria-disabled") === "true";
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
    document.querySelectorAll("#download-btn, #markdown-bundle-btn, #pdf-btn, #markdown-btn, #markdown-raw-btn")
      .forEach((node) => {
        node.addEventListener("click", handleProtectedArtifactClick);
      });
  }

  return {
    bindEvents,
    handleProtectedArtifactClick,
  };
}

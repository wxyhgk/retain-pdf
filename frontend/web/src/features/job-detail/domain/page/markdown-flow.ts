import {
  isMarkdownReady,
  renderMarkdownContract,
  renderMarkdownImagePreview,
  resolveMarkdownImagesBaseUrl,
} from "./artifacts.js";

export function renderInitialMarkdownContract({
  job,
  markdownImageUrls,
  setActionLink,
  setText,
}) {
  renderMarkdownContract({
    job,
    markdownPayload: null,
    markdownImageUrls,
    setText,
    setActionLink,
  });
}

export async function loadAndRenderMarkdownFlow({
  fetchProtected,
  job,
  jobId,
  loadMarkdownPayload,
  markdownImageUrls,
  setActionLink,
  setText,
  state,
}) {
  try {
    const markdownPayload = await loadMarkdownPayload(jobId);
    if (state) {
      state.markdownPayload = markdownPayload;
    }
    renderMarkdownContract({
      job,
      markdownPayload,
      markdownImageUrls,
      setText,
      setActionLink,
    });
    if (markdownPayload) {
      await renderMarkdownImagePreview({
        markdownPayload,
        imagesBaseUrl: resolveMarkdownImagesBaseUrl(job, markdownPayload),
        markdownImageUrls,
        fetchProtected,
      });
    } else if (isMarkdownReady(job)) {
      setText("detail-markdown-status", "Markdown 已标记 ready，但 /markdown 暂未返回内容");
    }
  } catch (error) {
    renderMarkdownContract({
      job,
      markdownPayload: null,
      markdownImageUrls,
      setText,
      setActionLink,
    });
    setText("detail-markdown-status", error.message || "读取 Markdown 失败");
  }
}

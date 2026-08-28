// Tầng render mệnh lệnh cho nội dung bong bóng AI: chuyển giao nguyên vẹn ngữ nghĩa từ src/js/reader/ai/chat.js cũ —
// Render tiết lưu Markdown dạng luồng (~90ms), inject nút trích dẫn [n] tại chỗ, danh sách chú thích trích dẫn,
// hoạt hình máy đánh chữ ký tự, văn bản sự kiện tool. React chỉ render khung bong bóng (article/label/body),
// nội dung chính (Markdown DOM/nút trích dẫn) không vào Virtual DOM, toàn bộ ghi qua handle message view.
//
// Handle message view: { root, body } trỏ đến phần tử bong bóng React đã commit
// (root=article, body=.reader-ai-message-body-el), được điền bởi callback ref của component.

import { renderAiMarkdownFragment } from "../../../../js/reader/markdown-render.js";
import type { PageAnchor } from "../../../../js/reader/types.js";

// Văn bản ngữ nghĩa hóa cho sự kiện công cụ agentic (sự kiện tool của /api/v1/ai/ask)
// Frontend hỏi đáp toàn sách sẽ lọc list_documents; văn bản cũng tránh cảm giác "thư viện"
const TOOL_EVENT_LABELS: Record<string, string> = {
  list_documents: "Xác nhận thông tin tài liệu",
  read_blocks: "Đọc các đoạn liên quan",
  search_favorites: "Tìm kiếm mục yêu thích",
  search_fulltext: "Tìm kiếm nội dung tài liệu",
};

const PROGRESS_CLASS = "reader-ai-message-progress";

export interface AiCitation {
  ref?: number | string;
  block_id?: string;
  page_idx?: number;
  page?: number;
  title?: string;
  snippet?: string;
  [key: string]: unknown;
}

export interface AiToolEvent {
  tool?: string;
  round?: number;
  [key: string]: unknown;
}

export interface MessageView {
  root: HTMLElement | null;
  body: HTMLElement | null;
  attachRoot(element: HTMLElement | null): void;
  attachBody(element: HTMLElement | null): void;
}

export interface AiMessageEntry {
  id: string;
  role: string;
  title: string;
  view: MessageView;
}

export interface StreamMessageOptions {
  chunkSize?: number;
  intervalMs?: number;
}

export interface RenderRichAnswerOptions {
  jumpToCitation?: ((citation: AiCitation & PageAnchor) => void) | null;
}

function nowMs() {
  // Date.now() trong một số môi trường bị hạn chế không khả dụng, suy biến về 0 (tiết lưu suy biến về luôn render mỗi lần, vẫn đúng)
  try {
    return Date.now();
  } catch (_err) {
    return 0;
  }
}

export function createMessageView(): MessageView {
  const view: MessageView = {
    root: null,
    body: null,
    attachRoot(element) {
      if (element) {
        view.root = element;
      }
    },
    attachBody(element) {
      if (element) {
        view.body = element;
      }
    },
  };
  return view;
}

export function isAgenticCitation(citation) {
  return !!citation
    && typeof citation === "object"
    && `${citation.block_id || ""}`.trim() !== "";
}

export function hasAgenticCitations(citations = []) {
  return Array.isArray(citations) && citations.some(isAgenticCitation);
}

export function formatCitations(citations = []) {
  if (!Array.isArray(citations) || !citations.length) {
    return "";
  }
  return `\n\nTrích dẫn:\n${citations
    .slice(0, 4)
    .map((item, index) => `${index + 1}. ${item.title || "Đoạn liên quan"}${item.page ? ` · Trang ${item.page}` : ""}${item.snippet ? `: ${item.snippet}` : ""}`)
    .join("\n")}`;
}

export function describeToolEvent(event: AiToolEvent = {}) {
  const tool = `${event?.tool || ""}`.trim();
  // Hỏi đáp toàn sách không hiển thị tiến độ kiểu "duyệt thư viện"
  if (tool === "list_documents") {
    return "";
  }
  const label = TOOL_EVENT_LABELS[tool] || tool;
  const action = label ? `Đang ${label.toLowerCase()}…` : "Đang tìm kiếm tài liệu…";
  // Không nhấn mạnh "lượt thứ n" nữa, giống tiến độ trò chuyện thông thường hơn
  return action;
}

export function renderMessageText(view, text = "", citations = []) {
  if (!view?.body) {
    return;
  }
  view.body.textContent = `${text}${formatCitations(citations)}`;
}

export function setMessageProgress(view, on) {
  view?.root?.classList?.toggle?.(PROGRESS_CLASS, Boolean(on));
}

// Hoạt hình máy đánh chữ ký tự (giữ giao diện cũ khi câu trả lời không phải luồng và không có trích dẫn agentic)
export function streamMessageText(view, text = "", citations = [], { chunkSize = 3, intervalMs = 12 }: StreamMessageOptions = {}) {
  if (!view?.body) {
    return Promise.resolve();
  }
  const fullText = `${text || ""}`;
  let index = 0;
  renderMessageText(view, "", []);
  return new Promise<void>((resolve) => {
    function tick() {
      index = Math.min(fullText.length, index + chunkSize);
      renderMessageText(view, fullText.slice(0, index), []);
      view.root?.parentElement?.scrollTo?.({ top: view.root.parentElement.scrollHeight });
      if (index >= fullText.length) {
        renderMessageText(view, fullText, citations);
        resolve();
        return;
      }
      globalThis.window?.setTimeout?.(tick, intervalMs) ?? setTimeout(tick, intervalMs);
    }
    tick();
  });
}

function clipSnippet(text = "", maxLength = 120) {
  const normalized = `${text}`.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength).trim()}…`;
}

function createCitationButton(documentRef, { className, text, citation, jumpToCitation }) {
  const button = documentRef.createElement("button");
  button.type = "button";
  button.className = className;
  button.textContent = text;
  button.addEventListener?.("click", () => {
    jumpToCitation?.(citation);
  });
  return button;
}

// Duyệt qua các text node trong container, thay thế ký hiệu [n] tại chỗ thành nút trích dẫn có thể nhấp.
// Tách biệt với render Markdown: dù nội dung là DOM do marked sinh ra hay text node thuần túy dự phòng, đều có thể thêm trích dẫn.
// Bỏ qua text bên trong code/pre ([n] trong code không phải trích dẫn).
function injectCitationButtons(container, citationByRef, documentRef, jumpToCitation) {
  if (!citationByRef.size || !container?.querySelectorAll) {
    return;
  }
  const walker = documentRef.createTreeWalker
    ? documentRef.createTreeWalker(container, 0x4 /* SHOW_TEXT */)
    : null;
  const textNodes = [];
  if (walker) {
    let node = walker.nextNode();
    while (node) {
      if (!node.parentElement?.closest?.("code, pre, .reader-ai-citation-ref")) {
        textNodes.push(node);
      }
      node = walker.nextNode();
    }
  }
  for (const textNode of textNodes) {
    const text = `${textNode.textContent || ""}`;
    if (!/\[\d+\]/.test(text)) {
      continue;
    }
    const fragment = documentRef.createDocumentFragment();
    for (const part of text.split(/(\[\d+\])/)) {
      if (!part) {
        continue;
      }
      const marker = part.match(/^\[(\d+)\]$/);
      const citation = marker ? citationByRef.get(marker[1]) : null;
      if (citation) {
        fragment.appendChild(createCitationButton(documentRef, {
          citation,
          className: "reader-ai-citation-ref",
          jumpToCitation,
          text: part,
        }));
      } else {
        fragment.appendChild(documentRef.createTextNode(part));
      }
    }
    textNode.replaceWith(fragment);
  }
}

// Render văn bản câu trả lời vào bong bóng: ưu tiên Markdown (trình duyệt), khi marked không khả dụng thì lùi về text node thuần túy.
// Sau đó inject nút trích dẫn [n] và danh sách chú thích trích dẫn. Toàn bộ quá trình theo cơ chế best-effort, hỏng bước nào hạ cấp bước đó.
export async function renderRichAnswer(view, text = "", citations = [], { jumpToCitation = null }: RenderRichAnswerOptions = {}) {
  const body = view?.body;
  if (!body) {
    return;
  }
  const documentRef = view.root?.ownerDocument || body.ownerDocument || globalThis.document;
  const citationByRef = new Map();
  for (const citation of citations) {
    if (isAgenticCitation(citation)) {
      citationByRef.set(`${citation.ref}`, citation);
    }
  }

  // Trích dẫn không phải agentic (trích dẫn dạng tiêu đề của tìm kiếm Markdown cục bộ) được giữ lại dạng khối văn bản "Trích dẫn:" ở đuôi
  const plainCitationText = citationByRef.size ? "" : formatCitations(citations);

  // 1) Nội dung chính: Markdown → fragment, thất bại thì dùng văn bản thuần
  let rendered = false;
  if (typeof body.replaceChildren === "function" && documentRef.createElement) {
    try {
      const fragment = await renderAiMarkdownFragment(text, { documentRef });
      body.replaceChildren(fragment);
      if (plainCitationText && documentRef.createTextNode) {
        body.appendChild(documentRef.createTextNode(plainCitationText));
      }
      rendered = true;
    } catch (_err) {
      rendered = false;
    }
  }
  if (!rendered) {
    body.textContent = `${text}${plainCitationText}`;
  }

  // 2) Inject nút trích dẫn [n] tại chỗ (tách rời marked)
  injectCitationButtons(body, citationByRef, documentRef, jumpToCitation);

  // 3) Danh sách chú thích trích dẫn (gắn trên article bong bóng, ngang cấp với nội dung chính)
  const messageEl = view.root;
  if (!citationByRef.size || typeof messageEl?.appendChild !== "function") {
    return;
  }
  messageEl.querySelector?.(".reader-ai-citations")?.remove?.();
  const footer = documentRef.createElement("div");
  footer.className = "reader-ai-citations";
  for (const citation of citationByRef.values()) {
    const pageIdx = Number(citation.page_idx);
    const pageLabel = Number.isFinite(pageIdx) && pageIdx >= 0 ? ` · Trang ${pageIdx + 1}` : "";
    footer.appendChild(createCitationButton(documentRef, {
      citation,
      className: "reader-ai-citation-item",
      jumpToCitation,
      text: `[${citation.ref}] ${clipSnippet(citation.snippet || "Đoạn trích liên quan")}${pageLabel}`,
    }));
  }
  messageEl.appendChild(footer);
}

// Render gia tăng Markdown trong giai đoạn luồng: tiết lưu theo thời gian (~90ms), tránh việc phân tích lại từng token gây giật.
// Trả về { push(fullText), stop() }: push xếp hàng văn bản tích lũy mới nhất, stop hủy bỏ render tiết lưu đang chờ
// (gọi trước finalize, tránh việc kích hoạt muộn ghi đè nút trích dẫn).
export function createStreamingMarkdownRenderer(view, throttleMs = 90) {
  let latest = "";
  let rendering = false;
  let dirty = false;
  let lastAt = 0;
  let timer = null;

  async function doRender() {
    if (rendering) {
      dirty = true;
      return;
    }
    rendering = true;
    dirty = false;
    lastAt = nowMs();
    const text = latest;
    // Trong giai đoạn luồng chỉ render Markdown nội dung chính, nút trích dẫn/chú thích để lại đến finalize
    await renderRichAnswer(view, text, [], {});
    rendering = false;
    if (dirty) {
      await doRender();
    }
  }

  function schedule() {
    if (timer) {
      return;
    }
    const wait = Math.max(0, throttleMs - (nowMs() - lastAt));
    timer = (globalThis.setTimeout || setTimeout)(() => {
      timer = null;
      void doRender();
    }, wait);
  }

  return {
    push(fullText) {
      latest = `${fullText || ""}`;
      schedule();
    },
    stop() {
      if (timer) {
        (globalThis.clearTimeout || clearTimeout)(timer);
        timer = null;
      }
      dirty = false;
    },
  };
}

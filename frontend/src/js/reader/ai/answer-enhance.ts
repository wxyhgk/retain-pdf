// AI answer DOM enhancement: inject clickable [n] citations, compact footnotes, and hydrate protected images as blobs.

import { fetchProtected } from "../../api/http.js";
import { resolveResourceUrl } from "../../job/artifacts.js";
import {
  isReaderAiNavigationLocked,
  shouldIgnoreReaderAiNavEvent,
} from "./ui-interaction-lock.js";

export type AiCitationLike = {
  ref?: number | string;
  block_id?: string;
  page_idx?: number;
  page?: number;
  job_id?: string;
  document_id?: string;
  snippet?: string;
  [key: string]: unknown;
};

export function isAgenticCitation(citation: unknown): citation is AiCitationLike {
  return !!citation
    && typeof citation === "object"
    && `${(citation as AiCitationLike).block_id || ""}`.trim() !== "";
}

/** Resolve a 0-based page_idx from a citation; when absent, try p00N inside block_id. */
export function resolveCitationPageIdx(citation: AiCitationLike | null | undefined): number | null {
  if (!citation || typeof citation !== "object") return null;
  // page_idx is 0-based across the chain (Python Citation/new ask flow).
  const rawIdx = citation.page_idx;
  if (rawIdx !== undefined && rawIdx !== null && `${rawIdx}`.trim() !== "") {
    const n = Number(rawIdx);
    if (Number.isFinite(n) && n >= 0) return Math.floor(n);
  }
  // page fields are 1-based across the system (legacy /reader/ai/chat flow, Python _public_anchor).
  // They were previously used as 0-based, causing page-only data to be off by one (audit B4 latent off-by-one).
  const rawPage = citation.page;
  if (rawPage !== undefined && rawPage !== null && `${rawPage}`.trim() !== "") {
    const n = Number(rawPage);
    if (Number.isFinite(n) && n >= 1) return Math.floor(n) - 1;
  }
  // p009-b0010 → page 9 (1-based) → idx 8
  const match = `${citation.block_id || ""}`.match(/(?:^|[^0-9])p0*([1-9]\d*)(?:-|_|\b)/i);
  if (match) {
    const oneBased = Number(match[1]);
    if (Number.isFinite(oneBased) && oneBased >= 1) return oneBased - 1;
  }
  return null;
}

/** Reader-facing 1-based page number. */
export function resolveCitationPageNumber(citation: AiCitationLike | null | undefined): number | null {
  const idx = resolveCitationPageIdx(citation);
  if (idx === null) return null;
  return idx + 1;
}

export function clipSnippet(text = "", maxLength = 72): string {
  const normalized = `${text}`.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength).trim()}…`;
}

/** Keep only [n] references that appear in the answer body, avoiding a long list of citations. */
export function pickCitationsForAnswer(
  answerText: string,
  citations: AiCitationLike[],
  { max = 5 }: { max?: number } = {},
): AiCitationLike[] {
  const agentic = citations.filter(isAgenticCitation).map((c) => ({
    ...c,
    page_idx: resolveCitationPageIdx(c) ?? c.page_idx,
  }));
  if (!agentic.length) return [];

  const byRef = new Map<string, AiCitationLike>();
  for (const c of agentic) {
    byRef.set(`${c.ref}`, c);
  }

  const orderedRefs: string[] = [];
  const seen = new Set<string>();
  for (const match of `${answerText || ""}`.matchAll(/\[(\d+)\]/g)) {
    const ref = match[1];
    if (seen.has(ref)) continue;
    if (!byRef.has(ref)) continue;
    seen.add(ref);
    orderedRefs.push(ref);
  }

  if (orderedRefs.length) {
    return orderedRefs.slice(0, max).map((ref) => byRef.get(ref)!);
  }

  // If the body has no [n], keep a few high-quality anchors, deduplicated by page.
  const fallback: AiCitationLike[] = [];
  const pages = new Set<number>();
  for (const c of agentic) {
    const page = resolveCitationPageIdx(c);
    if (page !== null) {
      if (pages.has(page)) continue;
      pages.add(page);
    }
    fallback.push(c);
    if (fallback.length >= Math.min(3, max)) break;
  }
  return fallback;
}

export function buildPagePreviewUrl(jobId: string, pageIdx0: number, kind: "translated" | "source" = "translated"): string {
  const job = `${jobId || ""}`.trim();
  const page = Math.max(1, Math.floor(Number(pageIdx0) || 0) + 1);
  if (!job) return "";
  const path = `/api/v1/jobs/${encodeURIComponent(job)}/preview/pages/${page}?kind=${kind}&width=240`;
  return resolveResourceUrl(path) || path;
}

export function buildMarkdownImageApiUrl(jobId: string, relativePath: string): string {
  const job = `${jobId || ""}`.trim();
  let rel = `${relativePath || ""}`.replace(/\\/g, "/").replace(/^\.\//, "");
  while (rel.startsWith("images/")) {
    rel = rel.slice("images/".length);
  }
  if (!job || !rel) return "";
  const path = `/api/v1/jobs/${encodeURIComponent(job)}/markdown/images/${rel.split("/").map(encodeURIComponent).join("/")}`;
  return resolveResourceUrl(path) || path;
}

/**
 * Convert markdown-generated <a href> elements into non-navigating spans.
 * In desktop Electron, setWindowOpenHandler leads to shell.openExternal, so
 * target=_blank, window.open, or a real <a> click can open the system browser.
 * During branch remounts, stale clicks felt like "opening a new tab again".
 */
export function neutralizeMarkdownAnchors(
  container: ParentNode,
  {
    onOpen,
    documentRef = globalThis.document,
  }: {
    /** Callback for explicit user link clicks; return true when handled. */
    onOpen?: ((href: string, event: MouseEvent) => boolean | void) | null;
    documentRef?: Document;
  } = {},
): void {
  if (!container || !documentRef) return;
  const anchors = [...((container as Element).querySelectorAll?.("a[href]") || [])];
  for (const anchor of anchors) {
    const a = anchor as HTMLAnchorElement;
    const href = `${a.getAttribute("href") || ""}`.trim();
    const span = documentRef.createElement("span");
    span.className = `aui-md-extlink${a.className ? ` ${a.className}` : ""}`.trim();
    // Preserve child nodes; links may contain strong/code.
    while (a.firstChild) {
      span.appendChild(a.firstChild);
    }
    if (!span.textContent?.trim() && href) {
      span.textContent = href;
    }

    if (
      href
      && !href.startsWith("#")
      && !/^\s*javascript:/i.test(href)
    ) {
      span.dataset.href = href;
      span.setAttribute("role", "link");
      span.tabIndex = 0;
      span.title = `Mở liên kết: ${href}`;
      const tryOpen = (event: Event) => {
        event.preventDefault();
        event.stopPropagation();
        if (shouldIgnoreReaderAiNavEvent(event)) return;
        if (isReaderAiNavigationLocked()) return;
        if (event instanceof MouseEvent) {
          // Only trusted primary-button clicks with an actual click count.
          if (event.button !== 0) return;
          if (event.detail === 0) return;
        }
        if (onOpen?.(href, event as MouseEvent) === true) return;
        // Default: do not openExternal automatically. onOpen handles explicit user gestures.
        // This no-op avoids any "clicked a branch but opened a browser" behavior.
      };
      span.addEventListener("click", tryOpen);
      span.addEventListener("auxclick", (event) => {
        event.preventDefault();
        event.stopPropagation();
      });
      span.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        tryOpen(event);
      });
    } else {
      // Anchor/empty links: plain text.
      span.removeAttribute("role");
    }
    a.replaceWith(span);
  }

  // Extra guard: if any a[href] remains from dynamic insertion, intercept navigation in the capture phase.
  const host = container as Element;
  if (host instanceof Element && !host.dataset.auiLinkGuard) {
    host.dataset.auiLinkGuard = "1";
    host.addEventListener(
      "click",
      (event) => {
        const t = event.target;
        if (!(t instanceof Element)) return;
        const a = t.closest("a[href]");
        if (!a || !host.contains(a)) return;
        event.preventDefault();
        event.stopPropagation();
      },
      true,
    );
  }
}

/** Replace [n] in the body with clickable buttons, skipping code/pre. */
export function injectCitationMarkers(
  container: ParentNode,
  citationByRef: Map<string, AiCitationLike>,
  onJump: ((citation: AiCitationLike) => void) | null,
  documentRef: Document = globalThis.document,
): void {
  if (!citationByRef.size || !container) return;
  // Clear old markers first to avoid repeated injection and stacked listeners.
  (container as Element).querySelectorAll?.("button.reader-ai-citation-ref").forEach((btn) => {
    const parent = btn.parentNode;
    if (!parent) return;
    parent.replaceChild(documentRef.createTextNode(btn.textContent || ""), btn);
    parent.normalize?.();
  });
  // 0x4 = SHOW_TEXT; avoid relying on global NodeFilter, which is absent in jsdom/some environments.
  const walker = documentRef.createTreeWalker?.(container as Node, 0x4) || null;
  const textNodes: Text[] = [];
  if (walker) {
    let node = walker.nextNode();
    while (node) {
      if (!(node.parentElement?.closest?.("code, pre, .reader-ai-citation-ref, button, a, .aui-msg-actions"))) {
        textNodes.push(node as Text);
      }
      node = walker.nextNode();
    }
  }
  for (const textNode of textNodes) {
    const text = `${textNode.textContent || ""}`;
    if (!/\[\d+\]/.test(text)) continue;
    const fragment = documentRef.createDocumentFragment();
    for (const part of text.split(/(\[\d+\])/)) {
      if (!part) continue;
      const marker = part.match(/^\[(\d+)\]$/);
      const citation = marker ? citationByRef.get(marker[1]) : null;
      if (citation) {
        const button = documentRef.createElement("button");
        button.type = "button";
        button.className = "reader-ai-citation-ref";
        button.textContent = part;
        const pageNo = resolveCitationPageNumber(citation);
        button.title = pageNo
          ? `Đi tới trang ${pageNo} - ${clipSnippet(citation.snippet || "", 60)}`
          : clipSnippet(citation.snippet || "Đoạn liên quan", 60);
        if (pageNo != null) button.dataset.page = `${pageNo}`;
        button.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          // Ignore stale clicks during branch/session remounts.
          if (shouldIgnoreReaderAiNavEvent(event)) return;
          onJump?.(citation);
        });
        fragment.appendChild(button);
      } else {
        fragment.appendChild(documentRef.createTextNode(part));
      }
    }
    textNode.replaceWith(fragment);
  }
}

/** Revoke hydrated blob URLs in the container before rerender/unmount to prevent leaks (audit P1-5). */
export function revokeHydratedImageUrls(container: ParentNode | null | undefined): void {
  if (!container) return;
  const images = [...((container as Element).querySelectorAll?.("img.is-hydrated") || [])];
  for (const img of images) {
    const src = (img as HTMLImageElement).src || "";
    if (src.startsWith("blob:")) {
      try {
        URL.revokeObjectURL(src);
      } catch {
        /* ignore */
      }
    }
  }
}

/** Protected API images to blobs for markdown images inside answer bodies. */
export async function hydrateProtectedImages(
  container: ParentNode,
  { fetchImpl = fetchProtected }: { fetchImpl?: typeof fetchProtected } = {},
): Promise<void> {
  const images = [...(container as Element).querySelectorAll?.("img[src], img[data-ai-src]") || []];
  await Promise.allSettled(images.map(async (img) => {
    const el = img as HTMLImageElement;
    const raw = el.getAttribute("data-ai-src") || el.getAttribute("src") || "";
    if (!raw || raw.startsWith("blob:") || raw.startsWith("data:") || raw.startsWith("mock:")) {
      return;
    }
    const isApi = /\/api\/v1\//i.test(raw) || raw.startsWith("/") || !/^[a-z]+:/i.test(raw);
    if (!isApi) return;
    const url = resolveResourceUrl(raw) || raw;
    el.setAttribute("data-ai-src", url);
    try {
      const response = await fetchImpl(url);
      if (!response?.ok) throw new Error(`HTTP ${response?.status || 0}`);
      const objectUrl = URL.createObjectURL(await response.blob());
      // Revoke the old blob when the same image is hydrated repeatedly after citation/content rerenders.
      const previous = el.src || "";
      if (previous.startsWith("blob:")) {
        try {
          URL.revokeObjectURL(previous);
        } catch {
          /* ignore */
        }
      }
      el.src = objectUrl;
      el.classList.add("is-hydrated");
    } catch {
      el.classList.add("is-missing");
      el.alt = el.alt || "Hình ảnh tạm không khả dụng";
    }
  }));
}

/**
 * Compact citation footnotes as chips, without large thumbnails by default.
 * Only show picked entries, usually the [n] references in the body.
 */
export function renderCitationFooter(
  host: HTMLElement,
  citations: AiCitationLike[],
  {
    onJump = null,
    answerText = "",
    max = 5,
    documentRef = globalThis.document,
  }: {
    onJump?: ((citation: AiCitationLike) => void) | null;
    answerText?: string;
    max?: number;
    documentRef?: Document;
  } = {},
): void {
  host.querySelector(".reader-ai-citations")?.remove();
  const picked = pickCitationsForAnswer(answerText, citations, { max });
  if (!picked.length) return;

  const footer = documentRef.createElement("div");
  footer.className = "reader-ai-citations";
  footer.setAttribute("aria-label", "Nguồn trích dẫn");

  const head = documentRef.createElement("div");
  head.className = "reader-ai-citations-head";
  head.textContent = "Nguồn";
  footer.appendChild(head);

  const list = documentRef.createElement("div");
  list.className = "reader-ai-citations-list";

  for (const citation of picked) {
    const pageNo = resolveCitationPageNumber(citation);
    const pageLabel = pageNo != null ? `p.${pageNo}` : "";
    const row = documentRef.createElement("button");
    row.type = "button";
    row.className = "reader-ai-citation-item";
    if (pageNo != null) row.dataset.page = `${pageNo}`;
    row.title = pageNo != null ? `Đi tới trang ${pageNo}` : "Định vị nguồn";
    row.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (shouldIgnoreReaderAiNavEvent(event)) return;
      onJump?.(citation);
    });

    const refEl = documentRef.createElement("span");
    refEl.className = "reader-ai-citation-refno";
    refEl.textContent = `[${citation.ref ?? "?"}]`;

    const meta = documentRef.createElement("span");
    meta.className = "reader-ai-citation-meta";
    meta.textContent = pageLabel || "—";

    const copy = documentRef.createElement("span");
    copy.className = "reader-ai-citation-copy";
    copy.textContent = clipSnippet(citation.snippet || "Đoạn liên quan", 64);

    row.append(refEl, meta, copy);
    list.appendChild(row);
  }

  footer.appendChild(list);
  host.appendChild(footer);
}

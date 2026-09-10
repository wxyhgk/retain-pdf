// Markdown 悬浮预览：任务识别/译文 Markdown 产物

import { useEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import { ChevronDown, ChevronUp, FileCode2, ListTree, Search } from "lucide-react";
import {
  defaultReaderDataPort,
  fetchProtected,
  resolveMarkdownAssetUrl,
} from "../../external.js";
import {
  extractMarkdownMath,
  materializeMarkdownMathFallbackHtml,
  materializeMarkdownMathHtml,
} from "../../shared/content/markdown-math.js";
import { normalizeMarkdownPayload } from "../../shared/data/markdown-payload.js";
import { ReaderFloatShell } from "./ReaderFloatShell.js";

export type ReaderMarkdownPanelProps = {
  open: boolean;
  jobId: string;
  sourceOnly: boolean;
  layout?: "floating" | "docked" | "workspace";
  side?: "left" | "right";
  onClose: () => void;
};

let markedModulePromise: Promise<typeof import("marked")> | null = null;

function loadMarked() {
  if (!markedModulePromise) {
    markedModulePromise = import("marked").catch((err) => {
      markedModulePromise = null;
      throw err;
    });
  }
  return markedModulePromise;
}

function sanitizeRenderedMarkdown(container: ParentNode) {
  container
    .querySelectorAll("script, iframe, object, embed, style, link, meta, base, form, input, button, textarea, select")
    .forEach((node) => node.remove());
  container.querySelectorAll("*").forEach((node) => {
    for (const attribute of [...(node as Element).attributes]) {
      if (/^on/i.test(attribute.name)) {
        (node as Element).removeAttribute(attribute.name);
      }
    }
  });
  container.querySelectorAll("a[href]").forEach((anchor) => {
    const el = anchor as HTMLAnchorElement;
    if (/^\s*javascript:/i.test(el.getAttribute("href") || "")) {
      el.removeAttribute("href");
    }
    el.setAttribute("target", "_blank");
    el.setAttribute("rel", "noopener noreferrer");
  });
}

function mountRenderedMarkdown(
  container: HTMLElement,
  html: string,
  imagesBaseUrl: string,
): HTMLImageElement[] {
  const template = container.ownerDocument.createElement("template");
  template.innerHTML = html;
  sanitizeRenderedMarkdown(template.content);
  template.content.querySelectorAll("img[src]").forEach((img) => {
    const raw = img.getAttribute("src") || "";
    const resolved = resolveMarkdownAssetUrl(imagesBaseUrl, raw) || raw;
    img.setAttribute("data-reader-md-src", resolved);
    img.setAttribute("loading", "lazy");
    img.setAttribute("decoding", "async");
    img.removeAttribute("src");
  });
  container.replaceChildren(template.content);
  container.classList.remove("hidden");
  return [...container.querySelectorAll<HTMLImageElement>("img[data-reader-md-src]")];
}

export function isProtectedMarkdownAssetUrl(value: string, baseUrl = "http://localhost/"): boolean {
  if (/^mock:\/\//i.test(value)) return true;
  try {
    // API payloads normally expose a root-relative images_base_url. A relative URL
    // cannot itself be used as URL's base, so anchor both values to the document
    // origin before deciding whether the image needs the credentialed fetch path.
    const documentBase = globalThis.location?.href || "http://localhost/";
    const trustedBase = new URL(baseUrl, documentBase);
    const url = new URL(value, trustedBase);
    if (!/\/api\/v1\/jobs\/[^/]+\/markdown\/images\//.test(url.pathname)) return false;
    if (!/^[a-z][a-z\d+.-]*:/i.test(value)) return true;
    const isLoopback = ["localhost", "127.0.0.1", "::1", "[::1]"].includes(url.hostname);
    return url.origin === trustedBase.origin || isLoopback;
  } catch {
    return false;
  }
}

export type MarkdownOutlineItem = {
  id: string;
  level: number;
  text: string;
};

function markdownHeadingSlug(text: string): string {
  return text
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "") || "section";
}

export function buildMarkdownOutline(container: ParentNode): MarkdownOutlineItem[] {
  const used = new Map<string, number>();
  return [...container.querySelectorAll<HTMLElement>("h1, h2, h3, h4, h5, h6")]
    .flatMap((heading) => {
      const text = (heading.textContent || "").replace(/\s+/g, " ").trim();
      if (!text) return [];
      const base = markdownHeadingSlug(text);
      const occurrence = (used.get(base) || 0) + 1;
      used.set(base, occurrence);
      const id = occurrence === 1 ? `reader-md-${base}` : `reader-md-${base}-${occurrence}`;
      heading.id = id;
      return [{ id, level: Number(heading.tagName.slice(1)), text }];
    });
}

const MARKDOWN_SEARCH_SELECTOR = "h1, h2, h3, h4, h5, h6, p, li, td, th, blockquote, pre";

export function clearMarkdownSearchHighlights(container: ParentNode): void {
  container
    .querySelectorAll(".reader-markdown-search-hit, .reader-markdown-search-hit-active")
    .forEach((element) => {
      element.classList.remove("reader-markdown-search-hit", "reader-markdown-search-hit-active");
    });
}

export function findMarkdownSearchTargets(container: ParentNode, query: string): HTMLElement[] {
  clearMarkdownSearchHighlights(container);
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return [];
  const candidates = [...container.querySelectorAll<HTMLElement>(MARKDOWN_SEARCH_SELECTOR)];
  const matches = candidates.filter((element) => {
    if ([...element.children].some((child) => child.matches(MARKDOWN_SEARCH_SELECTOR))) return false;
    return (element.textContent || "").toLocaleLowerCase().includes(needle);
  });
  matches.forEach((element) => element.classList.add("reader-markdown-search-hit"));
  return matches;
}

type MarkdownImageProgress = {
  failed: number;
  loaded: number;
  total: number;
};

type ProtectedMarkdownImageLoaderOptions = {
  fetchImage: (url: string) => Promise<Response>;
  onObjectUrl: (url: string) => void;
  onProgress?: (progress: MarkdownImageProgress) => void;
  protectedBaseUrl?: string;
  root?: Element | null;
};

/**
 * Direct public images rely on native lazy loading. Protected images cannot set src until
 * their authenticated blob has been fetched, so observe them against the reader scrollport.
 */
export function startMarkdownImageLoading(
  images: HTMLImageElement[],
  options: ProtectedMarkdownImageLoaderOptions,
): () => void {
  let stopped = false;
  let active = 0;
  let loaded = 0;
  let failed = 0;
  const queue: HTMLImageElement[] = [];
  const protectedImages: HTMLImageElement[] = [];
  const queued = new Set<HTMLImageElement>();

  const replaceWithFailure = (img: HTMLImageElement, label: string) => {
    const fallback = img.ownerDocument.createElement("span");
    fallback.className = "reader-markdown-image-missing";
    fallback.textContent = label;
    fallback.title = img.getAttribute("data-reader-md-src") || "";
    img.replaceWith(fallback);
  };

  for (const img of images) {
    const src = img.getAttribute("data-reader-md-src") || "";
    const documentBaseUrl = img.ownerDocument.baseURI || "http://localhost/";
    if (isProtectedMarkdownAssetUrl(src, options.protectedBaseUrl || documentBaseUrl)) {
      protectedImages.push(img);
    } else if (isSafeDirectImageUrl(src, documentBaseUrl)) {
      img.src = src;
    } else {
      replaceWithFailure(img, "[图片地址不可用]");
    }
  }

  const report = () => options.onProgress?.({ failed, loaded, total: protectedImages.length });
  const pump = () => {
    if (stopped) return;
    while (active < 4 && queue.length > 0) {
      const img = queue.shift();
      if (!img?.isConnected) continue;
      active += 1;
      const src = img.getAttribute("data-reader-md-src") || "";
      void options.fetchImage(src)
        .then(async (response) => {
          if (!response?.ok) throw new Error(`HTTP ${response?.status || 0}`);
          const objectUrl = URL.createObjectURL(await response.blob());
          if (stopped || !img.isConnected) {
            try { URL.revokeObjectURL(objectUrl); } catch { /* ignore */ }
            return;
          }
          options.onObjectUrl(objectUrl);
          img.src = objectUrl;
          loaded += 1;
        })
        .catch(() => {
          if (stopped || !img.isConnected) return;
          failed += 1;
          replaceWithFailure(img, "[图片暂不可用]");
        })
        .finally(() => {
          active -= 1;
          if (!stopped) {
            report();
            pump();
          }
        });
    }
  };
  const enqueue = (img: HTMLImageElement) => {
    if (stopped || queued.has(img)) return;
    queued.add(img);
    queue.push(img);
    pump();
  };

  const Observer = globalThis.IntersectionObserver;
  let observer: IntersectionObserver | null = null;
  if (Observer && protectedImages.length > 0) {
    observer = new Observer((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const img = entry.target as HTMLImageElement;
        observer?.unobserve(img);
        enqueue(img);
      });
    }, { root: options.root || null, rootMargin: "600px 0px" });
    protectedImages.forEach((img) => observer?.observe(img));
  } else {
    protectedImages.forEach(enqueue);
  }
  report();

  return () => {
    stopped = true;
    queue.length = 0;
    observer?.disconnect();
  };
}

function isSafeDirectImageUrl(value: string, baseUrl: string): boolean {
  if (/^data:image\//i.test(value) || /^blob:/i.test(value)) return true;
  try {
    const url = new URL(value, baseUrl);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function ReaderMarkdownPanel({
  open,
  jobId,
  sourceOnly,
  layout = "floating",
  side = "right",
  onClose,
}: ReaderMarkdownPanelProps) {
  const contentRef = useRef<HTMLElement | null>(null);
  const [status, setStatus] = useState("尚未加载");
  const objectUrlsRef = useRef<string[]>([]);
  const imageLoaderCleanupRef = useRef<(() => void) | null>(null);
  const searchMatchesRef = useRef<HTMLElement[]>([]);
  const searchQueryRef = useRef("");
  const [outline, setOutline] = useState<MarkdownOutlineItem[]>([]);
  const [outlineOpen, setOutlineOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchMatchCount, setSearchMatchCount] = useState(0);
  const [activeSearchIndex, setActiveSearchIndex] = useState(-1);

  const revokeAll = () => {
    for (const url of objectUrlsRef.current) {
      try { URL.revokeObjectURL(url); } catch { /* ignore */ }
    }
    objectUrlsRef.current = [];
  };

  const activateSearchMatch = (index: number, scroll = true) => {
    const matches = searchMatchesRef.current;
    matches.forEach((element) => element.classList.remove("reader-markdown-search-hit-active"));
    if (matches.length === 0) {
      setActiveSearchIndex(-1);
      return;
    }
    const normalized = (index + matches.length) % matches.length;
    const target = matches[normalized];
    target.classList.add("reader-markdown-search-hit-active");
    setActiveSearchIndex(normalized);
    if (scroll && typeof target.scrollIntoView === "function") {
      target.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  };

  const applySearch = (query: string, scroll = false) => {
    if (!contentRef.current) return;
    const matches = findMarkdownSearchTargets(contentRef.current, query);
    searchMatchesRef.current = matches;
    setSearchMatchCount(matches.length);
    activateSearchMatch(matches.length > 0 ? 0 : -1, scroll);
  };

  useEffect(() => {
    return () => {
      imageLoaderCleanupRef.current?.();
      revokeAll();
    };
  }, []);

  useEffect(() => {
    if (!open) {
      imageLoaderCleanupRef.current?.();
      imageLoaderCleanupRef.current = null;
      revokeAll();
      setOutline([]);
      return;
    }
    let cancelled = false;
    // 每次重新加载前回收上一轮 blob，避免 jobId 切换/重开时泄漏
    revokeAll();
    imageLoaderCleanupRef.current?.();
    imageLoaderCleanupRef.current = null;

    async function load() {
      const isSynthetic = jobId.startsWith("doc:");
      if (!jobId || isSynthetic) {
        // OCR 吸怪：馆藏合成 job(doc:*) 仍提示源文档无 Markdown；但 OCR-only 已通过 active_job_id 落真实 job_id（非合成），此分支不再误拦
        const msg = !jobId && sourceOnly ? "源文档阅读不提供 Markdown 产物" : "该任务暂无 Markdown 产物";
        setStatus(msg);
        if (contentRef.current) {
          contentRef.current.replaceChildren();
          contentRef.current.classList.add("hidden");
        }
        return;
      }
      setStatus("正在加载 Markdown…");
      contentRef.current?.replaceChildren();
      contentRef.current?.classList.add("hidden");
      try {
        const payload = await defaultReaderDataPort.loadMarkdownPayload(jobId);
        if (cancelled) return;
        const { content, imagesBaseUrl } = normalizeMarkdownPayload(payload);
        if (!content.trim()) {
          setStatus("该任务暂无 Markdown 产物");
          contentRef.current?.replaceChildren();
          contentRef.current?.classList.add("hidden");
          return;
        }
        const { marked } = await loadMarked();
        if (cancelled || !contentRef.current) return;
        const { text: protectedMarkdown, slots } = extractMarkdownMath(content);
        const parsedHtml = String(marked.parse(protectedMarkdown, { async: false }));
        const fastHtml = materializeMarkdownMathFallbackHtml(parsedHtml, slots);
        mountRenderedMarkdown(contentRef.current, fastHtml, imagesBaseUrl);
        setOutline(buildMarkdownOutline(contentRef.current));
        applySearch(searchQueryRef.current);
        setStatus(slots.length > 0 ? `正文已显示 · 正在渲染 ${slots.length} 个公式…` : "");

        const html = slots.length > 0
          ? await materializeMarkdownMathHtml(parsedHtml, slots)
          : parsedHtml;
        if (cancelled || !contentRef.current) return;
        const images = mountRenderedMarkdown(contentRef.current, html, imagesBaseUrl);
        setOutline(buildMarkdownOutline(contentRef.current));
        applySearch(searchQueryRef.current);
        setStatus("");
        const scrollRoot = contentRef.current.closest(".reader-notes-panel-body");
        imageLoaderCleanupRef.current = startMarkdownImageLoading(images, {
          root: scrollRoot,
          protectedBaseUrl: imagesBaseUrl || contentRef.current.ownerDocument.baseURI,
          fetchImage: fetchProtected,
          onObjectUrl: (url) => objectUrlsRef.current.push(url),
          onProgress: ({ failed }) => {
            if (!cancelled && failed > 0) setStatus(`正文已加载 · ${failed} 张图片不可用`);
          },
        });
      } catch (err) {
        if (cancelled) return;
        setStatus(err instanceof Error ? err.message : "Markdown 加载失败");
      }
    }

    void load();
    return () => {
      cancelled = true;
      imageLoaderCleanupRef.current?.();
      imageLoaderCleanupRef.current = null;
      // 中途取消时，若已创建了 blob 也需回收；下一轮 load 开头的 revokeAll 会兜底
      // 这里不直接 revoke，避免与正在进行的 Promise 竞争，依赖 cancelled 检查回收
    };
  }, [open, jobId, sourceOnly]);

  return (
    <ReaderFloatShell
      id="reader-markdown-panel"
      open={open}
      title="Markdown"
      subtitle={layout === "docked" ? "识别与翻译产出 · PDF / Markdown 分栏" : "识别与翻译产出 · 拖动可移动"}
      titleIcon={<FileCode2 size={14} strokeWidth={2.25} aria-hidden />}
      storageKey="retainpdf.reader.markdown-float.pos.v1"
      ariaLabel="Markdown 预览"
      width={420}
      placement={layout === "workspace" ? "workspace" : layout === "docked" ? "dock-right" : "floating"}
      showHeader={layout !== "workspace"}
      className={layout === "workspace" ? `is-pane-${side}` : undefined}
      onClose={onClose}
      toolbar={(
        <span className="reader-notes-count">{status || "已加载"}</span>
      )}
    >
      <div className="reader-markdown-nav" aria-label="Markdown 导航与搜索">
        <label className="reader-markdown-search">
          <Search size={13} aria-hidden />
          <input
            type="search"
            value={searchQuery}
            placeholder="搜索正文"
            aria-label="搜索 Markdown 正文"
            onChange={(event) => {
              const query = event.target.value;
              searchQueryRef.current = query;
              setSearchQuery(query);
              applySearch(query, false);
            }}
            onKeyDown={(event) => {
              if (event.key !== "Enter" || searchMatchCount === 0) return;
              event.preventDefault();
              activateSearchMatch(activeSearchIndex + (event.shiftKey ? -1 : 1));
            }}
          />
          {searchQuery ? (
            <span className="reader-markdown-search-count" aria-live="polite">
              {searchMatchCount > 0 ? `${activeSearchIndex + 1}/${searchMatchCount}` : "0/0"}
            </span>
          ) : null}
          <button
            type="button"
            aria-label="上一个搜索结果"
            disabled={searchMatchCount === 0}
            onClick={() => activateSearchMatch(activeSearchIndex - 1)}
          >
            <ChevronUp size={13} aria-hidden />
          </button>
          <button
            type="button"
            aria-label="下一个搜索结果"
            disabled={searchMatchCount === 0}
            onClick={() => activateSearchMatch(activeSearchIndex + 1)}
          >
            <ChevronDown size={13} aria-hidden />
          </button>
        </label>
        <button
          type="button"
          className="reader-markdown-outline-toggle"
          aria-expanded={outlineOpen}
          disabled={outline.length === 0}
          onClick={() => setOutlineOpen((value) => !value)}
        >
          <ListTree size={13} aria-hidden />
          目录{outline.length > 0 ? ` ${outline.length}` : ""}
        </button>
      </div>
      {outlineOpen && outline.length > 0 ? (
        <nav className="reader-markdown-outline" aria-label="Markdown 目录">
          {outline.map((item) => (
            <button
              key={item.id}
              type="button"
              style={{ "--reader-md-outline-level": item.level - 1 } as CSSProperties}
              onClick={() => {
                const target = [...(contentRef.current?.querySelectorAll<HTMLElement>("h1, h2, h3, h4, h5, h6") || [])]
                  .find((heading) => heading.id === item.id);
                if (target && typeof target.scrollIntoView === "function") {
                  target.scrollIntoView({ block: "start", behavior: "smooth" });
                }
              }}
            >
              {item.text}
            </button>
          ))}
        </nav>
      ) : null}
      {status && !contentRef.current?.childNodes?.length ? (
        <p className="reader-notes-empty">{status}</p>
      ) : null}
      <article
        ref={contentRef as RefObject<HTMLElement>}
        id="reader-markdown-content"
        className="reader-markdown-content reader-float-markdown-content"
      />
    </ReaderFloatShell>
  );
}

import {
  createContext,
  useCallback,
  useEffect,
  useContext,
  useRef,
  type MouseEvent as ReactMouseEvent,
} from "react";
import MarkdownRender, {
  MathInlineNode,
  setCustomComponents,
  type ImageNodeProps,
  type LinkNodeProps,
  type MathInlineNodeProps,
} from "markstream-react";
import {
  findCitationForAnswerImage,
  hydrateProtectedImages,
  resolveAnswerImageUrl,
  resolveCitationPageNumber,
  revokeHydratedImageUrls,
  type AiCitationLike,
} from "../../shared/ai/answer-enhance.js";

const RETAINPDF_MARKSTREAM_ID = "retainpdf-ai-answer";
const LOW_RESOLUTION_IMAGE_WIDTH = 320;
const MAX_LOW_RESOLUTION_UPSCALE = 2;

type AssetContextValue = {
  final: boolean;
  jobId: string;
  citations: AiCitationLike[];
  onJumpCitation?: (citation: AiCitationLike) => void;
};

const AssetContext = createContext<AssetContextValue>({
  final: false,
  jobId: "",
  citations: [],
});

/**
 * Keep tiny OCR crops legible without stretching them across most of the chat
 * column. Larger figures retain the product-wide 70% answer width.
 */
export function syncAnswerImageDisplaySize(image: HTMLImageElement): void {
  const naturalWidth = Number(image.naturalWidth) || 0;
  const wrapper = image.closest<HTMLElement>(".reader-ai-image-jump");
  const target = wrapper || image;
  const lowResolution = naturalWidth > 0 && naturalWidth < LOW_RESOLUTION_IMAGE_WIDTH;
  image.classList.toggle("is-low-resolution", lowResolution);
  wrapper?.classList.toggle("is-low-resolution", lowResolution);
  if (lowResolution) {
    const displayWidth = Math.min(
      LOW_RESOLUTION_IMAGE_WIDTH,
      Math.max(naturalWidth, naturalWidth * MAX_LOW_RESOLUTION_UPSCALE),
    );
    target.style.setProperty("--reader-ai-image-width", `${displayWidth}px`);
  } else {
    target.style.removeProperty("--reader-ai-image-width");
  }
}

function RetainImageNode({ node }: ImageNodeProps) {
  const { final, jobId, citations, onJumpCitation } = useContext(AssetContext);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const hydrationControllerRef = useRef<AbortController | null>(null);
  const alt = `${node.alt || ""}`.trim();
  const safeUrl = resolveAnswerImageUrl(node.src, jobId);
  const citation = findCitationForAnswerImage(node.src, citations, jobId);
  const pageNumber = resolveCitationPageNumber(citation);

  const attachImage = useCallback((nextImage: HTMLImageElement | null) => {
    const previousImage = imageRef.current;
    if (previousImage === nextImage) return;
    hydrationControllerRef.current?.abort();
    hydrationControllerRef.current = null;
    if (previousImage) revokeHydratedImageUrls(previousImage);
    imageRef.current = nextImage;
    if (!nextImage || !safeUrl) return;

    const controller = new AbortController();
    hydrationControllerRef.current = controller;
    void (async () => {
      // 流式回答可能先产出 Markdown 图片引用，后端图片产物稍后才可读。
      // 首次临时 404 不应要求用户刷新页面；使用短时有限退避恢复，同时
      // ref 回调会在 Markstream 替换图片节点时重新执行，避免旧 effect 已
      // 结束而新节点永远停在无 src 状态，必须刷新页面才能看到图片。
      for (const delay of [0, 250, 750, 1_500]) {
        if (delay) await new Promise((resolve) => globalThis.setTimeout(resolve, delay));
        if (controller.signal.aborted) return;
        const image = imageRef.current;
        if (!image || image !== nextImage) return;
        if (image.classList.contains("is-hydrated") && image.src.startsWith("blob:")) return;
        await hydrateProtectedImages(image, { signal: controller.signal });
      }
    })();
  }, [safeUrl]);

  useEffect(() => () => {
    hydrationControllerRef.current?.abort();
    hydrationControllerRef.current = null;
    revokeHydratedImageUrls(imageRef.current);
    imageRef.current = null;
  }, []);

  if (!safeUrl) {
    if (final) {
      return (
        <span className="aui-image-blocked">
          {alt ? `[图片不可用：${alt}]` : "[图片不可用]"}
        </span>
      );
    }
    return (
      <span className="aui-image-pending" aria-label={alt || "图片加载中"}>
        {alt ? `[图片：${alt}]` : "[图片加载中]"}
      </span>
    );
  }
  const image = (
    <img
      ref={attachImage}
      alt={alt}
      data-ai-src={safeUrl}
      decoding="async"
      loading="lazy"
      onLoad={(event) => syncAnswerImageDisplaySize(event.currentTarget)}
      title={node.title || undefined}
    />
  );
  if (!citation || !onJumpCitation) return image;
  return (
    <button
      type="button"
      className="reader-ai-image-jump"
      data-page={pageNumber ?? undefined}
      title={pageNumber ? `定位到 PDF 第 ${pageNumber} 页` : "定位到图片来源"}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onJumpCitation({ ...citation, image_url: safeUrl });
      }}
    >
      {image}
      <span className="reader-ai-image-jump-label" aria-hidden="true">
        {pageNumber ? `定位 p.${pageNumber}` : "定位来源"}
      </span>
    </button>
  );
}

function RetainLinkNode({ node }: LinkNodeProps) {
  const { citations, onJumpCitation } = useContext(AssetContext);
  const citationMatch = `${node.href || ""}`.match(/^#retainpdf-citation-(\d+)$/);
  const citation = citationMatch
    ? citations.find((item) => `${item.ref}` === citationMatch[1])
    : null;
  if (citation) {
    const pageNumber = resolveCitationPageNumber(citation);
    return (
      <button
        type="button"
        className="reader-ai-citation-ref"
        data-page={pageNumber ?? undefined}
        title={pageNumber ? `跳到第 ${pageNumber} 页` : "定位来源"}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onJumpCitation?.(citation);
        }}
      >
        [{citationMatch?.[1]}]
      </button>
    );
  }
  const label = `${node.text || node.href || ""}`.trim();
  return (
    <span
      className="aui-md-extlink"
      data-href={`${node.href || ""}`.trim() || undefined}
      title={label || undefined}
    >
      {label}
    </span>
  );
}

function RetainMathInlineNode({ node }: MathInlineNodeProps) {
  // Markstream accepts $$...$$ in the middle of a paragraph and then asks
  // KaTeX to use display mode inside an inline span. That produces the giant
  // fractions and displaced punctuation seen in Reader answers. A real block
  // formula is parsed as math_block, so inline nodes should always use KaTeX's
  // text style regardless of which delimiter the model happened to emit.
  return (
    <MathInlineNode
      node={node.markup === "$$" ? { ...node, markup: "$" } : node}
    />
  );
}

// Scoped registration: only RetainPDF's renderer instance gets the protected
// image and non-navigating link nodes. The React context keeps per-message job
// state out of Markstream's global component registry.
setCustomComponents(RETAINPDF_MARKSTREAM_ID, {
  image: RetainImageNode,
  link: RetainLinkNode,
  math_inline: RetainMathInlineNode,
});

export type RetainMarkstreamProps = {
  content: string;
  final: boolean;
  indexKey: string;
  jobId: string;
  citations?: AiCitationLike[];
  onJumpCitation?: (citation: AiCitationLike) => void;
  onClickCapture?: (event: ReactMouseEvent<HTMLDivElement>) => void;
};

export function RetainMarkstream({
  content,
  final,
  indexKey,
  jobId,
  citations = [],
  onJumpCitation,
  onClickCapture,
}: RetainMarkstreamProps) {
  return (
    <AssetContext.Provider value={{ final, jobId, citations, onJumpCitation }}>
      <div
        className="retain-markstream-shell"
        data-markdown-renderer="markstream-react"
        onClickCapture={onClickCapture}
      >
        <MarkdownRender
          batchRendering={!final}
          content={content}
          customId={RETAINPDF_MARKSTREAM_ID}
          fade={false}
          final={final}
          // AI output is untrusted. Markstream's "safe" policy intentionally
          // still permits ordinary <img>/<a>; "escape" prevents raw HTML from
          // bypassing RetainPDF's protected image and inert link nodes.
          htmlPolicy="escape"
          indexKey={indexKey}
          maxLiveNodes={0}
          renderCodeBlocksAsPre
          showTooltips={false}
          // The answer transport already appends complete chunks. Markstream's
          // internal typewriter queue can fall behind a newer controlled
          // `content` value and leave citations or protected images stale.
          smoothStreaming={false}
          typewriter={false}
        />
      </div>
    </AssetContext.Provider>
  );
}

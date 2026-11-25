// 把 PDF 某一页上的一块区域，按要的宽度重新画出来（不是把屏幕上那张放大，所以放多大都清楚）。
// 放大查看（ReaderZoomViewer）用它；以后引用悬停预览也用它。
//
// 区域用「占整页的比例」给（0–1，左上角为原点），和段落数据的页面尺寸单位无关；pdf.js 自己知道这一页多大。

import { useEffect, useRef, useState } from "react";

/** pdf.js PDFDocumentProxy / PDFPageProxy 里用到的那几样。 */
export type RegionPdfDocument = {
  getPage(pageNumber: number): Promise<RegionPdfPage>;
};

type RegionViewport = { width: number; height: number };

export type RegionPdfPage = {
  getViewport(options: { scale: number; offsetX?: number; offsetY?: number }): RegionViewport;
  render(options: { canvasContext: CanvasRenderingContext2D; viewport: RegionViewport }): { promise: Promise<void>; cancel(): void };
};

/** 区域：占整页的比例，左上角为原点。 */
export type RegionFraction = { left: number; top: number; width: number; height: number };

/** 画布最大边长（像素）：再大浏览器可能画不出来，也太占内存。 */
export const REGION_CANVAS_MAX_PX = 6000;

/** 四周留一点边，框住的字不贴边。 */
export function padRegion(region: RegionFraction, pad = 0.012): RegionFraction {
  const left = Math.max(0, region.left - pad);
  const top = Math.max(0, region.top - pad);
  const right = Math.min(1, region.left + region.width + pad);
  const bottom = Math.min(1, region.top + region.height + pad);
  return { left, top, width: right - left, height: bottom - top };
}

/**
 * 画这一块要用的缩放和画布尺寸：画布宽 = 显示宽 × 像素比，超过上限按比例缩。
 * pageSize 是缩放 1 时整页的大小（PDF 点）。
 */
export function regionRenderPlan(region: RegionFraction, pageSize: { width: number; height: number }, cssWidth: number, pixelRatio: number) {
  const regionWidthPts = region.width * pageSize.width;
  const regionHeightPts = region.height * pageSize.height;
  let scale = (cssWidth * pixelRatio) / Math.max(1, regionWidthPts);
  const longest = Math.max(regionWidthPts, regionHeightPts) * scale;
  if (longest > REGION_CANVAS_MAX_PX) scale *= REGION_CANVAS_MAX_PX / longest;
  return {
    scale,
    offsetX: -region.left * pageSize.width * scale,
    offsetY: -region.top * pageSize.height * scale,
    canvasWidth: Math.max(1, Math.round(regionWidthPts * scale)),
    canvasHeight: Math.max(1, Math.round(regionHeightPts * scale)),
    /** 显示高度（CSS 像素），按区域的宽高比。 */
    cssHeight: Math.round(cssWidth * (regionHeightPts / Math.max(1, regionWidthPts))),
  };
}

export function RegionCanvas({
  pdf,
  page,
  region,
  cssWidth,
  className,
  label,
}: {
  pdf: RegionPdfDocument;
  page: number;
  region: RegionFraction;
  /** 显示宽度（CSS 像素）。 */
  cssWidth: number;
  className?: string;
  label?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [state, setState] = useState<{ status: "loading" | "ready" | "error"; cssHeight: number }>({ status: "loading", cssHeight: 0 });
  const key = `${page}:${region.left}:${region.top}:${region.width}:${region.height}:${Math.round(cssWidth)}`;

  useEffect(() => {
    let cancelled = false;
    let task: { cancel(): void } | null = null;
    setState((current) => ({ status: "loading", cssHeight: current.cssHeight }));
    (async () => {
      try {
        const pdfPage = await pdf.getPage(page);
        if (cancelled) return;
        const base = pdfPage.getViewport({ scale: 1 });
        const pixelRatio = Math.min(3, Math.max(1, globalThis.devicePixelRatio || 1));
        const plan = regionRenderPlan(region, base, cssWidth, pixelRatio);
        const canvas = canvasRef.current;
        const context = canvas?.getContext("2d");
        if (!canvas || !context) return;
        canvas.width = plan.canvasWidth;
        canvas.height = plan.canvasHeight;
        setState({ status: "loading", cssHeight: plan.cssHeight });
        const viewport = pdfPage.getViewport({ scale: plan.scale, offsetX: plan.offsetX, offsetY: plan.offsetY });
        const rendering = pdfPage.render({ canvasContext: context, viewport });
        task = rendering;
        await rendering.promise;
        if (!cancelled) setState({ status: "ready", cssHeight: plan.cssHeight });
      } catch (error) {
        // 换了区域时 pdf.js 取消上一次绘制会抛错，不算出错。
        if (!cancelled && (error as { name?: string } | null)?.name !== "RenderingCancelledException") {
          setState((current) => ({ status: "error", cssHeight: current.cssHeight }));
        }
      }
    })();
    return () => {
      cancelled = true;
      task?.cancel();
    };
    // region 的四个数都在 key 里。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdf, key]);

  return (
    <div
      className={`reader-region-canvas${className ? ` ${className}` : ""}`}
      data-status={state.status}
      style={{ width: cssWidth, height: state.cssHeight || undefined }}
    >
      <canvas ref={canvasRef} role="img" aria-label={label ?? `第 ${page} 页的一块`} style={{ width: cssWidth, height: state.cssHeight || undefined }} />
      {state.status === "error" ? <p className="reader-region-canvas-error">这一块没画出来。</p> : null}
    </div>
  );
}

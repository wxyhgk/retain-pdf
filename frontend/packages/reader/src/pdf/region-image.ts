// 书页上一块（或整页）截成图片，带进提问（2026-11-27）：公式、图表、跨栏表格的文字层常常乱序丢上下标，直接给 agent 看图。
// 有这一栏的 pdf.js 文档就按要的宽度重新画（不管现在缩放多小都清楚）；没有（对照时左栏换成的另一份……）就从屏幕上那张画布裁。

import { regionRenderPlan, type RegionFraction, type RegionPdfDocument } from "./RegionCanvas.js";

/** 截图的宽度（像素）：整页 1600 够看清正文和公式，又远在 4MB 以内。 */
export const ASK_IMAGE_WIDTH = 1600;

export const FULL_PAGE: RegionFraction = { left: 0, top: 0, width: 1, height: 1 };

function canvasBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("截图没出来"))), "image/png");
  });
}

/** 两个点（屏幕坐标）框出的一块 → 占这一页的比例（夹在页内）；太小（不到页宽高的 2%）是 null。 */
export function dragRegion(pageRect: { left: number; top: number; width: number; height: number }, from: { x: number; y: number }, to: { x: number; y: number }): RegionFraction | null {
  if (pageRect.width <= 0 || pageRect.height <= 0) return null;
  const clampX = (x: number) => Math.min(1, Math.max(0, (x - pageRect.left) / pageRect.width));
  const clampY = (y: number) => Math.min(1, Math.max(0, (y - pageRect.top) / pageRect.height));
  const left = Math.min(clampX(from.x), clampX(to.x));
  const right = Math.max(clampX(from.x), clampX(to.x));
  const top = Math.min(clampY(from.y), clampY(to.y));
  const bottom = Math.max(clampY(from.y), clampY(to.y));
  if (right - left < 0.02 || bottom - top < 0.02) return null;
  return { left, top, width: right - left, height: bottom - top };
}

/** 用 pdf.js 重新画这一块，宽 width 像素。 */
export async function renderRegionImage(pdf: RegionPdfDocument, page: number, region: RegionFraction = FULL_PAGE, width = ASK_IMAGE_WIDTH): Promise<Blob> {
  const pdfPage = await pdf.getPage(page);
  const plan = regionRenderPlan(region, pdfPage.getViewport({ scale: 1 }), width, 1);
  const canvas = document.createElement("canvas");
  canvas.width = plan.canvasWidth;
  canvas.height = plan.canvasHeight;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("截图没出来");
  context.fillStyle = "#fff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  await pdfPage.render({ canvasContext: context, viewport: pdfPage.getViewport({ scale: plan.scale, offsetX: plan.offsetX, offsetY: plan.offsetY }) }).promise;
  return canvasBlob(canvas);
}

/** 从屏幕上已经画好的那张画布裁这一块（没有 pdf.js 文档时用）。 */
export async function cropCanvasImage(source: HTMLCanvasElement, region: RegionFraction = FULL_PAGE): Promise<Blob> {
  const sx = Math.round(region.left * source.width);
  const sy = Math.round(region.top * source.height);
  const sw = Math.max(1, Math.round(region.width * source.width));
  const sh = Math.max(1, Math.round(region.height * source.height));
  const canvas = document.createElement("canvas");
  canvas.width = sw;
  canvas.height = sh;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("截图没出来");
  context.drawImage(source, sx, sy, sw, sh, 0, 0, sw, sh);
  return canvasBlob(canvas);
}

/** 截图的文件名：第 12 页（整页）/ 第 12 页的一块。 */
export function regionImageName(page: number, region: RegionFraction): string {
  const whole = region.left === 0 && region.top === 0 && region.width === 1 && region.height === 1;
  return whole ? `第${page}页.png` : `第${page}页-截图.png`;
}

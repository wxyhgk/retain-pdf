// 悬停框画在哪、工具条（改 / 复制）放哪。2026-11-20 起：
//
// - 框贴着字画：译文比原文短时，按原文块画的框下半截全是空的。文字层里落在这一块里的字（.textLayer 的 span）
//   取并集，框收到字的范围（不超出原块）；没有文字层（关了、还没画好）就照原块画。命中还按原块算，鼠标在
//   框外、原块里的空白处不会换块。
// - 工具条放在框外的页边：放在框里右上角会压住第一行字。右边到页边（或右边那栏）空得下就放右边，左边空得下
//   就放左边；两边都挤（双栏论文、窄页）才退回框里右上角 / 框外上方（hoverToolsOutside）。工具条贴着框边，
//   鼠标从框里移过去不经过别的块。

import { useLayoutEffect, useState, type RefObject } from "react";

import type { ReaderRegionRect } from "../shared/data/reader-regions.js";
import { hoverToolsOutside, type HoverToolsPlacement, type ReaderTextHoverTarget } from "./ReaderTextHoverLayer.js";

/** 竖着排的工具条要多宽：「改」「复制」放得下；行间公式的「复制 LaTeX」宽一些。 */
export function sideToolsWidth(kind: string): number {
  return kind === "formula" ? 84 : 64;
}

const SIDE_GAP = 6;

const right = (rect: ReaderRegionRect) => rect.left + rect.width;
const bottom = (rect: ReaderRegionRect) => rect.top + rect.height;
const overlapsVertically = (a: ReaderRegionRect, b: ReaderRegionRect) => a.top < bottom(b) && b.top < bottom(a);

/**
 * 工具条放哪。右边空：到页右边、或到右边第一个和它上下有重叠的块，空出 toolsWidth + 间距；左边同理。
 * `others` 是这一页别的块（含它自己也行，自己会被跳过）。
 */
export function hoverToolsPlacement(
  rect: ReaderRegionRect,
  others: readonly ReaderRegionRect[],
  pageWidth: number,
  toolsWidth: number,
): HoverToolsPlacement {
  const need = toolsWidth + SIDE_GAP;
  let rightLimit = pageWidth;
  let leftLimit = 0;
  for (const other of others) {
    if (other === rect || !overlapsVertically(rect, other)) continue;
    if (other.left >= right(rect) - 1) rightLimit = Math.min(rightLimit, other.left);
    if (right(other) <= rect.left + 1) leftLimit = Math.max(leftLimit, right(other));
  }
  if (rightLimit - right(rect) >= need) return "side-right";
  if (rect.left - leftLimit >= need) return "side-left";
  return hoverToolsOutside(rect, toolsWidth) ? "outside" : "inside";
}

/**
 * 框收到字的范围：中心落在原块里的字取并集，四边各留 pad。没有字就照原块。
 * 最多比原块往外多出 slack：排版有时把首行画得比原块上沿还高一点，框不能压在字上。
 */
export function tightenHoverRect(rect: ReaderRegionRect, glyphs: readonly ReaderRegionRect[], pad = 3, slack = 6): ReaderRegionRect {
  let left = Infinity;
  let top = Infinity;
  let maxRight = -Infinity;
  let maxBottom = -Infinity;
  for (const glyph of glyphs) {
    if (glyph.width <= 0 || glyph.height <= 0) continue;
    const cx = glyph.left + glyph.width / 2;
    const cy = glyph.top + glyph.height / 2;
    if (cx < rect.left || cx > right(rect) || cy < rect.top || cy > bottom(rect)) continue;
    left = Math.min(left, glyph.left);
    top = Math.min(top, glyph.top);
    maxRight = Math.max(maxRight, right(glyph));
    maxBottom = Math.max(maxBottom, bottom(glyph));
  }
  if (!Number.isFinite(left)) return rect;
  const tight = {
    left: Math.max(rect.left - slack, left - pad),
    top: Math.max(rect.top - slack, top - pad),
    width: 0,
    height: 0,
  };
  tight.width = Math.min(right(rect) + slack, maxRight + pad) - tight.left;
  tight.height = Math.min(bottom(rect) + slack, maxBottom + pad) - tight.top;
  // 字太少（一两个字的碎块）时收得太小反而看不清是哪块：小于原块三成就照原块。
  if (tight.width * tight.height < rect.width * rect.height * 0.3 && tight.height < 24) return rect;
  return tight;
}

/** 文字层里每个字块（span）相对这一页的位置。 */
function glyphRects(host: HTMLElement): ReaderRegionRect[] {
  const origin = host.getBoundingClientRect();
  return Array.from(host.querySelectorAll<HTMLElement>(".textLayer span")).flatMap((span) => {
    if (!span.textContent?.trim()) return [];
    const box = span.getBoundingClientRect();
    return [{ left: box.left - origin.left, top: box.top - origin.top, width: box.width, height: box.height }];
  });
}

export type HoverPresentation = { rect: ReaderRegionRect; placement: HoverToolsPlacement } | null;

/** 悬停块的框和工具条位置。画面绘制前量好（layout effect），框不会先画大再缩。 */
export function useHoverPresentation(
  hostRef: RefObject<HTMLElement | null>,
  target: ReaderTextHoverTarget | null,
  targets: readonly ReaderTextHoverTarget[],
  pageWidth: number,
  kind: string,
): HoverPresentation {
  const [presentation, setPresentation] = useState<HoverPresentation>(null);
  useLayoutEffect(() => {
    if (!target) {
      setPresentation(null);
      return;
    }
    const host = hostRef.current;
    const rect = host ? tightenHoverRect(target.rect, glyphRects(host)) : target.rect;
    const placement = hoverToolsPlacement(target.rect, targets.map((other) => other.rect), pageWidth, sideToolsWidth(kind));
    setPresentation({ rect, placement });
  }, [hostRef, kind, pageWidth, target, targets]);
  return presentation && target ? presentation : null;
}

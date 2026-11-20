// 悬停工具条（改 / 复制）放哪：不挡字（2026-11-20 用户：「改」「复制」放到区域外面去，这样才不会挡住阅读）。
//
// 做法：候选位置 + 碰撞检测。按顺序列出工具条可以放的地方，每个算出它实际占的方框，和页上的东西比：
//   第一轮：框外、不碰任何字、也不进别的块 —— 第一个合格的就用；
//   第二轮：框外、只要不碰字（可以落在别的块的空白里，比如上一段最后一行没写满的地方）；
//   第三轮：段尾（框里，但不碰字）；
//   都不合格：图标版里挑压到字最少的那个（面积算），平手按候选顺序。
// 候选顺序（越靠前越不打扰阅读）：
//   1. 框外右边 / 左边，竖排完整按钮；     2. 同上，只有图标的小按钮（页边窄的论文）；
//   3. 框外上方一行；                       4. 框外下方一行；
//   5. 图标版伸出页边几像素（伸进书页外的留白）；6. 段尾：框里最后一行右边空着的地方（框外都不行才用）。
// 「字」是文字层里的 span（不含这一块自己的字，它们只在段尾那一档里查）；竖排的页边印章（Downloaded from…）不算字。
// 只按块的范围算空隙不够：页眉、页边印章不在任何块里，译文也常常溢出原文块。

import type { ReaderRegionRect } from "../shared/data/reader-regions.js";
import type { HoverToolsPlacement } from "./ReaderTextHoverLayer.js";

export type HoverToolsLayout = { placement: HoverToolsPlacement; compact: boolean; tailTop?: number };

/** 竖着排的完整按钮要多宽：「改」「复制」放得下；行间公式的「复制 LaTeX」宽一些。 */
export function sideToolsWidth(kind: string): number {
  return kind === "formula" ? 84 : 64;
}

/** 图标小按钮的边长；横排一行的高；一行多宽（「改」+「复制」，公式是「复制 LaTeX」）。 */
export const COMPACT_TOOL_SIZE = 24;
export const TOOLS_ROW_HEIGHT = 24;
export function rowToolsWidth(kind: string, compact: boolean): number {
  if (compact) return COMPACT_TOOL_SIZE * 2 + 4;
  return kind === "formula" ? 112 : 92;
}

/** 竖排时离框多远（CSS 里的 padding，鼠标从框里移过去走的就是这一截）、竖排多高。 */
const SIDE_GAP = 6;
const COMPACT_GAP = 4;
const SIDE_FULL_HEIGHT = 20 * 2 + 4;
const SIDE_COMPACT_HEIGHT = COMPACT_TOOL_SIZE * 2 + 4;
/** 书页外面（页和栏边之间）有 8px 的留白：伸出页边最多这么多，不出横向滚动条。 */
const PAGE_OVERHANG = 6;

const right = (rect: ReaderRegionRect) => rect.left + rect.width;
const bottom = (rect: ReaderRegionRect) => rect.top + rect.height;

function overlapArea(a: ReaderRegionRect, b: ReaderRegionRect): number {
  const w = Math.min(right(a), right(b)) - Math.max(a.left, b.left);
  const h = Math.min(bottom(a), bottom(b)) - Math.max(a.top, b.top);
  return w > 1 && h > 1 ? w * h : 0;
}

const centerIn = (glyph: ReaderRegionRect, rect: ReaderRegionRect) => {
  const cx = glyph.left + glyph.width / 2;
  const cy = glyph.top + glyph.height / 2;
  return cx >= rect.left && cx <= right(rect) && cy >= rect.top && cy <= bottom(rect);
};

/** 竖排的页边印章（又高又窄的一条）不算字：盖住它不影响阅读，算进去页边就永远放不了。 */
const isVerticalStamp = (glyph: ReaderRegionRect) => glyph.height > 40 && glyph.height > glyph.width * 2.5;

type Candidate = HoverToolsLayout & { box: ReaderRegionRect; overhang?: boolean };

/**
 * 段尾：贴框右边、和最后一行底对齐（再试贴框底）的一行，和框里的字都不碰才算。
 * 缩小看时一行字只有八九像素高，工具条比一行高，只看最后一行右边空不空会压到上面一两行。
 */
export function tailToolsTop(frame: ReaderRegionRect, ownGlyphs: readonly ReaderRegionRect[], width: number): number | null {
  if (!ownGlyphs.length || frame.height < TOOLS_ROW_HEIGHT || frame.width < width + 8) return null;
  const lastBottom = Math.max(...ownGlyphs.map(bottom));
  const left = right(frame) - 4 - width;
  for (const rowBottom of [lastBottom, bottom(frame) - 2]) {
    const top = Math.max(frame.top, rowBottom - TOOLS_ROW_HEIGHT);
    const row = { left, top, width, height: TOOLS_ROW_HEIGHT };
    if (!ownGlyphs.some((glyph) => overlapArea(row, glyph) > 0)) return top - frame.top;
  }
  return null;
}

function candidates(frame: ReaderRegionRect, kind: string, ownGlyphs: readonly ReaderRegionRect[]): Candidate[] {
  const out: Candidate[] = [];
  const side = (compact: boolean, overhang = false) => {
    const width = (compact ? COMPACT_TOOL_SIZE + COMPACT_GAP : sideToolsWidth(kind) + SIDE_GAP);
    const height = compact ? SIDE_COMPACT_HEIGHT : SIDE_FULL_HEIGHT;
    const top = frame.top - 2;
    out.push({ placement: "side-right", compact, overhang, box: { left: right(frame), top, width, height } });
    out.push({ placement: "side-left", compact, overhang, box: { left: frame.left - width, top, width, height } });
  };
  side(false);
  side(true);
  for (const compact of [false, true]) {
    const width = rowToolsWidth(kind, compact);
    out.push({ placement: "outside", compact, box: { left: frame.left - 2, top: frame.top - TOOLS_ROW_HEIGHT - 3, width, height: TOOLS_ROW_HEIGHT + 3 } });
    out.push({ placement: "below", compact, box: { left: frame.left - 2, top: bottom(frame), width, height: TOOLS_ROW_HEIGHT + 3 } });
  }
  for (const compact of [false, true]) {
    const width = rowToolsWidth(kind, compact);
    const top = tailToolsTop(frame, ownGlyphs, width);
    if (top !== null) out.push({ placement: "tail", compact, tailTop: top, box: { left: right(frame) - 4 - width, top: frame.top + top, width, height: TOOLS_ROW_HEIGHT } });
  }
  side(true, true);
  return out;
}

/** 工具条放哪（做法见文件开头）。`others` 是这一页别的块，`glyphs` 是这一页文字层所有字的位置。 */
export function placeHoverTools(input: {
  frame: ReaderRegionRect;
  others: readonly ReaderRegionRect[];
  pageWidth: number;
  pageHeight: number;
  glyphs?: readonly ReaderRegionRect[];
  kind?: string;
}): HoverToolsLayout {
  const { frame, others, pageWidth, pageHeight, glyphs = [], kind = "text" } = input;
  const usable = glyphs.filter((glyph) => glyph.width > 0 && glyph.height > 0 && !isVerticalStamp(glyph));
  const own = usable.filter((glyph) => centerIn(glyph, frame));
  const foreign = usable.filter((glyph) => !centerIn(glyph, frame));
  const blocks = others.filter((other) => other !== frame && overlapArea(other, frame) < frame.width * frame.height * 0.5);
  const list = candidates(frame, kind, own).filter(({ box, overhang }) => {
    const slack = overhang ? PAGE_OVERHANG : 0;
    return box.left >= -slack && right(box) <= pageWidth + slack && box.top >= 0 && bottom(box) <= pageHeight;
  });
  const pick = ({ placement, compact, tailTop }: Candidate): HoverToolsLayout =>
    (tailTop === undefined ? { placement, compact } : { placement, compact, tailTop });
  const noText = ({ box }: Candidate) => !foreign.some((g) => overlapArea(box, g) > 0);
  const outsideFrame = list.filter((candidate) => candidate.placement !== "tail");
  const clean = outsideFrame.find((candidate) => noText(candidate) && !blocks.some((b) => overlapArea(candidate.box, b) > 0));
  if (clean) return pick(clean);
  const quiet = outsideFrame.find(noText) || list.find((candidate) => candidate.placement === "tail" && noText(candidate));
  if (quiet) return pick(quiet);
  let best: Candidate | null = null;
  let bestCost = Number.POSITIVE_INFINITY;
  for (const candidate of list) {
    if (!candidate.compact) continue;
    const cost = foreign.reduce((sum, g) => sum + overlapArea(candidate.box, g), 0);
    if (cost < bestCost) {
      best = candidate;
      bestCost = cost;
    }
  }
  return best ? pick(best) : { placement: "outside", compact: true };
}

/**
 * 工具条在框外上方 / 下方时，鼠标斜着走向按钮可能先经过别的块：在工具条那一小块范围里保持当前框。
 * 只管这一小块 —— 以前保持的是框上方整条带，紧贴在上面的短块从下面就再也悬停不到了。
 */
export function inHoverToolsZone(
  presentation: ({ rect: ReaderRegionRect } & HoverToolsLayout) | null,
  kind: string,
  x: number,
  y: number,
): boolean {
  if (!presentation) return false;
  const { rect, placement, compact } = presentation;
  if (placement !== "outside" && placement !== "below") return false;
  const top = placement === "outside" ? rect.top - TOOLS_ROW_HEIGHT - 3 : bottom(rect);
  return x >= rect.left - 4 && x <= rect.left + rowToolsWidth(kind, compact) + 4 && y >= top && y <= top + TOOLS_ROW_HEIGHT + 3;
}

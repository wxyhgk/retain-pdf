/** 引用悬停预览：「图 2.1」「式 (3.21)」上停一会儿，旁边浮出那张图 / 那个式子（RegionCanvas 重画，小号的放大框）。
 * 只看不点（pointer-events: none），移开就收；点引用本身跳过去。 */
import type { ReactElement } from "react";

import type { ReaderMetadata, ReaderRegion } from "../../shared/data/reader-regions.js";
import { xrefTitle } from "../../shared/content/reader-xrefs.js";
import type { XrefPreview } from "../../hooks/use-reader-xrefs.js";
import { RegionCanvas, type RegionPdfDocument } from "../../pdf/RegionCanvas.js";
import { zoomUnionIn, type ReaderZoomDocuments } from "./ReaderZoomViewer.js";

export const XREF_PREVIEW_WIDTH = 380;
const MAX_HEIGHT = 320;
const GAP = 8;

/** 预览放哪：引用下方放得下就放下方，否则上方；左右不出屏。 */
export function placeXrefPreview(
  anchor: XrefPreview["anchor"],
  size: { width: number; height: number },
  viewport: { width: number; height: number },
): { left: number; top: number } {
  const left = Math.max(GAP, Math.min(anchor.left, viewport.width - size.width - GAP));
  const below = anchor.bottom + GAP;
  const top = below + size.height <= viewport.height - GAP ? below : Math.max(GAP, anchor.top - GAP - size.height);
  return { left, top };
}

export function ReaderXrefPreview({
  preview,
  regions,
  metadata,
  documents,
}: {
  preview: XrefPreview;
  regions: readonly ReaderRegion[];
  metadata: ReaderMetadata | null;
  documents: ReaderZoomDocuments;
}): ReactElement | null {
  const group = preview.target.itemIds
    .map((itemId) => regions.find((entry) => entry.itemId === itemId))
    .filter((entry): entry is ReaderRegion => Boolean(entry));
  if (!group.length) return null;
  // 先画引用所在的那一栏；那一栏的 PDF 没读好就用另一栏。
  const panes = preview.pane === "source" ? (["source", "translated"] as const) : (["translated", "source"] as const);
  let shown: { pdf: RegionPdfDocument; where: NonNullable<ReturnType<typeof zoomUnionIn>> } | null = null;
  for (const pane of panes) {
    const pdf = documents[pane];
    const where = pdf ? zoomUnionIn(group, metadata, pane) : null;
    if (pdf && where) {
      shown = { pdf, where };
      break;
    }
  }
  if (!shown) return null;
  const width = Math.round(Math.min(XREF_PREVIEW_WIDTH, MAX_HEIGHT / Math.max(0.05, shown.where.aspect)));
  const height = Math.round(width * shown.where.aspect) + 30;
  const viewport = typeof window === "undefined" ? { width: 1200, height: 800 } : { width: window.innerWidth, height: window.innerHeight };
  const { left, top } = placeXrefPreview(preview.anchor, { width: Math.max(width, 160) + 16, height: height + 16 }, viewport);
  return (
    <div className="reader-xref-preview" role="tooltip" style={{ left, top }}>
      <div className="reader-xref-preview-head">
        <span>{xrefTitle(preview.target)}</span>
        <span className="reader-xref-preview-page">第 {shown.where.page} 页 · 点击跳过去</span>
      </div>
      <RegionCanvas pdf={shown.pdf} page={shown.where.page} region={shown.where.fraction} cssWidth={width} label={xrefTitle(preview.target)} />
    </div>
  );
}

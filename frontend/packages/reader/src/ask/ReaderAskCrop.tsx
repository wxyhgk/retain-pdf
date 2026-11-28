// 「截一块问」（2026-11-27）：右键菜单里点了以后，书页上拖出一块，松开就把这块截成图带进提问（问的是这一页）。
// 盖一层透明的罩子接鼠标（书页不出悬停框、不选字），Esc 或右键取消。只认同一页里的一块：从哪页按下就截哪页。
import { useEffect, useRef, useState, type ReactElement } from "react";

import { READER_PAGE_ATTR, READER_PANE_ATTR } from "../pdf/reader-dom-contract.js";
import { dragRegion } from "../pdf/region-image.js";
import type { RegionFraction } from "../pdf/RegionCanvas.js";

export type AskCropResult = {
  page: number;
  pane: "source" | "translated";
  region: RegionFraction;
  /** 截的那张画布（没有 pdf.js 文档时从它裁）。 */
  canvas: HTMLCanvasElement | null;
  /** 按下的那一点（拼出处用）。 */
  point: { x: number; y: number; target: Element };
};

/** 屏幕上这一点下面的书页：页号、栏、画好的那张画布。 */
export function pageUnder(x: number, y: number, root: Document = document) {
  for (const element of root.elementsFromPoint(x, y)) {
    const slot = element.closest(`[${READER_PAGE_ATTR}]`);
    if (!slot) continue;
    const page = Number(slot.getAttribute(READER_PAGE_ATTR)) || 0;
    const paneHost = slot.closest(`[${READER_PANE_ATTR}]`) ?? slot;
    const pane = paneHost.getAttribute(READER_PANE_ATTR) === "translated" ? "translated" : "source";
    const canvas = slot.querySelector("canvas");
    if (page && canvas) return { page, pane, canvas, slot } as const;
  }
  return null;
}

export function ReaderAskCrop({ onDone, onCancel }: { onDone: (result: AskCropResult) => void; onCancel: () => void }): ReactElement {
  const [drag, setDrag] = useState<{ from: { x: number; y: number }; to: { x: number; y: number } } | null>(null);
  const start = useRef<ReturnType<typeof pageUnder> | null>(null);
  const overlay = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      onCancel();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onCancel]);
  // 罩子底下的书页：按下那一刻先让罩子不挡，问浏览器下面是哪一页。
  const under = (x: number, y: number) => {
    const element = overlay.current;
    if (element) element.style.pointerEvents = "none";
    try {
      return pageUnder(x, y);
    } finally {
      if (element) element.style.pointerEvents = "";
    }
  };
  const box = drag
    ? { left: Math.min(drag.from.x, drag.to.x), top: Math.min(drag.from.y, drag.to.y), width: Math.abs(drag.to.x - drag.from.x), height: Math.abs(drag.to.y - drag.from.y) }
    : null;
  return (
    <div
      ref={overlay}
      className="reader-ask-crop"
      role="presentation"
      onContextMenu={(event) => {
        event.preventDefault();
        onCancel();
      }}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        const hit = under(event.clientX, event.clientY);
        if (!hit) return;
        start.current = hit;
        event.currentTarget.setPointerCapture?.(event.pointerId);
        setDrag({ from: { x: event.clientX, y: event.clientY }, to: { x: event.clientX, y: event.clientY } });
      }}
      onPointerMove={(event) => {
        if (drag) setDrag({ from: drag.from, to: { x: event.clientX, y: event.clientY } });
      }}
      onPointerUp={(event) => {
        const hit = start.current;
        const from = drag?.from;
        start.current = null;
        setDrag(null);
        if (!hit || !from) return;
        const region = dragRegion(hit.canvas.getBoundingClientRect(), from, { x: event.clientX, y: event.clientY });
        if (!region) return; // 只是点了一下：接着等它拖
        onDone({ page: hit.page, pane: hit.pane, region, canvas: hit.canvas, point: { x: from.x, y: from.y, target: hit.slot } });
      }}
    >
      <p className="reader-ask-crop-hint">在书页上拖出一块，松开就带进提问 · Esc 取消</p>
      {box ? <div className="reader-ask-crop-box" style={box} /> : null}
    </div>
  );
}

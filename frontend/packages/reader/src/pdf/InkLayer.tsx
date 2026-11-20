// 一页书上的笔迹（画笔）：盖在文字层上面的一张 SVG，画出这一页的笔迹；画笔模式下接住鼠标 / 笔 / 手指，拖动就画，橡皮擦就擦。
// 不在画笔模式时不接任何事件，选字、悬停照旧。坐标按这一页宽高的比例存（hooks/use-reader-ink.ts）。
import { useRef, useState, type PointerEvent as ReactPointerEvent, type ReactElement } from "react";

import {
  INK_WIDTH,
  appendPoint,
  onPane,
  strokesHitByEraser,
  type InkPane,
  type InkStroke,
  type ReaderInk,
} from "../hooks/use-reader-ink.js";

export const READER_INK_LAYER_CLASS = "reader-ink-layer";

/** 一串比例坐标 → SVG 路径（按这一页的像素宽高放大）。只有一个点时画成一个小圆点。 */
export function inkPath(points: ReadonlyArray<[number, number]>, width: number, height: number): string {
  if (!points.length) return "";
  const [first, ...rest] = points.map(([x, y]) => `${(x * width).toFixed(1)} ${(y * height).toFixed(1)}`);
  return rest.length ? `M${first} L${rest.join(" L")}` : `M${first} l0.01 0`;
}

function StrokePath({ stroke, width, height }: { stroke: Pick<InkStroke, "tool" | "color" | "width" | "points">; width: number; height: number }) {
  return (
    <path
      className={`reader-ink-stroke is-${stroke.tool}`}
      d={inkPath(stroke.points, width, height)}
      style={{ stroke: `var(--${stroke.color})`, strokeWidth: Math.max(1, stroke.width * width) }}
    />
  );
}

export function InkLayer({ page, pane, width, height, ink }: { page: number; pane: InkPane; width: number; height: number; ink: ReaderInk }): ReactElement | null {
  const [draft, setDraft] = useState<Array<[number, number]> | null>(null);
  const drawing = useRef(false);
  const strokes = ink.strokes.filter((stroke) => onPane(stroke, page, pane));
  const active = Boolean(ink.tool);
  if (!active && !strokes.length) return null;

  const at = (event: ReactPointerEvent<SVGSVGElement>): [number, number] => {
    const box = event.currentTarget.getBoundingClientRect();
    return [
      Math.min(1, Math.max(0, (event.clientX - box.left) / Math.max(1, box.width))),
      Math.min(1, Math.max(0, (event.clientY - box.top) / Math.max(1, box.height))),
    ];
  };
  const eraseAt = (x: number, y: number) => ink.erase(strokesHitByEraser(ink.strokes, page, pane, x, y, height / Math.max(1, width)));

  const onDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!ink.tool || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    drawing.current = true;
    const [x, y] = at(event);
    if (ink.tool === "eraser") eraseAt(x, y);
    else setDraft([[x, y]]);
  };
  const onMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!drawing.current || !ink.tool) return;
    event.stopPropagation();
    const [x, y] = at(event);
    if (ink.tool === "eraser") eraseAt(x, y);
    else setDraft((points) => (points ? appendPoint(points, x, y) : [[x, y]]));
  };
  const onUp = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!drawing.current) return;
    drawing.current = false;
    event.stopPropagation();
    if (draft && ink.tool && ink.tool !== "eraser") {
      ink.add({ page, pane, tool: ink.tool, color: ink.color, width: INK_WIDTH[ink.tool], points: draft });
    }
    setDraft(null);
  };

  return (
    <svg
      className={READER_INK_LAYER_CLASS}
      data-ink-active={active ? (ink.tool as string) : undefined}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    >
      {strokes.map((stroke) => (
        <StrokePath key={stroke.id} stroke={stroke} width={width} height={height} />
      ))}
      {draft && ink.tool && ink.tool !== "eraser" ? (
        <StrokePath stroke={{ tool: ink.tool, color: ink.color, width: INK_WIDTH[ink.tool], points: draft }} width={width} height={height} />
      ) : null}
    </svg>
  );
}

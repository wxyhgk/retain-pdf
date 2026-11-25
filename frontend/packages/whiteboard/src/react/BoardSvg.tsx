// 把一帧画成 SVG。只读 frame 和排好的公式，不管时间：同一帧永远画成同一张图。

import type { ReactElement } from "react";
import type { Frame, FrameItem, ArrowItem, LevelsItem, MarkItem, NoteItem, WriteItem } from "../render/frame.js";
import type { Box } from "../layout/layout.js";
import { LAYOUT } from "../layout/layout.js";
import { FONT_SIZE, LINE_HEIGHT, type RenderedMath } from "../layout/measure.js";

export type MathLookup = (tex: string, size: "s" | "m" | "l") => RenderedMath | null;

type Props = {
  frame: Frame;
  math: MathLookup;
  /** clipPath 等 id 的前缀，同一页多块板时不撞（useId）。 */
  idPrefix: string;
  title?: string;
};

function safeId(value: string): string {
  return value.replace(/[^A-Za-z0-9_-]/g, "_");
}

function toneClass(tone: string | undefined): string {
  return tone ? `wb-tone-${tone}` : "wb-tone-ink";
}

function Reveal({ id, box, progress, children }: { id: string; box: Box; progress: number; children: ReactElement | ReactElement[] }) {
  if (progress >= 1) return <>{children}</>;
  return (
    <>
      <clipPath id={id}>
        <rect x={box.x - 4} y={box.y - 8} width={Math.max(0, (box.w + 8) * progress)} height={box.h + 16} />
      </clipPath>
      <g clipPath={`url(#${id})`}>{children}</g>
    </>
  );
}

function WriteView({ item, math, idPrefix }: { item: WriteItem; math: MathLookup; idPrefix: string }) {
  const { op, box } = item;
  const size = op.size ?? "m";
  const fontSize = FONT_SIZE[size];
  const clip = `${idPrefix}-clip-${safeId(item.key)}`;
  let body: ReactElement;
  if (op.math !== undefined) {
    const rendered = math(op.math, size);
    if (rendered && !rendered.error && rendered.svg) {
      body = (
        <g
          className="wb-math"
          transform={`translate(${box.x} ${box.y + (box.h - rendered.h) / 2})`}
          // MathJax 排出来、去掉了链接和事件属性的 SVG（engine.ts 的 sanitizeMathSvg）。
          dangerouslySetInnerHTML={{ __html: rendered.svg }}
        />
      );
    } else {
      body = (
        <text className="wb-text wb-math-error" x={box.x} y={box.y + box.h / 2} fontSize={fontSize} dominantBaseline="central">
          {op.math}
        </text>
      );
    }
  } else {
    body = (
      <text className={`wb-text wb-size-${size}`} x={box.x} y={box.y + box.h / 2} fontSize={fontSize} dominantBaseline="central">
        {op.text}
      </text>
    );
  }
  return (
    <g className="wb-item wb-write" data-wb-id={op.id} opacity={item.opacity}>
      <Reveal id={clip} box={box} progress={item.progress}>{body}</Reveal>
    </g>
  );
}

function MarkView({ item }: { item: MarkItem }) {
  const { box, op } = item;
  const style = op.style ?? "box";
  const p = item.progress;
  const cls = `wb-item wb-mark wb-mark-${style} ${toneClass(item.tone)}`;
  if (style === "highlight") {
    return (
      <rect
        className={cls}
        x={box.x - 6}
        y={box.y - 4}
        width={(box.w + 12) * p}
        height={box.h + 8}
        rx={6}
        opacity={item.opacity}
      />
    );
  }
  if (style === "underline") {
    const y = box.y + box.h + 4;
    return <path className={cls} d={`M ${box.x} ${y} L ${box.x + box.w} ${y}`} pathLength={1} strokeDasharray="1" strokeDashoffset={1 - p} opacity={item.opacity} />;
  }
  return (
    <rect
      className={cls}
      x={box.x - 8}
      y={box.y - 6}
      width={box.w + 16}
      height={box.h + 12}
      rx={10}
      pathLength={1}
      strokeDasharray="1"
      strokeDashoffset={1 - p}
      opacity={item.opacity}
    />
  );
}

type Point = { x: number; y: number };

/** 箭头从哪条边出、到哪条边：目标在下面就上下连，在右边就左右连，否则连中心。 */
export function arrowEnds(from: Box, to: Box): { start: Point; end: Point } {
  const fromCenter = { x: from.x + from.w / 2, y: from.y + from.h / 2 };
  const toCenter = { x: to.x + to.w / 2, y: to.y + to.h / 2 };
  // 上下连时，两个东西左右有重叠就竖直画（取重叠段中间），不斜着穿过公式。
  const left = Math.max(from.x, to.x);
  const right = Math.min(from.x + from.w, to.x + to.w);
  const sharedX = right - left >= 24 ? (left + right) / 2 : null;
  if (to.y >= from.y + from.h) {
    return {
      start: { x: sharedX ?? fromCenter.x, y: from.y + from.h + 6 },
      end: { x: sharedX ?? toCenter.x, y: to.y - 8 },
    };
  }
  if (to.y + to.h <= from.y) {
    return {
      start: { x: sharedX ?? fromCenter.x, y: from.y - 6 },
      end: { x: sharedX ?? toCenter.x, y: to.y + to.h + 8 },
    };
  }
  if (to.x >= from.x + from.w) {
    return { start: { x: from.x + from.w + 4, y: fromCenter.y }, end: { x: to.x - 6, y: toCenter.y } };
  }
  return { start: { x: from.x - 4, y: fromCenter.y }, end: { x: to.x + to.w + 6, y: toCenter.y } };
}

function ArrowView({ item, idPrefix }: { item: ArrowItem; idPrefix: string }) {
  const { start, end } = arrowEnds(item.from, item.to);
  const p = item.progress;
  const marker = `${idPrefix}-arrowhead-${item.tone ?? "ink"}`;
  const mid = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
  return (
    <g className={`wb-item wb-arrow ${toneClass(item.tone)}`} opacity={item.opacity}>
      <path
        d={`M ${start.x} ${start.y} L ${end.x} ${end.y}`}
        pathLength={1}
        strokeDasharray="1"
        strokeDashoffset={1 - p}
        markerEnd={p >= 0.95 ? `url(#${marker})` : undefined}
      />
      {item.op.label && p >= 0.6 ? (
        <text className="wb-arrow-label" x={mid.x + 10} y={mid.y} fontSize={FONT_SIZE.s} dominantBaseline="central">
          {item.op.label}
        </text>
      ) : null}
    </g>
  );
}

function NoteView({ item, idPrefix }: { item: NoteItem; idPrefix: string }) {
  const { box, target } = item;
  const lineHeight = Math.ceil(LAYOUT.noteFont * LINE_HEIGHT);
  const clip = `${idPrefix}-clip-${safeId(item.key)}`;
  const leaderStart = { x: target.x + target.w + 6, y: target.y + target.h / 2 };
  const leaderEnd = { x: box.x - 6, y: box.y + box.h / 2 };
  return (
    <g className={`wb-item wb-note ${toneClass(item.tone)}`} opacity={item.opacity}>
      <path className="wb-note-leader" d={`M ${leaderStart.x} ${leaderStart.y} L ${leaderEnd.x} ${leaderEnd.y}`} />
      <Reveal id={clip} box={box} progress={item.progress}>
        <text className="wb-note-text" x={box.x} y={box.y} fontSize={LAYOUT.noteFont}>
          {box.lines.map((line, index) => (
            <tspan key={index} x={box.x} dy={index === 0 ? lineHeight * 0.8 : lineHeight}>{line}</tspan>
          ))}
        </text>
      </Reveal>
    </g>
  );
}

/** 能级图里每条能级的纵向位置：能量越高越靠上；全一样时放中间。 */
export function levelYs(energies: readonly number[], top: number, bottom: number): number[] {
  const min = Math.min(...energies);
  const max = Math.max(...energies);
  if (max - min < 1e-12) return energies.map(() => (top + bottom) / 2);
  return energies.map((energy) => bottom - ((energy - min) / (max - min)) * (bottom - top));
}

function Electron({ x, y, up }: { x: number; y: number; up: boolean }) {
  const half = 11;
  const d = up
    ? `M ${x} ${y + half} L ${x} ${y - half} M ${x - 4} ${y - half + 6} L ${x} ${y - half} L ${x + 4} ${y - half + 6}`
    : `M ${x} ${y - half} L ${x} ${y + half} M ${x - 4} ${y + half - 6} L ${x} ${y + half} L ${x + 4} ${y + half - 6}`;
  return <path className="wb-electron" d={d} />;
}

function LevelsView({ item }: { item: LevelsItem }) {
  const { box, op } = item;
  const axisX = box.x + 28;
  const lineStart = box.x + 56;
  const lineEnd = box.x + 150;
  const top = box.y + 36;
  const bottom = box.y + box.h - 20;
  const ys = levelYs(op.levels.map((level) => level.energy), top, bottom);
  // 从下往上一条条出来。
  const order = op.levels.map((_, index) => index).sort((a, b) => ys[b] - ys[a]);
  const shown = new Set(order.slice(0, Math.ceil(item.progress * op.levels.length)));
  return (
    <g className="wb-item wb-levels" data-wb-id={op.id} opacity={item.opacity}>
      <path className="wb-levels-axis" d={`M ${axisX} ${bottom + 8} L ${axisX} ${box.y + 14}`} />
      <path className="wb-levels-axis" d={`M ${axisX - 4} ${box.y + 20} L ${axisX} ${box.y + 14} L ${axisX + 4} ${box.y + 20}`} />
      {op.axis ? (
        <text className="wb-levels-caption" x={axisX + 8} y={box.y + 16} fontSize={FONT_SIZE.s - 2}>{op.axis}</text>
      ) : null}
      {op.levels.map((level, index) => (shown.has(index) ? (
        <g key={index} className="wb-level">
          <path className="wb-level-line" d={`M ${lineStart} ${ys[index]} L ${lineEnd} ${ys[index]}`} />
          <text className="wb-level-label" x={lineEnd + 10} y={ys[index]} fontSize={FONT_SIZE.s} dominantBaseline="central">{level.label}</text>
          {(level.electrons ?? 0) >= 1 ? <Electron x={(lineStart + lineEnd) / 2 - 9} y={ys[index] - 12} up /> : null}
          {(level.electrons ?? 0) >= 2 ? <Electron x={(lineStart + lineEnd) / 2 + 9} y={ys[index] - 12} up={false} /> : null}
        </g>
      ) : null))}
    </g>
  );
}

function ItemView({ item, math, idPrefix }: { item: FrameItem; math: MathLookup; idPrefix: string }) {
  switch (item.kind) {
    case "write":
      return <WriteView item={item} math={math} idPrefix={idPrefix} />;
    case "mark":
      return <MarkView item={item} />;
    case "arrow":
      return <ArrowView item={item} idPrefix={idPrefix} />;
    case "note":
      return <NoteView item={item} idPrefix={idPrefix} />;
    case "levels":
      return <LevelsView item={item} />;
  }
}

const TONES = ["ink", "focus", "correct", "wrong"] as const;
const MAX_SCALE = 1.25;
const MIN_SCALE = 0.7;

export function BoardSvg({ frame, math, idPrefix, title }: Props) {
  const { camera } = frame;
  // 高亮垫在字下面，其余按出现顺序画。
  const highlights = frame.items.filter((item) => item.kind === "mark" && (item.op.style ?? "box") === "highlight");
  const rest = frame.items.filter((item) => !highlights.includes(item));
  return (
    <svg
      className="wb-board"
      viewBox={`${camera.x} ${camera.y} ${camera.w} ${camera.h}`}
      preserveAspectRatio="xMidYMin meet"
      // 内容少时别放得太大（最多 1.25 倍）；窄屏上也别缩得太小（最少 0.7 倍，再窄就在板子里横向滚）。
      style={{ maxWidth: `${Math.round(camera.w * MAX_SCALE)}px`, minWidth: `${Math.round(camera.w * MIN_SCALE)}px` }}
      role="img"
      aria-label={title ? `白板：${title}` : "白板"}
    >
      <defs>
        {TONES.map((tone) => (
          <marker
            key={tone}
            id={`${idPrefix}-arrowhead-${tone}`}
            className={`wb-arrowhead wb-tone-${tone}`}
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="8"
            markerHeight="8"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" />
          </marker>
        ))}
      </defs>
      {highlights.map((item) => <ItemView key={item.key} item={item} math={math} idPrefix={idPrefix} />)}
      {rest.map((item) => <ItemView key={item.key} item={item} math={math} idPrefix={idPrefix} />)}
    </svg>
  );
}

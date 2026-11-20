// 2.5D 编辑部里的物件：房间（地面、两面墙）、方块（桌子、柜子）、传送带、质检闸门、白板、看板、筐。
// 只画形状，颜色全走 CSS 类（EditorialOffice.css），跟着皮肤换。坐标见 ./iso.ts。

import type { ReactNode } from "react";

import {
  ROOM_D,
  ROOM_W,
  WALL_H,
  boxFaces,
  flatRect,
  iso,
  leftWallRect,
  pts,
  rightWallRect,
  type Point,
} from "./iso.js";

export function Room() {
  const grid: string[] = [];
  for (let x = 1; x < ROOM_W; x += 1) grid.push(pts([iso(x, 0), iso(x, ROOM_D)]));
  for (let y = 1; y < ROOM_D; y += 1) grid.push(pts([iso(0, y), iso(ROOM_W, y)]));
  return (
    <g className="editorial-room-office-room">
      <polygon className="editorial-room-office-wall is-left" points={leftWallRect(0, ROOM_D, 0, WALL_H)} />
      <polygon className="editorial-room-office-wall is-right" points={rightWallRect(0, ROOM_W, 0, WALL_H)} />
      <polygon className="editorial-room-office-floor" points={flatRect(0, 0, ROOM_W, ROOM_D)} />
      {grid.map((line) => (
        <polyline key={line} className="editorial-room-office-grid" points={line} />
      ))}
      {/* 踢脚线 */}
      <polyline className="editorial-room-office-skirting" points={pts([iso(0, ROOM_D), iso(0, 0), iso(ROOM_W, 0)])} />
    </g>
  );
}

export function IsoBox({
  at,
  size,
  z = 0,
  tone = "plain",
  children,
}: {
  at: [number, number];
  size: [number, number, number];
  z?: number;
  tone?: "plain" | "wood" | "metal" | "planned";
  children?: ReactNode;
}) {
  const faces = boxFaces(at[0], at[1], size[0], size[1], size[2], z);
  return (
    <g className={`editorial-room-iso is-${tone}`}>
      <polygon className="editorial-room-iso-left" points={faces.left} />
      <polygon className="editorial-room-iso-right" points={faces.right} />
      <polygon className="editorial-room-iso-top" points={faces.top} />
      {children}
    </g>
  );
}

/** 传送带：沿着一串地面点走的一条宽带子，开工时上面的纹路往前流。 */
export function Belt({ path, moving }: { path: Array<[number, number]>; moving: boolean }) {
  const points = pts(path.map(([gx, gy]) => iso(gx, gy, 2)));
  return (
    <g className={`editorial-room-office-belt${moving ? " is-moving" : ""}`} aria-hidden="true">
      <polyline className="editorial-room-office-belt-edge" points={points} />
      <polyline className="editorial-room-office-belt-surface" points={points} />
      <polyline className="editorial-room-office-belt-flow" points={points} />
    </g>
  );
}

/** 把一个 64 × 68、脚底在 y = 62 的小人或机器人摆到地面 (gx, gy) 上。 */
export function Sprite({ at, scale = 0.9, children }: { at: Point; scale?: number; children: ReactNode }) {
  return <g transform={`translate(${(at.x - 32 * scale).toFixed(1)} ${(at.y - 62 * scale).toFixed(1)}) scale(${scale})`}>{children}</g>;
}

/** 头顶一个词的小牌子（只在忙的时候出现）。 */
export function Tag({ at, text, tone = "plain" }: { at: Point; text: string; tone?: "plain" | "warn" }) {
  const width = Math.max(40, [...text].reduce((sum, ch) => sum + (/[\x00-\xff]/.test(ch) ? 6.5 : 12), 0) + 16);
  return (
    <g className={`editorial-room-office-tag is-${tone}`} transform={`translate(${at.x.toFixed(1)} ${at.y.toFixed(1)})`}>
      <rect x={-width / 2} y={-11} width={width} height={20} rx={10} />
      <text x={0} y={3.5} textAnchor="middle">
        {text}
      </text>
    </g>
  );
}

/** 质检闸门：两根柱子一根横梁，梁上一盏灯（绿、黄、红）。 */
export function CheckGate({ at, tone }: { at: [number, number]; tone: string }) {
  const [gx, gy] = at;
  const lamp = iso(gx + 0.15, gy + 0.5, 64);
  return (
    <g className={`editorial-room-office-gate is-${tone}`}>
      <IsoBox at={[gx, gy - 0.2]} size={[0.3, 0.22, 56]} tone="metal" />
      <IsoBox at={[gx, gy + 1.0]} size={[0.3, 0.22, 56]} tone="metal" />
      <IsoBox at={[gx, gy - 0.2]} size={[0.3, 1.42, 8]} z={56} tone="metal" />
      <circle className="editorial-room-office-lamp-glow" cx={lamp.x} cy={lamp.y - 4} r={11} />
      <circle className="editorial-room-office-lamp" cx={lamp.x} cy={lamp.y - 4} r={5.5} />
    </g>
  );
}

/** 墙上的看板（调度）：一格一张还没派的页。 */
export function Kanban({ waiting }: { waiting: number }) {
  const shown = Math.min(waiting, 8);
  return (
    <g className="editorial-room-office-kanban">
      <polygon className="editorial-room-office-board" points={leftWallRect(0.6, 2.9, 30, 78)} />
      {Array.from({ length: shown }, (_, i) => {
        const y0 = 0.8 + (i % 4) * 0.5;
        const z0 = i < 4 ? 58 : 38;
        return <polygon key={i} className="editorial-room-office-card" points={leftWallRect(y0, y0 + 0.36, z0, z0 + 14)} />;
      })}
    </g>
  );
}

/** 白板上一行字最长多少（按字号估的宽度，超了截断加「…」）。 */
const BOARD_LINE_WIDTH = 78;
const BOARD_FONT = 7;

function clipToWidth(text: string, width: number, size: number): string {
  let used = 0;
  let out = "";
  for (const ch of text) {
    used += /[\x00-\xff]/.test(ch) ? size * 0.56 : size * 1.02;
    if (used > width) return `${out}…`;
    out += ch;
  }
  return out;
}

/**
 * 墙上的术语表白板：最近改过的几条术语（新的在上；先写译法、后面淡淡跟着原文，长了截原文），版本号，歧义单便签。
 * 同一个原文改了几次只写最新那次。
 * 还没有术语时画几道字迹。writeKey 变了（刚改版）最上面那行重新「写」一遍：盖在字上的一条白板色慢慢抽走。
 * 字贴着右墙：右墙上往右 1 像素、往下走半像素，所以用 matrix(1, 0.5, 0, 1, …) 把一行字斜贴上去。
 */
export function Whiteboard({
  version,
  tickets,
  fresh,
  entries = [],
  writeKey = 0,
}: {
  version: number;
  tickets: number;
  fresh: boolean;
  entries?: ReadonlyArray<{ source: string; target: string }>;
  writeKey?: number;
}) {
  const corner = iso(6.35, 0, 78);
  const lines = [0, 1, 2, 3].map((i) => pts([iso(2.9, 0, 68 - i * 9), iso(4.6 - (i % 2) * 0.6, 0, 68 - i * 9)]));
  const shown = entries.filter((entry, i) => entries.findIndex((other) => other.source === entry.source) === i).slice(0, 3);
  return (
    <g className={`editorial-room-office-whiteboard${fresh ? " is-fresh" : ""}`} data-editorial-glossary-version={version}>
      <polygon className="editorial-room-office-board" points={rightWallRect(2.4, 6.8, 28, 82)} />
      {shown.length
        ? shown.map((entry, i) => {
            const origin = iso(2.65, 0, 70 - i * 10);
            const targetWidth = [...entry.target].length * BOARD_FONT * 1.02;
            const source = clipToWidth(entry.source, Math.max(0, BOARD_LINE_WIDTH - targetWidth - 5), BOARD_FONT * 0.86);
            const writing = i === 0 && writeKey > 0;
            return (
              <g
                key={writing ? `w-${writeKey}` : `${i}-${entry.source}`}
                className={`editorial-room-office-term${i === 0 ? " is-newest" : ""}`}
                transform={`matrix(1 0.5 0 1 ${origin.x.toFixed(1)} ${origin.y.toFixed(1)})`}
                data-editorial-term={entry.source}
              >
                <text x={0} y={0} fontSize={BOARD_FONT}>
                  <tspan className="editorial-room-office-term-target">{entry.target}</tspan>
                  <tspan className="editorial-room-office-term-source" dx={4} fontSize={BOARD_FONT * 0.86}>
                    {source}
                  </tspan>
                </text>
                {writing ? <rect className="editorial-room-office-term-cover" x={-1} y={-BOARD_FONT} width={BOARD_LINE_WIDTH + 6} height={BOARD_FONT + 3} /> : null}
              </g>
            );
          })
        : lines.map((line) => <polyline key={line} className="editorial-room-office-ink" points={line} />)}
      {Array.from({ length: Math.min(tickets, 3) }, (_, i) => (
        <polygon key={i} className="editorial-room-office-sticky" points={rightWallRect(5.5 + i * 0.42, 5.86 + i * 0.42, 34, 48)} />
      ))}
      <text key={version} className="editorial-room-office-version" x={corner.x - 6} y={corner.y + 16} textAnchor="end">
        v{version}
      </text>
    </g>
  );
}

/** 地上的一只筐：「待人看」的块一张张放进去。 */
export function Basket({ at, count }: { at: [number, number]; count: number }) {
  const [gx, gy] = at;
  return (
    <g className={`editorial-room-office-basket${count ? " has-items" : ""}`}>
      <IsoBox at={[gx, gy]} size={[0.8, 0.8, 14]} tone="wood" />
      {Array.from({ length: Math.min(count, 4) }, (_, i) => (
        <polygon
          key={i}
          className="editorial-room-office-paper is-flagged"
          points={flatRect(gx + 0.12 + i * 0.04, gy + 0.12, 0.5, 0.55, 15 + i * 2)}
        />
      ))}
    </g>
  );
}

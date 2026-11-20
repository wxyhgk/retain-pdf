// 2.5D 编辑部的家具和桌上的东西：椅背、地上的影子、笔记本、显示器、书堆、茶杯、台灯、稿纸。
// 纯画，只认位置和「亮不亮」（lit：工位有活时笔记本的标、台灯、茶杯的热气才亮），不读编辑部状态。
// 桌上的东西按桌面上的相对位置摆（u 沿 gx、v 沿 gy，0–1），由 deskPoint 换成地面格子。颜色走 props.css。

import type { ReactNode } from "react";

import { flatRect, iso, pts, type Point } from "../iso.js";
import { IsoBox } from "../OfficeParts.jsx";

export type DeskSpec = { at: [number, number]; size: [number, number, number]; tone: "wood" | "metal" };
export type DeskItemKind = "laptop" | "monitor" | "books" | "mug" | "lamp" | "papers" | "marked-papers";
export type DeskItemSpec = { kind: DeskItemKind; u: number; v: number };

/** 桌面上 (u, v) 那一点在地面格子上的位置，和桌面的高度。 */
export function deskPoint(desk: DeskSpec, u: number, v: number): { gx: number; gy: number; z: number } {
  return { gx: desk.at[0] + u * desk.size[0], gy: desk.at[1] + v * desk.size[1], z: desk.size[2] };
}

/** 椅背：画在人后面（和人共用 64 × 68 的画布）。 */
export function ChairBack() {
  return (
    <g className="office-prop-chair" aria-hidden="true">
      <rect className="office-prop-chair-back" x="15" y="27" width="34" height="26" rx="7" />
      <path className="office-prop-chair-seam" d="M20 33 Q32 30 44 33" />
    </g>
  );
}

/** 地上一团影子，让人和机器人站得住。 */
export function GroundShadow({ at, rx = 22 }: { at: Point; rx?: number }) {
  return <ellipse className="office-prop-shadow" cx={at.x} cy={at.y} rx={rx} ry={rx * 0.42} aria-hidden="true" />;
}

/** 立在桌面上、正对着人（背对我们）的一块板：笔记本的盖子、显示器的背面。 */
function backPanel(gx: number, gy: number, z: number, width: number, height: number, lean = 0.06): string {
  return pts([
    iso(gx - width / 2, gy, z),
    iso(gx + width / 2, gy, z),
    iso(gx + width / 2, gy + lean, z + height),
    iso(gx - width / 2, gy + lean, z + height),
  ]);
}

function Laptop({ gx, gy, z }: { gx: number; gy: number; z: number }) {
  const logo = iso(gx, gy + 0.2, z + 7);
  return (
    <g className="office-prop-laptop">
      <polygon className="office-prop-metal" points={flatRect(gx - 0.22, gy - 0.15, 0.44, 0.32, z)} />
      <polygon className="office-prop-metal is-shade" points={backPanel(gx, gy + 0.17, z, 0.44, 13)} />
      <circle className="office-prop-glow" cx={logo.x} cy={logo.y} r={2.2} />
    </g>
  );
}

function Monitor({ gx, gy, z }: { gx: number; gy: number; z: number }) {
  const neck = iso(gx, gy, z);
  return (
    <g className="office-prop-monitor">
      <polygon className="office-prop-metal" points={flatRect(gx - 0.1, gy - 0.08, 0.2, 0.16, z)} />
      <path className="office-prop-neck" d={`M${neck.x.toFixed(1)} ${neck.y.toFixed(1)} v-8`} />
      <polygon className="office-prop-metal is-shade" points={backPanel(gx, gy + 0.05, z + 6, 0.56, 17, 0.02)} />
      <circle className="office-prop-glow" cx={iso(gx, gy + 0.06, z + 15).x} cy={iso(gx, gy + 0.06, z + 15).y} r={1.6} />
    </g>
  );
}

function Books({ gx, gy, z }: { gx: number; gy: number; z: number }) {
  return (
    <g className="office-prop-books">
      <IsoBox at={[gx - 0.18, gy - 0.12]} size={[0.38, 0.26, 3.2]} z={z} tone="plain" />
      <g className="office-prop-book is-b">
        <IsoBox at={[gx - 0.15, gy - 0.14]} size={[0.32, 0.24, 3]} z={z + 3.2} tone="plain" />
      </g>
      <g className="office-prop-book is-c">
        <IsoBox at={[gx - 0.2, gy - 0.1]} size={[0.36, 0.22, 2.8]} z={z + 6.2} tone="plain" />
      </g>
    </g>
  );
}

function Mug({ gx, gy, z }: { gx: number; gy: number; z: number }) {
  const p = iso(gx, gy, z);
  return (
    <g className="office-prop-mug" transform={`translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`}>
      <path className="office-prop-mug-body" d="M-3.4 0 L-3.4 -7 L3.4 -7 L3.4 0 Q0 1.6 -3.4 0 Z" />
      <ellipse className="office-prop-mug-top" cx="0" cy="-7" rx="3.4" ry="1.4" />
      <path className="office-prop-mug-handle" d="M3.4 -5.5 Q6.4 -4.6 3.4 -2" />
      <path className="office-prop-steam" d="M-1 -10 Q-2.2 -12.5 -1 -15 M1.4 -10.5 Q0.2 -13 1.4 -15.5" />
    </g>
  );
}

function Lamp({ gx, gy, z }: { gx: number; gy: number; z: number }) {
  const p = iso(gx, gy, z);
  return (
    <g className="office-prop-lamp" transform={`translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`}>
      <path className="office-prop-light" d="M-9 -12 L-22 2 L2 2 Z" />
      <ellipse className="office-prop-metal" cx="0" cy="0" rx="4.4" ry="1.8" />
      <path className="office-prop-lamp-arm" d="M0 -1 L2.5 -13 L-5 -18" />
      <path className="office-prop-metal is-shade" d="M-3 -20.5 L-10.5 -13.5 L-6 -11 Z" />
    </g>
  );
}

function Papers({ gx, gy, z, marked }: { gx: number; gy: number; z: number; marked: boolean }) {
  const lines = [0, 1, 2].map((i) => pts([iso(gx - 0.14, gy - 0.08 + i * 0.07, z + 2.2), iso(gx + 0.1, gy - 0.08 + i * 0.07, z + 2.2)]));
  return (
    <g className="office-prop-papers">
      <polygon className="office-prop-sheet" points={flatRect(gx - 0.2, gy - 0.16, 0.42, 0.32, z + 0.6)} />
      <polygon className="office-prop-sheet" points={flatRect(gx - 0.22, gy - 0.14, 0.42, 0.32, z + 1.4)} />
      <polygon className="office-prop-sheet" points={flatRect(gx - 0.19, gy - 0.15, 0.42, 0.32, z + 2.2)} />
      {lines.map((line, i) => (
        <polyline key={i} className={`office-prop-ink${marked && i === 1 ? " is-marked" : ""}`} points={line} />
      ))}
    </g>
  );
}

export function DeskItem({ desk, item }: { desk: DeskSpec; item: DeskItemSpec }): ReactNode {
  const { gx, gy, z } = deskPoint(desk, item.u, item.v);
  switch (item.kind) {
    case "laptop":
      return <Laptop gx={gx} gy={gy} z={z} />;
    case "monitor":
      return <Monitor gx={gx} gy={gy} z={z} />;
    case "books":
      return <Books gx={gx} gy={gy} z={z} />;
    case "mug":
      return <Mug gx={gx} gy={gy} z={z} />;
    case "lamp":
      return <Lamp gx={gx} gy={gy} z={z} />;
    case "papers":
    case "marked-papers":
      return <Papers gx={gx} gy={gy} z={z} marked={item.kind === "marked-papers"} />;
    default:
      return null;
  }
}

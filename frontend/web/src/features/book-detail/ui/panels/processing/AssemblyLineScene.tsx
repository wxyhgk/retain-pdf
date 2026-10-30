// 「进度」页的流水线画面：斜俯视的一条传送带穿过五台机器（文档准备 → OCR 识别 → 文本翻译 → 版面重建 → 完成）。
// 自己画的线描 SVG，颜色全走皮肤变量（assembly-line.css），跟着换肤。只画，不写字：每站的状态和时间
// 由 ProcessingPipelineRail 按 STATION_ANCHORS 摆在机器上方。
//
// 动的规则：正在跑的那站机器在动（扫描灯来回、排版头左右走、指示灯呼吸），稿纸从上一站沿着带子往它那里走；
// 做完的站后面留一张稿纸；整条带子只在有任务在跑时转。

import type { CSSProperties, ReactNode } from "react";

import type { StationKey, StationState } from "../../../domain/assembly-line-model.js";

// 斜俯视投影：沿带子的方向 gx 往右、略往下；横穿带子的 gy 往左下；z 往上（像素）。
const AX = 44;
const AY = 9;
const BX = 22;
const BY = 13;
const OX = 74;
const OY = 168;
export const LINE_VIEW_W = 640;
export const LINE_VIEW_H = 318;

type P = { x: number; y: number };
const at = (gx: number, gy: number, z = 0): P => ({ x: OX + gx * AX - gy * BX, y: OY + gx * AY + gy * BY - z });
const pts = (list: P[]) => list.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

type Tone = "body" | "dark" | "paper" | "accent";

/** 立着的方块：(gx, gy) 是靠后的角，w 沿带子、d 横穿带子，z 起、高 h。画看得见的三个面。 */
function Box({ gx, gy, w, d, h, z = 0, tone = "body" }: { gx: number; gy: number; w: number; d: number; h: number; z?: number; tone?: Tone }) {
  const top = [at(gx, gy, z + h), at(gx + w, gy, z + h), at(gx + w, gy + d, z + h), at(gx, gy + d, z + h)];
  const front = [at(gx, gy + d, z + h), at(gx + w, gy + d, z + h), at(gx + w, gy + d, z), at(gx, gy + d, z)];
  const side = [at(gx + w, gy, z + h), at(gx + w, gy + d, z + h), at(gx + w, gy + d, z), at(gx + w, gy, z)];
  return (
    <g className={`book-detail-line-box is-${tone}`}>
      <polygon className="book-detail-line-face-front" points={pts(front)} />
      <polygon className="book-detail-line-face-side" points={pts(side)} />
      <polygon className="book-detail-line-face-top" points={pts(top)} />
    </g>
  );
}

/** 平放的一张纸（带两道字行）。 */
function Sheet({ gx, gy, z, className = "" }: { gx: number; gy: number; z: number; className?: string }) {
  const w = 0.62;
  const d = 0.62;
  const line = (f: number) => pts([at(gx + 0.1, gy + d * f, z), at(gx + w - 0.12, gy + d * f, z)]);
  return (
    <g className={`book-detail-line-sheet ${className}`}>
      <polygon points={pts([at(gx, gy, z), at(gx + w, gy, z), at(gx + w, gy + d, z), at(gx, gy + d, z)])} />
      <polyline points={line(0.35)} />
      <polyline points={line(0.62)} />
    </g>
  );
}

/** 一摞纸：几层薄片叠起来，最上面一张带字行。 */
function Stack({ gx, gy, z, layers }: { gx: number; gy: number; z: number; layers: number }) {
  return (
    <g className="book-detail-line-stack">
      <Box gx={gx} gy={gy} w={0.8} d={0.7} h={Math.max(2, layers * 2.4)} z={z} tone="paper" />
      <Sheet gx={gx + 0.09} gy={gy + 0.04} z={z + Math.max(2, layers * 2.4) + 0.2} />
    </g>
  );
}

function Lamp({ gx, gy, z, state }: { gx: number; gy: number; z: number; state: StationState }) {
  const p = at(gx, gy, z);
  return (
    <g className={`book-detail-line-lamp is-${state}`}>
      <ellipse className="book-detail-line-lamp-glow" cx={p.x} cy={p.y - 3} rx={9} ry={6} />
      <circle cx={p.x} cy={p.y - 3} r={3.6} />
    </g>
  );
}

// 每台机器在带子上的位置（中心 gx），稿纸在两站之间走的起止点。
const CENTER: Record<StationKey, number> = { prepare: 1.0, ocr: 3.5, translate: 6.0, render: 8.5, done: 11.0 };
const BELT_GY = 0.75;
const BELT_D = 0.9;
const BELT_Z = 12;
const ORDER: StationKey[] = ["prepare", "ocr", "translate", "render", "done"];
/** 每台机器沿带子方向的半宽：稿纸从上一台的出口走进下一台的入口。 */
const HALF: Record<StationKey, number> = { prepare: 0.7, ocr: 0.7, translate: 0.8, render: 0.75, done: 0.5 };

/** 每站上方挂说明的位置（占画面宽高的百分比），给 HTML 那一层摆标签用。 */
export const STATION_ANCHORS: Record<StationKey, { left: number; top: number }> = Object.fromEntries(
  ORDER.map((key) => {
    const height: Record<StationKey, number> = { prepare: 70, ocr: 66, translate: 70, render: 56, done: 64 };
    const p = at(CENTER[key] + 0.2, 0.2, height[key]);
    return [key, { left: (p.x / LINE_VIEW_W) * 100, top: (p.y / LINE_VIEW_H) * 100 }];
  }),
) as Record<StationKey, { left: number; top: number }>;

function machine(key: StationKey, state: StationState, layers: number): { back?: ReactNode; front: ReactNode } {
  const c = CENTER[key];
  const busy = state === "active";
  if (key === "prepare") {
    return {
      front: (
        <>
          <Box gx={c - 0.7} gy={-0.35} w={1.4} d={1.0} h={44} />
          <Stack gx={c - 0.4} gy={-0.2} z={44} layers={busy ? 5 : 3} />
          <Lamp gx={c + 0.55} gy={0.55} z={44} state={state} />
        </>
      ),
    };
  }
  if (key === "ocr") {
    return {
      back: <Box gx={c - 0.6} gy={0.35} w={1.2} d={0.3} h={52} />,
      front: (
        <>
          <Box gx={c - 0.6} gy={BELT_GY + BELT_D + 0.05} w={1.2} d={0.3} h={52} />
          <Box gx={c - 0.7} gy={0.3} w={1.4} d={1.75} h={12} z={52} />
          <g className={`book-detail-line-scan${busy ? " is-running" : ""}`}>
            <polygon points={pts([at(c - 0.5, BELT_GY, BELT_Z + 1), at(c - 0.4, BELT_GY, BELT_Z + 1), at(c - 0.4, BELT_GY + BELT_D, BELT_Z + 1), at(c - 0.5, BELT_GY + BELT_D, BELT_Z + 1)])} />
          </g>
          <Lamp gx={c} gy={1.2} z={64} state={state} />
        </>
      ),
    };
  }
  if (key === "translate") {
    const slot = (f: number) => pts([at(c - 0.55, 2.05, 22 + f * 9), at(c + 0.55, 2.05, 22 + f * 9)]);
    return {
      front: (
        <>
          <Box gx={c - 0.8} gy={0.25} w={1.6} d={1.8} h={66} />
          <polygon className="book-detail-line-window" points={pts([at(c - 0.6, 2.05, 54), at(c + 0.6, 2.05, 54), at(c + 0.6, 2.05, 18), at(c - 0.6, 2.05, 18)])} />
          <g className={`book-detail-line-trays${busy ? " is-running" : ""}`}>
            {[0, 1, 2, 3].map((f) => <polyline key={f} points={slot(f)} />)}
          </g>
          <Lamp gx={c} gy={1.1} z={66} state={state} />
        </>
      ),
    };
  }
  if (key === "render") {
    return {
      back: <Box gx={c - 0.1} gy={0.2} w={0.22} d={0.22} h={50} tone="dark" />,
      front: (
        <>
          <Box gx={c - 0.75} gy={0.45} w={1.5} d={1.4} h={8} z={BELT_Z} />
          <Box gx={c - 0.1} gy={1.95} w={0.22} d={0.22} h={50} tone="dark" />
          <Box gx={c - 0.1} gy={0.2} w={0.22} d={1.97} h={6} z={50} tone="dark" />
          <g className={`book-detail-line-head${busy ? " is-running" : ""}`}>
            <Box gx={c - 0.16} gy={0.9} w={0.34} d={0.4} h={12} z={40} tone="accent" />
          </g>
          <Lamp gx={c + 0.02} gy={0.3} z={56} state={state} />
        </>
      ),
    };
  }
  return {
    front: (
      <>
        <Box gx={c - 0.5} gy={0.3} w={1.3} d={1.7} h={36} />
        <Stack gx={c - 0.3} gy={0.75} z={36} layers={layers} />
        <Lamp gx={c + 0.55} gy={1.85} z={36} state={state} />
      </>
    ),
  };
}

export function AssemblyLineScene({ states, running }: { states: Record<StationKey, StationState>; running: boolean }) {
  const active = ORDER.find((key) => states[key] === "active");
  const doneCount = ORDER.filter((key) => states[key] === "done").length;
  const parts = ORDER.map((key) => ({ key, ...machine(key, states[key], key === "done" ? (states.done === "done" ? 9 : 1) : 0) }));

  // 走动的稿纸：从上一站出口走到正在跑的那站入口。
  const activeIndex = active ? ORDER.indexOf(active) : -1;
  const prev = activeIndex > 0 ? ORDER[activeIndex - 1] : null;
  const from = prev ? CENTER[prev] + HALF[prev] - 0.3 : 0;
  const to = active && prev ? CENTER[active] - HALF[active] + 0.1 : 0;
  const travel = { "--line-dx": `${((to - from) * AX).toFixed(1)}px`, "--line-dy": `${((to - from) * AY).toFixed(1)}px` } as CSSProperties;
  // 做完的站后面躺一张稿纸，看得出走到了哪。
  const resting = ORDER.slice(0, -1).filter((key, i) => states[key] === "done" && i + 1 !== activeIndex);

  return (
    <svg
      className={`book-detail-line-scene${running ? " is-running" : ""}`}
      viewBox={`0 0 ${LINE_VIEW_W} ${LINE_VIEW_H}`}
      role="img"
      aria-label={`处理流水线：五站里做完 ${doneCount} 站`}
      data-line-active={active || ""}
    >
      <polygon className="book-detail-line-floor" points={pts([at(-1.2, -0.8), at(12.6, -0.8), at(12.6, 3.0), at(-1.2, 3.0)])} />
      {parts.map((part) => (part.back ? <g key={`${part.key}-back`}>{part.back}</g> : null))}
      <g className="book-detail-line-belt">
        <Box gx={-0.6} gy={BELT_GY} w={11.4} d={BELT_D} h={BELT_Z} tone="dark" />
        <polyline className="book-detail-line-belt-run" points={pts([at(-0.6, BELT_GY + BELT_D / 2, BELT_Z), at(10.8, BELT_GY + BELT_D / 2, BELT_Z)])} />
      </g>
      {resting.map((key) => (
        <Sheet key={`rest-${key}`} gx={CENTER[key] + 0.85} gy={BELT_GY + 0.14} z={BELT_Z + 0.5} className="is-resting" />
      ))}
      {activeIndex > 0 ? (
        <g className="book-detail-line-travel" style={travel} data-line-travel={active}>
          <Sheet gx={from} gy={BELT_GY + 0.14} z={BELT_Z + 0.5} className="is-moving" />
          <Sheet gx={from} gy={BELT_GY + 0.14} z={BELT_Z + 0.5} className="is-moving is-late" />
        </g>
      ) : null}
      {parts.map((part) => (
        <g key={part.key} className={`book-detail-line-machine is-${states[part.key]}`} data-line-station={part.key} data-state={states[part.key]}>
          {part.front}
        </g>
      ))}
    </svg>
  );
}

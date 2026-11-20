// 2.5D 编辑部里一闪而过的动作：每条只播一次（按事件序号挂上，动画放完自己隐去）。
// 画的都是事件里的真东西，不编：
//   tool_call      译者头顶冒气泡「查全书「attention」· 4 处」
//   check_result   闸门里一道光扫下来，按结果绿 / 黄 / 红，灯上荡开一圈
//   retry          闸门上「退回重翻」
//   fallback       一张红纸从闸门抛进「待人看」筐
//   review_done    审校桌上的问题单一张张飞到修订桌：改进去的变绿打勾，没收的变灰掉下去，审校撤回的半路淡掉；
//                  修订头上报一句「改 2 · 没收 1」；没挑出问题时审校头上一句「这页没问题」
//   ticket_opened  白板旁边「歧义：attention 注意力 → 关注？」
//   page_done      定稿章盖在稿纸上，稿纸沿带子送到头，再落到档案柜的纸堆上
// 术语表改版的「写上白板」在 Whiteboard 里（那几行一直留着）。
// 动画写在 OfficeMoments.css（定稿归档、白板写字在 OfficeFiling.css）；系统开了「减弱动态效果」时整站动画收到瞬时，这些动作直接不出现。

import type { CSSProperties, ReactNode } from "react";

import type { EditorialEvent } from "../../domain/events.js";
import { toolBubbleText } from "../../domain/narration.js";
import type { Moment } from "../../domain/room-state.js";
import { flatRect, iso, type Point } from "./iso.js";
import { AT, BUBBLE_Z, CABINET_TOP_Z, DROP, PILE_STEP, type Spot } from "./layout.js";

/** 一张问题单最多画几张（单子再多也只飞这么多，数字在报数里）。 */
const NOTES_MAX = 6;
const BUBBLE_FONT = 10;

type MomentOf<T extends EditorialEvent["type"]> = { seq: number; event: Extract<EditorialEvent, { type: T }> };

const px = (value: number) => `${value.toFixed(1)}px`;
const delta = (from: Point, to: Point) => ({ "--dx": px(to.x - from.x), "--dy": px(to.y - from.y) });

/** 气泡宽度：按字估（中文一个字约 1 个字号宽，英文数字约 0.55）。 */
function textWidth(text: string, size = BUBBLE_FONT): number {
  return [...text].reduce((sum, ch) => sum + (/[\x00-\xff]/.test(ch) ? size * 0.5 : size * 1.02), 0);
}

function Bubble({
  at,
  text,
  tone = "plain",
  delay = 0,
  tail = "down",
}: {
  at: Point;
  text: string;
  tone?: "plain" | "ok" | "warn" | "danger";
  delay?: number;
  /** 尾巴朝下（气泡在头顶）还是朝上（气泡在桌子前面，指回桌上）。 */
  tail?: "down" | "up";
}) {
  const width = Math.max(36, textWidth(text) + 18);
  return (
    <g
      className={`editorial-room-office-moment is-bubble is-${tone}`}
      transform={`translate(${at.x.toFixed(1)} ${at.y.toFixed(1)})`}
      data-editorial-moment="bubble"
    >
      <g className="editorial-room-office-bubble" style={{ animationDelay: `${delay}ms` }}>
        <rect x={-width / 2} y={-12} width={width} height={22} rx={11} />
        <path d={tail === "down" ? "M -5 9.5 L 0 16 L 5 9.5 Z" : "M -5 -11.5 L 0 -18 L 5 -11.5 Z"} />
        <text x={0} y={3.5} textAnchor="middle" fontSize={BUBBLE_FONT}>
          {text}
        </text>
      </g>
    </g>
  );
}

const above = (spot: Spot, z = BUBBLE_Z) => iso(spot[0], spot[1], z);
/** 修订、审校的报数：放在两张桌子中间的上方（头顶正好叠着后排的调度、译者，桌前是定稿稿纸走的带子）。 */
const between = iso((AT.reviser[0] + AT.reviewer[0]) / 2, AT.reviser[1] + 0.2, 64);

function GateScan({ moment }: { moment: MomentOf<"check_result"> }) {
  const { error, warn } = moment.event;
  const tone = error ? "danger" : warn ? "warn" : "ok";
  const lamp = iso(AT.gate[0] + 0.15, AT.gate[1] + 0.5, 64);
  // 闸门两根柱子之间的一道光，从横梁扫到地面。
  const band = [iso(8.45, 3.55, 54), iso(8.45, 4.75, 54), iso(8.45, 4.75, 47), iso(8.45, 3.55, 47)];
  return (
    <g className={`editorial-room-office-moment is-scan is-${tone}`} data-editorial-moment="scan">
      <polygon className="editorial-room-office-scan" points={band.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")} />
      <circle className="editorial-room-office-ring" cx={lamp.x} cy={lamp.y - 4} r={8} />
    </g>
  );
}

function FallbackToss({ moment }: { moment: MomentOf<"fallback"> }) {
  const from = iso(DROP.checker[0], DROP.checker[1], 6);
  const to = iso(AT.basket[0] + 0.4, AT.basket[1] + 0.4, 18);
  return (
    <g className="editorial-room-office-moment is-toss" data-editorial-moment="fallback">
      <g className="editorial-room-office-flyer" style={delta(from, to) as CSSProperties}>
        <polygon className="editorial-room-office-paper is-flagged" points={flatRect(DROP.checker[0] - 0.22, DROP.checker[1] - 0.2, 0.44, 0.4, 6)} />
      </g>
      <title>{`第 ${moment.event.page} 页的 ${moment.event.block} 先放原文，等人看`}</title>
    </g>
  );
}

function ReviewNotes({ moment }: { moment: MomentOf<"review_done"> }) {
  const { tickets, applied, rejected, withdrawn } = moment.event;
  if (!tickets) {
    return <Bubble at={between} text="这页没问题" tone="ok" />;
  }
  const from = iso(AT.reviewer[0] + 0.2, AT.reviewer[1] + 0.5, 30);
  const to = iso(AT.reviser[0] + 0.2, AT.reviser[1] + 0.5, 24);
  // 先改进去的，再没收的，最后撤回的；张数按比例分到最多 NOTES_MAX 张。
  const total = Math.max(tickets, applied + rejected + withdrawn);
  const shown = Math.min(total, NOTES_MAX);
  const share = (n: number) => Math.round((n / total) * shown);
  const kinds = [
    ...Array<string>(share(applied)).fill("applied"),
    ...Array<string>(share(rejected)).fill("rejected"),
    ...Array<string>(share(withdrawn)).fill("withdrawn"),
  ].slice(0, shown);
  while (kinds.length < shown) kinds.push(applied ? "applied" : "rejected");
  const summary = [`改 ${applied}`, rejected ? `没收 ${rejected}` : "", withdrawn ? `撤回 ${withdrawn}` : ""].filter(Boolean).join(" · ");
  return (
    <g className="editorial-room-office-moment is-notes" data-editorial-moment="review-notes">
      {kinds.map((kind, i) => (
        // 外层定位（SVG 属性），中层飞（CSS 位移），里层变色、打勾：CSS 的 transform 会盖掉同一元素上的 transform 属性。
        <g key={i} transform={`translate(${(from.x + (i % 3) * 6 - 6).toFixed(1)} ${(from.y - Math.floor(i / 3) * 6).toFixed(1)})`}>
          <g className={`editorial-room-office-note-flyer is-${kind}`} style={{ ...delta(from, to), animationDelay: `${i * 130}ms` } as CSSProperties}>
            <g className="editorial-room-office-note-body" style={{ animationDelay: `${i * 130}ms` }}>
              <rect x={-8} y={-6.5} width={16} height={13} rx={2} />
              {kind === "applied" ? (
                <path className="editorial-room-office-note-check" style={{ animationDelay: `${i * 130}ms` }} d="M -4 0 L -1 3.2 L 4.2 -3" />
              ) : null}
            </g>
          </g>
        </g>
      ))}
      <Bubble at={between} text={summary} tone={rejected ? "warn" : "ok"} delay={900} />
    </g>
  );
}

function PageFiled({ moment, pileTop }: { moment: MomentOf<"page_done">; pileTop: number }) {
  const start = iso(DROP.reviser[0], DROP.reviser[1], 6);
  const end = iso(DROP.end[0], DROP.end[1], 6);
  const shelf = iso(AT.cabinet[0] + 0.49, AT.cabinet[1] + 0.39, pileTop);
  const flagged = moment.event.statuses.fallback_source > 0;
  const style = {
    "--end-x": px(end.x - start.x),
    "--end-y": px(end.y - start.y),
    "--shelf-x": px(shelf.x - start.x),
    "--shelf-y": px(shelf.y - start.y),
  } as CSSProperties;
  return (
    <g className="editorial-room-office-moment is-filed" data-editorial-moment="filed" data-editorial-page={moment.event.page}>
      <g className="editorial-room-office-filer" style={style}>
        <polygon
          className={`editorial-room-office-paper${flagged ? " is-flagged" : ""}`}
          points={flatRect(DROP.reviser[0] - 0.28, DROP.reviser[1] - 0.24, 0.56, 0.48, 6)}
        />
        <g transform={`translate(${start.x.toFixed(1)} ${(start.y - 1).toFixed(1)})`}>
          <g className="editorial-room-office-stamp">
            <ellipse rx={12} ry={7} />
            <text x={0} y={3} textAnchor="middle" fontSize={8.5}>
              定稿
            </text>
          </g>
        </g>
      </g>
    </g>
  );
}

/** 只留最新一条的那几种（气泡叠在同一处会糊在一起）。 */
const LATEST_ONLY: readonly string[] = ["tool_call", "check_result", "retry", "review_done", "ticket_opened"];

export function OfficeMoments({ moments, filedCount }: { moments: readonly Moment[]; filedCount: number }) {
  const latest = new Map<string, number>();
  for (const moment of moments) if (LATEST_ONLY.includes(moment.event.type)) latest.set(moment.event.type, moment.seq);
  const pileTop = CABINET_TOP_Z + Math.max(0, Math.min(filedCount, 10) - 1) * PILE_STEP;
  const nodes: ReactNode[] = [];
  for (const moment of moments) {
    const { event, seq } = moment;
    if (LATEST_ONLY.includes(event.type) && latest.get(event.type) !== seq) continue;
    switch (event.type) {
      case "tool_call": {
        const spot = event.role === "reviewer" ? AT.reviewer : AT.translator;
        nodes.push(<Bubble key={seq} at={above(spot)} text={toolBubbleText(event)} tone={event.error ? "warn" : "plain"} />);
        break;
      }
      case "check_result":
        nodes.push(<GateScan key={seq} moment={{ seq, event }} />);
        break;
      case "retry":
        nodes.push(<Bubble key={seq} at={iso(AT.gate[0] + 0.15, AT.gate[1] + 0.5, 86)} text="退回重翻" tone="warn" />);
        break;
      case "fallback":
        nodes.push(<FallbackToss key={seq} moment={{ seq, event }} />);
        break;
      case "review_done":
        nodes.push(<ReviewNotes key={seq} moment={{ seq, event }} />);
        break;
      case "ticket_opened":
        nodes.push(
          <Bubble key={seq} at={iso(6.0, 0.2, 98)} text={`歧义：${event.term} ${event.current} → ${event.proposed}？`} tone="warn" />,
        );
        break;
      case "page_done":
        nodes.push(<PageFiled key={seq} moment={{ seq, event }} pileTop={pileTop} />);
        break;
      default:
        break;
    }
  }
  return <g className="editorial-room-office-moments">{nodes}</g>;
}

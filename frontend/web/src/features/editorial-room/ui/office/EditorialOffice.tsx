// 2.5D 编辑部全景：斜 45° 俯视的一间办公室。
//
// 后排：调度机器人（墙上看板挂着还没派的页）→ 通读员 → 译者；拐角是质检闸门；
// 前排：审校 ← 修订机器人 ← 档案柜（定稿的页叠上去，最多叠 10 张高）。一条传送带把它们串起来，
// 稿纸沿着带子（过拐角）从一个工位走到下一个。墙上是术语表白板（最近改的几条术语、版本号、歧义单便签），
// 地上一只「待人看」筐，最前面一排灰色空桌是筹备中的工位。忙的角色头上一个词，细节在悬停提示里。
// 查资料、质检、审校单、定稿归档这些一闪而过的动作在 OfficeMoments（每条事件只播一次）。

import { useState, type CSSProperties, type ReactNode } from "react";

import { genreText, reviewWithdrawnText } from "../../domain/narration.js";
import { stationPages, waitingPages, type PageCard, type RoomState } from "../../domain/room-state.js";
import { EditorialFigure, type FigureRole } from "../EditorialFigure.jsx";
import { EditorialRobot } from "../EditorialRobot.jsx";
import { PLANNED_STATIONS } from "../EditorialSidePanels.jsx";
import { OfficeMoments } from "./OfficeMoments.jsx";
import { Basket, Belt, CheckGate, IsoBox, Kanban, Room, Sprite, Tag, Whiteboard } from "./OfficeParts.jsx";
import { VIEW_H, VIEW_W, depthOf, flatRect, iso, type Point } from "./iso.js";
import {
  AT,
  BELT,
  CABINET_TOP_Z,
  PILE_MAX_SHEETS,
  PILE_STEP,
  SHEET_ROUTE,
  SPRITE_SCALE,
  TAG_Z,
  type Spot,
} from "./layout.js";

const PLANNED_GX = [0.6, 2.2, 3.8, 5.4, 7.0];
const PLANNED_GY = 7.5;

/** 定稿的页分成至多 PILE_MAX_SHEETS 叠；一叠里有退回原文的页就标红。 */
function filedPile(done: PageCard[]): { flagged: boolean }[] {
  const count = Math.min(done.length, PILE_MAX_SHEETS);
  return Array.from({ length: count }, (_, i) => {
    const slice = done.slice(Math.floor((i * done.length) / count), Math.floor(((i + 1) * done.length) / count));
    return { flagged: slice.some((card) => card.fallback) };
  });
}

type Item = { depth: number; key: string; node: ReactNode };

function Person({
  role,
  at,
  busy,
  moving,
  tag,
  hint,
}: {
  role: FigureRole;
  at: Spot;
  busy: boolean;
  moving: boolean;
  tag: string;
  hint: string;
}): Item[] {
  const [gx, gy] = at;
  return [
    {
      depth: depthOf(gx, gy),
      key: `${role}-person`,
      node: (
        <g data-editorial-seat={role} data-busy={busy ? "true" : "false"}>
          <title>{hint}</title>
          <Sprite at={iso(gx, gy)} scale={SPRITE_SCALE}>
            <EditorialFigure role={role} busy={busy && moving} />
          </Sprite>
        </g>
      ),
    },
    { depth: depthOf(gx, gy) + 1.0, key: `${role}-desk`, node: <IsoBox at={[gx - 0.3, gy + 0.2]} size={[1.3, 0.7, 26]} tone="wood" /> },
    ...(busy && tag ? [{ depth: 99, key: `${role}-tag`, node: <Tag at={iso(gx, gy, TAG_Z)} text={tag} /> }] : []),
  ];
}

function Sheet({ card }: { card: PageCard }) {
  const route = SHEET_ROUTE[card.stage];
  if (!route) return null;
  const to = iso(route.to[0], route.to[1], 6);
  const from = iso(route.from[0], route.from[1], 6);
  // 沿带子拐角走；不拐的那段取中点，好让同一套关键帧（起点 → 中途 → 终点）两种都能用。
  const via = route.via ? iso(route.via[0], route.via[1], 6) : { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
  const still = from.x === to.x && from.y === to.y;
  const offset = (p: Point, axis: "x" | "y") => `${(p[axis] - to[axis]).toFixed(1)}px`;
  const style = {
    "--from-x": offset(from, "x"),
    "--from-y": offset(from, "y"),
    "--via-x": offset(via, "x"),
    "--via-y": offset(via, "y"),
  } as CSSProperties;
  return (
    <g
      className={`editorial-room-office-sheet is-${card.stage}${still ? " is-still" : ""}`}
      style={style}
      data-editorial-page={card.page}
      data-editorial-stage={card.stage}
    >
      <title>{`第 ${card.label} 页`}</title>
      <polygon className="editorial-room-office-paper" points={flatRect(route.to[0] - 0.28, route.to[1] - 0.24, 0.56, 0.48, 6)} />
      <text className="editorial-room-office-page-no" x={to.x} y={to.y - 8} textAnchor="middle">
        {card.label}
      </text>
    </g>
  );
}

const gateTone = (card: PageCard | null) =>
  !card?.check ? (card ? "on" : "off") : card.check.error ? "error" : card.check.warn ? "warn" : "ok";

export function EditorialOffice({ state, glossaryFresh }: { state: RoomState; glossaryFresh: boolean }) {
  const at = stationPages(state);
  const running = state.status === "running" || state.status === "reading";
  const waiting = waitingPages(state);
  const done = state.pages.filter((card) => card.stage === "done");
  const { translator, reviewer, reviser, checker } = at;
  const reading = state.reading;
  // 一闪而过的动作只播挂上以后来的：打开「进度」页时，之前的事件不一起炸开。回放从头放时序号回到 0，跟着归零。
  const [mountedAt] = useState(state.seq);
  const since = state.seq < mountedAt ? 0 : mountedAt;
  const moments = state.moments.filter((moment) => moment.seq > since);
  const writeKey = [...moments].reverse().find((moment) => moment.event.type === "glossary_changed")?.seq ?? 0;

  const items: Item[] = [
    ...Person({
      role: "reader",
      at: AT.reader,
      busy: state.status === "reading",
      moving: running,
      tag: "读书中",
      hint: reading
        ? `通读员：${genreText(reading.genre)} · 术语 ${reading.terms} 条 · 标题 ${reading.headings} 个`
        : "通读员：开翻前把全书读一遍",
    }),
    ...Person({
      role: "translator",
      at: AT.translator,
      busy: !!translator,
      moving: running,
      tag: translator ? `${translator.stage === "retrying" ? "重翻" : "翻译"}第 ${translator.label} 页` : "",
      hint: translator ? `译者：第 ${translator.label} 页，第 ${Math.max(1, translator.attempt)} 次 · ${translator.blocks} 块` : "译者：一次翻一整页",
    }),
    ...Person({
      role: "reviewer",
      at: AT.reviewer,
      busy: !!reviewer,
      moving: running,
      tag: reviewer ? `审第 ${reviewer.label} 页` : "",
      hint: reviewer ? `审校：第 ${reviewer.label} 页 · ${reviewer.blocks} 块` : "审校：每页翻完审一遍，只开问题单",
    }),
  ];

  const dispatching = running && waiting.length > 0;
  const [dx, dy] = AT.dispatcher;
  items.push({
    depth: depthOf(dx, dy),
    key: "dispatcher",
    node: (
      <g data-editorial-station="dispatcher" data-busy={dispatching ? "true" : "false"}>
        <title>{`调度：还有 ${waiting.length} 页没派`}</title>
        <Sprite at={iso(dx, dy)} scale={SPRITE_SCALE}>
          <EditorialRobot role="dispatcher" busy={dispatching && state.status === "running"} />
        </Sprite>
      </g>
    ),
  });

  const [rx, ry] = AT.reviser;
  items.push(
    {
      depth: depthOf(rx, ry),
      key: "reviser",
      node: (
        <g data-editorial-station="reviser" data-busy={reviser ? "true" : "false"}>
          <title>{reviser?.review ? `修订第 ${reviser.label} 页：改 ${reviser.review.applied} 处，没收 ${reviser.review.rejected} 处${reviewWithdrawnText(reviser.review.withdrawn)}` : "修订：按问题单改那一小段"}</title>
          <Sprite at={iso(rx, ry)} scale={SPRITE_SCALE}>
            <EditorialRobot role="reviser" busy={!!reviser && running} />
          </Sprite>
        </g>
      ),
    },
    { depth: depthOf(rx, ry) + 1.0, key: "reviser-desk", node: <IsoBox at={[rx - 0.25, ry + 0.2]} size={[1.1, 0.6, 20]} tone="metal" /> },
  );
  if (reviser && running) items.push({ depth: 99, key: "reviser-tag", node: <Tag at={iso(rx, ry, TAG_Z)} text="修订" /> });

  const [gx, gy] = AT.gate;
  items.push({
    depth: depthOf(gx, gy) + 1,
    key: "gate",
    node: (
      <g data-editorial-station="checker" data-busy={checker ? "true" : "false"} data-tone={gateTone(checker)}>
        <title>{checker?.check ? `质检第 ${checker.label} 页：合格 ${checker.check.ok} · 警告 ${checker.check.warn} · 不合格 ${checker.check.error}` : "质检：公式、编号、数字、漏翻、术语"}</title>
        <CheckGate at={AT.gate} tone={gateTone(checker)} />
      </g>
    ),
  });

  const [cx, cy] = AT.cabinet;
  items.push({
    depth: depthOf(cx, cy) + 1.6,
    key: "cabinet",
    node: (
      <g data-editorial-station="archive" data-done={done.length}>
        <title>{`归档：定稿 ${done.length} / ${state.pages.length} 页`}</title>
        <IsoBox at={[cx, cy]} size={[1.0, 0.8, 44]} tone="metal" />
        {filedPile(done).map((sheet, i) => (
          <polygon
            key={i}
            className={`editorial-room-office-paper is-filed${sheet.flagged ? " is-flagged" : ""}`}
            points={flatRect(cx + 0.18, cy + 0.14, 0.62, 0.5, CABINET_TOP_Z + i * PILE_STEP)}
          />
        ))}
      </g>
    ),
  });

  items.push({
    depth: depthOf(AT.basket[0], AT.basket[1]) + 1.6,
    key: "basket",
    node: (
      <g data-editorial-basket={state.basket.length}>
        <title>{`待人看：${state.basket.length} 处，先显示原文`}</title>
        <Basket at={AT.basket} count={state.basket.length} />
      </g>
    ),
  });

  PLANNED_STATIONS.forEach((station, i) => {
    const px = PLANNED_GX[i];
    items.push({
      depth: depthOf(px, PLANNED_GY) + 0.6,
      key: `planned-${station.id}`,
      node: (
        <g data-editorial-planned={station.id}>
          <title>{`筹备中：${station.title}（${station.hint}）`}</title>
          <IsoBox at={[px, PLANNED_GY]} size={[1.2, 0.6, 16]} tone="planned" />
        </g>
      ),
    });
  });

  items.sort((a, b) => a.depth - b.depth);
  const plannedLabel: Point = iso(PLANNED_GX[0] + 0.2, PLANNED_GY - 0.2, 30);
  const sheets = state.pages.filter((card) => SHEET_ROUTE[card.stage]);

  return (
    <svg
      className={`editorial-room-office is-${state.status}`}
      viewBox={`0 0 ${VIEW_W.toFixed(0)} ${VIEW_H.toFixed(0)}`}
      role="img"
      aria-label="翻译编辑部：几位编辑接力翻译这本书"
      data-editorial-office="true"
    >
      <Room />
      <Kanban waiting={waiting.length} />
      <Whiteboard
        version={state.glossary.version}
        tickets={state.tickets.length}
        fresh={glossaryFresh}
        entries={state.glossary.recent}
        writeKey={writeKey}
      />
      <Belt path={BELT} moving={running} />
      {items.filter((item) => item.depth < 99).map((item) => <g key={item.key}>{item.node}</g>)}
      {sheets.map((card) => (
        <Sheet key={`${card.page}-${card.stage}-${card.attempt}`} card={card} />
      ))}
      <OfficeMoments moments={moments} filedCount={done.length} />
      <text className="editorial-room-office-note" x={plannedLabel.x} y={plannedLabel.y}>
        筹备中
      </text>
      {items.filter((item) => item.depth >= 99).map((item) => <g key={item.key}>{item.node}</g>)}
    </svg>
  );
}

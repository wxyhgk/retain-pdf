// 编辑部的车间：工位按稿子的流转顺序排成一条线。
// 调度 → 通读员 → 译者 → 质检 → 审校 → 修订 → 归档。人干的活画小人，程序干的画成机器。
// 每个工位显示：在不在忙、手上是哪一页、一句现在在做什么。

import type { ReactNode } from "react";
import { Archive, ClipboardList, PencilLine } from "lucide-react";

import { genreText } from "../domain/narration.js";
import { stationPages, waitingPages, type PageCard, type RoomState } from "../domain/room-state.js";
import { EditorialFigure } from "./EditorialFigure.jsx";
import { EditorialPageSheet } from "./EditorialPageSheet.jsx";

type StationProps = {
  id: string;
  title: string;
  kind: "ai" | "program";
  busy: boolean;
  note: string;
  visual: ReactNode;
  /** 接不接稿子：调度、归档不接，桌面那格不显示「空着」。 */
  holdsPages?: boolean;
  sheet?: PageCard | null;
};

function Station({ id, title, kind, busy, note, visual, holdsPages = true, sheet }: StationProps) {
  return (
    <li
      className={`editorial-room-station is-${kind}${busy ? " is-busy" : ""}`}
      data-editorial-station={id}
      data-busy={busy ? "true" : "false"}
      {...(sheet ? { "data-editorial-holding": sheet.page } : {})}
    >
      <header className="editorial-room-station-head">
        <strong>{title}</strong>
        <span className="editorial-room-station-kind">{kind === "ai" ? "模型" : "程序"}</span>
      </header>
      <div className="editorial-room-station-visual">{visual}</div>
      <div className="editorial-room-station-desk">
        {sheet ? (
          <EditorialPageSheet key={`${sheet.page}-${sheet.stage}-${sheet.attempt}`} card={sheet} />
        ) : (
          <span className="editorial-room-station-empty">{holdsPages ? "空着" : ""}</span>
        )}
      </div>
      <p className="editorial-room-station-note">{note}</p>
    </li>
  );
}

function Machine({ icon, busy }: { icon: ReactNode; busy: boolean }) {
  return <span className={`editorial-room-machine${busy ? " is-busy" : ""}`}>{icon}</span>;
}

/** 质检的三盏灯：最近一次质检有不合格亮红、有警告亮黄、都合格亮绿。 */
function CheckLamps({ card }: { card: PageCard | null }) {
  const check = card?.check;
  const lit = !check ? "" : check.error > 0 ? "error" : check.warn > 0 ? "warn" : "ok";
  return (
    <span className="editorial-room-lamps" data-editorial-lamp={lit || "off"} aria-hidden="true">
      <span className={`editorial-room-lamp is-ok${lit === "ok" ? " is-lit" : ""}`} />
      <span className={`editorial-room-lamp is-warn${lit === "warn" ? " is-lit" : ""}`} />
      <span className={`editorial-room-lamp is-error${lit === "error" ? " is-lit" : ""}`} />
    </span>
  );
}

function DispatchBoard({ waiting }: { waiting: PageCard[] }) {
  const shown = waiting.slice(0, 6);
  return (
    <span className="editorial-room-kanban">
      <ClipboardList aria-hidden="true" />
      <span className="editorial-room-kanban-tiles">
        {shown.map((card) => (
          <span key={card.page} className="editorial-room-kanban-tile">{card.label}</span>
        ))}
        {waiting.length > shown.length ? <span className="editorial-room-kanban-more">+{waiting.length - shown.length}</span> : null}
      </span>
    </span>
  );
}

function checkNote(card: PageCard | null): string {
  if (!card?.check) return "等稿子";
  const { ok, warn, error } = card.check;
  return `第 ${card.page} 页：合格 ${ok} · 警告 ${warn} · 不合格 ${error}`;
}

export function EditorialFloor({ state }: { state: RoomState }) {
  const at = stationPages(state);
  const waiting = waitingPages(state);
  const running = state.status === "running" || state.status === "reading";
  const started = state.pages.length - waiting.length;
  const done = state.pages.filter((card) => card.stage === "done");

  const dispatchNote =
    state.status === "idle"
      ? "等开工"
      : state.status === "reading"
        ? "等通读完再派"
        : waiting.length
          ? `已派 ${started} / ${state.pages.length} 页`
          : "都派完了";
  const readerNote = state.reading
    ? `${genreText(state.reading.genre)} · 术语 ${state.reading.terms} 条 · 标题 ${state.reading.headings} 个`
    : state.status === "reading"
      ? "通读全书，定体裁、术语和标题"
      : "等开工";
  const translator = at.translator;
  const translatorNote = translator
    ? translator.stage === "retrying"
      ? `第 ${translator.page} 页退回重翻`
      : translator.stage === "queued"
        ? `第 ${translator.page} 页到了，准备开翻`
        : `翻第 ${translator.page} 页${translator.attempt > 1 ? `（第 ${translator.attempt} 次）` : ""}`
    : "等稿子";
  const review = at.reviewer;
  const reviser = at.reviser;

  return (
    <ol className="editorial-room-floor" aria-label="编辑部工位">
      <Station
        id="dispatcher"
        title="调度"
        kind="program"
        busy={running && waiting.length > 0}
        holdsPages={false}
        note={dispatchNote}
        visual={<DispatchBoard waiting={waiting} />}
      />
      <Station
        id="reader"
        title="通读员"
        kind="ai"
        busy={state.status === "reading"}
        holdsPages={false}
        note={readerNote}
        visual={<EditorialFigure role="reader" busy={state.status === "reading"} />}
      />
      <Station
        id="translator"
        title="译者"
        kind="ai"
        busy={!!translator}
        note={translatorNote}
        sheet={translator}
        visual={<EditorialFigure role="translator" busy={!!translator && running} />}
      />
      <Station
        id="checker"
        title="质检"
        kind="program"
        busy={!!at.checker}
        note={checkNote(at.checker)}
        sheet={at.checker}
        visual={<CheckLamps card={at.checker} />}
      />
      <Station
        id="reviewer"
        title="审校"
        kind="ai"
        busy={!!review}
        note={review ? `审第 ${review.page} 页，只开问题单` : "等稿子"}
        sheet={review}
        visual={<EditorialFigure role="reviewer" busy={!!review && running} />}
      />
      <Station
        id="reviser"
        title="修订"
        kind="program"
        busy={!!reviser}
        note={
          reviser?.review
            ? `第 ${reviser.page} 页：改 ${reviser.review.applied} 处 · 没收 ${reviser.review.rejected} 处`
            : "等问题单"
        }
        sheet={reviser}
        visual={<Machine icon={<PencilLine aria-hidden="true" />} busy={!!reviser && running} />}
      />
      <Station
        id="archive"
        title="归档"
        kind="program"
        busy={false}
        holdsPages={false}
        note={`定稿 ${done.length} / ${state.pages.length || 0} 页`}
        visual={
          <span className="editorial-room-shelf">
            <Archive aria-hidden="true" />
            <span className="editorial-room-shelf-pages">
              {done.map((card) => (
                <span key={card.page} className={`editorial-room-shelf-page${card.fallback ? " has-fallback" : ""}`} title={`第 ${card.label} 页`} />
              ))}
            </span>
          </span>
        }
      />
    </ol>
  );
}

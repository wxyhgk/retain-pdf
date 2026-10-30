// 翻译编辑部的用户视图：一眼看懂「几个人在接力翻这本书，翻到第几页了」，不需要读字。
//
// 只画三个有小人的角色：通读 → 译者 → 审校。调度、质检、修订、归档是程序，不画工位，
// 画成稿子在小人之间流动时经过的检查点（质检亮绿黄红，修订在审校之后闪一下）。
// 每个小人旁边最多一个词，细节放在悬停提示里。完整信息见 EditorialRoom（调试视图）。

import { BookMarked, Check, ShieldCheck } from "lucide-react";

import { genreText, stopReasonText } from "../domain/narration.js";
import { roomTotals, stationPages, type PageCard, type RoomState } from "../domain/room-state.js";
import { EditorialFigure, type FigureRole } from "./EditorialFigure.jsx";

/** 术语表改动后，「术语表已更新」的轻提示留几条事件。 */
const GLOSSARY_HINT_EVENTS = 3;

type Seat = {
  role: FigureRole;
  name: string;
  busy: boolean;
  word: string;
  hint: string;
  sheet: PageCard | null;
};

function SeatView({ seat, moving }: { seat: Seat; moving: boolean }) {
  return (
    <li
      className={`editorial-room-stage-seat${seat.busy ? " is-busy" : ""}`}
      data-editorial-seat={seat.role}
      data-busy={seat.busy ? "true" : "false"}
      title={seat.hint}
    >
      <span className="editorial-room-stage-figure">
        <EditorialFigure role={seat.role} busy={seat.busy && moving} />
        {seat.sheet ? (
          <span
            key={`${seat.sheet.page}-${seat.sheet.stage}-${seat.sheet.attempt}`}
            className={`editorial-room-stage-sheet is-${seat.sheet.stage}`}
            data-editorial-page={seat.sheet.page}
          >
            {seat.sheet.label}
          </span>
        ) : null}
      </span>
      <span className="editorial-room-stage-word">{seat.word}</span>
    </li>
  );
}

function Checkpoint({ kind, card }: { kind: "check" | "revise"; card: PageCard | null }) {
  const check = card?.check;
  const tone = !card ? "off" : kind === "revise" ? "on" : !check ? "on" : check.error ? "error" : check.warn ? "warn" : "ok";
  const hint = !card
    ? kind === "check" ? "质检" : "修订"
    : kind === "check" && check
      ? `质检第 ${card.page} 页：合格 ${check.ok} · 警告 ${check.warn} · 不合格 ${check.error}`
      : `修订第 ${card.page} 页`;
  return (
    <li className={`editorial-room-stage-path is-${tone}`} data-editorial-checkpoint={kind} data-tone={tone} title={hint}>
      <span className="editorial-room-stage-dot" aria-hidden="true">
        {kind === "check" ? <ShieldCheck /> : <Check />}
      </span>
    </li>
  );
}

function nowText(state: RoomState, seats: Seat[]): string {
  if (state.status === "idle") return "还没开工";
  if (state.status === "stopped") return stopReasonText(state.stopReason);
  if (state.status === "done") return "全部翻完了";
  if (state.status === "reading") return "通读员在读全书";
  const busy = seats.filter((seat) => seat.busy && seat.role !== "reader").map((seat) => `${seat.name}${seat.word}`);
  return busy.length ? busy.join("，") : "稿子在检查";
}

export function EditorialStage({ state }: { state: RoomState }) {
  const at = stationPages(state);
  const totals = roomTotals(state);
  const running = state.status === "running" || state.status === "reading";
  const pages = state.pages.length;
  const current = Math.min(pages, totals.donePages + (running && totals.donePages < pages ? 1 : 0));
  const translator = at.translator;
  const reviewer = at.reviewer;
  const reading = state.reading;

  const seats: Seat[] = [
    {
      role: "reader",
      name: "通读员",
      busy: state.status === "reading",
      word: state.status === "reading" ? "读书中" : "通读",
      hint: reading
        ? `通读完：${genreText(reading.genre)} · 术语 ${reading.terms} 条 · 标题 ${reading.headings} 个`
        : "通读员：开翻前把全书读一遍",
      sheet: null,
    },
    {
      role: "translator",
      name: "译者",
      busy: !!translator,
      word: translator ? (translator.stage === "retrying" ? `重翻第 ${translator.label} 页` : `翻译第 ${translator.label} 页`) : "译者",
      hint: translator
        ? `译者：第 ${translator.label} 页，第 ${Math.max(1, translator.attempt)} 次 · ${translator.blocks} 块`
        : "译者：一次翻一整页",
      sheet: translator,
    },
    {
      role: "reviewer",
      name: "审校",
      busy: !!reviewer,
      word: reviewer ? `审第 ${reviewer.label} 页` : "审校",
      hint: reviewer ? `审校：第 ${reviewer.label} 页 · ${reviewer.blocks} 块` : "审校：每页翻完审一遍",
      sheet: reviewer,
    },
  ];
  const glossaryFresh = state.glossary.changedAt > 0 && state.seq - state.glossary.changedAt < GLOSSARY_HINT_EVENTS;

  return (
    <section
      className={`editorial-room-stage is-${state.status}`}
      aria-label="翻译编辑部"
      data-editorial-stage="true"
      data-editorial-status={state.status}
    >
      <header className="editorial-room-stage-head">
        <strong className="editorial-room-stage-title">{state.docTitle ? `《${state.docTitle}》` : "翻译编辑部"}</strong>
        <span className="editorial-room-stage-count" data-editorial-progress={`${current}/${pages}`}>
          第 {current} / {pages} 页
        </span>
      </header>
      <span
        className="editorial-room-stage-progress"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={pages}
        aria-valuenow={totals.donePages}
        aria-label="已定稿的页数"
      >
        <span style={{ width: `${pages ? (totals.donePages / pages) * 100 : 0}%` }} />
      </span>
      <ol className="editorial-room-stage-line">
        <SeatView seat={seats[0]} moving={running} />
        <li className="editorial-room-stage-path is-plain" aria-hidden="true" />
        <SeatView seat={seats[1]} moving={running} />
        <Checkpoint kind="check" card={at.checker} />
        <SeatView seat={seats[2]} moving={running} />
        <Checkpoint kind="revise" card={at.reviser} />
        <li className="editorial-room-stage-pile" title={`已定稿 ${totals.donePages} 页`} aria-label={`已定稿 ${totals.donePages} 页`}>
          {state.pages
            .filter((card) => card.stage === "done")
            .map((card) => (
              <span key={card.page} className="editorial-room-stage-pile-page" />
            ))}
        </li>
      </ol>
      <footer className="editorial-room-stage-foot">
        <span className={`editorial-room-stage-now is-${state.status}`} aria-live="polite" data-editorial-now="true">
          {nowText(state, seats)}
        </span>
        {glossaryFresh ? (
          <span key={state.glossary.version} className="editorial-room-stage-chip" data-editorial-glossary-hint="true">
            <BookMarked aria-hidden="true" />
            术语表已更新
          </span>
        ) : null}
        {totals.fallback > 0 ? (
          <span className="editorial-room-stage-chip is-attention" data-editorial-attention={totals.fallback} title="重翻还不合格的地方先显示原文，等你看">
            需要人看 {totals.fallback} 处
          </span>
        ) : null}
      </footer>
    </section>
  );
}

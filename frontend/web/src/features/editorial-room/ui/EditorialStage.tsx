// 翻译编辑部的用户视图：一眼看懂「几位编辑在接力翻这本书，翻到第几页了」，不需要读字。
//
// 上面书名和进度，中间是 2.5D 的编辑部全景（office/EditorialOffice），底下一行「正在……」，
// 术语表改了、有块退回原文时各出一句轻提示。细节都在悬停提示里；完整信息见 EditorialRoom（调试视图）。

import { BookMarked } from "lucide-react";

import { stopReasonText } from "../domain/narration.js";
import { roomTotals, stationPages, type RoomState } from "../domain/room-state.js";
import { EditorialOffice } from "./office/EditorialOffice.jsx";

/** 术语表改动后，「术语表已更新」的轻提示留几条事件。 */
const GLOSSARY_HINT_EVENTS = 3;

function nowText(state: RoomState): string {
  if (state.status === "idle") return "还没开工";
  if (state.status === "stopped") return stopReasonText(state.stopReason);
  if (state.status === "done") return "全部翻完了";
  if (state.status === "reading") return "通读员在读全书";
  const { translator, reviewer, reviser } = stationPages(state);
  const busy = [
    translator ? `译者${translator.stage === "retrying" ? "重翻" : "翻译"}第 ${translator.label} 页` : "",
    reviewer ? `审校审第 ${reviewer.label} 页` : "",
    reviser ? `修订在改第 ${reviser.label} 页` : "",
  ].filter(Boolean);
  return busy.length ? busy.join("，") : "稿子在检查";
}

export function EditorialStage({ state }: { state: RoomState }) {
  const totals = roomTotals(state);
  const running = state.status === "running" || state.status === "reading";
  const pages = state.pages.length;
  const current = Math.min(pages, totals.donePages + (running && totals.donePages < pages ? 1 : 0));
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
      <EditorialOffice state={state} glossaryFresh={glossaryFresh} />
      <footer className="editorial-room-stage-foot">
        <span className={`editorial-room-stage-now is-${state.status}`} aria-live="polite" data-editorial-now="true">
          {nowText(state)}
        </span>
        {glossaryFresh ? (
          <span key={state.glossary.version} className="editorial-room-stage-chip" data-editorial-glossary-hint="true">
            <BookMarked aria-hidden="true" />
            术语表已更新
          </span>
        ) : null}
        {totals.fallback > 0 ? (
          <span
            className="editorial-room-stage-chip is-attention"
            data-editorial-attention={totals.fallback}
            title="重翻还不合格的地方先显示原文，等你看"
          >
            需要人看 {totals.fallback} 处
          </span>
        ) : null}
      </footer>
    </section>
  );
}

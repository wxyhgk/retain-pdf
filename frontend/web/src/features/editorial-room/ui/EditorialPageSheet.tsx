// 一页稿子：工位手上那张纸。页码、第几次翻、质检的绿黄红条、有没有块进了「待人看」筐。
// 换了工位或换了阶段就重新挂载（key 带 stage），播一次滑进来的动画。

import type { PageCard, PageStage } from "../domain/room-state.js";

export const STAGE_TEXT: Record<PageStage, string> = {
  waiting: "待派",
  queued: "已派",
  translating: "翻译中",
  checking: "质检",
  retrying: "退回重翻",
  reviewing: "审校中",
  revising: "修订中",
  done: "定稿",
};

function CheckBar({ card }: { card: PageCard }) {
  const check = card.check;
  if (!check) return <span className="editorial-room-sheet-lines" aria-hidden="true" />;
  const total = Math.max(1, check.ok + check.warn + check.error + (card.stage === "done" ? card.fallback : 0));
  const part = (n: number) => `${(n / total) * 100}%`;
  return (
    <span
      className="editorial-room-sheet-bar"
      role="img"
      aria-label={`合格 ${check.ok}，警告 ${check.warn}，不合格 ${check.error}`}
    >
      <span className="editorial-room-sheet-bar-ok" style={{ width: part(check.ok) }} />
      <span className="editorial-room-sheet-bar-warn" style={{ width: part(check.warn) }} />
      <span className="editorial-room-sheet-bar-error" style={{ width: part(check.error) }} />
      {card.stage === "done" ? <span className="editorial-room-sheet-bar-source" style={{ width: part(card.fallback) }} /> : null}
    </span>
  );
}

export function EditorialPageSheet({ card, compact = false }: { card: PageCard; compact?: boolean }) {
  return (
    <span
      className={`editorial-room-sheet is-${card.stage}${compact ? " is-compact" : ""}${card.fallback ? " has-fallback" : ""}`}
      data-editorial-page={card.page}
      data-editorial-stage={card.stage}
    >
      <span className="editorial-room-sheet-head">
        <strong>第 {card.label} 页</strong>
        {card.attempt > 1 ? <span className="editorial-room-sheet-attempt">第 {card.attempt} 次</span> : null}
      </span>
      {compact ? null : <CheckBar card={card} />}
      <span className="editorial-room-sheet-stage">
        {STAGE_TEXT[card.stage]}
        {card.blocks ? ` · ${card.blocks} 块` : ""}
      </span>
    </span>
  );
}

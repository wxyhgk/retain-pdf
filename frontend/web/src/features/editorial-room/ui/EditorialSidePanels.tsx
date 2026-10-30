// 车间旁边的三样东西：术语表白板（带版本号、最近几次改动、歧义单）、「待人看」筐、筹备中的工位。

import { Construction, Inbox, Presentation } from "lucide-react";

import { checkCodeText, glossaryActionText } from "../domain/narration.js";
import type { RoomState } from "../domain/room-state.js";

/** 以后会有的工位：先占位画成灰色。 */
export const PLANNED_STATIONS = [
  { id: "toc", title: "目录 agent", hint: "按原书目录对齐标题" },
  { id: "reflow", title: "重排 agent", hint: "把译文排进原来的框，放不下要求译者改短" },
  { id: "table", title: "表格 agent", hint: "表格单独翻、对齐行列" },
  { id: "source-check", title: "原文核对员", hint: "对着原文查漏译、错译" },
  { id: "consistency", title: "一致性检查员", hint: "全书前后说法一致" },
] as const;

export function GlossaryBoard({ state }: { state: RoomState }) {
  const { glossary, tickets } = state;
  return (
    <section
      className="editorial-room-board"
      aria-label="术语表"
      data-editorial-glossary-version={glossary.version}
    >
      <header className="editorial-room-panel-head">
        <Presentation aria-hidden="true" />
        <strong>术语表</strong>
        <span key={glossary.version} className="editorial-room-board-version">
          第 {glossary.version} 版
        </span>
      </header>
      {glossary.recent.length ? (
        <ul className="editorial-room-board-terms">
          {glossary.recent.map((entry, index) => (
            <li key={`${entry.version}-${entry.source}-${index}`} className={index === 0 ? "is-fresh" : ""}>
              <span className="editorial-room-board-source">{entry.source}</span>
              <span className="editorial-room-board-arrow" aria-hidden="true">→</span>
              <span className="editorial-room-board-target">{entry.target}</span>
              <span className="editorial-room-board-action">{glossaryActionText(entry.action)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="editorial-room-panel-empty">通读时定下的译法会写在这里</p>
      )}
      {tickets.length ? (
        <ul className="editorial-room-tickets" aria-label="歧义单">
          {tickets.map((ticket, index) => (
            <li key={`${ticket.term}-${index}`} className="editorial-room-ticket" data-editorial-ticket={ticket.term}>
              <strong>{ticket.term}</strong>
              <span>
                「{ticket.current}」还是「{ticket.proposed}」
              </span>
              <span className="editorial-room-ticket-page">第 {ticket.page} 页</span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

export function FallbackBasket({ state }: { state: RoomState }) {
  const { basket } = state;
  return (
    <section className="editorial-room-basket" aria-label="待人看" data-editorial-basket={basket.length}>
      <header className="editorial-room-panel-head">
        <Inbox aria-hidden="true" />
        <strong>待人看</strong>
        <span className="editorial-room-basket-count">{basket.length}</span>
      </header>
      {basket.length ? (
        <ul className="editorial-room-basket-items">
          {basket.map((item, index) => (
            <li key={`${item.page}-${item.block}-${index}`}>
              <span className="editorial-room-basket-block">{item.block}</span>
              <span>第 {item.page} 页 · {checkCodeText(item.reason)}，先显示原文</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="editorial-room-panel-empty">重翻还不合格的块会放进来，先显示原文</p>
      )}
    </section>
  );
}

export function PlannedStations() {
  return (
    <section className="editorial-room-planned" aria-label="筹备中的工位">
      <header className="editorial-room-panel-head">
        <Construction aria-hidden="true" />
        <strong>筹备中</strong>
      </header>
      <ul>
        {PLANNED_STATIONS.map((station) => (
          <li key={station.id} className="editorial-room-planned-item" data-editorial-planned={station.id} title={station.hint}>
            <strong>{station.title}</strong>
            <span>{station.hint}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

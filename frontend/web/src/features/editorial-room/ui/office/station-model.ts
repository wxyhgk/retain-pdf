// 2.5D 编辑部：状态 → 每个工位此刻显示什么（忙不忙、动不动、头顶一个词、悬停一句话）。纯函数，不碰 React。
// 画面那边（stations.tsx）只按这里给的数去画，角色、家具不读 RoomState。

import { genreText, reviewWithdrawnText } from "../../domain/narration.js";
import { stationPages, waitingPages, type PageCard, type RoomState } from "../../domain/room-state.js";

export type StationId = "dispatcher" | "reader" | "translator" | "checker" | "reviewer" | "reviser" | "archive";

export type StationView = {
  /** 手上有活（亮起来、头顶出牌子）。 */
  busy: boolean;
  /** 在动（任务在跑才动；停下、跑完时有活也定格）。 */
  moving: boolean;
  /** 头顶一个词；空串不出牌子。 */
  tag: string;
  /** 悬停的一句话。 */
  hint: string;
  /** 手上是哪一页（页码标签）；没有是空串。 */
  holding: string;
};

/** 质检闸门的灯：没活灭，有活没结果亮蓝，有结果按最差的那级。 */
export type GateTone = "off" | "on" | "ok" | "warn" | "error";

export type OfficeModel = {
  running: boolean;
  stations: Record<StationId, StationView>;
  gate: GateTone;
  waiting: number;
  /** 定稿的页（档案柜纸堆、定稿动作用）。 */
  done: PageCard[];
};

const view = (busy: boolean, moving: boolean, tag: string, hint: string, holding = ""): StationView => ({
  busy,
  moving: busy && moving,
  tag: busy ? tag : "",
  hint,
  holding,
});

export const gateTone = (card: PageCard | null): GateTone =>
  !card?.check ? (card ? "on" : "off") : card.check.error ? "error" : card.check.warn ? "warn" : "ok";

export function officeModel(state: RoomState): OfficeModel {
  const { translator, reviewer, reviser, checker } = stationPages(state);
  const running = state.status === "running" || state.status === "reading";
  const waiting = waitingPages(state);
  const done = state.pages.filter((card) => card.stage === "done");
  const reading = state.reading;
  const dispatching = running && waiting.length > 0;

  return {
    running,
    gate: gateTone(checker),
    waiting: waiting.length,
    done,
    stations: {
      dispatcher: view(dispatching, state.status === "running", "", `调度：还有 ${waiting.length} 页没派`),
      reader: view(
        state.status === "reading",
        running,
        "读书中",
        reading
          ? `通读员：${genreText(reading.genre)} · 术语 ${reading.terms} 条 · 标题 ${reading.headings} 个`
          : "通读员：开翻前把全书读一遍",
      ),
      translator: view(
        !!translator,
        running,
        translator ? `${translator.stage === "retrying" ? "重翻" : "翻译"}第 ${translator.label} 页` : "",
        translator ? `译者：第 ${translator.label} 页，第 ${Math.max(1, translator.attempt)} 次 · ${translator.blocks} 块` : "译者：一次翻一整页",
        translator?.label,
      ),
      checker: view(
        !!checker,
        running,
        "",
        checker?.check
          ? `质检第 ${checker.label} 页：合格 ${checker.check.ok} · 警告 ${checker.check.warn} · 不合格 ${checker.check.error}`
          : "质检：公式、编号、数字、漏翻、术语",
        checker?.label,
      ),
      reviewer: view(
        !!reviewer,
        running,
        reviewer ? `审第 ${reviewer.label} 页` : "",
        reviewer ? `审校：第 ${reviewer.label} 页 · ${reviewer.blocks} 块` : "审校：每页翻完审一遍，只开问题单",
        reviewer?.label,
      ),
      reviser: view(
        !!reviser,
        running,
        "修订",
        reviser?.review
          ? `修订第 ${reviser.label} 页：改 ${reviser.review.applied} 处，没收 ${reviser.review.rejected} 处${reviewWithdrawnText(reviser.review.withdrawn)}`
          : "修订：按问题单改那一小段",
        reviser?.label,
      ),
      archive: view(false, false, "", `归档：定稿 ${done.length} / ${state.pages.length} 页`),
    },
  };
}

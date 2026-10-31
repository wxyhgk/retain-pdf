// 「进度」页的状态行：一句标题（「翻译中」「翻译失败」「已停止」「已完成」），右边是这一刻能做的事（tools，由页签按状态给）；
// 下面是 HUD 面板（ProcessingHud：进度环、耗时、模型、token），再下面页码行、提醒和报错。
//
// 这一页的按钮只在这里：以前「取消任务 / 详情」在一张状态卡上，「从断点继续 / 查看日志」在失败卡上，
// 「翻译整本 / 开始 OCR」在页面最下面，三处各说各的。状态图标、进度、页数、用时、模型、token 以前是标题旁边的
// 图标和一行小字，现在在 HUD 里。
//
// 契约：标题带 data-processing-unified-status；「N 个内容块没能翻译出来」的提醒是 .book-detail-processing-warning。

import type { ReactNode } from "react";
import { TriangleAlert } from "lucide-react";

export type ProcessingHeaderTone = "active" | "done" | "warn" | "failed" | "stopped" | "idle";

export type ProcessingHeaderProps = {
  headline: string;
  tone: ProcessingHeaderTone;
  /** 首帧还不知道任务情况：只占位，不下结论。 */
  bootstrapping?: boolean;
  keptOriginBlocks?: number;
  tools?: ReactNode;
  /** HUD 面板。 */
  hud?: ReactNode;
  /** 状态行下面紧跟的一块（指定页码、报错）。 */
  children?: ReactNode;
};

export function ProcessingHeader({
  headline,
  tone,
  bootstrapping = false,
  keptOriginBlocks = 0,
  tools = null,
  hud = null,
  children = null,
}: ProcessingHeaderProps) {
  const shownTone: ProcessingHeaderTone = bootstrapping ? "idle" : tone;
  return (
    <>
      <header className="book-detail-processing-head" data-tone={shownTone}>
        <p className="book-detail-processing-head-title">
          <span className="book-detail-processing-unified-status" data-processing-unified-status="true">
            {bootstrapping ? "正在读取处理状态…" : headline}
          </span>
        </p>
        {tools ? <div className="book-detail-processing-tools">{tools}</div> : null}
      </header>

      {hud}

      {children}

      {!bootstrapping && tone !== "active" && keptOriginBlocks > 0 ? (
        <p className="book-detail-processing-warning" role="note" data-kept-origin-blocks={keptOriginBlocks}>
          <TriangleAlert aria-hidden="true" />
          {`${keptOriginBlocks} 个内容块没能翻译出来，重新翻译可以补齐`}
        </p>
      ) : null}
    </>
  );
}

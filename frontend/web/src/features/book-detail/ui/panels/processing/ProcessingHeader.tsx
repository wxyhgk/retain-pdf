// 「进度」页的状态行：左边一个状态图标、一句标题、一行带图标的小字（用时、批次、停在哪站、翻了几页），
// 右边是这一刻能做的事（tools，由页签按状态给）；下面一条进度条，失败时变红、停在出错的位置。
//
// 这一页的按钮只在这里：以前「取消任务 / 详情」在一张状态卡上，「从断点继续 / 查看日志」在失败卡上，
// 「翻译整本 / 开始 OCR」在页面最下面，三处各说各的。
//
// 契约：标题带 data-processing-unified-status，小字带 data-processing-facts；
// 「N 个内容块没能翻译出来」的提醒是 .book-detail-processing-warning。

import type { ReactNode } from "react";
import {
  Check,
  CircleAlert,
  Clock3,
  Coins,
  Cpu,
  FileText,
  History,
  Languages,
  Layers,
  LoaderCircle,
  Pause,
  Recycle,
  TriangleAlert,
} from "lucide-react";

export type ProcessingHeaderTone = "active" | "done" | "warn" | "failed" | "stopped" | "idle";

/** 小字一项：图标按 kind 选，画面上只留短字（「12 分」「4 / 6 页」），整句放在悬停里（title）。 */
export type ProcessingHeaderFact = {
  key: string;
  text: string;
  title?: string;
  kind?: "time" | "count" | "stopped" | "pages" | "merged" | "when" | "model" | "reuse" | "tokens";
};

export type ProcessingHeaderProps = {
  headline: string;
  tone: ProcessingHeaderTone;
  /** 进行中的百分比；没有就不画数字。 */
  percent?: number | null;
  /** 进度条宽度：在跑时是 percent，失败 / 停下时停在原处；null 不画条。 */
  bar?: number | null;
  /** 首帧还不知道任务情况：只占位，不下结论。 */
  bootstrapping?: boolean;
  facts?: ProcessingHeaderFact[];
  keptOriginBlocks?: number;
  tools?: ReactNode;
  /** 状态行下面紧跟的一块（指定页码、报错）。 */
  children?: ReactNode;
};

function ToneIcon({ tone }: { tone: ProcessingHeaderTone }) {
  if (tone === "active") return <LoaderCircle className="animate-spin" />;
  if (tone === "done") return <Check />;
  if (tone === "warn") return <TriangleAlert />;
  if (tone === "failed") return <CircleAlert />;
  if (tone === "stopped") return <Pause />;
  return <Languages />;
}

const FACT_ICON = {
  time: Clock3,
  count: Layers,
  stopped: Pause,
  pages: FileText,
  merged: Layers,
  when: History,
  model: Cpu,
  reuse: Recycle,
  tokens: Coins,
} as const;

/** 覆盖接口给的是成句的字（「已翻译 4 / 6 页」「最近 10/31 11:52」）：认出是哪一类，画面上去掉图标已经说了的那几个字，
 *  整句留在悬停里。 */
export function coverageFact(text: string): ProcessingHeaderFact {
  const all = /^已翻译全部\s*(\d+)\s*页$/.exec(text);
  if (all) return { key: text, kind: "pages", text: `${all[1]} / ${all[1]} 页`, title: text };
  if (text.startsWith("已翻译")) return { key: text, kind: "pages", text: text.replace(/^已翻译\s*/, ""), title: text };
  const merged = /^由\s*(\d+)\s*次翻译拼成$/.exec(text);
  if (merged) return { key: text, kind: "merged", text: `${merged[1]} 次`, title: text };
  if (text.startsWith("最近")) return { key: text, kind: "when", text: text.replace(/^最近\s*/, ""), title: `最近一次翻译 ${text.replace(/^最近\s*/, "")}` };
  if (text.startsWith("用时")) return { key: text, kind: "time", text: text.replace(/^用时\s*/, ""), title: text };
  return { key: text, kind: "model", text, title: `模型 ${text}` };
}

export function ProcessingHeader({
  headline,
  tone,
  percent = null,
  bar = null,
  bootstrapping = false,
  facts = [],
  keptOriginBlocks = 0,
  tools = null,
  children = null,
}: ProcessingHeaderProps) {
  const shownTone: ProcessingHeaderTone = bootstrapping ? "idle" : tone;
  const barWidth = bootstrapping ? null : bar;
  return (
    <>
      <header className="book-detail-processing-head" data-tone={shownTone}>
        <span className="book-detail-processing-head-icon" aria-hidden="true">
          <ToneIcon tone={shownTone} />
        </span>
        <div className="book-detail-processing-head-copy">
          <p className="book-detail-processing-head-title">
            <span className="book-detail-processing-unified-status" data-processing-unified-status="true">
              {bootstrapping ? "正在读取处理状态…" : headline}
            </span>
            {!bootstrapping && percent !== null ? (
              <span className="book-detail-processing-head-percent">{`${Math.round(percent)}%`}</span>
            ) : null}
          </p>
          {!bootstrapping && facts.length ? (
            <p className="book-detail-processing-facts" data-processing-facts="true">
              {facts.map((fact) => {
                const Icon = FACT_ICON[fact.kind || "model"];
                return (
                  <span
                    key={fact.key}
                    className="book-detail-processing-fact"
                    data-fact={fact.kind || "model"}
                    title={fact.title || undefined}
                    {...(fact.kind === "reuse" ? { "data-ocr-reuse": "true" } : {})}
                  >
                    <Icon aria-hidden="true" />
                    {fact.title ? <span className="sr-only">{fact.title}</span> : null}
                    <span aria-hidden={fact.title ? true : undefined}>{fact.text}</span>
                  </span>
                );
              })}
            </p>
          ) : null}
        </div>
        {tools ? <div className="book-detail-processing-tools">{tools}</div> : null}
      </header>

      {/* 首帧未知时留一条空轨占位：进度条稍后可能出现，先占好位置避免跳变。 */}
      {bootstrapping ? (
        <div className="book-detail-processing-progress" aria-hidden="true" />
      ) : barWidth !== null ? (
        <div
          className="book-detail-processing-progress"
          data-tone={shownTone}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(barWidth)}
          aria-label="处理进度"
        >
          <div className="book-detail-processing-progress-fill" style={{ width: `${barWidth}%` }} />
        </div>
      ) : null}

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

// 「进度」页的 HUD 条：一行排开——小进度环（中间状态图标）+ 页数 / 进度，总耗时，模型（标志 + 名字），token 合计。
// 画面上只有图标和数，名字和整句在悬停与读屏里；算不出来的项不出（processingHudModel 给 null）。
// 各站分开的耗时、翻译站用的模型和 token 挂在流水线各站下面（stationChips），这里只放总数。
// 以前这是四张大卡，进度环、分段条各占一块，太占地方。

import type { CSSProperties } from "react";
import {
  Check,
  Coins,
  Languages,
  LoaderCircle,
  Pause,
  Recycle,
  Timer,
  TriangleAlert,
  X,
} from "lucide-react";

import type { ProcessingHudModel } from "../../tabs/processing-hud-model.js";
import type { ProcessingHeaderTone } from "./ProcessingHeader.jsx";

function ToneIcon({ tone }: { tone: ProcessingHeaderTone }) {
  if (tone === "active") return <LoaderCircle className="animate-spin" aria-hidden="true" />;
  if (tone === "done") return <Check aria-hidden="true" />;
  if (tone === "warn") return <TriangleAlert aria-hidden="true" />;
  if (tone === "failed") return <X aria-hidden="true" />;
  if (tone === "stopped") return <Pause aria-hidden="true" />;
  return <Languages aria-hidden="true" />;
}

const RING = 2 * Math.PI * 15;

export function ProcessingHud({
  model,
  bootstrapping = false,
  ocrReuse = false,
}: {
  model: ProcessingHudModel;
  bootstrapping?: boolean;
  /** 还没翻译、但已有 OCR 可以复用：一个小标。 */
  ocrReuse?: boolean;
}) {
  const { gauge, time, tokens } = model;
  const tone: ProcessingHeaderTone = bootstrapping ? "idle" : gauge.tone;
  return (
    <div className="book-detail-hud" data-processing-hud="true" data-tone={tone}>
      <span className="book-detail-hud-item book-detail-hud-gauge" title={bootstrapping ? undefined : gauge.title} data-hud="gauge">
        <span className="book-detail-hud-ring">
          <svg viewBox="0 0 36 36" aria-hidden="true">
            <circle className="book-detail-hud-ring-track" cx="18" cy="18" r="15" />
            <circle
              className="book-detail-hud-ring-fill"
              cx="18"
              cy="18"
              r="15"
              style={{ strokeDasharray: `${(bootstrapping ? 0 : gauge.value) * RING} ${RING}` } as CSSProperties}
            />
          </svg>
          <span className="book-detail-hud-ring-icon"><ToneIcon tone={tone} /></span>
        </span>
        <span className="sr-only">{bootstrapping ? "正在读取" : gauge.title}</span>
        <span className="book-detail-hud-num" aria-hidden="true">{bootstrapping ? "…" : gauge.text}</span>
      </span>

      {ocrReuse && !bootstrapping ? (
        <span className="book-detail-hud-item" data-ocr-reuse="true" title="复用已有 OCR">
          <Recycle aria-hidden="true" />
          <span className="sr-only">复用已有 OCR</span>
        </span>
      ) : null}

      {time && !bootstrapping ? (
        <span className="book-detail-hud-item" title={time.title} data-hud="time">
          <Timer aria-hidden="true" />
          <span className="sr-only">{time.title}</span>
          <span className="book-detail-hud-num" aria-hidden="true">{time.text}</span>
        </span>
      ) : null}

      {model.model && !bootstrapping ? (
        <span className="book-detail-hud-item book-detail-hud-model" title={model.model.title} data-hud="model">
          {model.model.logo ? <img src={model.model.logo} alt="" aria-hidden="true" /> : null}
          <span className="sr-only">{model.model.title}</span>
          <span className="book-detail-hud-model-name" aria-hidden="true">{model.model.name}</span>
          {model.model.agent ? <span className="book-detail-hud-badge" aria-hidden="true">agent</span> : null}
        </span>
      ) : null}

      {tokens && !bootstrapping ? (
        <span className="book-detail-hud-item" title={tokens.title} data-hud="tokens">
          <Coins aria-hidden="true" />
          <span className="sr-only">{tokens.title}</span>
          <span className="book-detail-hud-num" aria-hidden="true">{tokens.text}</span>
        </span>
      ) : null}
    </div>
  );
}

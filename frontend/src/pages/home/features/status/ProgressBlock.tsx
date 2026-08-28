// Khối tiến trình (bản thiết kế §2 features/status/, phản chiếu
// renderProgressComponents/renderProgressModel của job-status-card-progress-renderer.js
// — giữ nguyên hợp đồng DOM theo id/class/biến CSS (rủi ro bản thiết kế §8.7:
// --status-ring-percent, --status-progress-percent, data-value, aria-valuenow).
// renderOptions lấy từ useStagedProgressAnimation; component này chỉ render
// khai báo và không giữ trạng thái hoạt ảnh.

import type { CSSProperties } from "react";
import { buildProgressRenderModel, type ProgressRenderModelInput } from "./progress-model.js";
import { useStatusCardIds } from "./status-card-ids-context.js";

function roundPercent(percent: number) {
  const numeric = Number(percent);
  return Math.round(Math.max(0, Math.min(100, Number.isFinite(numeric) ? numeric : 0)));
}

type ProgressBlockProps = {
  renderOptions?: ProgressRenderModelInput | null;
};

export function ProgressBlock({ renderOptions }: ProgressBlockProps) {
  const ids = useStatusCardIds();
  const model = buildProgressRenderModel(renderOptions || {});
  const {
    visible,
    percent = 0,
    text = "",
    componentText = "-",
    indeterminate = false,
    legacyIndeterminate = false,
  } = model || {};
  const rounded = roundPercent(percent);
  const ringText = indeterminate ? "..." : `${rounded}%`;
  const ringMetaText = componentText || (indeterminate ? "Đang xử lý" : `${rounded}%`);
  const footPercentText = indeterminate ? "Đang xử lý" : `${rounded}%`;

  return (
    <>
      <div className={`status-progress-block${visible ? "" : " hidden"}`}>
        <div
          id={ids.progressBar}
          className={`status-progress-bar${indeterminate ? " is-indeterminate" : ""}`}
          role="progressbar"
          aria-label="Tiến trình tác vụ"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={visible ? percent : 0}
          data-value={visible ? percent : 0}
          style={{ ["--status-progress-percent"]: `${visible ? percent : 0}%` } as CSSProperties}
        >
          <div className="status-progress-bar-fill" />
        </div>
        <div className="progress-track hidden">
          <div
            id={ids.legacyProgressBar}
            className={`progress-bar${visible && legacyIndeterminate ? " is-indeterminate" : ""}`}
            style={{ width: visible ? `${percent}%` : "0%" }}
          />
        </div>
        <div className="status-progress-foot">
          <span id={ids.progressText} className="status-progress-text">{visible ? text : ""}</span>
          <span id={ids.progressPercent} className="status-progress-percent">{footPercentText}</span>
        </div>
      </div>
       <div className="status-progress-ring-wrap" aria-label="Tiến độ tác vụ (phần trăm)">
        <div
          id={ids.progressRing}
          className={`status-progress-ring${indeterminate ? " is-indeterminate" : ""}`}
          role="progressbar"
          aria-label="Tiến độ tác vụ"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          data-value={percent}
          style={{ ["--status-ring-percent"]: `${indeterminate ? 42 : percent}%` } as CSSProperties}
        >
          <span className="status-progress-ring-text">{ringText}</span>
        </div>
        <div id={ids.progressRingMeta} className="status-animation-meta">{ringMetaText}</div>
      </div>
    </>
  );
}

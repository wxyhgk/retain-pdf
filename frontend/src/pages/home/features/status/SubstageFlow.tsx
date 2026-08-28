// Thanh quy trình giai đoạn con (bản thiết kế §2 features/status/; nguồn dữ
// liệu buildSubstageViewModel là VM thuần của job-status/substage-view-model.js,
// import nguyên trạng — phản chiếu cấu trúc DOM syncStageSubstageStates của
// job-status-card-substages.js, giữ hợp đồng biến CSS --status-substage-count).

import type { StatusCardSnapshot, StatusCardStageProgress } from "./status-card-store.js";
import type { CSSProperties } from "react";
import { buildSubstageViewModel } from "../../composition/external.js";

type SubstageFlowProps = {
  selectedStageKey?: string;
  selectedIsCurrent?: boolean;
  snapshot?: StatusCardSnapshot | null;
  selectedProgress?: StatusCardStageProgress | null;
};

export function SubstageFlow({ selectedStageKey, selectedIsCurrent, snapshot, selectedProgress }: SubstageFlowProps) {
  const viewModel = buildSubstageViewModel({ selectedStageKey, selectedIsCurrent, snapshot, selectedProgress });

  return (
    <div
      className={`status-substage-flow${viewModel.hidden ? " hidden" : ""}`}
       aria-label="Giai đoạn con của tác vụ"
      style={{ ["--status-substage-count"]: `${viewModel.cssCount}` } as CSSProperties}
    >
      {viewModel.items.map((item) => (
        <span
          key={item.key}
          className={`status-substage-step${item.active ? " is-active" : ""}${item.done ? " is-done" : ""}`}
          data-substage-key={item.key}
        >
          {item.label}
        </span>
      ))}
    </div>
  );
}

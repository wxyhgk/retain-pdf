// Gỡ lỗi dịch: lọc trạng thái + nhập tìm kiếm (trạng thái bản nháp được kiểm soát, chỉ
// khi bấm "Làm mới" hoặc Enter mới gửi applyTranslationFilter — ánh ngữ nghĩa thế giới
// cũ readTranslationFilterQuery chỉ đọc biểu mẫu một lần khi gửi, không phải mỗi phím).

import { useState } from "react";
import { STATUS_DETAIL_DIALOG_IDS } from "./status-detail-dom-ids.js";

const FINAL_STATUS_OPTIONS = [
  { value: "", label: "Tất cả" },
  { value: "translated", label: "Đã dịch" },
  { value: "partially_translated", label: "Dịch một phần" },
  { value: "kept_origin", label: "Giữ nguyên bản gốc" },
  { value: "failed", label: "Thất bại" },
];

export function TranslationFilterPanel({ query, onApply }) {
  const [finalStatus, setFinalStatus] = useState(query.finalStatus || "");
  const [q, setQ] = useState(query.q || "");
  const ids = STATUS_DETAIL_DIALOG_IDS.translation;

  function submit() {
    onApply({ finalStatus: finalStatus.trim(), q: q.trim() });
  }

  return (
    <section className="translation-filter-panel">
      <div className="translation-filter-row">
        <label className="translation-filter-field">
          <span className="label">Trạng thái</span>
          <select
            id={ids.filterFinalStatus}
            value={finalStatus}
            onChange={(event) => setFinalStatus(event.target.value)}
          >
            {FINAL_STATUS_OPTIONS.map((option) => (
              <option key={option.value || "all"} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <label className="translation-filter-field translation-filter-search">
          <span className="label">Tìm kiếm</span>
          <input
            id={ids.filterQuery}
            type="search"
            placeholder="Nhập item_id, route, đoạn văn bản gốc"
            value={q}
            onChange={(event) => setQ(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                submit();
              }
            }}
          />
        </label>
        <button id={ids.filterApply} type="button" className="button-link secondary" onClick={submit}>Làm mới</button>
      </div>
    </section>
  );
}

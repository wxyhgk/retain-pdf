// Bảng biên tập thuật ngữ (đối chiếu glossary-manager-dialog-template.js với
// khối bảng .glossary-editor-panel + view.js:appendGlossaryEntryRow theo từng cột).
//
// Bắt buộc DOM hành động hàng → mảng có cấu trúc + .map (kế hoạch xây dựng §3):
// mọi entries lấy từ draft.entries của glossaries-store.js, mỗi ô do input/select
// kiểm soát và onChange ghi trực tiếp vào store (updateEntryField), không tự viết
// DOM theo từng hàng hoặc cắt bỏ phần tử.

import { EmptyState } from "../../../../shared/icons/EmptyState.jsx";
import { GLOSSARY_DOM_IDS, ENTRY_LEVEL_OPTIONS, MATCH_MODE_OPTIONS } from "./glossaries-dom-ids.js";

export function GlossaryEditor({ entries, onFieldChange, onRemoveRow }) {
  const hasEntries = entries.length > 0;
  return (
    <div className="glossary-table-wrap">
      <table className="glossary-table">
        <thead>
          <tr>
            <th className="glossary-col-source">Từ gốc</th>
            <th className="glossary-col-target">Bản dịch</th>
            <th className="glossary-col-note">Ghi chú</th>
            <th className="glossary-col-level">Loại</th>
            <th className="glossary-col-match">Khớp</th>
            <th className="glossary-col-action"></th>
          </tr>
        </thead>
        <tbody id={GLOSSARY_DOM_IDS.entries}>
          {entries.map((row, index) => (
            // eslint-disable-next-line react/no-array-index-key -- Hàng không có id ổn định
            // (bản cũ cũng chỉ định vị DOM thuần túy), nên khóa chỉ mục là tương đương.
            <tr key={index} className="glossary-entry-row">
              <td>
                <input
                  type="text"
                  className="glossary-entry-source"
                  placeholder="Hartree-Fock"
                  value={row.source}
                  onChange={(event) => onFieldChange(index, "source", event.target.value)}
                />
              </td>
              <td>
                <input
                  type="text"
                  className="glossary-entry-target"
                  placeholder="Có thể để trống"
                  value={row.target}
                  onChange={(event) => onFieldChange(index, "target", event.target.value)}
                />
              </td>
              <td>
                <input
                  type="text"
                  className="glossary-entry-note"
                  placeholder="Tùy chọn"
                  value={row.note}
                  onChange={(event) => onFieldChange(index, "note", event.target.value)}
                />
              </td>
              <td>
                <select
                  className="glossary-entry-level"
                  value={row.level}
                  onChange={(event) => onFieldChange(index, "level", event.target.value)}
                >
                  {ENTRY_LEVEL_OPTIONS.map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </td>
              <td>
                <select
                  className="glossary-entry-match"
                  value={row.match_mode}
                  onChange={(event) => onFieldChange(index, "match_mode", event.target.value)}
                >
                  {MATCH_MODE_OPTIONS.map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </td>
              <td>
                <button
                  type="button"
                  className="glossary-entry-remove secondary"
                  aria-label="Xóa mục"
                  onClick={() => onRemoveRow(index)}
                >
                  ×
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div id={GLOSSARY_DOM_IDS.entriesEmpty} className={hasEntries ? "hidden" : undefined}>
        {!hasEntries ? (
          <EmptyState
            instrument="spectrum"
            title="Không có mục"
            hint="Thêm từ gốc và bản dịch, dịch thuật sẽ ưu tiên dùng thuật ngữ của bạn."
          />
        ) : null}
      </div>
    </div>
  );
}

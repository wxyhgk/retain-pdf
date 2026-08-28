// Bảng danh sách thuật ngữ(so sánh glossary-manager-dialog-template.js của
// .glossary-list-panel Khá»i: + view.js:renderGlossaryList Phản chiếu từng nút một)。

import { EmptyState } from "../../../../shared/icons/EmptyState.jsx";
import { GLOSSARY_DOM_IDS } from "./glossaries-dom-ids.js";

export function GlossaryList({ items, selectedId, onSelect, onCreateNew }) {
  const hasItems = items.length > 0;
  return (
    <aside className="glossary-list-panel">
      <div className="glossary-panel-head">
        <strong>Danh sách</strong>
        <button
          id={GLOSSARY_DOM_IDS.newButton}
          type="button"
          className="app-button secondary"
          onClick={onCreateNew}
        >
Tạo mới
        </button>
      </div>
      <div id={GLOSSARY_DOM_IDS.list} className="glossary-list">
        {items.map((item) => {
          const glossaryId = `${item?.glossary_id || ""}`.trim();
          if (!glossaryId) {
            return null;
          }
          return (
            <button
              key={glossaryId}
              type="button"
              className={`glossary-list-item${glossaryId === selectedId ? " is-active" : ""}`}
              onClick={() => onSelect(glossaryId)}
            >
              <strong>{item.name || glossaryId}</strong>
              <span>{Number(item.entry_count) || 0} mục</span>
            </button>
          );
        })}
      </div>
      <div id={GLOSSARY_DOM_IDS.listEmpty} className={hasItems ? "hidden" : undefined}>
        {!hasItems ? (
          <EmptyState
            instrument="atom"
            title="Không có bảng thuật ngữ"
            hint="Nhấn «Mới» ở góc trên bên phải để tạo bảng thuật ngữ cho lĩnh vực."
          />
        ) : null}
      </div>
    </aside>
  );
}

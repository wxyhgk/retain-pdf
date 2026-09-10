// 术语表列表面板(对照 glossary-manager-dialog-template.js 的
// .glossary-list-panel 区块 + view.js:renderGlossaryList 逐节点镜像)。

import { EmptyState } from "@/ui/icons/EmptyState.jsx";
import { GLOSSARY_DOM_IDS } from "./glossaries-dom-ids.js";

export function GlossaryList({ items, selectedId, onSelect, onCreateNew }) {
  const hasItems = items.length > 0;
  return (
    <aside className="glossary-list-panel">
      <div className="glossary-panel-head">
        <strong>列表</strong>
        <button
          id={GLOSSARY_DOM_IDS.newButton}
          type="button"
          className="app-button secondary"
          onClick={onCreateNew}
        >
          新建
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
              <span>{Number(item.entry_count) || 0} 条</span>
            </button>
          );
        })}
      </div>
      <div id={GLOSSARY_DOM_IDS.listEmpty} className={hasItems ? "hidden" : undefined}>
        {!hasItems ? (
          <EmptyState
            instrument="atom"
            title="暂无术语表"
            hint="点右上角「新建」，为领域术语建一份对照表。"
          />
        ) : null}
      </div>
    </aside>
  );
}

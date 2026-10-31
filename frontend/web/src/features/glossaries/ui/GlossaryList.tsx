// 术语表列表面板(对照 glossary-manager-dialog-template.js 的
// .glossary-list-panel 区块 + view.js:renderGlossaryList 逐节点镜像)。

import { useState } from "react";
import { EmptyState } from "@/ui/icons/EmptyState.jsx";
import { GLOSSARY_DOM_IDS } from "./glossaries-dom-ids.js";
import type { GlossaryListItem } from "../domain/glossaries-store.js";

export type GlossaryListProps = {
  items: GlossaryListItem[];
  selectedId: string;
  onSelect: (glossaryId: string) => void;
  onCreateNew: () => void;
  disabled?: boolean;
};

export function GlossaryList({ items, selectedId, onSelect, onCreateNew, disabled = false }: GlossaryListProps) {
  const [query, setQuery] = useState("");
  const filteredItems = items.filter(item => `${item.name || ""} ${item.glossary_id || ""}`.toLowerCase().includes(query.trim().toLowerCase()));
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
          disabled={disabled}
        >
          新建
        </button>
      </div>
      <input id="glossary-list-search" className="glossary-search" type="search" aria-label="搜索术语库" placeholder="搜索术语库" value={query} onChange={(event) => setQuery(event.target.value)} />
      <div id={GLOSSARY_DOM_IDS.list} className="glossary-list">
        {filteredItems.map((item) => {
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
              disabled={disabled}
            >
              <strong>{item.name || glossaryId}</strong>
              <span>{Number(item.entry_count) || 0} 条</span>
            </button>
          );
        })}
        {hasItems && !filteredItems.length ? <p className="glossary-help">没有匹配的术语库</p> : null}
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

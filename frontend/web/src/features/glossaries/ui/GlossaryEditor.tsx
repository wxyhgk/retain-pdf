// 术语表编辑器表格(对照 glossary-manager-dialog-template.js 的
// .glossary-editor-panel 表格区块 + view.js:appendGlossaryEntryRow 逐列镜像)。
//
// 命令式 DOM 行操作 → 结构化数组 + .map 渲染(蓝图 §3):entries 全部来自
// glossaries-store.js 的 draft.entries,每格是受控 input/select,onChange 直接
// 写 store(updateEntryField),不再手写行级 DOM 增删。

import { X } from "lucide-react";
import { EmptyState } from "@/ui/icons/EmptyState.jsx";
import { GLOSSARY_DOM_IDS, ENTRY_LEVEL_OPTIONS, MATCH_MODE_OPTIONS } from "./glossaries-dom-ids.js";

export function GlossaryEditor({ entries, onFieldChange, onRemoveRow }) {
  const hasEntries = entries.length > 0;
  return (
    <div className="glossary-table-wrap">
      <table className="glossary-table">
        <thead>
          <tr>
            <th className="glossary-col-source">原词</th>
            <th className="glossary-col-target">译文</th>
            <th className="glossary-col-note">备注</th>
            <th className="glossary-col-level">类型</th>
            <th className="glossary-col-match">匹配</th>
            <th className="glossary-col-action"></th>
          </tr>
        </thead>
        <tbody id={GLOSSARY_DOM_IDS.entries}>
          {entries.map((row, index) => (
            // eslint-disable-next-line react/no-array-index-key -- 行无稳定 id(旧世界也是纯位置化 DOM 行),索引键与旧行为等价
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
                  placeholder="可留空"
                  value={row.target}
                  onChange={(event) => onFieldChange(index, "target", event.target.value)}
                />
              </td>
              <td>
                <input
                  type="text"
                  className="glossary-entry-note"
                  placeholder="可选"
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
                  aria-label="删除词条"
                  onClick={() => onRemoveRow(index)}
                >
                  <X className="h-4 w-4" />
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
            title="暂无词条"
            hint="添加原词与译文，翻译时会优先用你的术语。"
          />
        ) : null}
      </div>
    </div>
  );
}

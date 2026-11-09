// 术语表编辑器表格(对照 glossary-manager-dialog-template.js 的
// .glossary-editor-panel 表格区块 + view.js:appendGlossaryEntryRow 逐列镜像)。
//
// 命令式 DOM 行操作 → 结构化数组 + .map 渲染(蓝图 §3):entries 全部来自
// glossaries-store.js 的 draft.entries,每格是受控 input/select,onChange 直接
// 写 store(updateEntryField),不再手写行级 DOM 增删。

import { X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button, Checkbox, ConfirmDialog, Input } from "@retainpdf/ui";
import { EmptyState } from "@/ui/icons/EmptyState.jsx";
import { GLOSSARY_DOM_IDS, ENTRY_LEVEL_OPTIONS, MATCH_MODE_OPTIONS } from "./glossaries-dom-ids.js";
import type { GlossaryEntryRow } from "../domain/glossaries-store.js";

export type GlossaryEditorProps = {
  entries: GlossaryEntryRow[];
  /** 行结构版本（整表替换/增删行时 +1，改字段不动），用来判断旧勾选是否还指向同一行。 */
  structureRevision: number;
  onFieldChange: (index: number, field: keyof GlossaryEntryRow, value: string) => void;
  onRemoveRow: (index: number) => void;
  onRemoveRows?: (indices: number[]) => void;
  query?: string;
  disabled?: boolean;
};

export function GlossaryEditor({ entries, structureRevision, onFieldChange, onRemoveRow, onRemoveRows, query = "", disabled = false }: GlossaryEditorProps) {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  // 勾选按行号记，只有切换术语表/导入/增删行（行号不再指同一行）才清；改原词译文不能清，
  // 否则每敲一个字勾选就没了。
  useEffect(() => { setSelected(new Set()); setConfirmOpen(false); }, [structureRevision]);
  // 搜索结果只在换关键词、增删行时重算：边改边算的话，把一行改到不再匹配，这一行会在输入中途消失。
  const matchedIndices = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return null;
    return new Set(entries.flatMap((row, index) =>
      [row.source, row.target, row.note, row.context].some((value) => (value || "").toLowerCase().includes(needle)) ? [index] : []));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 故意不随 entries 变：见上
  }, [query, structureRevision]);
  const filtered = entries.map((row, index) => ({ row, index }))
    .filter(({ index }) => !matchedIndices || matchedIndices.has(index));
  const hasEntries = filtered.length > 0;
  return (
    <>
    <div className="glossary-entry-tools">
      <span className="glossary-help">显示 {filtered.length} 条 · 已选 {selected.size} 条</span>
      <Button id="glossary-delete-selected" variant="secondary" size="sm" disabled={disabled || !selected.size} onClick={() => setConfirmOpen(true)}>删除所选</Button>
      {selected.size > 0 && <Button variant="ghost" size="sm" disabled={disabled} onClick={() => setSelected(new Set())}>取消选择</Button>}
    </div>
    <fieldset className="glossary-table-wrap" disabled={disabled} aria-label="术语词条">
      <table className="glossary-table">
        <thead>
          <tr>
            <th className="glossary-col-select"><Checkbox aria-label="选择全部可见词条" checked={filtered.length > 0 && filtered.every(({ index }) => selected.has(index))}
              onChange={event => setSelected(previous => { const next = new Set(previous); filtered.forEach(({ index }) => event.target.checked ? next.add(index) : next.delete(index)); return next; })} /></th>
            <th className="glossary-col-source">原词</th>
            <th className="glossary-col-target">译文</th>
            <th className="glossary-col-note">备注</th>
            <th className="glossary-col-context">语境</th>
            <th className="glossary-col-level">类型</th>
            <th className="glossary-col-match">匹配</th>
            <th className="glossary-col-action"></th>
          </tr>
        </thead>
        <tbody id={GLOSSARY_DOM_IDS.entries}>
          {filtered.map(({ row, index }) => (
            // eslint-disable-next-line react/no-array-index-key -- 行无稳定 id(旧世界也是纯位置化 DOM 行),索引键与旧行为等价
            <tr key={index} className="glossary-entry-row">
              <td><Checkbox aria-label={`选择词条 ${row.source || index + 1}`} checked={selected.has(index)}
                onChange={event => setSelected(previous => { const next = new Set(previous); if (event.target.checked) next.add(index); else next.delete(index); return next; })} /></td>
              <td>
                <Input
                  size="sm"
                  type="text"
                  className="glossary-entry-source"
                  placeholder="Hartree-Fock"
                  value={row.source}
                  onChange={(event) => onFieldChange(index, "source", event.target.value)}
                />
              </td>
              <td>
                <Input
                  size="sm"
                  type="text"
                  className="glossary-entry-target"
                  placeholder="可留空"
                  value={row.target}
                  onChange={(event) => onFieldChange(index, "target", event.target.value)}
                />
              </td>
              <td>
                <Input
                  size="sm"
                  type="text"
                  className="glossary-entry-note"
                  placeholder="可选"
                  value={row.note}
                  onChange={(event) => onFieldChange(index, "note", event.target.value)}
                />
              </td>
              <td><Input size="sm" type="text" className="glossary-entry-context" aria-label={`语境 ${row.source || index + 1}`} placeholder="例如：机器学习" value={row.context}
                onChange={event => onFieldChange(index, "context", event.target.value)} /></td>
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
            title={query.trim() ? "没有匹配的词条" : "暂无词条"}
            hint={query.trim() ? "试试其他关键词，或清空搜索查看全部词条。" : "添加原词与译文，翻译时会优先用你的术语。"}
          />
        ) : null}
      </div>
    </fieldset>
    <ConfirmDialog id="glossary-delete-entries-confirm" title="删除所选词条"
      description={`将从当前草稿删除 ${selected.size} 条词条（包括筛选隐藏的已选词条），保存后生效。`}
      confirmLabel="删除词条" tone="danger" level="nested" open={confirmOpen} pending={disabled} onOpenChange={setConfirmOpen}
      onConfirm={() => {
        if (disabled) return;
        const indices = [...selected].sort((a, b) => b - a);
        if (onRemoveRows) onRemoveRows(indices); else indices.forEach(onRemoveRow);
        setSelected(new Set()); setConfirmOpen(false);
      }} />
    </>
  );
}

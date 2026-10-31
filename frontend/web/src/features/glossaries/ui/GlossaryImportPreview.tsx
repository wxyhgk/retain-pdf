import { IMPORT_FIELDS, previewGlossaryImport } from "../domain/glossary-import-table.js";
import type { GlossaryTable, ImportMapping } from "../domain/glossary-import-table.js";

export function GlossaryImportPreview({ table, mapping, onMappingChange, disabled }: {
  table: GlossaryTable; mapping: ImportMapping; onMappingChange: (mapping: ImportMapping) => void; disabled: boolean;
}) {
  const preview = previewGlossaryImport(table, mapping);
  const width = Math.max(0, ...table.rows.map(row => row.length));
  return <div className="glossary-import-preview">
    <label className="glossary-check-label"><input type="checkbox" checked={mapping.hasHeader} disabled={disabled}
      onChange={event => onMappingChange({ ...mapping, hasHeader: event.target.checked })} />首行为表头</label>
    <div className="glossary-import-options">
      {IMPORT_FIELDS.map(([field, label]) => <label key={field}>{label}列
        <select aria-label={`${label}列`} value={mapping.columns[field] ?? -1} disabled={disabled}
          onChange={event => onMappingChange({ ...mapping, columns: { ...mapping.columns, [field]: Number(event.target.value) } })}>
          <option value={-1}>{field === "source" || field === "target" ? "请选择" : "不导入"}</option>
          {Array.from({ length: width }, (_, index) => <option key={index} value={index}>
            第 {index + 1} 列{mapping.hasHeader ? ` · ${table.rows[0]?.[index] || "未命名"}` : ""}
          </option>)}
        </select>
      </label>)}
    </div>
    <p className="glossary-help">语境用于限制原文中的匹配范围；仅作分类的列建议对应到备注，或选择「不导入」。</p>
    <p role="status" className="glossary-help">预览 {preview.entries.length} 条，文件内重复 {preview.duplicateCount} 条（后者覆盖前者）。显示前 5 条，导入后仍需保存。</p>
    {preview.errors.length > 0 && <div role="alert" className="glossary-import-error">
      {preview.errors.slice(0, 5).map((error, index) => <p key={index}>{error}</p>)}
      {preview.errors.length > 5 && <p>另有 {preview.errors.length - 5} 项错误，请修正文件后重试。</p>}
    </div>}
    {preview.entries.length > 0 && <div className="glossary-preview-scroll"><table aria-label="导入词条预览">
      <thead><tr>{IMPORT_FIELDS.map(([field, label]) => <th key={field}>{label}</th>)}</tr></thead>
      <tbody>{preview.entries.slice(0, 5).map((entry, index) => <tr key={index}>{IMPORT_FIELDS.map(([field]) => <td key={field}>{entry[field] || "—"}</td>)}</tr>)}</tbody>
    </table></div>}
  </div>;
}

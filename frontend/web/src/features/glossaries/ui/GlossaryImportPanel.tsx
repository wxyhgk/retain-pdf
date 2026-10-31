import { useEffect, useMemo, useRef, useState } from "react";
import { GLOSSARY_DOM_IDS } from "./glossaries-dom-ids.js";
import { GLOSSARY_CSV_TEMPLATE, MAX_GLOSSARY_ENTRIES, readGlossaryFile } from "../domain/glossary-import.js";
import type { GlossaryFileEncoding, GlossaryImportMode } from "../domain/glossary-import.js";
import { parseGlossaryTable, previewGlossaryImport } from "../domain/glossary-import-table.js";
import type { ImportDelimiter, ImportMapping } from "../domain/glossary-import-table.js";
import { GlossaryImportPreview } from "./GlossaryImportPreview.jsx";

export type GlossaryImportPanelProps = {
  visible: boolean;
  csvText: string;
  onCsvTextChange: (value: string) => void;
  onApply: (mode: GlossaryImportMode, csv: string) => void;
  onCancel: () => void;
  busy?: boolean;
  onReadingChange?: (reading: boolean) => void;
};

export function GlossaryImportPanel({ visible, csvText, onCsvTextChange, onApply, onCancel, busy = false, onReadingChange }: GlossaryImportPanelProps) {
  const [mode, setMode] = useState<GlossaryImportMode>("append");
  const [encoding, setEncoding] = useState<GlossaryFileEncoding>("auto");
  const [fileInfo, setFileInfo] = useState("");
  const [error, setError] = useState("");
  const [reading, setReading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [delimiter, setDelimiter] = useState<ImportDelimiter>("auto");
  const [mapping, setMapping] = useState<ImportMapping | null>(null);
  const [sheets, setSheets] = useState<Array<{ name: string; text: string }>>([]);
  const [sheetIndex, setSheetIndex] = useState(0);
  const parsed = useMemo(() => {
    try { return { table: csvText.trim() ? parseGlossaryTable(csvText, delimiter) : null, error: "" }; }
    catch (err) { return { table: null, error: err instanceof Error ? err.message : "解析失败" }; }
  }, [csvText, delimiter]);
  const activeMapping = mapping || parsed.table?.mapping;
  const preview = parsed.table && activeMapping ? previewGlossaryImport(parsed.table, activeMapping) : null;
  const fileRef = useRef<File | null>(null);
  const request = useRef(0);
  useEffect(() => {
    if (!visible) {
      request.current++;
      fileRef.current = null;
      setFileInfo(""); setError(""); setReading(false); setDragging(false);
      setSheets([]);
      onReadingChange?.(false);
    }
    return () => { request.current++; };
  }, [visible, onReadingChange]);
  useEffect(() => { if (!csvText) { setMapping(null); setDelimiter("auto"); } }, [csvText]);

  async function loadFile(file: File, selectedEncoding = encoding) {
    const seq = ++request.current;
    fileRef.current = file;
    setError(""); setReading(true); onReadingChange?.(true);
    try {
      const decoded = await readGlossaryFile(file, selectedEncoding);
      if (seq !== request.current) return;
      onCsvTextChange(decoded.text);
      setMapping(null); setDelimiter("auto"); setSheets(decoded.sheets || []);
      setSheetIndex(Math.max(0, decoded.sheets?.findIndex(sheet => sheet.text === decoded.text) ?? 0));
      setFileInfo(`${file.name} · ${decoded.encoding.toUpperCase()}`);
    } catch (err) {
      if (seq === request.current) setError(err instanceof Error ? err.message : "文件读取失败，请重新选择。");
    } finally {
      if (seq === request.current) { setReading(false); onReadingChange?.(false); }
    }
  }

  function pickFiles(files: FileList | null) {
    if (busy || reading || !files?.length) return;
    if (files.length !== 1) { setError("请一次导入一个文件。"); return; }
    void loadFile(files[0]);
  }

  return (
    <div id={GLOSSARY_DOM_IDS.importPanel} className={`glossary-import-panel${visible ? "" : " hidden"}${dragging ? " is-dragging" : ""}`}
      onDragOver={(event) => { event.preventDefault(); if (!busy && !reading) setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => { event.preventDefault(); setDragging(false); pickFiles(event.dataTransfer.files); }}
    >
      <label className="glossary-file-drop">
        <strong>选择或拖入术语文件</strong>
        <span>CSV / TSV / TXT / XLSX，最大 2 MB；支持 Excel 工作表选择。</span>
        <input id="glossary-import-file" type="file" accept=".csv,.tsv,.txt,.xlsx" disabled={busy || reading}
          onChange={(event) => { pickFiles(event.target.files); event.target.value = ""; }} />
      </label>
      <div className="glossary-import-options">
        <label>文件编码
          <select aria-label="文件编码" value={encoding} disabled={busy || reading || sheets.length > 0}
            onChange={(event) => { const next = event.target.value as GlossaryFileEncoding; setEncoding(next); if (fileRef.current) void loadFile(fileRef.current, next); }}>
            <option value="auto">自动识别</option><option value="utf-8">UTF-8</option>
            <option value="gb18030">GBK / GB18030</option><option value="utf-16le">UTF-16 LE</option><option value="utf-16be">UTF-16 BE</option>
          </select>
        </label>
        {sheets.length > 0 && <label>工作表
          <select aria-label="工作表" value={sheetIndex} disabled={busy || reading} onChange={event => {
            const index = Number(event.target.value); setSheetIndex(index); setMapping(null); setDelimiter("auto"); onCsvTextChange(sheets[index].text);
          }}>{sheets.map((sheet, index) => <option key={index} value={index}>{sheet.name}</option>)}</select>
        </label>}
        <label>分隔符
          <select aria-label="分隔符" value={delimiter} disabled={busy || reading || sheets.length > 0} onChange={event => { setDelimiter(event.target.value as ImportDelimiter); setMapping(null); }}>
            <option value="auto">自动识别</option><option value=",">逗号</option><option value={"\t"}>制表符</option><option value=";">分号</option>
          </select>
        </label>
        <label>导入方式
          <select id="glossary-import-mode" value={mode} disabled={busy || reading} onChange={(event) => setMode(event.target.value as GlossaryImportMode)}>
            <option value="append">追加合并</option><option value="replace">替换当前词条</option>
          </select>
        </label>
        <a download="术语导入模板.csv" href={`data:text/csv;charset=utf-8,${encodeURIComponent(GLOSSARY_CSV_TEMPLATE)}`}>下载 CSV 模板</a>
      </div>
      <p className="glossary-help">{mode === "append" ? "按原词和语境合并，重复词条以导入内容为准。" : "替换编辑区中的全部词条。"} 导入后请检查并保存，最多 {MAX_GLOSSARY_ENTRIES} 条。</p>
      {fileInfo ? <p className="glossary-help" role="status">{fileInfo}</p> : null}
      {reading ? <p role="status">正在读取文件…</p> : null}
      {error ? <p className="glossary-import-error" role="alert">{error}</p> : null}
      <label htmlFor={GLOSSARY_DOM_IDS.csvText}>文件内容 / 粘贴 CSV 或 TSV</label>
      <textarea
        id={GLOSSARY_DOM_IDS.csvText}
        rows={5}
        disabled={busy || reading}
        placeholder={"原词,译文,备注\nband gap,带隙,材料术语"}
        value={csvText}
        onChange={(event) => { fileRef.current = null; setFileInfo(""); setSheets([]); setError(""); setMapping(null); onCsvTextChange(event.target.value); }}
      />
      {parsed.error && <p className="glossary-import-error" role="alert">{parsed.error}</p>}
      {parsed.table && activeMapping && <GlossaryImportPreview table={parsed.table} mapping={activeMapping} onMappingChange={setMapping} disabled={busy || reading} />}
      <div className="glossary-import-actions">
        <button id={GLOSSARY_DOM_IDS.importApplyButton} type="button" className="app-button" disabled={busy || reading || !preview || preview.errors.length > 0 || Boolean(error)} onClick={() => { if (preview) onApply(mode, preview.csv); }}>解析并导入</button>
        <button id={GLOSSARY_DOM_IDS.importCancelButton} type="button" className="app-button secondary" disabled={busy || reading} onClick={onCancel}>收起</button>
      </div>
    </div>
  );
}

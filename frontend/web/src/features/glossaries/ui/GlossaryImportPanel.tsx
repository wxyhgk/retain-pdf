// CSV 导入面板(对照 glossary-manager-dialog-template.js 的
// .glossary-import-panel 区块镜像)。解析动作复用 controller.js 的
// applyImport(内部走 js/api/glossaries.js:parseGlossaryCsv)。

import { GLOSSARY_DOM_IDS } from "./glossaries-dom-ids.js";

export function GlossaryImportPanel({ visible, csvText, onCsvTextChange, onApply, onCancel }) {
  return (
    <div id={GLOSSARY_DOM_IDS.importPanel} className={`glossary-import-panel${visible ? "" : " hidden"}`}>
      <textarea
        id={GLOSSARY_DOM_IDS.csvText}
        rows={6}
        placeholder="原词,译文,类型,匹配模式,备注"
        value={csvText}
        onChange={(event) => onCsvTextChange(event.target.value)}
      />
      <div className="glossary-import-actions">
        <button id={GLOSSARY_DOM_IDS.importApplyButton} type="button" className="app-button" onClick={onApply}>解析</button>
        <button id={GLOSSARY_DOM_IDS.importCancelButton} type="button" className="app-button secondary" onClick={onCancel}>取消</button>
      </div>
    </div>
  );
}

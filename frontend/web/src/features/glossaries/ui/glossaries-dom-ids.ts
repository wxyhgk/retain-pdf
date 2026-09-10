// GlossariesDialog 的 id/选择器契约(蓝图 §3 + §0.1)。
//
// 拷贝自 src/js/components/dialogs/glossary-manager-dialog-dom-contract.js
// (旧自定义元素视图层,architecture-boundaries 门禁禁止 src/pages/** 直接
// import js/components/**)——同一手法已在 credentials-dom-ids.js 用过一次。
// 字面量必须与旧契约逐一对齐:视觉基线与门禁按这些 id 精确定位,不得改名。

export const GLOSSARY_DOM_IDS = Object.freeze({
  triggerButton: "glossary-btn",
  dialog: "glossary-manager-dialog",
  closeButton: "glossary-close-btn",
  newButton: "glossary-new-btn",
  list: "glossary-list",
  listEmpty: "glossary-list-empty",
  nameInput: "glossary-name",
  addRowButton: "glossary-add-row-btn",
  importButton: "glossary-import-btn",
  exportButton: "glossary-export-btn",
  deleteButton: "glossary-delete-btn",
  entries: "glossary-entries",
  entriesEmpty: "glossary-entries-empty",
  importPanel: "glossary-import-panel",
  csvText: "glossary-csv-text",
  importApplyButton: "glossary-import-apply-btn",
  importCancelButton: "glossary-import-cancel-btn",
  status: "glossary-status",
  saveButton: "glossary-save-btn",
});

export const ENTRY_LEVEL_OPTIONS = [
  ["preserve", "保留"],
  ["canonical", "固定译法"],
  ["preferred", "偏好译法"],
];

export const MATCH_MODE_OPTIONS = [
  ["case_insensitive", "忽略大小写"],
  ["exact", "精确"],
  ["regex", "正则"],
];

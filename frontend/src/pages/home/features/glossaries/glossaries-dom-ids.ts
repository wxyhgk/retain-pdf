// GlossariesDialog của id/Hợp đồng bộ chọn(kế hoạch xây dựng §3 + §0.1)。
//
// Sao chép từ src/js/components/dialogs/glossary-manager-dialog-dom-contract.js
// (Lớp chế độ xem phần tử tùy chỉnh cũ,architecture-boundaries Không truy cập src/pages/** trực tiếp
// import js/components/**)——Kỹ thuật tương tự đã được sử dụng trong credentials-dom-ids.js Được sử dụng một lần。
// Các chữ cái phải được căn chỉnh từng chữ một với hợp đồng cũ:Đường cơ sở trực quan và kiểm soát truy cập nhấn các id Định vị chính xác,Không thể thay đổi tên。

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
  ["preserve", "Giữ nguyên"],
  ["canonical", "Dịch cố định"],
  ["preferred", "Dịch ưu tiên"],
];

export const MATCH_MODE_OPTIONS = [
  ["case_insensitive", "Không phân biệt hoa thường"],
  ["exact", "Chính xác"],
  ["regex", "Biểu thức chính quy"],
];

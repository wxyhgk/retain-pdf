export const USER_STAGE_FLOW = [
  {
    key: "ocr",
    label: "Phân tích OCR",
    detail: "Đang nhận diện nội dung PDF",
    matches: ["ocr", "parse", "mineru", "paddle", "normaliz", "document", "submit", "startup"],
  },
  {
    key: "translate",
    label: "Dịch",
    detail: "Đang dịch nội dung chính",
    matches: ["translat"],
  },
  {
    key: "render",
    label: "Kết xuất",
    detail: "Đang tạo PDF đã dịch",
    matches: ["render", "sav"],
  },
];

export const USER_STAGE_TOTAL = USER_STAGE_FLOW.length + 1;

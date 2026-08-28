// Định nghĩa công cụ đọc (căn chỉnh theo bộ 4 công cụ topbar legacy + tải xuống ở khu vực FAB riêng)

export type ReaderToolId = "notes" | "favorites" | "markdown" | "ai";

export type ReaderToolDef = {
  id: ReaderToolId;
  label: string;
  /** Copy phụ (đóng / mở). */
  subIdle: string;
  subOpen: string;
  /** Có bị tắt khi chỉ đọc tài liệu gốc không. */
  needsJob: boolean;
};

/** Cùng bộ capability với legacy ReaderTopbarActions.TOOL_BUTTONS. */
export const READER_TOOLS: readonly ReaderToolDef[] = Object.freeze([
  {
    id: "notes",
    label: "Ghi chú",
    subIdle: "Chọn văn bản để thêm",
    subOpen: "Đóng cửa sổ nổi",
    needsJob: false,
  },
  {
    id: "favorites",
    label: "Trích đoạn",
    subIdle: "Mục yêu thích trên mây của sách này",
    subOpen: "Đóng cửa sổ nổi",
    needsJob: false,
  },
  {
    id: "markdown",
    label: "Markdown",
    subIdle: "Văn bản OCR / bản dịch",
    subOpen: "Đóng cửa sổ nổi",
    needsJob: true,
  },
  {
    id: "ai",
    label: "Hỏi đáp AI",
    subIdle: "Đặt câu hỏi theo tài liệu",
    subOpen: "Đóng cửa sổ nổi",
    needsJob: true,
  },
]);

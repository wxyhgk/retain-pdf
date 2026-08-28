// Panel PDF đơn lẻ: React chỉ render khung (trạng thái rỗng/lớp bọc/viewer host).
// Nội dung DOM của .pdfViewer hoàn toàn do pdfjs mệnh lệnh quản (pdf-controller/pdf-renderer
// tìm id để mount), đóng/mở hidden do showReaderPaneReady/Empty của view.js chuyển —
// tuyệt đối không ảo hóa DOM các trang PDF. Component này không đổi props, không có
// state, sau lần commit đầu React sẽ không đụng vào các nút này nữa.
//
// id vùng chứa viết thẳng literal (không nối `${viewerKey}-wrap`):
// tests/page-dom-references.test.mjs kiểm tra thuộc tính theo id="..." dạng literal,
// nối chuỗi sẽ khiến tham chiếu phía src/js/reader (view.js/viewer-mount-flow.js) thành
// mồ côi, báo động sai.

import type { CSSProperties } from "react";
import { Panel } from "react-resizable-panels";

type ReaderPdfPane = "source" | "translated";

function paneStyle(pane: ReaderPdfPane): CSSProperties {
  return {
    maxHeight: "none",
    overflowY: "visible",
    overflowX: "clip",
    // Tái tạo tương đương đường kẻ phân cột của panel bản dịch trong bố cục cũ
    // (quy tắc .reader-panel + .reader-panel)
    ...(pane === "translated"
      ? { borderLeft: "1px solid color-mix(in srgb, var(--shadow-color) 4%, transparent)" }
      : null),
  };
}

export function PdfPane({ pane }: { pane: ReaderPdfPane }) {
  if (pane === "source") {
    return (
      <Panel
        id="reader-pane-source"
        role="tabpanel"
        data-reader-pane="source"
        aria-labelledby="reader-tab-source"
        className="reader-panel"
        style={paneStyle("source")}
      >
        <div id="reader-pdf-empty" className="reader-empty hidden"></div>
        <div id="reader-pdf-wrap" className="reader-viewer-wrap hidden">
          <div id="reader-pdf-viewer-host" className="reader-viewer-host">
            <div id="reader-pdf-viewer" className="pdfViewer"></div>
          </div>
        </div>
      </Panel>
    );
  }
  return (
    <Panel
      id="reader-pane-translated"
      role="tabpanel"
      data-reader-pane="translated"
      aria-labelledby="reader-tab-translated"
      className="reader-panel"
      style={paneStyle("translated")}
    >
      <div id="reader-translation-empty" className="reader-empty hidden"></div>
      <div id="reader-translated-pdf-wrap" className="reader-viewer-wrap hidden">
        <div id="reader-translated-pdf-viewer-host" className="reader-viewer-host">
          <div id="reader-translated-pdf-viewer" className="pdfViewer"></div>
        </div>
      </div>
    </Panel>
  );
}

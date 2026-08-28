// Container cuộn dùng chung + hai bảng PDF (cổng kỹ thuật của Phase 2a).
//
// #reader-scroll-shell vẫn là container cuộn dọc duy nhất (định vị tuyệt đối giữa
// hai cột, overflow:auto); Group của react-resizable-panels là phần tử con, thay
// main#reader-grid (grid 1fr/1fr) cũ.
//
// Ghi đè style đã được xác minh khi nghiên cứu rrp v4 (bám kế hoạch, không tự nghĩ thêm):
// - Group mặc định height:100%; phải ghi đè thành height:auto + overflow:visible
//   để hai pane cao theo nội dung cao nhất và parent shell cuộn chung.
  //   Nghiên cứu trước ghi minHeight:'100%', nhưng .reader-page cao auto, min-height
  //   phần trăm không phân giải được; cận dưới của .reader-grid cũ là min-height:100vh,
  //   ở đây lấy 100vh để giữ tương đương pixel.
// - Cấu trúc hai lớp của Panel: maxHeight:100% trên flex item ngoài tự vô hiệu
//   khi Group có chiều cao auto; lớp trong (nhận className/style) ghi đè
//   maxHeight:'none', overflowY:'visible', overflowX:'clip'.
// - Separator rộng 0: ở chế độ đối chiếu, hai pane của bố cục cũ mỗi bên chiếm
//   một nửa và không kéo được; đường phân cách tái tạo bằng viền trái 1px của
//   pane bản dịch (CSS cũ .reader-panel + .reader-panel không còn khớp vì có
//   Separator ở giữa). Rộng 0 bảo đảm hai pane đúng bằng baseline — chiều rộng
//   pane đi vào phép tính scale của pdf.js, lệch 1px có thể làm văn bản trôi
//   dưới pixel.

import { Group, Separator } from "react-resizable-panels";
import { PdfPane } from "./PdfPane.jsx";
import { ReaderPageHud } from "./ReaderPageHud.jsx";

export function ReaderScrollShell() {
  return (
    <div id="reader-scroll-shell" className="reader-scroll-shell">
      <div className="reader-page">
        <ReaderPageHud />
        <Group
          id="reader-grid"
          orientation="horizontal"
          // minWidth:0: .reader-page là display:grid; min-width:auto của Group
          // với vai trò grid item có thể bị nội dung PDF kéo vượt 100% (bố cục
          // cũ dùng minmax(0,1fr) để tránh vấn đề tương tự).
          style={{ height: "auto", minHeight: "100vh", minWidth: 0, overflow: "visible" }}
        >
          <PdfPane pane="source" />
          <Separator
            id="reader-grid-separator"
            aria-label="Điều chỉnh độ rộng bảng bản gốc/bản dịch"
            style={{ width: 0, minWidth: 0, flexBasis: 0 }}
          />
          <PdfPane pane="translated" />
        </Group>
      </div>
    </div>
  );
}

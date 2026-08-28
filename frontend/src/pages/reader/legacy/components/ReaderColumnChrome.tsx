// Thanh phân cách và tay cầm thu gọn giữa các cột: nhìn thấy trong ảnh baseline
// (đường dọc 1px + chấm tròn nhỏ ở giữa biên cột); vị trí hoàn toàn tính bằng
// biến CSS (--reader-left-w / --reader-right-w), render tĩnh là đủ căn chỉnh.
// Giai đoạn thăm dò chưa nối tương tác kéo/thu gọn (triển khai cũ là
// column-resizer.js / panel-collapse.js); 2b quyết định rrp quản lý cả ba cột
// hay dùng lại controller cũ.

export function ReaderColumnChrome() {
  return (
    <>
      <div id="reader-col-resizer-left" className="reader-col-resizer reader-col-resizer-left" role="separator" aria-orientation="vertical" aria-label="Kéo để đổi độ rộng cột trái" title="Kéo để đổi độ rộng, nhấp đúp để đặt lại"></div>
      <div id="reader-col-resizer-right" className="reader-col-resizer reader-col-resizer-right" role="separator" aria-orientation="vertical" aria-label="Kéo để đổi độ rộng cột phải" title="Kéo để đổi độ rộng, nhấp đúp để đặt lại"></div>
      <button id="reader-left-collapse-btn" type="button" className="reader-col-collapse reader-col-collapse-left" aria-label="Thu gọn cột trái" aria-expanded="true" title="Thu gọn / mở rộng cột trái"></button>
      <button id="reader-right-collapse-btn" type="button" className="reader-col-collapse reader-col-collapse-right" aria-label="Thu gọn cột phải" aria-expanded="true" title="Thu gọn / mở rộng cột phải"></button>
    </>
  );
}

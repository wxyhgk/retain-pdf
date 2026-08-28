// Cột trái (giữ chỗ điều hướng): cột thường trực của khung ba cột, độ rộng do
// biến CSS --reader-left-w điều khiển (reader-page.css).

export function ReaderLeftNav() {
  return (
    <aside id="reader-col-left" className="reader-col-left" aria-label="Điều hướng">
      <div className="reader-col-left-head">Điều hướng</div>
      <div className="reader-col-left-body">
        <p className="reader-col-left-placeholder">Khu vực giữ chỗ</p>
        <p className="reader-col-left-hint">Sẽ hiển thị tổng hợp trích đoạn / chú thích</p>
      </div>
    </aside>
  );
}

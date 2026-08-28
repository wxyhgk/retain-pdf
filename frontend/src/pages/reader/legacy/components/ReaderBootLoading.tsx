// Lớp phủ tiến trình khởi động: hiển thị ban đầu, văn bản tiến trình/thanh tiến trình/ẩn
// đều do tầng view mệnh lệnh điều khiển (src/js/reader/view.js + progress-presenter.js),
// React chỉ render vùng chứa một lần.

export function ReaderBootLoading() {
  return (
    <div id="reader-boot-loading" className="reader-boot-loading" aria-live="polite">
      <div className="reader-boot-loading-card">
        <div id="reader-boot-loading-text" className="reader-boot-loading-text">Đang chuẩn bị đọc đối chiếu…</div>
        <div className="reader-boot-loading-track">
          <span id="reader-boot-loading-bar" className="reader-boot-loading-bar"></span>
        </div>
      </div>
    </div>
  );
}

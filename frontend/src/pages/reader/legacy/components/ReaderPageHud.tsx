// HUD số trang đáy: ẩn ban đầu, văn bản số trang/tiến trình/chế độ do tầng view mệnh lệnh ghi
// (view.js setPageIndicator / setReaderModeHud, điều khiển qua interaction-flow).

export function ReaderPageHud() {
  return (
    <div id="reader-page-indicator" className="reader-page-indicator reader-bottom-hud hidden" aria-live="polite">
      <span id="reader-bottom-hud-page" className="reader-bottom-hud-page">Trang 1 / 1</span>
      <span className="reader-bottom-hud-progress" aria-hidden="true">
        <span id="reader-bottom-hud-progress-bar" className="reader-bottom-hud-progress-bar"></span>
      </span>
      <span id="reader-bottom-hud-mode" className="reader-bottom-hud-mode">Đối chiếu</span>
    </div>
  );
}

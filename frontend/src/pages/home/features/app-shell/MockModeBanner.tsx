import {
  isMockMode,
  mockScenario,
} from "../../composition/external.js";

// Chế độ mock: Hiển thị khi URL có ?mock=demo hoặc ?mock=parallel.
// Hướng dẫn người dùng mở tab Bộ sưu tập → Phiên dịch → dịch toàn bộ sách để xem hoạt ảnh tiến trình trực tiếp.

export function MockModeBanner() {
  if (!isMockMode()) {
    return null;
  }
  const scenario = mockScenario() || "demo";
  return (
    <div
      id="mock-mode-banner"
      className="mock-mode-banner"
      role="status"
      data-mock-scenario={scenario}
    >
      <strong>Chế độ trình diễn Mock</strong>
      <span>
         Hiện tại <code>?mock={scenario}</code>
         : không kết nối backend thật. Mở sách có huy hiệu «Bộ sưu tập» → Tab «Dịch» → «Dịch toàn bộ»,
        có thể xem tiến trình giả khoảng 16 giây trong chi tiết (OCR → Dịch → Render → Hoàn thành).
      </span>
    </div>
  );
}

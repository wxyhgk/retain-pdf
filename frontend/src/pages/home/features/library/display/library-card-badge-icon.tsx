// Biểu tượng nhỏ phía trước huy hiệu trạng thái (lưu kho / dịch / đang xử lý / thất bại / xếp
// hàng). Huy hiệu vốn nhỏ, biểu tượng đi theo đường lucide 11px nét mảnh, cùng màu với
// chữ huy hiệu (currentColor). name là khóa icon trả về từ library-card-badge.js.

const PATHS = {
  // Lưu kho: archive (hộp có nắp) — "đã vào kho nhưng chưa dịch"
  archive: (
    <>
      <rect width="20" height="5" x="2" y="3" rx="1" />
      <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" />
      <path d="M10 12h4" />
    </>
  ),
  // Đã dịch: languages (ký hiệu văn/A)
  languages: (
    <>
      <path d="m5 8 6 6" />
      <path d="m4 14 6-6 2-3" />
      <path d="M2 5h12" />
      <path d="M7 2h1" />
      <path d="m22 22-5-10-5 10" />
      <path d="M14 18h6" />
    </>
  ),
  // Đang xử lý: loader-circle (xoay vòng, phối hợp animate-spin)
  loader: <path d="M21 12a9 9 0 1 1-6.219-8.56" />,
  // Thất bại: circle-alert
  alert: (
    <>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" x2="12" y1="8" y2="12" />
      <line x1="12" x2="12.01" y1="16" y2="16" />
    </>
  ),
  // Đang xếp hàng: clock
  clock: (
    <>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </>
  ),
};

export function BadgeIcon({ name }) {
  const path = PATHS[name];
  if (!path) return null;
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      width="11"
      height="11"
      className={name === "loader" ? "animate-spin [animation-duration:1.1s]" : undefined}
      aria-hidden="true"
    >
      {path}
    </svg>
  );
}

// Bảng đăng ký token cho Theme Studio (mô-đun ES nguyên bản của trình duyệt, không đi vào pipeline build).
//
// Đối chiếu chính xác:
// - Giao thức màu: src/styles/themes/_contract.css (20+1 token bắt buộc)
// - Hình thái/Layout/Vật liệu L3: src/styles/themes/_component-defaults.css
// tests/studio-token-registry.test.mjs khóa "token đăng ký PHẢI thực sự tồn tại trong
// src/styles" — khi giao thức tiến hóa thì cập nhật theo tại đây, không để trôi nổi âm thầm.

export const TOKEN_GROUPS = [
  {
    id: "contract",
    label: "Giao thức màu (bắt buộc cho skin)",
    tokens: [
      { name: "--bg", type: "color", hint: "Màu nền trang" },
      { name: "--paper", type: "color", hint: "Giấy/phẳng" },
      { name: "--surface", type: "color", hint: "Bề mặt lớp phủ" },
      { name: "--ink", type: "color", hint: "Chữ nội dung" },
      { name: "--muted", type: "color", hint: "Chữ phụ" },
      { name: "--line", type: "color", hint: "Đường viền/phân chia" },
      { name: "--accent", type: "color", hint: "Màu nhấn mạnh" },
      { name: "--accent-weak", type: "color", hint: "Nền nhấn yếu" },
      { name: "--selection", type: "color", hint: "Phạm vi chọn" },
      { name: "--danger", type: "color", hint: "Nguy hiểm" },
      { name: "--danger-weak", type: "color", hint: "Nền nguy hiểm yếu" },
      { name: "--ok", type: "color", hint: "Thành công" },
      { name: "--ok-weak", type: "color", hint: "Nền thành công yếu" },
      { name: "--warn", type: "color", hint: "Cảnh báo/đánh dấu huỳnh quang" },
      { name: "--warn-weak", type: "color", hint: "Nền cảnh báo yếu" },
      { name: "--gold", type: "color", hint: "Vàng/dấu ấn" },
      { name: "--gold-weak", type: "color", hint: "Nền vàng yếu" },
      { name: "--chrome", type: "color", hint: "Viền sẫm" },
      { name: "--reader-page", type: "color", hint: "Nền trang đọc" },
      { name: "--shadow-color", type: "color", hint: "Màu nền bóng" },
    ],
  },
  {
    id: "shape",
    label: "L3 · Hình thái thành phần",
    tokens: [
      { name: "--btn-radius", type: "text", hint: "Bo góc nút chính" },
      { name: "--btn-primary-bg", type: "color", hint: "Nền nút chính" },
      { name: "--btn-primary-fg", type: "color", hint: "Chữ nút chính" },
      { name: "--panel-radius", type: "text", hint: "Bo góc vỏ hộp thoại" },
      { name: "--stage-veil", type: "text", hint: "Độ dày màn che %" },
      { name: "--ornament-line", type: "color", hint: "Đường viền đồ trang trí" },
    ],
  },
  {
    id: "layout",
    label: "L3 · Mật độ bố cục",
    tokens: [
      { name: "--shell-pad-inline", type: "text", hint: "Khoảng đệm hành lang" },
      { name: "--shell-pad-inline-narrow", type: "text", hint: "Hành lang màn hình hẹp" },
      { name: "--header-width", type: "text", hint: "Chiều rộng thanh tiêu đề" },
      { name: "--header-gap-bottom", type: "text", hint: "Khoảng cách dưới thanh tiêu đề" },
      { name: "--stage-width", type: "text", hint: "Chiều rộng bàn giấy" },
      { name: "--stage-pad", type: "text", hint: "Lót bàn giấy" },
      { name: "--stage-shadow", type: "text", hint: "Bóng bàn giấy" },
    ],
  },
  {
    id: "mat",
    label: "L3 · Chất liệu bầu không khí",
    tokens: [
      { name: "--mat-fiber", type: "color", hint: "Sợi 1" },
      { name: "--mat-fiber-2", type: "color", hint: "Sợi 2" },
      { name: "--mat-edge", type: "color", hint: "Ép tối hành lang" },
      { name: "--mat-center", type: "color", hint: "Nâng sáng trung tâm" },
    ],
  },
];

/** Token bắt buộc cho tệp skin (dùng cho xuất tệp), giống với _contract.css */
export const REQUIRED_TOKENS = TOKEN_GROUPS[0].tokens.map((t) => t.name);

/**
 * Bảng phân tích click chọn: trong iframe, phần tử được click sẽ khớp từ trong ra ngoài với điều kiện đầu tiên,
 * bảng điều khiển sẽ tập trung vào token "quản lý". Trường hợp đặc biệt lớp trang trí: M3 sẽ thực hiện quy trình sinh ảnh.
 */
export const SELECTOR_TOKEN_MAP = [
  { match: ".app-button", label: "Nút chính", tokens: ["--btn-primary-bg", "--btn-primary-fg", "--btn-radius", "--accent"] },
  { match: ".decor-quote", label: "Biểu ngữ chữ (trang trí)", tokens: ["--ornament-line", "--gold", "--paper"] },
  { match: ".decor-layer", label: "Lớp trang trí (vị trí sinh ảnh M3)", tokens: [], decorSlot: true },
  { match: ".home-paper-stage", label: "Bàn giấy", tokens: ["--stage-veil", "--stage-width", "--stage-pad", "--stage-shadow", "--paper"] },
  { match: ".app-shell-header", label: "Thanh tiêu đề", tokens: ["--header-width", "--header-gap-bottom", "--ink", "--paper"] },
  { match: "button, [role='button']", label: "Nút/điều khiển thông thường", tokens: ["--accent", "--ink", "--paper", "--line"] },
  { match: "input, textarea, select", label: "Điều khiển nhập", tokens: ["--paper", "--ink", "--line", "--muted"] },
  { match: "h1, h2, h3, h4", label: "Chữ tiêu đề", tokens: ["--ink"] },
  { match: "p, span, li", label: "Chữ nội dung/phụ", tokens: ["--ink", "--muted"] },
  { match: "body", label: "Bầu không khí toàn cục", tokens: ["--bg", "--paper", "--ink", "--mat-edge", "--mat-center"] },
];

/** Kiểm tra độ tương phản WCAG trước khi xuất cặp màu then chốt (tiền cảnh, nền, cấp độ mong muốn) */
export const CONTRAST_PAIRS = [
  { fg: "--ink", bg: "--paper", label: "正文/纸面", min: 7 },
  { fg: "--ink", bg: "--bg", label: "正文/底色", min: 4.5 },
  { fg: "--muted", bg: "--paper", label: "次要字/纸面", min: 4.5 },
  { fg: "--btn-primary-fg", bg: "--btn-primary-bg", label: "主按钮字/底", min: 4.5 },
  { fg: "--danger", bg: "--paper", label: "危险字/纸面", min: 3 },
];

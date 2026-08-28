# Skin: Mặc Gia (id `mojia`)

Gói trang trí đi kèm `decor/mojia` (10 yếu tố cơ quan tổng hợp). Khác biệt với tuyến xám lạnh khoảng trống của jiangnan "Giấy Mộc": ấm hơn một bậc, đoan trang hơn một bậc, nhưng vẫn giữ kỷ luật không dùng màu diện tích lớn.

## Logic lấy màu

| Token | Giá trị | Ghi chú |
|-------|-----|------|
| `--bg` | `#f2efe8` | Lụa mộc ấm, khác với xám đá lạnh của jiangnan |
| `--paper` | `#faf8f1` | Mặt lụa gần trắng hơi ấm |
| `--ink` | `#26221b` | Huyền mặc pha nâu, phối màu gỗ không ngả xanh |
| `--accent` | `#4c6658` | Xanh đồng, trạng thái chọn/nhấn mạnh |
| `--btn-primary-bg` | `var(--accent)` | Nút chính/trạng thái chọn xanh đồng, góc vuông 8px (bản đầu thử nền huyền mặc, quá cứng nên bỏ) |
| `--gold` | `#8f7442` | Vàng đồng, chỉ điểm xuyết nhãn nhỏ |
| `--danger` | `#b23b32` | Chu sa trầm một bậc, đè được màu gỗ |

## Kỷ luật

1. Diện tích lớn chỉ dùng lụa và mặc, đồng/xanh/son chỉ làm màu chức năng diện tích nhỏ.
2. Yếu tố cơ quan giao cho gói trang trí, bản thân skin không chất vân.
3. Độ mờ bóng nền cắt ≤ 10%, dưới panel không được trông bẩn (giới hạn đỏ giống jiangnan).

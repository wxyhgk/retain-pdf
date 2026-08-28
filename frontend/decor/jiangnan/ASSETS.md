# Gói trang trí "Giấy Mộc · Giang Nam" — Hướng dẫn tạo tài sản mỹ thuật

> Tệp này dành cho **công cụ AI tạo (văn sinh hình / văn sinh 3D) + người tiếp nhận sau** đọc đặc tả tài sản.
> Tài sản tạo ra thay thế tệp cùng tên trong thư mục này là có hiệu lực, không cần sửa mã; thêm tầng mới mới cần
> sửa manifest.json (hợp đồng định dạng xem `docs/theme-system/DECOR_PACKS.md`).
> Ba tệp SVG trong thư mục hiện tại là bản vector vẽ tay chính thức (hợp đồng cho phép định dạng svg); nếu sau này đổi sang
> bitmap văn sinh hình, theo prompt bên dưới tạo webp cùng tên thay thế là được.

---

## 1. Khí chất chủ đề (tất cả tài sản cùng tuân thủ)

**Hình tượng**: Vườn Giang Nam · Núi xa trong sương · Giấy mộc · Thư phòng văn nhân. Kiềm chế, khoảng trống, bão hòa thấp.
**Cấm**: Màu bão hòa cao, nét viền cartoon cứng, yếu tố cyber/hiện đại, bố cục chen chúc.

Bảng màu bắt buộc lấy từ token chủ đề (trong tài sản cho phép viết cứng màu, nhưng sắc tướng phải nằm trong bộ này):

| token | Giá trị | Mục đích |
|---|---|---|
| Đáy giấy `--paper` | `#fbfaf8` | Phần sáng / khoảng trống |
| Đáy xám đá `--bg` | `#f1f0ed` | Tông nền |
| Xanh lục `--accent` | `#2a5f57` | Phần sâu của trúc, núi (thường dùng bậc màu nhạt hơn) |
| Mực `--ink` | `#1b1b1d` | Chỉ điểm nhấn, không dùng diện tích lớn |
| Chu sa `--danger` họ | `#c23b32` → Ấn giữ chỗ dùng `#b0493f` | Chỉ cho con dấu/chấm phá |

**Ngưỡng tương phản**: Tất cả trang trí đặt dưới UI chức năng, panel chức năng là màu giấy ~88% không mờ.
Độ sáng tổng thể tài sản nền phải ≥ `#dde2dd` (cảm giác sương), nếu không lọt qua panel sẽ trông bẩn.

## 2. Thông số kỹ thuật chung (hợp đồng bắt buộc, vượt giới hạn không qua cổng)

- Định dạng: `webp` (ưu tiên) / `png` / `svg` / `avif`; **đạo cụ bắt buộc nền trong suốt**
- Tệp đơn ≤ **512 KB** (`IMAGE_BUDGET_KB`, chân lý contract.ts)
- Không gian màu sRGB; bitmap theo bảng "kích thước xuất hình" bên dưới (đã chứa dư lượng 2x)
- Tên khớp với `src` trong manifest.json; thay thế = ghi đè cùng tên

## 3. Thông số từng tài sản + prompt tạo

### 3.1 `bg.svg` → Đề nghị đổi sang `bg.webp` (backdrop toàn màn hình)

- Xuất hình: **3200×1800** (16:9, object-fit: cover, màn hình hẹp cắt hai bên)
- Ràng buộc cứng bố cục: **60% phía trên gần như để trống** (sương/trời, panel chức năng đè ở đây);
  núi tập trung **1/3 phía dưới**, chỗ tối nhất bốn góc hình không sâu hơn `#93aa9d`
- Prompt:
  > Phong cách thủy mặc đạm thái, núi xa Giang Nam, sương sớm lan tỏa, tông xanh xám (#93aa9d đến #f1f0ed),
  > bóng núi ba tầng chồng từ nhạt đến đậm, hai phần ba phía trên hình là màu sương để trống, bố cục khoảng trống cực giản,
  > bão hòa thấp, không nhân vật không kiến trúc, ngang 16:9

### 3.2 `bamboo.svg` → `bamboo.webp` (cành trúc left-bottom)

- Xuất hình: **600×840** (bố cục dọc 5:7, nền trong suốt)
- Ràng buộc cứng bố cục: Chủ thể **sát mép trái và mép dưới** mọc (slot neo ở góc dưới trái màn hình),
  phía phải, phía trên để khoảng thở trong suốt; 2-3 thân trúc + ít lá, kỵ rậm rạp
- Prompt:
  > Hai ba thân mực trúc từ góc dưới trái hình chéo ra, phong cách thủy mặc, tông xanh lục (#4c7466, #5d8273),
  > thưa thớt khoảng trống, lá trúc năm ba thành nhóm, nền trong suốt, chất liệu tiểu phẩm hội họa Trung Quốc

### 3.3 `seal.svg` → `seal.webp` (con dấu tàng thư right-bottom)

- Xuất hình: **280×280** (vuông, nền trong suốt)
- Ràng buộc cứng bố cục: Một con dấu chiếm 85% hình, nghiêng phải nhẹ 2-3° tự nhiên hơn
- Prompt:
  > Một con dấu tàng thư chu sa, phong cách triện khắc, màu đỏ tối (#b0493f), khung vuông góc bo tròn,
  > văn ấn có thể là "tàng thư" hoặc hoa văn triện trừu tượng, mép có cảm giác khuyết nhỏ thủ công khi đóng ấn, nền trong suốt

### 3.4 Đề tự (quote) — không phải tài sản hình ảnh

Văn tự dọc do sân khấu render trực tiếp (sửa `quote.text` trong manifest.json là được),
**không** tạo hình văn tự. Văn án hiện tại: 「Thư tàng vạn quyển / Tâm du thiên tải」.

## 4. Điểm neo bỏ trống (muốn thêm tài sản mới đặt vào đây)

Theo manifest thêm một dòng `{ "type": "image", "slot": "<id>", "src": "<tệp>" }` là được:

| slot | Vị trí màn hình | Đề nghị xuất hình | Nội dung phù hợp |
|---|---|---|---|
| `hero` | Vùng banner đỉnh (vị trí "tiếp tục đọc" cũ) | 440×520 trong suốt | Nhân vật đọc sách (thiếu nữ/thiếu niên bản phác thảo) |
| `left-top` / `right-top` | Cánh trên trái phải | 560×720 trong suốt | Cành rủ, đèn lồng, chim bay |
| `top-center` | Trên điều hướng | 1040×220 trong suốt | Trang sức hình vòm, bướm |
| `edge-left` / `edge-right` | Ép cạnh đè UI (tầng duy nhất nổi trên UI) | 280×1920 trong suốt | Cành hoa vươn vào panel — **phải cực thưa**, 80% giữa để trống |

## 5. Tài sản 3D (engine three kết nối xong bật, thông số lập trước ở đây)

- Định dạng `.glb`, **sau nén Draco + KTX2 ≤ 2 MB, ≤ 50.000 mặt tam giác** (chân lý contract.ts)
- Clip hoạt hình nhúng trong và đặt tên, trong manifest `idleClip` (chờ vòng lặp) / `clickClip` (nhấp một lần) tham chiếu
- **Bắt buộc kèm hình fallback cùng tên** (manifest `fallback` bắt buộc điền) — sân khấu phiên bản hình / máy cấu hình thấp /
  reduced-motion đều render hình này, nên bản thân fallback phải đạt chuẩn chất lượng tài sản 2D bên trên
- Pipeline: AI tạo → `gltf-transform optimize` → Kiểm tra ngân sách → Nhập kho

## 6. Nghiệm thu (bắt buộc chạy sau khi thay/thêm tài sản)

```bash
cd frontend
# Hợp đồng manifest + kế hoạch sân khấu (sau khi thêm tầng/sửa manifest)
node --import ./tests/helpers/register-jsx.mjs --test tests/decor-stage.test.mjs
# Cổng dung lượng (512KB)
find decor/jiangnan -type f \( -name '*.webp' -o -name '*.png' -o -name '*.svg' -o -name '*.avif' \) -size +512k
# ↑ Có output = vượt ngân sách, nén xong mới nhập kho
```

Kiểm tra bằng mắt trên trình duyệt: Chuyển chủ đề sang "Giấy Mộc", xác nhận màn hình hẹp <1100px chỉ giữ nền,
khả năng đọc văn bản panel chức năng không bị nền can nhiễu.

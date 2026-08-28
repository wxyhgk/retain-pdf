# Gói trang trí "Mặc Gia" — Mô tả tài sản mỹ thuật

> Định dạng tệp này tuân theo mẫu `decor/jiangnan/ASSETS.md` (chân lý hợp đồng xem tại
> `docs/theme-system/DECOR_PACKS.md`). Tài sản trong gói hiện tại là **bản chính thức**:
> nền là tranh khung lụa do người dùng cung cấp; đạo cụ gồm 10 tấm PNG trong suốt chủ đề
> cơ quan Mặc Gia (1254×1254 RGBA) được ImageMagick cắt viền / thu phóng / ghép / nén.
> Thay thế tài sản chỉ cần ghi đè cùng tên.

---

## 1. Khí chất chủ đề (tất cả tài sản cùng tuân thủ)

**Hình tượng**: Xưởng Mặc Gia · Trúc giản quyển trục · Cơ quan đồng xanh · Quy củ thằng mặc. Đoan trang, kiềm chế, ấm mộc.
**Cấm**: Màu bão hòa cao, yếu tố cyber/hiện đại, bố cục chen chúc, cận cảnh binh khí đè màn hình.

Bảng màu lấy từ token skin (`src/styles/themes/mojia.css`):

| token | Giá trị | Mục đích |
|---|---|---|
| Lụa mộc `--paper` | `#faf8f1` | Phần sáng / khoảng trống |
| Nền lụa ấm `--bg` | `#f2efe8` | Tông nền / sương đáy đạo cụ |
| Đồng xanh `--accent` | `#4c6658` | Nhấn chính |
| Mực huyền `--ink` | `#26221b` | Đáy nút chính / điểm nhấn |
| Vàng đồng `--gold` | `#8f7442` | Chấm phá diện tích nhỏ |

**Ngưỡng tương phản**: Nền đặt dưới tấm giấy ~92% không mờ, độ sáng tổng thể phải ≥ `#dde2dd`.

**Kỷ luật sắp xếp** (rút ra từ kiểm tra thiết bị thật):

- Vật đứng/nằm chỉ đặt **điểm neo bottom** (chân chạm mép dưới màn hình);
  điểm neo top chỉ đặt vật biết bay (diều gỗ) — vật đứng đặt top = nhãn dán lơ lửng
- `hero` rơi vào vùng banner panel thư viện, `top-center` va chạm điều hướng nổi, **hai điểm neo bị cấm**
- Vật cùng phía ghép thành "nhóm hình" một tấm (một slot một tầng), không rải rác thành nhãn dán bốn góc

## 2. Thông số kỹ thuật chung (hợp đồng bắt buộc)

- Định dạng: `webp` (ưu tiên) / `png` / `svg` / `avif`; **đạo cụ bắt buộc nền trong suốt**
- Tệp đơn ≤ **512 KB** (`IMAGE_BUDGET_KB`, chân lý contract.ts)
- Không gian màu sRGB; tên khớp với `src` trong manifest.json; thay thế = ghi đè cùng tên

## 3. Thông số từng tài sản (hiện trạng + pipeline tái tạo)

Nguồn nguyên liệu: `mojia-transparent-assets-10-elements/*.png`. Tiền xử lý chung: `magick <nguyen_lieu> -trim +repage`.
Quy trình hòa trộn đạo cụ thống nhất: `-modulate 100,90,100` giảm bão hòa + chồng dải sương màu `--bg` ở đáy
(vật chạm đáy 220px đậm đến 55%), cùng ngôn ngữ cảm giác sương với đáy bg; **không thêm bóng cứng chạm đất**
(bóng trên điểm neo lơ lửng trông giả hơn cả đạo cụ). Nén: `-define webp:alpha-quality=95 -quality 85`.

### 3.1 `bg.webp` (backdrop toàn màn hình, 31 KB)

- Nguồn: **Bản do người dùng cung cấp** (nền lụa ấm + khung hồi văn bốn góc + núi xa/miệng bánh răng mực nhạt hai góc dưới),
  kích thước gốc 1672×941 chuyển thẳng sang webp, không gia công lần hai
- Bố cục tự nhiên đáp ứng hợp đồng: 60% phía trên để trống, phía dưới cảnh nhạt, độ sáng cao hơn ngưỡng đỏ nhiều

### 3.2 `kite.webp` (left-top đôi diều gỗ ← nguyên liệu 07)

- Xuất hình: **560×720** trong suốt; diều chính rộng 300 (+170,+60, ngửa 6°), diều phụ rộng 165
  (+40,+150, cúi 4°), bay vào khung hình từ phải trên, chỉ chiếm phần trên canvas —
  left-top là điểm neo duy nhất "vật biết bay" nên ở (top-center va chạm điều hướng nổi, cấm)

### 3.3 `master.webp` (right-bottom-fg đại sư cơ quan đơn nhân ← nguyên liệu 02)

- Xuất hình: **600×840** trong suốt, nhân vật cao 800 (95% canvas) sát phải sát đáy, dải sương 220px chạm đất
- Từng là thành viên nhóm scholar, nay theo yêu cầu kiểm tra thực tế phóng to đơn nhân; treo **right-bottom-fg** (dải fg,
  đè lên trên panel, tránh tà áo chìm vào mép panel), kèm `clickQuote` hai câu ngữ lục "Mặc Tử"
  (nhấp nhân vật luân phiên: Chí bất cường giả trí bất đạt, ngôn bất tín giả hành bất quả / Hưng thiên hạ chi lợi, trừ thiên hạ chi hại)

### 3.4 `scholar.webp` / `lantern-lock.webp` (dự phòng, chưa treo tầng)

- Hai nhóm hình (thư án đại sư / xảo cơ dưới đèn, thông số xem lịch sử git), sau kiểm tra thiết bị thật đã gỡ; tệp giữ trong kho có thể treo lại

### 3.5 `boy.webp` (dự phòng, chưa treo tầng ← nguyên liệu 01)

- Xuất hình: 440×520 trong suốt. Vị trí anh hùng (hero) rơi vào vùng banner panel thư viện,
  nhân vật sẽ bị mặt giấy ép thành "tàn ảnh watermark" — trước khi bố cục tiến hóa không đưa vào kho treo tầng

### 3.6 `gear-btn.webp` (mặt nút "thêm" ← nguyên liệu 03, không qua manifest)

- Xuất hình: **128×125** trong suốt (dư lượng 3x cho mặt nút 40px), bánh răng cắt viền gọn, không làm mờ
- Bên tiêu thụ là quy tắc `.library-bottom-icon-btn-ornament` trong `themes/mojia.css`
 *(móc thay trang phục dự phòng của component AppBottomBar), đổi mặt nút "+" thanh dưới thành bánh răng thật,
  hover xoay 45°; không qua manifest, không vào tầng sân khấu
- **Lưu ý**: Trong CSS chủ đề, hình này được nhúng inline dạng data: URI (phiên bản phái sinh 112px q80, ~8KB),
  hình thay đổi phải đồng bộ tạo lại bản inline. Một bẫy khác: móc là thay đổi component, **bắt buộc
  `npm run build:js` xuất lại bundle** — chỉ chạy build:css sẽ xuất hiện "skin giấu dấu +,
  phần tử móc không tồn tại" nút trống

### 3.7 `tools-btn.webp` (mặt nút "cài đặt" ← nguyên liệu 06, không qua manifest)

- Xuất hình: **128×128** trong suốt; CSS chủ đề nhúng inline phiên bản phái sinh 112px q80 (~6KB)
- Bên tiêu thụ giống nút bánh răng: móc ornament của `#app-settings-btn`; "cài đặt = công cụ quy củ", hover nâng nhẹ

### 3.8 `scroll-btn.webp` / `library-btn.webp` / `fav-btn.webp` (mặt biểu tượng tab thanh trên ← nguyên liệu 08 / 11 / 12, không qua manifest)

- Xuất hình: đều **128px** trong suốt; CSS chủ đề nhúng inline phiên bản phái sinh 96px q80 (mỗi tấm ~3KB)
- Bên tiêu thụ: móc `.library-top-tab-ornament` của `#library-top-tab-{categories,library,favorites}`
  (component LibraryTopTabs dự phòng), vị trí biểu tượng 24px tràn nhẹ;
  ngữ nghĩa: thư viện = kệ sách trúc giản cơ quan, bộ sưu tập = cuộn trúc giản, yêu thích = nhập hòm điển tạng
- **Lưu ý**: Nguyên liệu 11 / 12 là hình nền trắng RGB (không phải RGBA), trước khi nhập kho phải tách nền:
  `-alpha set -fuzz 9% -fill none -floodfill +2+2 white` (bốn góc mỗi lần);
  08 và 10 tấm nguyên liệu trước đó vốn trong suốt, trực tiếp `-trim` là được

### 3.9 Đề tự (quote) — không phải tài sản hình ảnh

Văn tự dọc do sân khấu render trực tiếp. Văn án hiện tại: 「Kiêm tương ái / Giao tương lợi」("Mặc Tử · Kiêm Ái").

## 4. Điểm neo bỏ trống

| slot | Trạng thái | Lý do |
|---|---|---|
| `hero` / `top-center` | **Cấm** | Rơi vào vùng panel chức năng/điều hướng nổi, xem §1 kỷ luật sắp xếp |
| Giữa dưới (hai bên thanh dưới) | **Cấm** | Panel thư viện chiếm đầy chiều cao đáy: dải mid bị panel đè thành tàn ảnh, dải fg đè lên thẻ sách như nhãn dán. Từng đăng ký điểm neo `bottom-center` (lõi bánh răng), sau kiểm tra thiết bị thật phủ quyết đã lùi |
| `right-top` | Trống | Dải đề tự độc chiếm phải trên, thêm đạo cụ sẽ đè lấn nhau |
| `edge-left` / `edge-right` | Trống | Dải fg ép biên; nếu thêm (anh lạc/dây mực) phải cực thưa, 80% giữa để trống |

Nguyên liệu 05 liên nỏ / 09 thành lâu: Tranh khung cảnh người dùng đã chứa viễn cảnh, phương án cắt bóng bỏ, hình gốc giữ làm nguyên liệu cho 3D hóa hoặc chủ đề khác sau này; nguyên liệu 03 bánh răng chuyển làm mặt nút "thêm" (xem §3.6).

## 5. Nghiệm thu (bắt buộc chạy sau khi thay/thêm tài sản)

```bash
cd frontend
node --import ./tests/helpers/register-jsx.mjs --test tests/decor-stage.test.mjs
find decor/mojia -type f \( -name '*.webp' -o -name '*.png' -o -name '*.svg' -o -name '*.avif' \) -size +512k
# ↑ Có output = vượt ngân sách, nén xong mới nhập kho
```

Kiểm tra bằng mắt trên trình duyệt: Chuyển chủ đề sang "Mặc Gia", xác nhận màn hình hẹp <1100px chỉ giữ nền,
khả năng đọc văn bản panel chức năng không bị nền can nhiễu.

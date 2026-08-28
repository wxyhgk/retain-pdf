# Hợp đồng gói trang trí (Decor Packs)

> Trạng thái: Hợp đồng + sân khấu phiên bản hình ảnh đã triển khai (engine three chưa thực hiện, tầng model tạm dùng hình fallback).
> Chân lý mã: `frontend/src/shared/decor/{slots,contract,stage-plan}.ts` · `DecorStage.tsx`
> Định vị slot: `frontend/src/styles/core/decor-stage.css` · Gói mẫu: `frontend/decor/jiangnan/`
> Kiểm thử: `frontend/tests/decor-contract.test.mjs` · `tests/decor-stage.test.mjs`

## Là gì

Hệ thống chủ đề hiện có (`data-theme` + biến CSS ngữ nghĩa) chỉ quản **bảng màu**. Gói trang trí phủ lên trên một tầng
**thế giới thị giác tùy chọn**: minh họa nền toàn màn hình, đạo cụ phân tầng, mô hình 3D nhấp phát hoạt hình, biểu ngữ đề tự —
tức chủ đề "quốc phong/vườn thảo/nguyên" trong bản phác thảo khái niệm.

```
Chủ đề trang trí = Skin bảng màu (themes/<id>.css)  ← Hệ thống sẵn có, không động
               + Gói trang trí   (decor/<pack>/manifest.json + tài sản)
```

`ThemeDefinition.decorPack` trong `registry.ts` trỏ đến tên gói. **Skin không có decorPack
(classic / night) bằng không trang trí, bằng không tải thêm** — chunk three.js chỉ dynamic import khi gói trang trí chứa tầng model.

## Nguyên tắc đầu tiên: UI chức năng luôn là DOM

Lưới thư viện, thanh trên, tìm kiếm, nút toàn bộ giữ React/DOM. Tầng trang trí chỉ treo trên **điểm neo đặt tên (slot)**,
chia ba dải tầng:

```
z-index thấp → cao
  bg   Minh họa nền toàn màn hình          (luôn bị panel UI che)
  ---- Bảng lưng UI chức năng (--surface bán trong suốt) ----
  mid  Đạo cụ trung cảnh: nhân vật/đỉnh đồng/ngựa (có thể bị panel UI che một phần)
  ---- Nội dung UI chức năng ----
  fg   Viền trước ép cạnh: cành hoa/lưu tô    (đè lên mép UI, pointer-events: none)
```

## Bản đồ điểm neo (chân lý slots.ts)

```
┌─────────────────────────────────────────────┐
│ left-top      top-center        right-top   │
│                  hero              quote    │
│ e┌─────────────────────────────────────┐e   │
│ d│                                     │d   │
│ g│         UI chức năng (panel thư viện)│g   │
│ e│                                     │e   │
│ -│                                     │-   │
│ l└─────────────────────────────────────┘r   │
│ left-bottom                   right-bottom  │
│              (right-bottom-fg: vị trí tiền cảnh phải dưới) │
│              backdrop (toàn màn hình)                       │
└─────────────────────────────────────────────┘
```

- Slot ở đâu, lớn bao nhiêu, z-index gì: **CSS sân khấu thống nhất thực hiện** (DecorStage chờ xây),
  manifest chỉ khai báo "tài sản treo slot nào". Phía tài sản và phía bố cục tách rời.
- Một slot chỉ treo một tầng. Muốn chồng → slots.ts mở điểm neo mới, không chồng trong manifest.
- Thêm điểm neo = slots.ts đăng ký một dòng + CSS sân khấu bổ sung một dòng định vị, kiểm nghiệm tự động thông qua.

## Ví dụ manifest

```jsonc
// decor/guofeng/manifest.json
{
  "version": 1,
  "id": "guofeng",
  "layers": [
    { "type": "image", "slot": "backdrop",    "src": "bg.webp", "parallax": 0.05 },
    { "type": "image", "slot": "left-bottom", "src": "dragon.webp" },
    { "type": "model", "slot": "left-top",    "src": "girl.glb",
      "fallback": "girl.webp", "idleClip": "Breathe", "clickClip": "TurnPage" }
  ],
  "quote": { "slot": "quote", "text": "Tri kỳ sở lai\nMinh kỳ sở vãng" }
}
```

## Quy tắc cứng (validateDecorManifest bắt buộc)

| Quy tắc | Lý do |
|---|---|
| Tầng model `fallback` bắt buộc điền | Chuỗi giảm cấp là hợp đồng: reduced-motion / không WebGL / máy cấu hình thấp → hình tĩnh |
| Backdrop cấm treo 3D | Ngưỡng đỏ hiệu năng; nền dùng image + parallax giả thật |
| Tầng 3D ≤ 3 | Canvas đơn renderer đơn, nhiều chắc chắn giật |
| Tổng số tầng ≤ 12 | Chống "dán đầy màn hình" mất kiểm soát |
| src chỉ đường dẫn tương đối trong gói | Cấm `..` / đường dẫn tuyệt đối / http: / data: |
| parallax ∈ [0, 0.2] | Thị sai là chấm phá không phải kỹ xảo |
| quote chỉ treo điểm neo textCapable | Sắp chữ do sân khấu thống nhất xử lý |

## Ngân sách tài sản (hằng số contract.ts, cổng pipeline cấm)

| Hạng mục | Giới hạn trên |
|---|---|
| glb đơn (sau nén Draco+KTX2) | 2048 KB |
| Mặt tam giác mô hình đơn | 50.000 |
| Hình trang trí đơn (webp) | 512 KB |

Pipeline mô hình AI sản xuất: AI tạo → `gltf-transform optimize` (hình học Draco + vân KTX2) →
Cổng ngân sách (npm script, vượt giới hạn từ chối nhập kho) → Đặt tên clip hoạt hình (tên tham chiếu trong `idleClip`/`clickClip`
phải tồn tại trong glb) → Nhập kho.

## Mô hình tương tác (tuân thủ khi engine sân khấu thực hiện)

- Canvas WebGL trong suốt toàn màn hình đơn chở tất cả tầng model, `pointer-events: none`.
- Window lắng nghe click, raycast trúng đối tượng đã đăng ký `clickClip` mới phát hoạt hình —
  Sự kiện UI và trang trí không can nhiễu lẫn nhau.
- `idleClip` phát vòng lặp; khi `prefers-reduced-motion` không tải three, trực tiếp dùng hình fallback.
- Tầng image có thể khai báo `clickQuote`: Sân khấu phủ một nút hotspot trong suốt lên tầng hình đó
  (chỉ che phần thực thể nhân vật, khôi phục `pointer-events`), nhấp luân phiên bong bóng ngữ lục, 5s tự đóng;
  bản thân `<img>` trang trí vẫn `pointer-events: none` + `alt=""`, tương tác đi qua nút thật.

## Thêm một gói trang trí mới

1. `decor/<pack>/` đặt manifest.json + tài sản (qua cổng ngân sách)
2. **Cùng thư mục viết `ASSETS.md` đặc tả tài sản** (prompt từng tài sản cho công cụ AI tạo +
   ràng buộc cứng kích thước/bố cục/bảng màu, mẫu xem `decor/jiangnan/ASSETS.md`)
3. `registry.ts` chủ đề tương ứng thêm `decorPack: "<pack>"`
4. Chạy `tests/decor-contract.test.mjs` (khi schema thay đổi) + kiểm nghiệm manifest của engine sân khấu sẽ đỡ đáy khi tải

## Vị trí lộ trình

1. ✅ Hợp đồng manifest + bảng đăng ký slot (tài liệu này)
2. ✅ Hội tụ hardcode CSS (461→0, baseline ratchet `{}`)
3. ✅ Cổng (tests/css-color-literals.test.mjs, kiểm thử tức cổng)
4. ⬜ Token component L3 (hình thái nút/thẻ có thể đổi skin) — thực tiễn sân khấu phản hồi danh sách token
5. ✅ DecorStage phiên bản hình ảnh (gói mẫu jiangnan: núi sương/cành trúc/chu sa ấn/đề tự dọc;
   thị sai rAF tiết lưu; vùng an toàn <1100px chỉ giữ nền; chủ đề không gói như classic bằng không chi phí)
6. ⬜ Engine three + đạo cụ 3D đầu tiên + script cổng pipeline tài sản

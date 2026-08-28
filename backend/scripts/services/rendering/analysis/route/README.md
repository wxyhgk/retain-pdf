# rendering/analysis/route

## Trách nhiệm

Tầng quyết định tuyến đơn trang. Tiêu thụ `RenderPageProfile`, xuất ra `RenderPageRoute`.

Mã thực thi tầng trên chỉ được tiêu thụ tuyến từ đây hoặc trường sự thật trong profile. Ví dụ pseudo PDF
có đi `typst_visual` hay không, hidden text có bóc hay không, source cleanup có xóa vật lý hay không,
đều phải phái sinh từ cùng một page profile, không được quét riêng
`page_has_large_background_image()` trong overlay/source cleanup rồi phán đoán cục bộ.

## Lối vào công khai

- `builder.py`
- `models.py`

## Không nên làm gì

- Không quét lại PDF.
- Không thực hiện redaction.
- Không sinh Typst.
- Không thay đổi hành vi render thực tế, trừ khi tầng trên kết nối rõ ràng vào route.

Khi thêm phán đoán tuyến mới, giữ một phán đoán một tệp, ví dụ `redaction_route.py`, `background_route.py`.

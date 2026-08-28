# Hướng dẫn sử dụng layoutParsingResults[*].outputImages

`layoutParsingResults` trong `json_full.json` là cấu trúc ngoài cùng của đầu ra OCR mỗi trang. Sau khi nhận được mảng này, adapter/script gỡ lỗi sẽ lần lượt xử lý `prunedResult` cho cấu trúc và `markdown` cho phán đoán chiến lược trên từng trang, cuối cùng treo một số hình ảnh hỗ trợ thị giác lên `outputImages`. Trong mẫu paddle provider hiện tại, `outputImages` của mỗi trang chỉ có một mục:

| Tên khóa | Ví dụ nội dung | Mô tả |
| --- | --- | --- |
| `layout_det_res` | `https://.../layout_det_res_0.jpg?...` | Hình overlay của layout detection, vẽ lại polygon/bbox của tất cả block trong `prunedResult.parsing_res_list` lên ảnh gốc; URL là CDN trực tuyến Paddle OCR (có ủy quyền tạm thời) |

Nếu sau này thêm các key khác (ví dụ `crop_*.jpg` / `summary_vis`) cũng sẽ đặt vào từ điển này, quy ước đặt tên tiếp tục theo mức ngữ nghĩa `<stage>_<purpose>`. `outputImages` không phải trường bắt buộc, nhưng khi tồn tại thì đại diện cho việc provider đã sinh ra một hình ảnh thị giác có ý nghĩa ở stage hiện tại, có thể dùng để hỗ trợ hiểu kết quả phân đoạn.

## Chiến lược áp dụng cho các bên tiêu thụ

### Adapter (bộ thích ứng schema)
- Khuyến nghị dùng `layout_det_res` làm đối chiếu phụ trợ trong kiểm tra regression hoặc fixture của `document_schema`. Nhờ hình này có thể nhanh chóng xác nhận `block_bbox`/`polygon_points` ghi trong `prunedResult` có khớp với bố cục thực tế hay không, đặc biệt khi normalized document xuất hiện block thừa/thiếu thì đối chiếu lại hình này sẽ định vị vấn đề nhanh hơn.
- Không khuyến nghị ghi bất kỳ image URL nào trực tiếp vào normalized document. Loại hình này thuộc sản phẩm "cấp gỡ lỗi", không ảnh hưởng trường của downstream schema, nhưng có thể đính kèm liên kết bên cạnh regression report để provider mới dễ dàng rà soát xem có bỏ sót bố cục quan trọng nào không.

### Công cụ gỡ lỗi (script, log runtime)
- `layout_det_res` là lối vào gỡ lỗi trực quan nhất: khi tái tạo một case, tải URL này về máy là có thể xem overlay layout detection. Khuyến nghị in URL này đồng bộ khi các script như `regression_check.py`, `validate_document_schema.py` xuất summary (hoặc ghi vào summary do `reporting.py` sinh), để người vận hành tự nhiên mở kết quả thị giác trang tương ứng khi thấy normalized document có vấn đề.
- Các `outputImages` tiềm năng khác (như hình cắt bố cục tương lai) cũng chỉ nên ghi vào log/hệ thống tệp ở chế độ debug, tránh lưu giữ lượng lớn ảnh tạm vào pipeline dữ liệu chính thức.

### Xem trước/chẩn đoán frontend
- `layout_det_res` rất phù hợp làm panel thị giác "layout QA" (ví dụ trong bảng điều khiển gỡ lỗi nối liền ảnh gốc, overlay phát hiện, cây normalized). Vì URL có ủy quyền và kích thước lớn, nên coi nó là tùy chọn nhấp để xem, không tự động kéo trong luồng chính, tránh frontend thường xuyên kích hoạt xác minh CDN khi chạy chính thức.
- Nếu sau này muốn hiển thị cho người dùng "ảnh đã cắt" hoặc "ảnh chỉ đọc trực quan", có thể thêm trường `crop_*`, `vis_fit_res` vào `outputImages`, nói rõ chúng dành riêng cho frontend/báo cáo, vẫn ràng buộc qua README chỉ đọc ở trang QA/diagnostic.

## Khuyến nghị giữ trường

- `layout_det_res`: Giữ. Dù không phải dữ liệu chuỗi chính, vẫn nên giữ một bản URL hoặc tệp lưu trữ (như thư mục `layout_det_res_*` trong `artifacts.py`) trong provider attachment/regression report, dùng cho kiểm tra căn chỉnh thị giác sau này.
- Các `outputImages` khác: Nếu tên trường tương ứng rõ ràng với một tình huống gỡ lỗi/cắt nào đó (ví dụ `block_crop_res`, `layout_vis`), có thể chọn lưu giữ hay không tùy nhu cầu; nhưng nguyên tắc là chỉ cần không dùng để xây dựng normalized document, đều thuộc phạm vi "gỡ lỗi/trực quan", bật theo nhu cầu và ghi chú trong README rằng chúng không nên được parse vào schema.

## Gợi ý trường liên quan

- `inputImage`: Mỗi `layoutParsingResults` đồng thời cung cấp ảnh đầu vào gốc (`input_img_N.jpg`), khi hiển thị overlay frontend nên tải ảnh này trước, rồi đặt `layout_det_res` làm tầng overlay.
- `preprocessedImages`: Ảnh preprocessed ở tầng ngoài cùng JSON tổng thể (như `preprocessed_img_0.jpg`) là bản thảo trước khi phát hiện, phù hợp làm tham khảo kiểm tra hiệu quả tiền xử lý mô hình, không thuộc `outputImages`, nên chỉ bổ sung mô tả trong README.

Sau khi viết các quy ước này vào README, adapter/script gỡ lỗi có thể quay lại xem trực tiếp tệp này, không cần phán đoán lặp lại trong nhiều script xem những ảnh nào khả dụng. Điều này cũng phù hợp với tuyến chính hiện tại: tài liệu/script/regression đều lấy schema thống nhất làm cốt lõi, còn hình ảnh trực quan chỉ tồn tại như thông tin bổ trợ.

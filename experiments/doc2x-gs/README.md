# Thí nghiệm xóa văn bản正文 trong luồng nội dung PDF doc2x-gs

Thư mục này dùng để tái tạo thí nghiệm luồng nội dung PDF "xóa văn bản正文 gốc nhưng giữ công thức giữa dòng".

## Mục tiêu

Xác minh một phương án tinh tế hơn phủ bbox:

- Không rasterize toàn trang;
- Không xóa一刀切 theo bbox lớn;
- Trực tiếp viết lại luồng nội dung PDF;
- Xóa thao tác hiển thị văn bản `TJ/Tj` của正文 thông thường;
- Giữ các thao tác `Tj/Tm` vụn vặt và yếu tố vector trong công thức giữa dòng;
- Sau đó phủ bản dịch tiếng Trung Typst của chúng ta.

Tệp tham chiếu đóng nguồn `电子结构方法-第四章-高斯基组-onlyTrans.pdf` cơ bản đi theo hướng tương tự: văn bản tiếng Anh gốc không trích xuất được, nhưng công thức giữa dòng vẫn giữ dưới dạng văn bản/vector PDF gốc.

## Tệp

- `电子结构方法-第四章-高斯基组.pdf`: PDF mẫu gốc.
- `电子结构方法-第四章-高斯基组-onlyTrans.pdf`: Đầu ra dự án đóng nguồn, dùng để so sánh.
- `content_stream_text_strip.py`: Script POC hiện tại.
- `work/`: Thư mục đầu ra thí nghiệm.

## Chạy

Chạy trong thư mục này:

```bash
python3 content_stream_text_strip.py \
  --input 电子结构方法-第四章-高斯基组.pdf \
  --output work/content-op-strip.pdf \
  --diagnostics work/content-op-strip-diagnostics.json \
  --preview work/content-op-strip-page1.png \
  --pages 1
```

Cũng có thể chạy phương án chuyên gia đề xuất "redact trước rồi dán lại vùng công thức":

```bash
python3 redact_restore_formula.py \
  --input 电子结构方法-第四章-高斯基组.pdf \
  --output work/redact-restore-formula.pdf \
  --diagnostics work/redact-restore-formula-diagnostics.json \
  --preview work/redact-restore-formula-page1.png \
  --pages 1
```

Đầu ra:

- `work/content-op-strip.pdf`
- `work/content-op-strip-diagnostics.json`
- `work/content-op-strip-page1.png`

## Hiệu quả hiện tại

Với trang 1:

- Văn bản正文 tiếng Anh, tiêu đề tiếng Anh, chân trang bị xóa;
- Ba công thức giữa dòng được giữ lại;
- PDF không bị chuyển thành ảnh, công thức vẫn là đối tượng PDF gốc;
- Văn bản trích xuất cơ bản chỉ còn khối công thức.

## Hạn chế hiện tại

Đây vẫn là POC mẫu, chưa phải cài đặt chung backend.

Quy tắc hiện tại tận dụng đặc trưng cấu trúc của PDF này:

- Văn bản正文 chủ yếu mã hóa bằng mảng `TJ` dài;
- Công thức giữa dòng chủ yếu mã hóa bằng nhiều `Tj/Tm` vụn vặt;
- Biến đơn lẻ trong正文 cần quy tắc bổ sung để xóa sạch.

Phiên bản chung backend còn cần bổ sung:

- Ánh xạ ổn định `Tj/TJ -> bbox`;
- Kết nối bbox `display_formula` của PaddleOCR làm vùng保护区;
- Trong vùng保护区 giữ thao tác văn bản gốc, ngoài vùng保护区 xóa thao tác正文;
- Kết hợp với chiến lược Typst overlay / source cleanup hiện có thành chế độ render tùy chọn.

## Hướng tích hợp khuyến nghị

Chuyên gia khuyến nghị ưu tiên tích hợp `apply_redactions + show_pdf_page`, vì độ phức tạp kỹ thuật thấp hơn nhiều so với text-op interpreter đầy đủ.

Luồng backend có thể là:

1. Giai đoạn OCR giữ bbox `display_formula`.
2. Giai đoạn cleanup thực hiện redaction cho bbox dịch正文.
3. Sau redaction, từ PDF gốc clip lại vùng công thức theo bbox `display_formula`.
4. Phủ bản dịch tiếng Trung Typst.
5. Nếu dán lại thất bại, hạ cấp sang cover/strip bbox hiện có.

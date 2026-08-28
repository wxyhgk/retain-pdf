# Trích đoạn hướng dẫn dịch vụ chính thức PaddleOCR-VL

Nguồn:

- Tài liệu chính thức GitHub:
  <https://github.com/PaddlePaddle/PaddleOCR/blob/main/docs/version3.x/pipeline_usage/PaddleOCR-VL.md>
- Trích đoạn sớm trong kho lưu trữ hiện tại:
  `backend/rust_api/src/ocr_provider/paddle/AsyncParse.md`

Trích đoạn này chỉ giữ lại những nội dung liên quan trực tiếp đến việc kết nối provider trong kho lưu trữ này, không sao chép toàn bộ hướng dẫn chính thức.

## 1. Markdown tồn tại trong phản hồi chính thức

Ví dụ dịch vụ hóa chính thức thể hiện rõ cách sử dụng sau:

- Duyệt qua `result["layoutParsingResults"]`
- Đọc `res["markdown"]["text"]`
- Đọc `res["markdown"]["images"]`

Nghĩa là, phản hồi chính thức của Paddle không chỉ có `prunedResult` có cấu trúc, mà còn có thể nhận trực tiếp văn bản Markdown và ánh xạ hình ảnh Markdown.

## 2. Cấu trúc phản hồi quan trọng

Cấu trúc liên quan trực tiếp nhất đến việc kết nối trong kho lưu trữ này là:

```json
{
  "result": {
    "layoutParsingResults": [
      {
        "prunedResult": {},
        "markdown": {
          "text": "...",
          "images": {}
        },
        "outputImages": {},
        "inputImage": "..."
      }
    ]
  }
}
```

Ý nghĩa các trường:

- `prunedResult`: Kết quả phân tích trang có cấu trúc
- `markdown.text`: Văn bản Markdown cấp trang
- `markdown.images`: Ánh xạ từ đường dẫn tương đối hình ảnh Markdown đến nội dung/địa chỉ hình ảnh
- `outputImages`: Kết quả hình ảnh trực quan hoặc trung gian
- `inputImage`: Hình ảnh trang đầu vào

Cần đặc biệt lưu ý:

- Khóa của `markdown.images` không phải là "giá trị đề xuất", mà là đường dẫn tương đối thực tế được tham chiếu trong văn bản Markdown/HTML
- Nếu văn bản là `<img src="imgs/xxx.jpg">`, thì key trong `images` phải là `imgs/xxx.jpg`
- Bên tích hợp không được tự ý sửa đổi đường dẫn tương đối do provider trả về thành một bộ quy tắc thư mục khác, chỉ có thể thực hiện đóng gói tối thiểu, có thể đảo ngược ở giai đoạn phát hành

## 3. Các tham số yêu cầu liên quan trực tiếp đến luồng chính hiện tại của kho lưu trữ

- `restructurePages`
  Dùng để tái cấu trúc PDF nhiều trang, ảnh hưởng đến nhận dạng bảng xuyên trang và mức tiêu đề đoạn.
- `mergeTables`
  Hợp nhất bảng xuyên trang.
- `relevelTitles`
  Nhận dạng mức tiêu đề đoạn.
- `showFormulaNumber`
  Kiểm soát việc bao gồm số công thức trong Markdown.
- `prettifyMarkdown`
  Kiểm soát việc xuất Markdown đã làm đẹp.
- `visualize`
  Kiểm soát việc trả về kết quả hình ảnh.

## 4. Kết luận áp dụng cho hệ thống của chúng tôi

Kết luận rất trực tiếp:

1. `markdown_ready = false` không thể quy cho việc Paddle chính thức không hỗ trợ Markdown.
2. Nếu raw của tác vụ đã có `markdown.text` / `markdown.images`, thì nên xuất thành artifact Markdown của job ở tầng sản phẩm.
3. Provider adapter / pipeline cần phân biệt rõ:
   - Chuẩn hóa tài liệu có cấu trúc
   - Ghi sản phẩm Markdown
   - Ghi hình ảnh Markdown
4. Đường dẫn hình ảnh Markdown nên tuân theo giá trị trả về của provider; nếu cần thêm tiền tố trang để tránh xung đột cho tác vụ nhiều trang, chỉ được thực hiện đóng gói phạm vi bên ngoài như vậy, không được mã hóa cứng mẫu đường dẫn tương đối bên trong.

## 5. Nguyên tắc cập nhật

Sau này nếu tiếp tục bổ sung tài liệu Paddle, ưu tiên bổ sung ở đây:

- Đầu vào chính thức
- Các trường và tham số liên quan mạnh đến kho lưu trữ hiện tại
- Ánh xạ tương ứng với artifact / normalized document / provider adapter của kho lưu trữ

Không sao chép toàn bộ hướng dẫn triển khai chính thức vào đây.

# Mô tả gói con Continuation

Gói con này chuyên chứa logic liên quan đến tính liên tục đoạn văn, tức là phán đoán những khối OCR nào nên nối thành cùng một đơn vị dịch.

## Phân công

- `rules.py`
  Đặc điểm đầu cuối văn bản, quan hệ hình học bbox, chấm điểm join/break.
- `state.py`
  Tiêu thụ provider hint trước, sau đó ghi kết quả quy tắc trở lại payload, duy trì nhóm continuation và đánh dấu candidate.
- `pairs.py`
  Xuất cặp candidate, và ghi lại join sau khi phê duyệt.
- `review.py`
  Gửi cặp candidate cho mô hình xem xét.

## Chiến lược hiện tại

Continuation hiện tại dùng provider-first, nhưng không phải provider-only:

- Nếu payload đã có trường `ocr_continuation_*`, và thuộc provider hint `intra_page` cùng trang, `state.py` sẽ ưu tiên xây dựng nhóm trực tiếp
- Nếu thuộc provider hint `cross_page` khác trang, hiện chỉ tiêu thụ có kiểm soát khi "hai trang kề nhau + reading_order duy nhất + layout_zone chạm ranh giới đọc cuối/trang đầu + độ dài văn bản đủ"
- Những item này được đánh dấu `provider_joined`, quy tắc sau không tiêu thụ lặp lại
- Phần không có provider hint khả dụng vẫn tiếp tục đi qua quy tắc ghép nối cục bộ
- Provider hint `cross_page` không thỏa điều kiện kiểm soát vẫn giữ trong payload, nhưng không trực tiếp điều khiển ghép nối
- Quét quy tắc không được dừng toàn bộ vì thiếu trang giữa chừng (page_idx không liên tục trong payload); `pair_join_score` vẫn chỉ cho phép join trực tiếp giữa `page_idx` liền kề
- Hai cột L→R ưu tiên tin `layout_zone`, khe cột hẹp (<8pt) cũng cho phép bbox phán định
- Đoạn sau nếu giống tiêu đề số chương (như `2.2.1 Title`), hard break, tránh ghép câu dở vào tiểu tiết mới

Mục đích rõ ràng:

- Mô hình OCR mới đã biết ghép cùng trang thì không cần quy tắc cục bộ đoán lại
- Mô hình chưa biết ghép thì tiếp tục tái sử dụng quy tắc hiện có
- Sau này nếu xuất hiện mô hình mới cung cấp ổn định nhóm liên tục xuyên trang, chỉ cần mở rộng chiến lược tiêu thụ hint, không cần đưa cấu trúc riêng của provider vào luồng chính dịch

## Giao diện công khai

```python
from services.translation.services.continuation import annotate_continuation_context
from services.translation.services.continuation import candidate_continuation_pairs
```

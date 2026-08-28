# Điều độ dịch

Thư mục này chịu trách nhiệm cơ chế thực thi sau khi translation units đã được chọn:

- Phân phối hàng đợi
- Vòng đời worker pool
- Drain hàng đợi kết quả
- Lượt tail retry
- Nhịp flush
- Chỉ số điều độ

Nó không nên quyết định một block nào đó có dịch hay không, không nên xây dựng prompt, cũng không nên cài đặt lời gọi HTTP provider.

Các tệp nguồn hiện tại cần di chuyển sau này:

- `workflow/batch_runner.py`
- `workflow/workers.py`
- Phần liên quan đến điều độ trong `workflow/batching/pending_units.py`

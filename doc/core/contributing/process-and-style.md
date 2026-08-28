# Issue, PR, phong cách mã và hướng dẫn phát hành

## Quy trình Issue

Khi gửi Bug Issue, cố gắng bao gồm:

- Phiên bản RetainPDF, cách chạy: desktop / Docker / phát triển cục bộ.
- Hệ điều hành và trình duyệt.
- OCR provider, model provider, workflow tác vụ.
- job_id, giai đoạn thất bại, tóm tắt lỗi hoặc ảnh chụp màn hình.
- Các bước tái hiện.
- Kết quả mong đợi và kết quả thực tế.
- Nếu liên quan đến mẫu PDF, nêu rõ có thể công khai không; nếu không, cung cấp ảnh chụp màn hình tối thiểu, số trang, bbox hoặc mẫu đã làm ẩn.

Khi gửi Feature Issue, cố gắng bao gồm:

- Kịch bản sử dụng.
- Bạn muốn frontend/API/dòng lệnh hiển thị như thế nào.
- Có cần tương thích với job, artifact, reader, library hoặc phân phối Docker hiện có không.
- Các module có thể bị ảnh hưởng.

Vấn đề bảo mật, lộ khóa, dữ liệu riêng tư không đăng trực tiếp lên Issue công khai. Vui lòng liên hệ với người bảo trì qua nhóm trong README hoặc kênh riêng trên GitHub trước; nếu chỉ có thể đăng công khai, chỉ mô tả phạm vi ảnh hưởng, không kèm khóa, tệp thực hoặc dữ liệu nhận dạng người dùng.

## Quy trình PR

Quy trình đề xuất:

1. Trước tiên tạo Issue hoặc mô tả giải pháp trong Issue hiện có, đặc biệt là thay đổi xuyên Rust/Python/frontend/Docker.
2. Tạo nhánh từ `main` mới nhất.
3. Giữ PR tập trung, mỗi lần chỉ giải quyết một chủ đề.
4. Bổ sung kiểm thử khi sửa mã hoặc giải thích lý do tạm thời chưa bổ sung được.
5. Cập nhật tài liệu liên quan.
6. Mô tả PR rõ ràng đã sửa gì, tại sao sửa, xác minh thế nào.

Mô tả PR nên bao gồm:

```md
## Thay đổi

- ...

## Xác minh

- [ ] cargo test --manifest-path backend/rust_api/Cargo.toml
- [ ] python3 backend/scripts/devtools/check_pipeline_architecture.py
- [ ] npm --prefix desktop run verify-frontend-sync

## Rủi ro

- ...
```

Nếu PR sửa đổi hành vi người dùng có thể thấy, vui lòng đính kèm ảnh chụp màn hình, ví dụ giao diện, job_id mẫu hoặc so sánh trước sau.

## Áp dụng phong cách hiện có

"Áp dụng phong cách và đặt tên module hiện có" nghĩa là:

- Trước tiên tìm 2-3 triển khai tương tự trong cùng thư mục, tiếp tục viết theo cách đặt tên, xử lý lỗi, kiểu trả về, cách viết kiểm thử và tổ chức tệp của chúng.
- Khi module hiện có đặt tên `*_view`, `*_payload`, `*_manifest`, `*_contract`, trường mới hoặc helper mới cũng cố gắng sử dụng cùng bộ từ, không tạo ra một bộ `dto/result/response/entity` lẫn lộn.
- Khi mã hiện có sử dụng tham số phụ thuộc hẹp, đừng quay lại truyền toàn bộ `AppState`, config toàn cục hoặc dict lớn.
- Khi API hiện có trả về qua tầng view/projection, đừng ghép JSON tạm thời trong route.
- Khi Python pipeline hiện có sử dụng stage spec, manifest, document.v1, đừng vòng qua để đọc raw JSON của provider.

## Khi nào có thể thêm trừu tượng

Đừng đưa hệ thống trừu tượng mới cho các nhu cầu nhỏ lẻ. Các trường hợp sau thường không nên thêm trừu tượng dạng framework:

- Chỉ thêm một trường, một nút, một đầu vào tải xuống hoặc một nhánh xác thực.
- Chỉ hai điểm gọi có một chút trùng lặp.
- Chỉ để làm tên "tổng quát hơn" nhưng không giảm độ phức tạp thực tế.
- Chỉ bọc logic tuần tự rõ ràng vào nhiều tầng class/factory/manager.

Có thể thêm trừu tượng khi:

- Cùng một logic đã lặp lại ở hơn 3 nơi và khi sửa dễ bỏ sót.
- Hàm hiện tại đã trộn lẫn IO, chiến lược, chuyển đổi dữ liệu, xử lý lỗi, gây khó kiểm thử.
- Trừu tượng mới có thể thu hẹp phụ thuộc xuyên tầng, ví dụ chuyển phán đoán nghiệp vụ trong route sang service.
- Trừu tượng mới có thể tạo hợp đồng ổn định, ví dụ artifact manifest, reader region, translation diagnostics.

Khi thêm trừu tượng, mô tả PR nêu:

- Nó thay thế những sự trùng lặp hoặc phụ thuộc nào.
- Nó thuộc tầng nào.
- Module nào được phép phụ thuộc vào nó, module nào không nên phụ thuộc.

## Phạm vi thay đổi

- Đừng trộn tái cấu trúc không liên quan vào PR chức năng. Sửa lỗi, đổi tên, di chuyển thư mục, định dạng nên tách riêng.
- Đừng tiện tay sửa nhiều tệp không liên quan, sắp xếp import, sắp xếp lại CSS hoặc viết lại logic lịch sử, trừ khi đó là mục tiêu của PR.
- Không commit khóa cục bộ, token, tệp người dùng thực, `data/db/jobs.db`, nhiều sản phẩm chạy trong `data/jobs/*`, `tmp/*` hoặc đầu ra thí nghiệm có dung lượng lớn.

## Thay đổi hiệu suất và mẫu lớn

Các thay đổi như kết xuất, xử lý PDF, xử lý batch dịch, OCR adapter có thể ảnh hưởng rõ rệt đến PDF trên 500 trang. Khi liên quan đến hiệu suất, nên cung cấp:

- Số trang mẫu và loại tệp.
- Thời gian cũ, thời gian mới.
- Lệnh đã sử dụng hoặc job_id.
- Có thay đổi nội dung PDF đầu ra, kích thước hoặc trải nghiệm xem trước trang đầu không.

Mẫu lớn, CSV tạm thời, đầu ra benchmark nên đặt trong `experiments/` hoặc `tmp/`, mặc định không commit vào kho lưu trữ.

## Phát hành và vận hành

Người đóng góp thông thường thường không cần tạo tag hoặc gói phát hành. Người bảo trì khi phát hành sẽ thực hiện riêng quy trình commit phiên bản, tag, push GitHub, đồng bộ desktop và Docker/Release.

Nếu PR của bạn ảnh hưởng đến gói phát hành, vui lòng nêu trong mô tả PR:

- Có ảnh hưởng đến bundle desktop không.
- Có ảnh hưởng đến cấu hình runtime Docker không.
- Có cần di chuyển cơ sở dữ liệu hoặc tương thích với job cũ không.
- Có cần cập nhật README, tài liệu API hoặc hướng dẫn cài đặt người dùng không.

Ghi chép phát hành, phân phối Docker và vận hành trực tuyến của người bảo trì xem [Vận hành và ghi chép quy trình](../../ops/README.md) và tài liệu Docker.

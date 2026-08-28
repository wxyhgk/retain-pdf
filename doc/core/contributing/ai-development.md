# Hướng dẫn phát triển với AI

RetainPDF khuyến khích sử dụng AI hỗ trợ phát triển. Khuyến nghị ưu tiên sử dụng coding agent như Codex hoặc Claude Code có thể đọc/ghi kho lưu trữ cục bộ, chạy lệnh và thực thi kiểm thử, thay vì chỉ để model đưa ra giải pháp trong cửa sổ chat.

AI có thể nâng cao hiệu quả, nhưng không thể thay thế đánh giá ranh giới, xác minh kiểm thử và trách nhiệm cuối cùng. Người gửi PR cần xác nhận thay đổi phù hợp với kiến trúc dự án, vượt qua các kiểm tra cần thiết và có thể giải thích rủi ro.

## Công cụ được khuyến nghị

- Codex: Phù hợp để sửa đổi mã, tái cấu trúc, kiểm thử, sắp xếp tài liệu và kiểm tra trước khi phát hành trong kho lưu trữ cục bộ.
- Claude Code: Phù hợp để đọc mã ngữ cảnh dài, tái cấu trúc đa tệp, tạo kiểm thử và tóm tắt thay đổi phức tạp.

Không bắt buộc người đóng góp phải sử dụng một công cụ cụ thể, nhưng nếu sử dụng AI tham gia phát triển, nên mô tả ngắn gọn trong mô tả PR những phần AI đã tham gia, ví dụ "hỗ trợ tạo kiểm thử", "hỗ trợ sắp xếp tài liệu", "hỗ trợ tái cấu trúc ranh giới import".

## Skills AI được đề xuất

Có thể viết các khả năng dưới đây thành Codex skill, Claude Code command hoặc agent checklist trong dự án.

### Ngữ cảnh dự án RetainPDF

Mục đích: Giúp AI hiểu ranh giới kho lưu trữ trước khi bắt tay vào làm.

Nên bao gồm:

- Thư mục gốc dự án: `/home/wxyhgk/tmp/Code`
- Các module chính: `backend/rust_api/`, `backend/scripts/`, `frontend/`, `frontend-react/`, `desktop/`, `docker/`, `doc/`
- Quy tắc cốt lõi: Không hoàn tác các thay đổi không liên quan; chỉnh sửa thủ công bằng patch; đọc mã lân cận trước khi sửa; chạy kiểm thử theo module.
- Đầu vào tài liệu: `CONTRIBUTING.md` ở thư mục gốc và `doc/core/contributing/README.md`

### Kiểm tra ranh giới Rust API

Mục đích: Ngăn AI trộn lẫn route, service, runner, db.

Nên nhắc AI:

- `routes/*` chỉ làm HTTP adapter.
- Tầng service thực hiện tổng hợp nghiệp vụ và view/projection.
- `job_runner/*` thực thi trạng thái chạy.
- Truy cập cơ sở dữ liệu thông qua facade `Db`, không viết SQL trực tiếp trong route.
- Trường API mới cần đồng bộ tài liệu và kiểm thử.

Kiểm tra thường dùng:

```bash
cargo fmt --manifest-path backend/rust_api/Cargo.toml --check
cargo test --manifest-path backend/rust_api/Cargo.toml
cd backend/rust_api && python3 scripts/check_architecture.py
```

### Kiểm tra ranh giới pipeline Python

Mục đích: Ngăn AI đưa import xuyên tầng hoặc bỏ qua manifest ổn định.

Nên nhắc AI:

- Raw payload OCR trước tiên vào `document_schema`, tạo `document.v1`.
- translation không import rendering.
- rendering chỉ tiêu thụ PDF nguồn, translation manifest, payload từng trang và render spec.
- Bổ sung kiểm thử hồi quy tối thiểu khi thêm công thức, thuật ngữ, bbox, chiến lược kết xuất.

Kiểm tra thường dùng:

```bash
python3 backend/scripts/devtools/check_pipeline_architecture.py
PYTHONPATH=backend/scripts python3 -m pytest backend/scripts/devtools/tests/translation -q
PYTHONPATH=backend/scripts python3 -m pytest backend/scripts/devtools/tests/rendering -q
```

### Đồng bộ frontend và desktop

Mục đích: Ngăn AI chỉ sửa mã nguồn web mà quên bundle desktop.

Nên nhắc AI:

- Sau khi sửa `frontend/**`, cần chạy `npm --prefix desktop run verify-frontend-sync`.
- Không chỉ sửa `desktop/app/frontend/**`.
- `frontend-react/` là khu vực di chuyển, không mặc định thay thế `frontend/`.
- Cổng mặc định cho frontend tĩnh cục bộ là `40001`.

Kiểm tra thường dùng:

```bash
npm --prefix frontend run build
npm --prefix desktop run verify-frontend-sync
```

### Tạo kiểm thử và hồi quy

Mục đích: Giúp AI chuyển vấn đề của chuyên gia kiểm thử thành trường hợp tái hiện được.

Nên nhắc AI xuất:

- Môi trường, phiên bản, provider, workflow.
- Mẫu có thể công khai hay không.
- Số trang, bbox, ảnh chụp màn hình, job_id.
- Các bước tái hiện, kết quả mong đợi, kết quả thực tế.
- Fixture tối thiểu hoặc đề xuất kiểm thử tự động.

### Kiểm tra tính nhất quán của tài liệu

Mục đích: Tránh tài liệu lạc hậu sau khi sửa mã.

Nên nhắc AI kiểm tra:

- Trường API có đồng bộ `doc/core/api/` không.
- Ranh giới Rust có đồng bộ `doc/core/rust_api/` không.
- Ranh giới Python có đồng bộ `doc/core/python/` không.
- Cổng và lệnh frontend, Docker, desktop có nhất quán không.
- `CONTRIBUTING.md` ở thư mục gốc vẫn chỉ là đầu vào ngắn.

## Quy trình làm việc được khuyến nghị

1. Cho AI đọc tài liệu con liên quan trước, không trực tiếp sửa mã.
2. Yêu cầu AI đưa ra phạm vi ảnh hưởng và kế hoạch xác minh.
3. Cho AI gửi patch từng bước nhỏ, không định dạng không liên quan.
4. Chạy kiểm thử hoặc kiểm tra tương ứng.
5. Cho AI xem xét một lần: tập trung vào phụ thuộc xuyên tầng, tương thích cũ, lỗ hổng kiểm thử, lỗ hổng tài liệu.
6. Xác nhận đầu ra, rủi ro và mô tả PR bằng tay.

## Gợi ý prompt

Có thể nói trực tiếp với Codex hoặc Claude Code:

```text
Bạn đang làm việc trong kho lưu trữ RetainPDF. Trước tiên hãy đọc CONTRIBUTING.md và các tài liệu con liên quan trong doc/core/contributing.
Chỉ sửa các tệp liên quan đến nhiệm vụ này, không hoàn tác các thay đổi không liên quan.
Trước khi sửa, hãy nêu phạm vi ảnh hưởng; sau khi sửa, chạy kiểm thử tương ứng.
Nếu không chạy được kiểm thử, hãy giải thích lý do và rủi ro còn lại.
```

Với backend:

```text
Kiểm tra xem thay đổi Rust API lần này có vi phạm ranh giới routes -> services -> job_runner/db không.
Tập trung vào việc route có ghép JSON nghiệp vụ không, service có phụ thuộc trực tiếp HTTP Response không, job_runner có phụ thuộc ngược vào service không.
Đưa ra tệp và số dòng, nếu cần thì sửa trực tiếp.
```

Với Python:

```text
Kiểm tra xem translation, rendering, ocr_provider có tồn tại import xuyên tầng không.
Đừng để translation import services.rendering.
Nếu cần chia sẻ dữ liệu, hãy truyền qua manifest/spec/document.v1.
```

Với kiểm thử:

```text
Sắp xếp báo cáo lỗi này thành trường hợp kiểm thử tái hiện được.
Cần bao gồm môi trường, mẫu, số trang, bbox, các bước tái hiện, kết quả mong đợi, kết quả thực tế và đề xuất vị trí kiểm thử tự động.
```

## Lưu ý

- Mã do AI tạo ra phải được xem xét thủ công.
- AI không nên gửi tệp người dùng thực, token riêng tư, cơ sở dữ liệu cục bộ hoặc sản phẩm chạy có dung lượng lớn.
- Khi AI tái cấu trúc, phải giải thích nó thay thế những sự trùng lặp hoặc phụ thuộc nào, không thêm trừu tượng chỉ để "trông tổng quát hơn".
- Khi AI sửa quy trình phát hành, Docker, đóng gói desktop, cần giải thích thêm cách hoàn tác và cách xác minh.

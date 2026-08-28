# Mô tả thư mục backend

`backend/` hiện chứa đồng thời mã nguồn backend, tài nguyên đóng gói và sản phẩm runtime cục bộ. Khi sắp xếp đừng coi nó là thư mục mã nguồn thuần túy mà di chuyển trực tiếp.

## Nội dung nên giữ lại trong backend

- `rust_api/`: Mã nguồn dịch vụ Rust API. Docker, desktop và dịch vụ hệ thống đều tìm nó qua `RUST_API_ROOT` hoặc đường dẫn cố định.
- `scripts/`: Mã nguồn pipeline Python OCR, dịch, render. GitHub Actions, Docker, đóng gói desktop và kiểm thử cục bộ đều tham chiếu trực tiếp đường dẫn này.
- `fonts/`: Tài nguyên font tiếng Trung được sao chép khi đóng gói và Docker, hiện là tài nguyên phát hành chính thức, không phải cache.

## Sản phẩm runtime cục bộ hoặc nền tảng

- `rust_api/target/`: Sản phẩm build Rust, dung lượng lớn, đã được `.gitignore` bỏ qua, có thể xóa an toàn rồi biên dịch lại.
- `python/`: Python runtime dùng cho đóng gói desktop Windows, đã được `.gitignore` bỏ qua. Sau này nếu tái cấu trúc, khuyến nghị chuyển sang `local-runtime/windows/python/` ở thư mục gốc hoặc thư mục runtime chuyên dụng desktop, đồng thời cập nhật `desktop/scripts/prepare-app.mjs`.
- `typst-win32/bin/`: Thư mục tệp thực thi Typst Windows, đã được `.gitignore` bỏ qua. `typst-win32/.crates.toml` và `.crates2.json` hiện vẫn là tệp nhìn thấy được, sau này khuyến nghị lưu trữ cùng Typst runtime.
- `workspace/`: Workspace tạm thời lịch sử/cục bộ, không nên tiếp tục mở rộng làm lối vào mã nguồn.
- `.ipynb_checkpoints/`, `.pytest_cache/`, `__pycache__/`: Cache trình soạn thảo và Python, có thể xóa.
- `scripts/.env/*.env`, `rust_api/auth.local.json`: Cấu hình khóa bí mật cục bộ, không được commit.

## Hướng sắp xếp khuyến nghị

Đừng vội di chuyển `scripts/` hoặc `rust_api/`. Cách ổn định hơn là thêm lối vào lưu trữ runtime cấp thư mục gốc, ví dụ `local-runtime/`, chuyên thu thập binary cục bộ, runtime nền tảng và tệp lớn có thể tái sinh.

Cấu trúc mục tiêu có thể là:

```text
backend/
  rust_api/        # Mã nguồn Rust API
  scripts/         # Mã nguồn Python pipeline
  fonts/           # Tài nguyên font phát hành

local-runtime/
  windows/python/  # Python runtime Windows
  windows/typst/   # Typst runtime Windows
  README.md
```

Trước khi di chuyển thực sự phải cập nhật đồng bộ:

- `desktop/scripts/prepare-app.mjs`
- `.github/workflows/release-desktop.yml`
- `docker/Dockerfile.app`
- Đường dẫn cố định trong README và kiểm thử liên quan

## Ranh giới tách hiện tại

Trạng thái giải ghép backend lấy tài liệu tuyến chính và cổng kiến trúc làm chuẩn. Ranh giới ổn định hiện tại là:

- Rust API chịu trách nhiệm trạng thái tác vụ, stage spec, sự kiện, tham chiếu artifact và điều phối tiến trình.
- Python `backend/scripts/runtime/pipeline/` chỉ làm điều phối giai đoạn, không trực tiếp tiêu thụ cấu trúc thô OCR provider.
- Lối vào dịch Python đi qua facade `services.translation.workflow`.
- Tiền xử lý PDF nguồn render Python đi qua `services.rendering.source.render_source` và `services.rendering.source.preparation.*`, đừng viết chi tiết hidden-text strip / compression ngược lại runtime pipeline.
- Sản phẩm thô OCR provider phải vào `document.v1.json` trước, dịch và render chỉ tiêu thụ normalized document và translation artifacts.

Trước khi thêm phụ thuộc xuyên tầng, chạy trước:

```bash
python3 backend/scripts/devtools/check_pipeline_architecture.py
python3 backend/scripts/devtools/check_stage_specs_contract.py data/jobs
```

## Dọn dẹp an toàn có thể làm ngay

Nếu chỉ muốn giải phóng dung lượng, có thể xóa các thư mục ignored này, không ảnh hưởng lịch sử Git:

```bash
rm -rf backend/rust_api/target
find backend -type d \( -name '__pycache__' -o -name '.pytest_cache' -o -name '.ipynb_checkpoints' \) -prune -exec rm -rf {} +
```

Sau khi xóa cần biên dịch lại Rust API.

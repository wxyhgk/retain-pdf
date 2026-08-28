# Nguồn duy nhất phụ thuộc Python

Nguồn tin cậy phụ thuộc Python của kho lưu trữ hiện tại đã được hội tụ vào [`pyproject.toml`](../../pyproject.toml) ở thư mục gốc.

## Cách bảo trì hiện tại

- Phụ thuộc runtime:
  `project.dependencies`
- Phụ thuộc kiểm thử:
  `project.optional-dependencies.test`
- Phiên bản Python:
  `project.requires-python`
- Phụ thuộc nhị phân không phải Python:
  `tool.retain_pdf.external-binaries`

Không trực tiếp sửa các tệp sinh này nữa:

- [`docker/requirements-app.txt`](../../docker/requirements-app.txt)
- [`docker/requirements-test.txt`](../../docker/requirements-test.txt)
- [`desktop/requirements-desktop-posix.txt`](../../desktop/requirements-desktop-posix.txt)
- [`desktop/requirements-desktop-windows.txt`](../../desktop/requirements-desktop-windows.txt)
- [`desktop/requirements-desktop-macos.txt`](../../desktop/requirements-desktop-macos.txt)

## Cách cập nhật

Sau khi sửa [`pyproject.toml`](../../pyproject.toml), thực thi:

```bash
python backend/scripts/devtools/sync_python_requirements.py --repo-root .
```

Nếu chỉ muốn kiểm tra xem có sai lệch không:

```bash
python backend/scripts/devtools/sync_python_requirements.py --repo-root . --check
```

## Cấu hình hiện tại

Gói Python runtime:

- `Pillow`
- `PyMuPDF`
- `pikepdf`
- `requests`
- `urllib3`

Gói bổ sung kiểm thử:

- `pytest`

Phụ thuộc nhị phân không phải Python:

- `typst`: Bắt buộc
- `gs`: Tùy chọn, phụ thuộc đường dẫn nén

## Tại sao làm vậy

Trước đây Docker, desktop, CI tự duy trì requirements, dễ xảy ra:

- Một nền tảng thiếu gói
- Phiên bản runtime và đóng gói desktop sai lệch
- CI thông qua nhưng bản dựng cục bộ hoặc phát hành thất bại

Mục tiêu hiện tại:

- Chỉ sửa một chỗ
- Sinh nhiều nơi
- CI dùng `--check` để ngăn sai lệch vào nhánh chính

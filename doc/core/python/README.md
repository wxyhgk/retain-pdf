# Tài liệu backend Python

Nơi đây ghi lại kiến trúc backend Python, runtime, phụ thuộc kiểm thử và quy tắc sinh phụ thuộc Pipeline.

Thứ tự đọc đề xuất:

1. [Ranh giới kiến trúc backend Python](./architecture.md)
2. [Giải thích tầng dịch thuật](./translation.md)
3. [Nguồn duy nhất phụ thuộc Python](./dependency_source_of_truth.md)
4. [Giải thích phụ thuộc Pipeline](./pipeline_dependencies.md)
5. [Danh sách phụ thuộc Pipeline JSON](./pipeline_dependencies.json)
6. [Đầu vào requirements runtime](./pipeline_runtime_requirements.in)
7. [Đầu vào requirements kiểm thử](./pipeline_test_requirements.in)

Nguyên tắc bảo trì:

- Nguồn tin cậy phụ thuộc là [`pyproject.toml`](../../pyproject.toml) ở thư mục gốc.
- Các tệp requirements nên được sinh bởi script, không trực tiếp sửa tay.
- Docker, desktop và CI nên chia sẻ cùng một bộ tiêu chuẩn phụ thuộc.
- Ranh giới module tuân theo [architecture.md](./architecture.md) và `backend/scripts/devtools/check_pipeline_architecture.py`.

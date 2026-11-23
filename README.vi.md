# RetainPDF: Công cụ dịch PDF giữ nguyên bố cục

<p align="center">
  <a href="README.md">中文</a> · <a href="README.en.md">English</a> · <a href="README.vi.md">Tiếng Việt</a>
</p>

<p align="center">
  <img src="resources/brand/RetainPDF-github.svg" alt="RetainPDF" width="320" />
</p>

<p align="center">
  <a href="https://github.com/wxyhgk/retain-pdf/releases/latest"><img src="https://img.shields.io/github/v/release/wxyhgk/retain-pdf?label=phi%C3%AAn%20b%E1%BA%A3n&color=2563eb" alt="Release" /></a>
  <a href="https://github.com/wxyhgk/retain-pdf/releases"><img src="https://img.shields.io/github/downloads/wxyhgk/retain-pdf/total?label=l%C6%B0%E1%BB%A3t%20t%E1%BA%A3i&color=16a34a" alt="Downloads" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-f59e0b" alt="MIT" /></a>
  <a href="https://github.com/wxyhgk/retain-pdf/actions/workflows/tests.yml"><img src="https://github.com/wxyhgk/retain-pdf/actions/workflows/tests.yml/badge.svg?branch=main" alt="Tests" /></a>
  <a href="https://github.com/wxyhgk/retain-pdf/stargazers"><img src="https://img.shields.io/github/stars/wxyhgk/retain-pdf?style=flat&color=eab308" alt="Stars" /></a>
</p>

Công cụ mã nguồn mở dịch PDF mà vẫn giữ nguyên bố cục, dịch được cả PDF quét và PDF dạng ảnh. Dùng ứng dụng desktop, hoặc tự triển khai bằng Docker.

- **Giữ nguyên bố cục**: công thức, trang nhiều cột, hình ảnh, đầu trang và chân trang vẫn đúng vị trí; công thức nội dòng vẫn ổn định sau khi dịch.
- **Dịch cả bản quét**: OCR trước rồi mới dịch, có lớp văn bản hay không đều được.
- **Dịch theo câu hoàn chỉnh**: đoạn bị tách qua cột, qua trang được ghép lại trước khi dịch; mã nguồn, công thức và tên riêng được bảo vệ, bảng thuật ngữ cố định cách dịch.
- **Dịch bằng Agent**: đọc toàn bộ sách trước để thống nhất thuật ngữ và văn phong, rồi dịch từng trang và rà soát từng đoạn. Chậm hơn và tốn hơn, dành cho những cuốn sách cần đọc kỹ.

<p align="center">
  <img src="resources/brand/readme-gallery/translation-examples.webp" alt="Ví dụ bản dịch RetainPDF: bài báo, tài liệu quét, sách giáo khoa" width="1000" />
</p>

<p align="center">
  <img src="resources/brand/readme-gallery/product/side-by-side-reader.png" alt="RetainPDF đọc đối chiếu" width="1000" />
</p>

## Tải về

Từ [Releases](https://github.com/wxyhgk/retain-pdf/releases/latest):

| Hệ điều hành | Tệp | Ghi chú |
| --- | --- | --- |
| macOS | `RetainPDF-Mac-<phiên-bản>.dmg` | Chip Apple (M1 trở lên), đã được ký và công chứng |
| Windows | `RetainPDF-Windows-<phiên-bản>-Setup.exe` | Nếu thấy “Windows đã bảo vệ máy tính của bạn”, bấm “Thông tin thêm” → “Vẫn chạy” |
| Linux | `RetainPDF-Linux-<phiên-bản>.deb` | `sudo apt install ./RetainPDF-Linux-<phiên-bản>.deb` |

Lần đầu mở, ứng dụng sẽ hỏi key OCR và key dịch. Hỗ trợ PaddleOCR, MinerU, GLM-OCR; DeepSeek, Qwen, Zhipu, OpenAI, Anthropic, OpenCode Go và mọi endpoint tương thích OpenAI hoặc Anthropic ([cách lấy key, tiếng Trung](frontend/web/guide/credentials.md)).

Docker:

```bash
git clone https://github.com/wxyhgk/retain-pdf.git
cd retain-pdf/ops/deployment/docker/delivery
docker compose up -d   # mở http://127.0.0.1:40001
```

Xem thêm [hướng dẫn triển khai Docker](ops/deployment/docker/delivery/README.md).

## Tài liệu

- [Hướng dẫn sử dụng (tiếng Trung)](frontend/web/guide/README.md): thư viện, dịch, đọc đối chiếu, bảng thuật ngữ, đồng bộ, sao lưu, chia sẻ mạng LAN… cũng có ở mục “使用说明” cuối ứng dụng
- Phát triển: [hướng dẫn đóng góp](CONTRIBUTING.md) · [tài liệu dự án](docs/README.md) · [hướng dẫn backend](backend/README.md)

## Cộng đồng

Nhóm QQ: `1101779791`

<p align="center">
  <img src="resources/brand/QQ_Group.JPG" alt="Mã QR nhóm QQ RetainPDF" width="200" />
</p>

## Giấy phép

MIT, xem [LICENSE](LICENSE).

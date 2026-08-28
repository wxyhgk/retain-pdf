# Plugin `local_command`

`local_command` là hợp đồng ổn định tối thiểu để tích hợp mô hình OCR cục bộ với RetainPDF.

Nó không yêu cầu bạn chạy dịch vụ HTTP. Nó yêu cầu một lệnh thực thi. Trong giai đoạn OCR, RetainPDF khởi chạy lệnh đó và truyền đường dẫn PDF đầu vào, thư mục job và đường dẫn tệp đầu ra thông qua các biến môi trường. Lệnh của bạn chỉ cần ghi kết quả OCR vào vị trí mong đợi.

Quy trình điển hình:

```text
RetainPDF job
  -> khởi động local_command
  -> mô hình OCR cục bộ / wrapper OCR HTTP cục bộ / script tùy chỉnh
  -> ghi payload thô hoặc document.v1
  -> RetainPDF xác thực document.v1
  -> dịch / kết xuất tiếp tục
```

Luồng chính chỉ đọc `ocr/normalized/document.v1.json` cuối cùng và không đọc trực tiếp JSON riêng của nhà cung cấp.

## Khi nào sử dụng

Sử dụng khi:

- Bạn có mô hình OCR cục bộ, như PaddleOCR, Marker, triển khai MinerU cục bộ hoặc mô hình bố cục của riêng bạn.
- Bạn có dịch vụ OCR HTTP cục bộ và muốn bọc nó bằng một script nhỏ trước khi kết nối với RetainPDF.
- Bạn muốn xác thực nhà cung cấp OCR nhanh chóng mà không cần thay đổi API Rust, luồng dịch hoặc luồng kết xuất.

Không phù hợp khi:

- Nhà cung cấp phải được RetainPDF quản lý với máy trạng thái submit / poll / download phức tạp. Điều này phù hợp hơn với `remote_command` trước, và hỗ trợ tích hợp sau.
- Bạn muốn các hệ thống hạ nguồn tiêu thụ trực tiếp các trường riêng của nhà cung cấp. RetainPDF không hỗ trợ kiểu tích hợp này; hãy chuyển đổi sang `document.v1` trước.

## Cấu hình nhà cung cấp

Tệp cấu hình:

```text
backend/config/ocr_providers.json
```

Cấu hình tối thiểu:

```json
{
  "providers": {
    "my_local_ocr": {
      "display_name": "My Local OCR",
      "kind": "local_command",
      "credential": null,
      "options": {
        "command": {
          "type": "string",
          "default": "python /opt/retainpdf-ocr/my_ocr.py"
        },
        "raw_provider": {
          "type": "string",
          "default": "generic_flat_ocr"
        }
      }
    }
  }
}
```

Chọn khóa nhà cung cấp khi gửi job:

```json
{
  "ocr": {
    "provider": "my_local_ocr"
  }
}
```

Thứ tự phân giải cho `command` và `raw_provider`:

1. Tùy chọn nhà cung cấp trong yêu cầu job hoặc đặc tả giai đoạn.
2. Giá trị mặc định trong `ocr_providers.json`.
3. Biến môi trường `RETAIN_LOCAL_OCR_COMMAND` / `RETAIN_OCR_RAW_PROVIDER`.

## Hợp đồng gọi lệnh

RetainPDF chạy lệnh của bạn trong thư mục gốc của job:

```text
cwd = RETAIN_OCR_JOB_ROOT
```

Lệnh được thực thi thông qua shell, vì vậy cấu hình có thể như sau:

```text
python /opt/retainpdf-ocr/my_ocr.py
```

Hoặc:

```text
/opt/retainpdf-ocr/bin/run_ocr --model local-v1
```

Ý nghĩa mã thoát:

- `0` có nghĩa là lệnh OCR thành công và RetainPDF sẽ tiếp tục kiểm tra các tệp đầu ra.
- Khác `0` có nghĩa là giai đoạn OCR thất bại, và stderr/stdout được ghi lại trong nhật ký job.

Ý nghĩa stdout/stderr:

- Bạn có thể in nhật ký đọc được cho con người.
- Không ghi kết quả OCR chính chỉ vào stdout.
- Kết quả OCR chính phải được ghi vào đường dẫn tệp do các biến môi trường cung cấp.

## Biến môi trường đầu vào

Lệnh nhận các biến môi trường ổn định sau:

```text
RETAIN_OCR_PROVIDER
RETAIN_OCR_PROVIDER_KIND
RETAIN_OCR_CREDENTIAL
RETAIN_OCR_SOURCE_PDF
RETAIN_OCR_SOURCE_URL
RETAIN_OCR_JOB_ROOT
RETAIN_OCR_SOURCE_DIR
RETAIN_OCR_DIR
RETAIN_OCR_PROVIDER_RESULT_JSON
RETAIN_OCR_NORMALIZED_DOCUMENT_JSON
RETAIN_OCR_NORMALIZATION_REPORT_JSON
RETAIN_OCR_PROVIDER_RAW_DIR
RETAIN_OCR_RAW_PAYLOAD_JSON
RETAIN_OCR_RAW_PROVIDER
```

Mô tả các trường phổ biến:

| Biến | Mô tả |
| --- | --- |
| `RETAIN_OCR_SOURCE_PDF` | Đường dẫn cục bộ đến PDF đầu vào. Luôn có mặt đối với các lần tải lên cục bộ thông thường. |
| `RETAIN_OCR_SOURCE_URL` | URL gốc cho các đầu vào dựa trên URL. `local_command` thường không cần. |
| `RETAIN_OCR_JOB_ROOT` | Thư mục gốc của job hiện tại. |
| `RETAIN_OCR_SOURCE_DIR` | Thư mục tệp nguồn. Các plugin chế độ URL phải ghi PDF cuối cùng vào đây. |
| `RETAIN_OCR_DIR` | Thư mục giai đoạn OCR. |
| `RETAIN_OCR_NORMALIZED_DOCUMENT_JSON` | Đường dẫn đích để ghi trực tiếp `document.v1.json`. |
| `RETAIN_OCR_RAW_PAYLOAD_JSON` | Đường dẫn đích để ghi payload thô. |
| `RETAIN_OCR_RAW_PROVIDER` | Tên bộ chuyển đổi cho payload thô, chẳng hạn như `generic_flat_ocr`. |
| `RETAIN_OCR_PROVIDER_RESULT_JSON` | Tóm tắt kết quả nhà cung cấp tùy chọn. |
| `RETAIN_OCR_NORMALIZATION_REPORT_JSON` | Báo cáo chuẩn hóa tùy chọn. |
| `RETAIN_OCR_CREDENTIAL` | Thông tin xác thực backend đã phân tích. Trống khi không có thông tin xác thực được cấu hình. |

## Chế độ đầu ra A: Ghi trực tiếp `document.v1`

Nếu bạn muốn tạo trực tiếp cấu trúc tài liệu thống nhất của RetainPDF, hãy ghi vào:

```text
$RETAIN_OCR_NORMALIZED_DOCUMENT_JSON
```

Tệp phải chứa `document.v1.json`. Xem [Hướng dẫn Schema Tài liệu](../../../backend/scripts/services/document_schema/README.md) để biết các trường chi tiết.

Đây là cách tiếp cận ổn định nhất, nhưng cũng tốn kém nhất để tích hợp. Nó phù hợp với các nhà cung cấp OCR cần tích hợp sâu.

Sau khi lệnh thành công, RetainPDF sẽ:

1. Xác thực `document.v1.json`.
2. Thêm `document.v1.report.json` tối thiểu nếu thiếu.
3. Thêm tóm tắt nhà cung cấp nếu `result.json` thiếu.
4. Cho phép dịch và kết xuất tiếp tục bằng cách chỉ đọc `document.v1.json`.

## Chế độ đầu ra B: Ghi payload thô

Điểm khởi đầu được khuyến nghị là chế độ payload thô. Lệnh của bạn ghi vào:

```text
$RETAIN_OCR_RAW_PAYLOAD_JSON
```

Sau đó, RetainPDF sử dụng bộ chuyển đổi được đặt tên bởi `RETAIN_OCR_RAW_PROVIDER` để chuyển đổi payload thô thành `document.v1.json`.

Bộ chuyển đổi tích hợp sẵn nhỏ nhất là:

```text
generic_flat_ocr
```

Nó phù hợp cho đầu ra OCR chung có dạng page -> blocks -> bbox + text.

### Schema `generic_flat_ocr`

Cấu trúc tối thiểu:

```json
{
  "provider": "generic_flat_ocr",
  "pages": [
    {
      "page": 1,
      "width": 612,
      "height": 792,
      "unit": "pt",
      "blocks": [
        {
          "type": "text",
          "sub_type": "body",
          "bbox": [72, 72, 420, 120],
          "text": "Văn bản OCR thô",
          "lines": [],
          "segments": []
        }
      ]
    }
  ]
}
```

Mô tả các trường:

| Trường | Bắt buộc | Mô tả |
| --- | --- | --- |
| `provider` | Có | Phải là `generic_flat_ocr`. |
| `pages` | Có | Mảng các trang. |
| `pages[].width` / `height` | Có | Kích thước trang. Đề xuất sử dụng điểm PDF. |
| `pages[].unit` | Không | Mặc định là `pt`. |
| `blocks[].type` | Không | Mặc định là `text`. Các khối không phải văn bản không được dịch. |
| `blocks[].sub_type` | Không | Mặc định là `body`. Các giá trị phổ biến là `title`, `heading`, `abstract`, `body`, `footnote` và `reference_entry`. |
| `blocks[].bbox` | Có | `[x0, y0, x1, y1]`, sử dụng cùng hệ tọa độ với kích thước trang. |
| `blocks[].text` | Có | Văn bản OCR. |
| `blocks[].lines` | Không | Cấu trúc cấp dòng. Cung cấp khi có thể để ổn định bảng, danh sách và Mục lục. |
| `blocks[].segments` | Không | Đoạn nội tuyến. Chỉ điền khi bạn có thể cung cấp công thức, kiểu hoặc thông tin token. |

`sub_type` ảnh hưởng đến chính sách mặc định:

- `body`, `abstract` và `heading` được dịch.
- `footnote`, `reference_entry`, `header`, `footer` và `page_number` bị loại khỏi bản dịch thân chính sách mặc định.
- Nếu nhà cung cấp của bạn có thể xác định Mục lục, danh sách hoặc tiêu đề, hãy biểu thị điều đó rõ ràng trong bộ chuyển đổi hoặc payload thô thay vì để lớp kết xuất đoán.

## Ví dụ tối thiểu `my_ocr.py`

Ví dụ dưới đây không thực hiện OCR thực; nó chỉ cho thấy cách plugin nên đọc và ghi đường dẫn:

```python
import json
import os
from pathlib import Path


def main() -> None:
    source_pdf = Path(os.environ["RETAIN_OCR_SOURCE_PDF"])
    target = Path(os.environ["RETAIN_OCR_RAW_PAYLOAD_JSON"])
    target.parent.mkdir(parents=True, exist_ok=True)

    # TODO: gọi mô hình OCR cục bộ của bạn tại đây.
    payload = {
        "provider": "generic_flat_ocr",
        "pages": [
            {
                "page": 1,
                "width": 612,
                "height": 792,
                "unit": "pt",
                "blocks": [
                    {
                        "type": "text",
                        "sub_type": "body",
                        "bbox": [72, 72, 420, 120],
                        "text": f"Kết quả OCR từ {source_pdf.name}",
                        "lines": [],
                        "segments": [],
                    }
                ],
            }
        ],
    }
    target.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
```

Cấu hình runtime:

```bash
export RETAIN_LOCAL_OCR_COMMAND="python /opt/retainpdf-ocr/my_ocr.py"
export RETAIN_OCR_RAW_PROVIDER=generic_flat_ocr
```

## Nếu bạn đã có dịch vụ OCR HTTP cục bộ thì sao?

Cách tiếp cận được khuyến nghị vẫn là bọc nó bằng `local_command`. RetainPDF không quy định API HTTP cục bộ của bạn; nó chỉ quy định hợp đồng đầu vào và đầu ra của wrapper.

Ví dụ:

```python
import json
import os
from pathlib import Path

import requests


def main() -> None:
    source_pdf = Path(os.environ["RETAIN_OCR_SOURCE_PDF"])
    target = Path(os.environ["RETAIN_OCR_RAW_PAYLOAD_JSON"])
    target.parent.mkdir(parents=True, exist_ok=True)

    with source_pdf.open("rb") as file:
        response = requests.post(
            "http://127.0.0.1:8000/ocr",
            files={"file": (source_pdf.name, file, "application/pdf")},
            timeout=600,
        )
    response.raise_for_status()

    # Tốt nhất là dịch vụ HTTP cục bộ trả về generic_flat_ocr trực tiếp.
    # Nếu không, hãy chuyển đổi tại đây.
    payload = response.json()
    target.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")


if __name__ == "__main__":
    main()
```

Bằng cách này, bên thứ ba chỉ cần duy trì dịch vụ OCR và wrapper của riêng mình, không cần dạy RetainPDF mọi API HTTP riêng.

## Lưu ý đầu vào URL

Các lần tải lên cục bộ thông thường cung cấp `RETAIN_OCR_SOURCE_PDF`.

Đối với các job nguồn gốc URL, bạn có thể chỉ nhận được:

```text
RETAIN_OCR_SOURCE_URL
```

Trong trường hợp đó, plugin phải tải xuống hoặc vật chất hóa PDF nguồn cuối cùng vào:

```text
$RETAIN_OCR_SOURCE_DIR/*.pdf
```

Nếu không, dịch và kết xuất sẽ không có PDF nguồn cục bộ và job sẽ thất bại.

## Xử lý thất bại

Plugin nên tuân theo các quy tắc sau:

- Thoát khác `0` đối với các đối số không hợp lệ, dịch vụ OCR không khả dụng hoặc thất bại tạo đầu ra.
- Ghi chi tiết chẩn đoán vào stderr hoặc stdout.
- Không phát ra JSON viết dở và vẫn thoát `0`.
- Nếu thoát `0`, nó phải ghi ít nhất một trong `RETAIN_OCR_NORMALIZED_DOCUMENT_JSON` hoặc `RETAIN_OCR_RAW_PAYLOAD_JSON`.

RetainPDF cũng sẽ xác minh:

- Các tệp đầu ra có tồn tại không.
- Payload thô có thể được bộ chuyển đổi nhận diện không.
- `document.v1.json` có vượt qua xác thực schema không.

## Danh sách kiểm tra gỡ lỗi

Khi tích hợp nhà cung cấp OCR cục bộ, hãy kiểm tra những điều này trước:

- Cấu hình nhà cung cấp `kind` là `local_command`.
- Lệnh `command` có thể thực thi được bởi người dùng backend.
- Đọc PDF đầu vào từ `RETAIN_OCR_SOURCE_PDF`; không mã hóa cứng đường dẫn.
- Ghi đầu ra vào `RETAIN_OCR_RAW_PAYLOAD_JSON` hoặc `RETAIN_OCR_NORMALIZED_DOCUMENT_JSON`.
- `provider` của payload thô khớp với `RETAIN_OCR_RAW_PROVIDER`.
- Tọa độ bbox và kích thước trang `width`/`height` sử dụng cùng đơn vị.
- Số trang, thứ tự khối và giá trị bbox không trống hoặc đảo ngược.
- Khi thất bại, thoát khác `0` thay vì bỏ qua lỗi.

## Ranh giới với các nhà cung cấp tích hợp sẵn

Việc thêm nhà cung cấp OCR cục bộ không yêu cầu thay đổi:

- Mô-đun dịch
- Mô-đun kết xuất
- Luồng chính của trình chạy job Rust

Chỉ khi `generic_flat_ocr` không thể biểu đạt đầu ra của nhà cung cấp của bạn, bạn mới cần thêm:

```text
backend/scripts/services/document_schema/provider_adapters/<your_provider>/
```

Sau khi thêm bộ chuyển đổi, trỏ `raw_provider` đến tên bộ chuyển đổi của bạn. Luồng chính vẫn chỉ tiêu thụ `document.v1.json`.

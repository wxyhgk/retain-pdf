# Ví dụ Gọi API và Triển khai Dịch vụ PaddleOCR-VL-1.5:

> 
> 
> 
> [Địa chỉ GitHub dự án mã nguồn mở PaddleOCR](https://github.com/PaddlePaddle/PaddleOCR/tree/release/3.3), dịch vụ này **được xây dựng dựa trên mô hình PaddleOCR-VL của dự án mã nguồn mở đó**.
> 
> **Ghi chú phiên bản**: Trang chủ PaddleOCR hiện tại tương ứng với **phiên bản PaddleX 3.4.0**, **phiên bản PaddlePaddle 3.2.1**.
> 

## 1. Giới thiệu PaddleOCR-VL-1.5

Vào ngày 29 tháng 1 năm 2026, chúng tôi đã phát hành **PaddleOCR-VL-1.5** dựa trên PaddleOCR-VL. PaddleOCR-VL-1.5 không chỉ đạt độ chính xác 94.5% trên bộ đánh giá OmniDocBench v1.5, mà còn hỗ trợ định vị khung bất thường một cách sáng tạo, giúp PaddleOCR-VL-1.5 thể hiện xuất sắc trong các tình huống thực tế như quét, nghiêng, gập, chụp màn hình và điều kiện ánh sáng phức tạp. Ngoài ra, mô hình còn bổ sung khả năng nhận diện dấu đóng và phát hiện nhận diện văn bản, các chỉ số chính tiếp tục dẫn đầu.

### **Các chỉ số chính:**

![](https://paddle-model-ecology.bj.bcebos.com/paddlex/demo_image/paddleocr-vl-1.5_metrics.png)

Hình dưới đây thể hiện quy trình tổng thể và khả năng mới được bổ sung của PaddleOCR-VL-1.5:

![](https://paddle-model-ecology.bj.bcebos.com/paddlex/demo_image/PaddleOCR-VL-1.5.png)

## 2. Mô tả Giao diện

Vui lòng xem [tài liệu](https://ai.baidu.com/ai-doc/AISTUDIO/Xmjclapam)

## 3. Ví dụ gọi dịch vụ (Python)

```
# Please make sure the requests library is installed
# pip install requests
import base64
import os
import requests

# Vui lòng truy cập [trang chủ PaddleOCR](https://aistudio.baidu.com/paddleocr/task) để lấy API_URL và TOKEN trong ví dụ gọi API.
API_URL = "<your url>"
TOKEN = "<access token>"

file_path = "<local file path>"

with open(file_path, "rb") as file:
    file_bytes = file.read()
    file_data = base64.b64encode(file_bytes).decode("ascii")

headers = {
    "Authorization": f"token {TOKEN}",
    "Content-Type": "application/json"
}

required_payload = {
    "file": file_data,
    "fileType": <file type>,  # Đối với tài liệu PDF, đặt `fileType` là 0; đối với hình ảnh, đặt `fileType` là 1
}

optional_payload = {
    "useDocOrientationClassify": False,
    "useDocUnwarping": False,
    "useChartRecognition": False,
}

payload = {**required_payload, **optional_payload}

response = requests.post(API_URL, json=payload, headers=headers)
print(response.status_code)
assert response.status_code == 200
result = response.json()["result"]

output_dir = "output"
os.makedirs(output_dir, exist_ok=True)

for i, res in enumerate(result["layoutParsingResults"]):
    md_filename = os.path.join(output_dir, f"doc_{i}.md")
    with open(md_filename, "w", encoding="utf-8") as md_file:
        md_file.write(res["markdown"]["text"])
    print(f"Markdown document saved at {md_filename}")
    for img_path, img in res["markdown"]["images"].items():
        full_img_path = os.path.join(output_dir, img_path)
        os.makedirs(os.path.dirname(full_img_path), exist_ok=True)
        img_bytes = requests.get(img).content
        with open(full_img_path, "wb") as img_file:
            img_file.write(img_bytes)
        print(f"Image saved to: {full_img_path}")
    for img_name, img in res["outputImages"].items():
        img_response = requests.get(img)
        if img_response.status_code == 200:
            # Save image to local
            filename = os.path.join(output_dir, f"{img_name}_{i}.jpg")
            with open(filename, "wb") as f:
                f.write(img_response.content)
            print(f"Image saved to: {filename}")
        else:
            print(f"Failed to download image, status code: {img_response.status_code}")
```

Đối với các thao tác chính do dịch vụ cung cấp:

- Phương thức yêu cầu HTTP là POST.
- Thân yêu cầu và thân phản hồi đều là dữ liệu JSON (đối tượng JSON).
- Khi yêu cầu được xử lý thành công, mã trạng thái phản hồi là `200`, các thuộc tính của thân phản hồi như sau:

| Tên | Kiểu | Ý nghĩa |
| --- | --- | --- |
| `logId` | `string` | UUID của yêu cầu. |
| `errorCode` | `integer` | Mã lỗi. Cố định là `0`. |
| `errorMsg` | `string` | Mô tả lỗi. Cố định là `"Success"`. |
| `result` | `object` | Kết quả thao tác. |
- Khi yêu cầu xử lý không thành công, các thuộc tính của thân phản hồi như sau:

| Tên | Kiểu | Ý nghĩa |
| --- | --- | --- |
| `logId` | `string` | UUID của yêu cầu. |
| `errorCode` | `integer` | Mã lỗi. Giống với mã trạng thái phản hồi. |
| `errorMsg` | `string` | Mô tả lỗi. |

Các thao tác chính do dịch vụ cung cấp như sau:

- **`infer`**

Thực hiện phân tích bố cục.

`POST /layout-parsing`

## 4. Mô tả Tham số Yêu cầu

| Tên | Tham số | Kiểu | Ý nghĩa | Bắt buộc |
| --- | --- | --- | --- | --- |
| `Tệp đầu vào` | `file` | `string` | URL của tệp hình ảnh hoặc PDF có thể truy cập được từ máy chủ, hoặc kết quả mã hóa Base64 của nội dung tệp loại này. Mặc định đối với tệp PDF vượt quá 100 trang, chỉ có nội dung của 100 trang đầu tiên sẽ được xử lý. Để bỏ giới hạn số trang, vui lòng thêm cấu hình sau vào tệp cấu hình dây chuyền sản xuất:

`Serving:
  extra:
    max_num_input_imgs: null`
 | Có |
| `Loại tệp` | `fileType` | `integer`｜`null` | Loại tệp. `0` đại diện cho tệp PDF, `1` đại diện cho tệp hình ảnh. Nếu thân yêu cầu không có thuộc tính này, loại tệp sẽ được suy ra từ URL. | Không |
| `Điều chỉnh hướng hình ảnh` | `useDocOrientationClassify` | `boolean` | `null` | Có sử dụng mô-đun điều chỉnh hướng hình ảnh văn bản khi suy luận hay không. Khi bật, có thể tự động nhận diện và điều chỉnh hình ảnh ở các góc 0°, 90°, 180°, 270°. | Không |
| `Điều chỉnh méo mó hình ảnh` | `useDocUnwarping` | `boolean` | `null` | Có sử dụng mô-đun điều chỉnh hình ảnh văn bản khi suy luận hay không. Khi bật, có thể tự động điều chỉnh hình ảnh bị méo mó, ví dụ như nhăn, nghiêng, v.v. | Không |
| `Phân tích bố cục` | `useLayoutDetection` | `boolean` | `null` | Có sử dụng mô-đun phát hiện và sắp xếp vùng bố cục khi suy luận hay không. Khi bật, có thể tự động phát hiện và sắp xếp các vùng khác nhau trong tài liệu. | Không |
| `Nhận diện biểu đồ` | `useChartRecognition` | `boolean` | `null` | Có sử dụng mô-đun phân tích biểu đồ khi suy luận hay không. Khi bật, có thể tự động phân tích biểu đồ trong tài liệu (như biểu đồ cột, biểu đồ tròn, v.v.) và chuyển đổi thành dạng bảng để thuận tiện cho việc xem và chỉnh sửa dữ liệu. | Không |
| `Ngưỡng lọc vùng bố cục` | `layoutThreshold` | `number` | `object` | `null` | Ngưỡng điểm của mô hình bố cục. Số thực bất kỳ trong khoảng `0-1`. Nếu không thiết lập, sẽ sử dụng giá trị tham số được khởi tạo trong dây chuyền sản xuất, mặc định khởi tạo là `0.5`. | Không |
| `Xử lý hậu kỳ NMS` | `layoutNms` | `boolean` | `null` | Phát hiện bố cục có sử dụng xử lý hậu kỳ NMS hay không. Khi bật, sẽ tự động loại bỏ các khung vùng trùng lặp hoặc chồng lấn cao. | Không |
| `Hệ số giãn` | `layoutUnclipRatio` | `number` | `array` | `object` | `null` | Hệ số giãn của khung phát hiện mô hình phát hiện vùng bố cục. Số thực bất kỳ lớn hơn `0`. Nếu không thiết lập, sẽ sử dụng giá trị tham số được khởi tạo trong dây chuyền sản xuất, mặc định khởi tạo là `1.0`. | Không |
| `Phương pháp lọc khung chồng lấn trong phát hiện vùng bố cục` | `layoutMergeBboxesMode` | `string` | `object` | `null` | 
• **large**: Khi đặt là large, trong các khung phát hiện do mô hình xuất ra, đối với các khung chồng lấn và bao nhau, chỉ giữ lại khung lớn nhất bên ngoài và xóa các khung bên trong bị chồng lấn;
• **small**: Khi đặt là small, trong các khung phát hiện do mô hình xuất ra, đối với các khung chồng lấn và bao nhau, chỉ giữ lại khung nhỏ bên trong bị bao và xóa khung bên ngoài;
• **union**: Không thực hiện lọc khung, giữ lại tất cả các khung bên trong và bên ngoài;
Nếu không thiết lập, sẽ sử dụng giá trị tham số được khởi tạo trong dây chuyền sản xuất, mặc định khởi tạo là `large`. | Không |
| `Hình dạng hình học của kết quả phát hiện bố cục` | `layoutShapeMode` | `string` | `null` | Dùng để chỉ định chế độ biểu diễn hình dạng hình học của kết quả phát hiện bố cục. Tham số này quyết định cách tính toán và hiển thị ranh giới của các vùng phát hiện (như khối văn bản, hình ảnh, bảng, v.v.). Các tham số có thể điền là `rect` (hình chữ nhật), `quad` (tứ giác), `poly` (đa giác) và `auto` (tự động), mặc định khởi tạo là `auto`. | Không |
| `Thiết lập loại prompt` | `promptLabel` | `string` | `null` | Thiết lập loại prompt của mô hình VL, chỉ có hiệu lực khi `useLayoutDetection=False`. Các tham số có thể điền là `ocr`, `formula`, `table` và `chart`, mặc định khởi tạo là `ocr`. | Không |
| `Cường độ ức chế lặp lại` | `repetitionPenalty` | `number` | `null` | Khi xuất hiện văn bản lặp lại hoặc nội dung bảng lặp lại trong kết quả, có thể tăng thích hợp. | Không |
| `Độ ổn định nhận diện` | `temperature` | `number` | `null` | Khi kết quả không ổn định hoặc xuất hiện ảo giác rõ ràng, hãy giảm xuống; khi nhận diện thiếu hoặc lặp lại nhiều, có thể tăng nhẹ. | Không |
| `Phạm vi tin cậy của kết quả` | `topP` | `number` | `null` | Khi kết quả phân tán và không đủ tin cậy, có thể giảm thích hợp để mô hình thận trọng hơn. | Không |
| `Kích thước hình ảnh tối thiểu` | `minPixels` | `number` | `null` | Khi hình ảnh đầu vào quá nhỏ và không nhìn rõ chữ, có thể tăng thích hợp, thường không cần điều chỉnh. | Không |
| `Kích thước hình ảnh tối đa` | `maxPixels` | `number` | `null` | Khi hình ảnh đầu vào đặc biệt lớn, xử lý chậm hoặc áp lực bộ nhớ hiển thị lớn, có thể giảm thích hợp. | Không |
| `Hiển thị số công thức` | `showFormulaNumber` | `boolean` | Có bao gồm số công thức trong văn bản Markdown đầu ra hay không. | Không |
| `Tái cấu trúc kết quả nhiều trang` | `restructurePages` | `boolean` | Tái cấu trúc kết quả phân tích tài liệu PDF nhiều trang để phù hợp với việc hợp nhất bảng biểu trải nhiều trang và nhận diện cấp độ tiêu đề đoạn văn, mặc định khởi tạo là `False`. | Không |
| `Hợp nhất bảng xuyên trang` | `mergeTables` | `boolean` | Khi bật, sẽ nhận diện bảng xuyên trang và hợp nhất thành một, chỉ có hiệu lực khi `useLayoutDetection=False`, mặc định khởi tạo là `True`. | Không |
| `Nhận diện cấp tiêu đề đoạn văn` | `relevelTitles` | `boolean` | Khi bật, sẽ nhận diện cấp tiêu đề đoạn văn, chỉ có hiệu lực khi `useLayoutDetection=False`, mặc định khởi tạo là `True`. | Không |
| `Làm đẹp Markdown` | `prettifyMarkdown` | `boolean` | Có xuất ra văn bản Markdown đã làm đẹp hay không. | Không |
| `Trực quan hóa` | `visualize` | `boolean` | `null` | Hỗ trợ trả về hình ảnh kết quả trực quan và hình ảnh trung gian trong quá trình xử lý. Bật chức năng này sẽ tăng thời gian trả kết quả.  
• Truyền `true`: Trả về hình ảnh. 
• Truyền `false`: Không trả về hình ảnh. 
• Nếu thân yêu cầu không cung cấp tham số này hoặc truyền `null`: Tuân theo cài đặt `Serving.visualize` trong tệp cấu hình dây chuyền. Ví dụ, thêm trường sau vào tệp cấu hình dây chuyền: 

`Serving:
  visualize: False`
 Sẽ mặc định không trả về hình ảnh, tham số `visualize` trong thân yêu cầu có thể ghi đè hành vi mặc định. Nếu cả thân yêu cầu và tệp cấu hình đều không đặt (hoặc thân yêu cầu truyền `null`, tệp cấu hình không đặt), thì mặc định trả về hình ảnh. | Không |
- Khi yêu cầu được xử lý thành công, thuộc tính `result` của thân phản hồi có các thuộc tính sau:

| Tên | Kiểu | Ý nghĩa |
| --- | --- | --- |
| `layoutParsingResults` | `array` | Kết quả phân tích bố cục. Độ dài mảng là 1 (đối với đầu vào hình ảnh) hoặc số trang tài liệu thực tế được xử lý (đối với đầu vào PDF). Đối với đầu vào PDF, mỗi phần tử trong mảng lần lượt đại diện cho kết quả của mỗi trang trong tệp PDF được xử lý thực tế. |
| `dataInfo` | `object` | Thông tin dữ liệu đầu vào. |

Mỗi phần tử trong `layoutParsingResults` là một đối tượng `object`, có các thuộc tính sau:

| Tên | Kiểu | Ý nghĩa |
| --- | --- | --- |
| `prunedResult` | `object` | Phiên bản đơn giản hóa của trường `res` trong biểu diễn JSON của kết quả được tạo bởi phương thức `predict` của đối tượng, trong đó đã loại bỏ các trường `input_path` và `page_index`. |
| `markdown` | `object` | Kết quả Markdown. |
| `outputImages` | `object` | `null` | Xem mô tả thuộc tính `img` của kết quả dự đoán. Hình ảnh ở định dạng JPEG, được mã hóa bằng Base64. |
| `inputImage` | `string` | `null` | Hình ảnh đầu vào. Hình ảnh ở định dạng JPEG, được mã hóa bằng Base64. |

`markdown` là một đối tượng `object`, có các thuộc tính sau:

| Tên | Kiểu | Ý nghĩa |
| --- | --- | --- |
| `text` | `string` | Văn bản Markdown. |
| `images` | `object` | Cặp khóa-giá trị của đường dẫn tương đối hình ảnh Markdown và hình ảnh được mã hóa bằng Base64.
- **`restructurePages`**

Tái cấu trúc kết quả nhiều trang (tùy chọn).

`POST /restructure-pages`

- Các thuộc tính của thân yêu cầu như sau:

| Tên | Tham số | Kiểu | Ý nghĩa | Bắt buộc |
| --- | --- | --- | --- | --- |
| `Hợp nhất bảng biểu trải nhiều trang` | `mergeTables` | `boolean` | Khi bật, sẽ nhận diện các bảng biểu trải nhiều trang và hợp nhất chúng thành một bảng, chỉ có hiệu lực khi `useLayoutDetection=False`, mặc định khởi tạo là `True`. | Không |
| `Nhận diện cấp độ tiêu đề đoạn văn` | `relevelTitles` | `boolean` | Khi bật, sẽ nhận diện cấp độ tiêu đề đoạn văn, chỉ có hiệu lực khi `useLayoutDetection=False`, mặc định khởi tạo là `True`. | Không |
| `Tái cấu trúc kết quả nhiều trang` | `concatenatePages` | `boolean` | Tái cấu trúc kết quả phân tích tài liệu PDF nhiều trang để phù hợp với việc hợp nhất bảng biểu trải nhiều trang và nhận diện cấp độ tiêu đề đoạn văn, mặc định khởi tạo là `False`. | Không |
| `Làm đẹp Markdown` | `prettifyMarkdown` | `boolean` | Có xuất ra văn bản Markdown đã được làm đẹp hay không. | Không |
| `Hiển thị số công thức` | `showFormulaNumber` | `boolean` | Có bao gồm số công thức trong văn bản Markdown đầu ra hay không. | Không |

Mỗi phần tử trong `pages` là một đối tượng `object`, có các thuộc tính sau:

| Tên | Kiểu | Ý nghĩa |
| --- | --- | --- |
| `prunedResult` | `object` | Đối tượng `prunedResult` tương ứng được trả về từ thao tác `infer`. |
| `markdownImages` | `object`|`null` | Thuộc tính `images` của đối tượng `markdown` được trả về từ thao tác `infer`.
- Khi yêu cầu được xử lý thành công, thuộc tính `result` của thân phản hồi có các thuộc tính sau:

| Tên | Kiểu | Ý nghĩa |
| --- | --- | --- |
| `layoutParsingResults` | `array` | Kết quả phân tích bố cục sau khi tái cấu trúc. Các trường chứa trong mỗi phần tử xem mô tả kết quả trả về của thao tác `infer` (không bao gồm hình ảnh kết quả trực quan và hình ảnh trung gian). |

Đối với mô tả cấu trúc dữ liệu và trường trả về, vui lòng tham khảo [tài liệu](https://www.paddleocr.ai/latest/version3.x/pipeline_usage/PaddleOCR-VL.html).

**Lưu ý**: Nếu gặp vấn đề trong quá trình sử dụng, vui lòng gửi phản hồi bất cứ lúc nào tại mục [issue](https://github.com/PaddlePaddle/PaddleOCR/issues).

# Mã gọi bất đồng bộ

# Please make sure the requests library is installed
# pip install requests
import json
import os
import requests
import sys
import time

JOB_URL = "https://paddleocr.aistudio-app.com/api/v2/ocr/jobs"
TOKEN = "<PADDLEOCR_API_TOKEN>"
MODEL = "PaddleOCR-VL"

file_path = "<local file path or file url>"

headers = {
    "Authorization": f"bearer {TOKEN}",
}

optional_payload = {
    "useDocOrientationClassify": False,
    "useDocUnwarping": False,
    "useChartRecognition": False,
}

print(f"Processing file: {file_path}")

if file_path.startswith("http"):
    # URL Mode
    headers["Content-Type"] = "application/json"
    payload = {
        "fileUrl": file_path,
        "model": MODEL,
        "optionalPayload": optional_payload
    }
    job_response = requests.post(JOB_URL, json=payload, headers=headers)
else:
    # Local File Mode
    if not os.path.exists(file_path):
        print(f"Error: File not found at {file_path}")
        sys.exit(1)
        
    data = {
        "model": MODEL,
        "optionalPayload": json.dumps(optional_payload)
    }
    
    with open(file_path, "rb") as f:
        files = {"file": f}
        job_response = requests.post(JOB_URL, headers=headers, data=data, files=files)

print(f"Response status: {job_response.status_code}")
if job_response.status_code != 200:
    print(f"Response content: {job_response.text}")

assert job_response.status_code == 200
jobId = job_response.json()["data"]["jobId"]
print(f"Job submitted successfully. job id: {jobId}")
print("Start polling for results")

jsonl_url = ""
while True:
    job_result_response = requests.get(f"{JOB_URL}/{jobId}", headers=headers)
    assert job_result_response.status_code == 200
    state = job_result_response.json()["data"]["state"]
    if state == 'pending':
        print("The current status of the job is pending")
    elif state == 'running':
        try:
            total_pages = job_result_response.json()['data']['extractProgress']['totalPages']
            extracted_pages = job_result_response.json()['data']['extractProgress']['extractedPages']
            print(f"The current status of the job is running, total pages: {total_pages}, extracted pages: {extracted_pages}")
        except KeyError:
             print("The current status of the job is running...")
    elif state == 'done':
        extracted_pages = job_result_response.json()['data']['extractProgress']['extractedPages']
        start_time = job_result_response.json()['data']['extractProgress']['startTime']
        end_time = job_result_response.json()['data']['extractProgress']['endTime']
        print(f"Job completed, successfully extracted pages: {extracted_pages}, start time: {start_time}, end time: {end_time}")
        jsonl_url = job_result_response.json()['data']['resultUrl']['jsonUrl']
        break
    elif state == "failed":
        error_msg = job_result_response.json()['data']['errorMsg']
        print(f"Job failed, failure reason：{error_msg}")
        sys.exit()

    time.sleep(5)

if jsonl_url:
    jsonl_response = requests.get(jsonl_url)
    jsonl_response.raise_for_status()
    lines = jsonl_response.text.strip().split('\n')
    output_dir = "output"
    os.makedirs(output_dir, exist_ok=True)
    page_num = 0
    for line_num, line in enumerate(lines, start=1):
        line = line.strip()
        if not line:
            continue
        result = json.loads(line)["result"]
        for i, res in enumerate(result["layoutParsingResults"]):
            md_filename = os.path.join(output_dir, f"doc_{page_num}.md")
            with open(md_filename, "w", encoding="utf-8") as md_file:
                md_file.write(res["markdown"]["text"])
            print(f"Markdown document saved at {md_filename}")
            for img_path, img in res["markdown"]["images"].items():
                full_img_path = os.path.join(output_dir, img_path)
                os.makedirs(os.path.dirname(full_img_path), exist_ok=True)
                img_bytes = requests.get(img).content
                with open(full_img_path, "wb") as img_file:
                    img_file.write(img_bytes)
                print(f"Image saved to: {full_img_path}")
            for img_name, img in res["outputImages"].items():
                img_response = requests.get(img)
                if img_response.status_code == 200:
                    # Save image to local
                    filename = os.path.join(output_dir, f"{img_name}_{page_num}.jpg")
                    with open(filename, "wb") as f:
                        f.write(img_response.content)
                    print(f"Image saved to: {filename}")
                else:
                    print(f"Failed to download image, status code: {img_response.status_code}")
            page_num += 1
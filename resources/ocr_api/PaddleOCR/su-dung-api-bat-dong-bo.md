Tài liệu sử dụng API bất đồng bộ
Cập nhật lần cuối: 04-02-2026
Hướng dẫn sử dụng API bất đồng bộ
Mỗi yêu cầu hỗ trợ tối đa 1000 trang PDF
Hỗ trợ truyền liên kết tệp. Kích thước tệp không được vượt quá 200 MB
Hỗ trợ tải lên tệp cục bộ. Kích thước tệp không được vượt quá 50 MB
Ví dụ gọi API bất đồng bộ hoàn chỉnh
Đối với các mô hình khác nhau, các trường trong kết quả trả về có sự khác biệt nhỏ. Dưới đây là ví dụ gọi API cho dòng PaddleOCR-VL / PP-StructureV3 và PP-OCRv5.

1. Ví dụ gọi PaddleOCR-VL-1.5, PaddleOCR-VL, PP-StructureV3
Áp dụng cho các mô hình PaddleOCR-VL-1.5, PaddleOCR-VL và PP-StructureV3.

# Please make sure the requests library is installed
# pip install requests
import json
import os
import requests
import sys
import time

JOB_URL = "https://paddleocr.aistudio-app.com/api/v2/ocr/jobs"
TOKEN = ""
# Các mô hình tùy chọn: "PaddleOCR-VL-1.5", "PaddleOCR-VL", "PP-StructureV3"
MODEL = "PaddleOCR-VL-1.5"

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

    print(f"Trạng thái phản hồi: {job_response.status_code}")
    if job_response.status_code != 200:
        print(f"Nội dung phản hồi: {job_response.text}")

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
        # Lưu ý: Ở đây sử dụng trường layoutParsingResults
        for i, res in enumerate(result["layoutParsingResults"]):
            md_filename = os.path.join(output_dir, f"doc_{page_num}.md")
            with open(md_filename, "w", encoding="utf-8") as md_file:
                md_file.write(res["markdown"]["text"])
            print(f"Tài liệu Markdown đã được lưu tại {md_filename}")
            for img_path, img in res["markdown"]["images"].items():
                full_img_path = os.path.join(output_dir, img_path)
                os.makedirs(os.path.dirname(full_img_path), exist_ok=True)
                img_bytes = requests.get(img).content
                with open(full_img_path, "wb") as img_file:
                    img_file.write(img_bytes)
                print(f"Hình ảnh đã được lưu tại: {full_img_path}")
            for img_name, img in res["outputImages"].items():
                img_response = requests.get(img)
                if img_response.status_code == 200:
                    # Save image to local
                    filename = os.path.join(output_dir, f"{img_name}_{page_num}.jpg")
                    with open(filename, "wb") as f:
                        f.write(img_response.content)
                    print(f"Hình ảnh đã được lưu tại: {filename}")
                else:
                    print(f"Không thể tải xuống hình ảnh, mã trạng thái: {img_response.status_code}")
            page_num += 1
2. Ví dụ gọi PP-OCRv5
Áp dụng cho mô hình PP-OCRv5.

# Please make sure the requests library is installed
# pip install requests
import json
import os
import requests
import sys
import time

JOB_URL = "https://paddleocr.aistudio-app.com/api/v2/ocr/jobs"
TOKEN = ""
MODEL = "PP-OCRv5"

file_path = "<local file path or file url>"

headers = {
    "Authorization": f"bearer {TOKEN}",
}

optional_payload = {
    "useDocOrientationClassify": False,
    "useDocUnwarping": False,
    "useTextlineOrientation": False,
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
        # Lưu ý: PP-OCRv5 sử dụng trường ocrResults
        for i, res in enumerate(result["ocrResults"]):
            image_url = res["ocrImage"]
            img_response = requests.get(image_url)
            if img_response.status_code == 200:
                # Save image to local
                filename = f"output/img_output_{page_num}.jpg"
                with open(filename, "wb") as f:
                    f.write(img_response.content)
                print(f"Hình ảnh đã được lưu tại: {filename}")
            else:
                print(f"Không thể tải xuống hình ảnh, mã trạng thái: {img_response.status_code}")
            page_num += 1
Tài liệu giao diện
Base URL：https://paddleocr.aistudio-app.com/

Gửi tác vụ phân tích
Path: /api/v2/ocr/jobs

Method: POST

Header:

Authorization: Bearer {access_token}
Content-Type: application/json（đặt khi truyền liên kết tệp, mã mẫu đã tự động thích ứng）
Content-Type: multipart/form-data（đặt khi tải lên tệp, mã mẫu đã tự động thích ứng）
Accept-Encoding: gzip, deflate, br
Mô tả tham số yêu cầu
Tham số	Kiểu	Bắt buộc	Ví dụ	Mô tả
file	bytes	Có (chọn một trong hai với fileUrl)		Dữ liệu tệp nhị phân
fileUrl	string	Có (chọn một trong hai với file)		Liên kết tệp
model	string	Có	PP-OCRv5
PP-StructureV3
PaddleOCR-VL
PaddleOCR-VL-1.5	Tên mô hình OCR
optionalPayload	object	Không	{"useDocOrientationClassify": false}	Tham số phân tích, kiểu khác nhau tùy mô hình, tham khảo:
PP-OCRV5: Tài liệu
PP-StructureV3: Tài liệu
PaddleOCR-VL: Tài liệu
PaddleOCR-VL-1.5: Tài liệu
pageRanges	string	Không	"2,4-6": Trang 2, trang 4 đến trang 6
"2--2": Trang 2 đến trang thứ 2 từ cuối	Chỉ định phạm vi trang cần phân tích
batchId	string	Không	Chuỗi nhận dạng duy nhất	ID lô, dùng để truy vấn tác vụ hàng loạt
Mô tả tham số phản hồi
Tham số	Kiểu	Ví dụ	Mô tả
traceId	string	0b1eb3150f5bec03dab9e74b4264c615	ID yêu cầu
code	int	10002	Mã trạng thái giao diện, thành công là 0, chi tiết thất bại xem "Mô tả mã lỗi"
msg	string	URL tệp không nhận diện được	Thông tin phản hồi giao diện, chi tiết thất bại xem "Mô tả mã lỗi"
data	object		
data.jobId	string	ocrjob-f4377241b695	ID tác vụ
Lấy kết quả phân tích
Path: /api/v2/ocr/jobs/{jobId}

Method: GET

Header:

Authorization: Bearer {access_token}
Content-Type: application/json
Mô tả tham số phản hồi
Tham số	Kiểu	Ví dụ	Mô tả
traceId	string	0b1eb3150f5bec03dab9e74b4264c615	ID yêu cầu
code	int	0	Mã trạng thái giao diện, thành công: 0
msg	string	Success	Thông tin xử lý giao diện, thành công: "Success"
data	object		
data.jobId	string	ocrjob-f4377241b695	ID tác vụ
data.state	string	done	Trạng thái xử lý tác vụ
* done: Hoàn thành
* pending: Đang xếp hàng
* running: Đang phân tích
* failed: Phân tích thất bại (không có trường hợp một phần trang thành công)
data.errorMsg	string	Định dạng tệp không được hỗ trợ, vui lòng tải lên loại tệp đáp ứng yêu cầu	Nguyên nhân thất bại phân tích, giá trị này có hiệu lực khi state=failed
data.resultUrl	object	Cung cấp liên kết ngắn BOS
{ "jsonUrl": "https://***.com", "markdownUrl": "https://***.com"}	Kết quả phân tích tài liệu, giá trị này có hiệu lực khi state=done
data.extractProgress	object		Tiến độ phân tích tài liệu, giá trị này có hiệu lực khi state=running
data.extractProgress.startTime	string	2026-01-01T12:00:00+08:00	Thời gian bắt đầu phân tích tài liệu
data.extractProgress.endTime	string	2026-01-01T12:00:00+08:00	Thời gian kết thúc phân tích tài liệu
data.extractProgress.totalPages	string	10	Tổng số trang tài liệu
data.extractProgress.extractedPages	string	1	Số trang đã phân tích
Lấy kết quả tác vụ theo lô
Path: /api/v2/ocr/jobs/batch/{batchId}

Method: GET

Header:

Authorization: Bearer {access_token}
Content-Type: application/json
Accept-Encoding: gzip, deflate, br
Mô tả tham số phản hồi

Tham số	Kiểu	Ví dụ	Mô tả
traceId	string	0b1eb3150f5bec03dab9e74b4264c615	ID yêu cầu
code	int	0	Mã trạng thái giao diện, thành công: 0
msg	string	Success	Thông tin xử lý giao diện, thành công: "Success"
data	object		
data.batchId	string	batchid-202601210000	ID tác vụ hàng loạt, người dùng tự định nghĩa truyền vào, hình thức tự đặt.
data.extractResult	array		Danh sách kết quả suy luận
data.extractResult.jobId	string	ocrjob-f4377241b695	ID tác vụ
data.extractResult.state	string	done	Trạng thái xử lý tác vụ
* done: Hoàn thành
* pending: Đang xếp hàng
* running: Đang phân tích
* failed: Phân tích thất bại (không có trường hợp một phần trang thành công)
data.extractResult.errorMsg	string	Định dạng tệp không được hỗ trợ, vui lòng tải lên loại tệp đáp ứng yêu cầu	Nguyên nhân thất bại phân tích, giá trị này có hiệu lực khi state=failed
data.extractResult.resultUrl	object	Cung cấp liên kết ngắn BOS
{ "jsonUrl": "https://***.com", "markdownUrl": "https://***.com"}	Kết quả phân tích tài liệu, giá trị này có hiệu lực khi state=done
data.extractResult.extractProgress	object		Tiến độ phân tích tài liệu, giá trị này có hiệu lực khi state=running
data.extractResult.extractProgress.startTime	string	2026-01-01T12:00:00+08:00	Thời gian bắt đầu phân tích tài liệu
data.extractResult.extractProgress.endTime	string	2026-01-01T12:00:00+08:00	Thời gian kết thúc phân tích tài liệu
data.extractResult.extractProgress.totalPages	int	10	Tổng số trang tài liệu
data.extractResult.extractProgress.extractedPages	int	1	Số trang đã phân tích

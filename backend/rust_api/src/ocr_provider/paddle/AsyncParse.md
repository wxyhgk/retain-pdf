# PaddleOCR-VL-1.5 服务化部署调用示例及 API 介绍：

> 
> 
> 
> [PaddleOCR 开源项目 GitHub 地址](https://github.com/PaddlePaddle/PaddleOCR/tree/release/3.3)，本服务**基于该开源项目的 PaddleOCR-VL 模型构建**。
> 
> **版本说明**：PaddleOCR 官网当前对应的 **PaddleX 版本为 3.4.0**，**PaddlePaddle 版本为 3.2.1**。
> 

## 1. PaddleOCR-VL-1.5 介绍

2026年1月29日，我们在PaddleOCR-VL的基础上发布了**PaddleOCR-VL-1.5**。PaddleOCR-VL-1.5不仅以94.5%精度大幅刷新了评测集OmniDocBench v1.5，更创新性地支持了异形框定位，使得PaddleOCR-VL-1.5 在扫描、倾斜、弯折、屏幕拍摄及复杂光照等真实场景中均表现优异。此外，模型还新增了印章识别与文本检测识别能力，关键指标持续领跑。

### **关键指标:**

![](https://paddle-model-ecology.bj.bcebos.com/paddlex/demo_image/paddleocr-vl-1.5_metrics.png)

下图展示了 PaddleOCR-VL-1.5 的整体流程及新增能力：

![](https://paddle-model-ecology.bj.bcebos.com/paddlex/demo_image/PaddleOCR-VL-1.5.png)

## 2. 接口说明

请查看[文档](https://ai.baidu.com/ai-doc/AISTUDIO/Xmjclapam)

## 3. 服务调用示例（python）

```
# Please make sure the requests library is installed
# pip install requests
import base64
import os
import requests

# API_URL 及 TOKEN 请访问 [PaddleOCR 官网](https://aistudio.baidu.com/paddleocr/task) 在 API 调用示例中获取。
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
    "fileType": <file type>,  # For PDF documents, set `fileType` to 0; for images, set `fileType` to 1
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

对于服务提供的主要操作：

- HTTP请求方法为POST。
- 请求体和响应体均为JSON数据（JSON对象）。
- 当请求处理成功时，响应状态码为`200`，响应体的属性如下：

| 名称 | 类型 | 含义 |
| --- | --- | --- |
| `logId` | `string` | 请求的UUID。 |
| `errorCode` | `integer` | 错误码。固定为`0`。 |
| `errorMsg` | `string` | 错误说明。固定为`"Success"`。 |
| `result` | `object` | 操作结果。 |
- 当请求处理未成功时，响应体的属性如下：

| 名称 | 类型 | 含义 |
| --- | --- | --- |
| `logId` | `string` | 请求的UUID。 |
| `errorCode` | `integer` | 错误码。与响应状态码相同。 |
| `errorMsg` | `string` | 错误说明。 |

服务提供的主要操作如下：

- **`infer`**

进行版面解析。

`POST /layout-parsing`

## 4. 请求参数说明

| 名称 | 参数 | 类型 | 含义 | 是否必填 |
| --- | --- | --- | --- | --- |
| `输入文件` | `file` | `string` | 服务器可访问的图像文件或PDF文件的URL，或上述类型文件内容的Base64编码结果。默认对于超过100页的PDF文件，只有前100页的内容会被处理。 要解除页数限制，请在产线配置文件中添加以下配置： 

`Serving:
  extra:
    max_num_input_imgs: null`
 | 是 |
| `文件类型` | `fileType` | `integer`｜`null` | 文件类型。`0`表示PDF文件，`1`表示图像文件。若请求体无此属性，则将根据URL推断文件类型。 | 否 |
| `图片方向矫正` | `useDocOrientationClassify` | `boolean` | `null` | 是否在推理时使用文本图像方向矫正模块，开启后，可以自动识别并矫正 0°、90°、180°、270°的图片。 | 否 |
| `图片扭曲矫正` | `useDocUnwarping` | `boolean` | `null` | 是否在推理时使用文本图像矫正模块，开启后，可以自动矫正扭曲图片，例如褶皱、倾斜等情况。 | 否 |
| `版面分析` | `useLayoutDetection` | `boolean` | `null` | 是否在推理时使用版面区域检测排序模块，开启后，可以自动检测文档中不同区域并排序。 | 否 |
| `图表识别` | `useChartRecognition` | `boolean` | `null` | 是否在推理时使用图表解析模块，开启后，可以自动解析文档中的图表（如柱状图、饼图等）并转换为表格形式，方便查看和编辑数据。 | 否 |
| `版面区域过滤强度` | `layoutThreshold` | `number` | `object` | `null` | 版面模型得分阈值。`0-1` 之间的任意浮点数。如果不设置，将使用产线初始化的该参数值，默认初始化为 `0.5`。 | 否 |
| `NMS后处理` | `layoutNms` | `boolean` | `null` | 版面检测是否使用后处理NMS，开启后，会自动移除重复或高度重叠的区域框。 | 否 |
| `扩张系数` | `layoutUnclipRatio` | `number` | `array` | `object` | `null` | 版面区域检测模型检测框的扩张系数。 任意大于 `0` 浮点数。如果不设置，将使用产线初始化的该参数值，默认初始化为 `1.0`。 | 否 |
| `版面区域检测的重叠框过滤方式` | `layoutMergeBboxesMode` | `string` | `object` | `null` |  
• **large**，设置为large时，表示在模型输出的检测框中，对于互相重叠包含的检测框，只保留外部最大的框，删除重叠的内部框； 
• **small**，设置为small，表示在模型输出的检测框中，对于互相重叠包含的检测框，只保留内部被包含的小框，删除重叠的外部框； 
• **union**，不进行框的过滤处理，内外框都保留；  如果不设置，将使用产线初始化的该参数值，默认初始化为`large`。 | 否 |
| `版面检测结果的几何形状` | `layoutShapeMode` | `string` | `null` | 用于指定版面检测结果的几何形状表示模式，该参数决定了检测区域（如文本块、图片、表格等）边界的计算方式及展示形态。可填写参数为 `rect` (矩形)、`quad` (四边形)、`poly` (多边形) 和 `auto` (自动)，默认初始化为`auto`。 | 否 |
| `prompt类型设置` | `promptLabel` | `string` | `null` | VL模型的 prompt 类型设置，当且仅当 `useLayoutDetection=False` 时生效。可填写参数为 `ocr`、`formula`、`table` 和 `chart`，默认初始化为`ocr`。 | 否 |
| `重复抑制强度` | `repetitionPenalty` | `number` | `null` | 结果中出现重复文字、重复表格内容时，可适当调高。 | 否 |
| `识别稳定性` | `temperature` | `number` | `null` | 结果不稳定或出现明显幻觉时调低，漏识别或者重复较多时可略微调高。 | 否 |
| `结果可信范围` | `topP` | `number` | `null` | 结果发散、不够可信时可适当调低，让模型更保守。 | 否 |
| `最小图像尺寸` | `minPixels` | `number` | `null` | 输入图片太小、文字看不清时可适当调高，一般无需调整。 | 否 |
| `最大图像尺寸` | `maxPixels` | `number` | `null` | 输入图片特别大、处理变慢或显存压力较大时可适当调低。 | 否 |
| `公式编号展示` | `showFormulaNumber` | `boolean` | 输出的 Markdown 文本中是否包含公式编号。 | 否 |
| `重构多页结果` | `restructurePages` | `boolean` | 对多页 pdf 解析结果进行重构，用于适配跨页表格合并和段落标题级别识别，默认初始化为`False`。 | 否 |
| `跨页表格合并` | `mergeTables` | `boolean` | 开启后，会识别跨页表格，将其合并为一个，当且仅当 `useLayoutDetection=False` 时生效，默认初始化为`True`。 | 否 |
| `段落标题级别识别` | `relevelTitles` | `boolean` | 开启后，会识别段落标题级别，当且仅当 `useLayoutDetection=False` 时生效，默认初始化为`True`。 | 否 |
| `Markdown 美化` | `prettifyMarkdown` | `boolean` | 是否输出美化后的 Markdown 文本。 | 否 |
| `可视化` | `visualize` | `boolean` | `null` | 支持返回可视化结果图及处理过程中的中间图像。开启此功能后，将增加结果返回时间。  
• 传入 `true`：返回图像。 
• 传入 `false`：不返回图像。 
• 若请求体中未提供该参数或传入 `null`：遵循产线配置文件`Serving.visualize` 的设置。  例如，在产线配置文件中添加如下字段： 

`Serving:
  visualize: False`
 将默认不返回图像，通过请求体中的`visualize`参数可以覆盖默认行为。如果请求体和配置文件中均未设置（或请求体传入`null`、配置文件中未设置），则默认返回图像。 | 否 |
- 请求处理成功时，响应体的`result`具有如下属性：

| 名称 | 类型 | 含义 |
| --- | --- | --- |
| `layoutParsingResults` | `array` | 版面解析结果。数组长度为1（对于图像输入）或实际处理的文档页数（对于PDF输入）。对于PDF输入，数组中的每个元素依次表示PDF文件中实际处理的每一页的结果。 |
| `dataInfo` | `object` | 输入数据信息。 |

`layoutParsingResults`中的每个元素为一个`object`，具有如下属性：

| 名称 | 类型 | 含义 |
| --- | --- | --- |
| `prunedResult` | `object` | 对象的 `predict` 方法生成结果的 JSON 表示中 `res` 字段的简化版本，其中去除了 `input_path` 和 `page_index` 字段。 |
| `markdown` | `object` | Markdown结果。 |
| `outputImages` | `object` | `null` | 参见预测结果的 `img` 属性说明。图像为JPEG格式，使用Base64编码。 |
| `inputImage` | `string` | `null` | 输入图像。图像为JPEG格式，使用Base64编码。 |

`markdown`为一个`object`，具有如下属性：

| 名称 | 类型 | 含义 |
| --- | --- | --- |
| `text` | `string` | Markdown文本。 |
| `images` | `object` | Markdown图片相对路径和Base64编码图像的键值对。 |
- **`restructurePages`**

重构多页结果 (可选)。

`POST /restructure-pages`

- 请求体的属性如下：

| 名称 | 参数 | 类型 | 含义 | 是否必填 |
| --- | --- | --- | --- | --- |
| `跨页表格合并` | `mergeTables` | `boolean` | 开启后，会识别跨页表格，将其合并为一个，当且仅当 `useLayoutDetection=False` 时生效，默认初始化为`True`。 | 否 |
| `段落标题级别识别` | `relevelTitles` | `boolean` | 开启后，会识别段落标题级别，当且仅当 `useLayoutDetection=False` 时生效，默认初始化为`True`。 | 否 |
| `重构多页结果` | `concatenatePages` | `boolean` | 对多页 pdf 解析结果进行重构，用于适配跨页表格合并和段落标题级别识别，默认初始化为`False`。 | 否 |
| `Markdown 美化` | `prettifyMarkdown` | `boolean` | 是否输出美化后的 Markdown 文本。 | 否 |
| `公式编号展示` | `showFormulaNumber` | `boolean` | 输出的 Markdown 文本中是否包含公式编号。 | 否 |

`pages`中的每个元素为一个`object`，具有如下属性：

| 名称 | 类型 | 含义 |
| --- | --- | --- |
| `prunedResult` | `object` | 对应`infer`操作返回的`prunedResult`对象。 |
| `markdownImages` | `object`|`null` | 对应`infer`操作返回的`markdown`对象的`images`属性。 |
- 请求处理成功时，响应体的`result`具有如下属性：

| 名称 | 类型 | 含义 |
| --- | --- | --- |
| `layoutParsingResults` | `array` | 重构后的版面解析结果。其中每个元素包含的字段请参见对`infer`操作返回结果的说明（不含可视化结果图和中间图像）。 |

对于返回的数据结构及字段说明，请查阅[文档](https://www.paddleocr.ai/latest/version3.x/pipeline_usage/PaddleOCR-VL.html)。

**注**：如果在使用过程中遇到问题，欢迎随时在 [issue](https://github.com/PaddlePaddle/PaddleOCR/issues) 区提交反馈。

# 异步调用代码

# Please make sure the requests library is installed
# pip install requests
import json
import os
import requests
import sys
import time

JOB_URL = "https://paddleocr.aistudio-app.com/api/v2/ocr/jobs"
TOKEN = "6e580446746aea4dc442c02f59d1575809d5f77b"
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
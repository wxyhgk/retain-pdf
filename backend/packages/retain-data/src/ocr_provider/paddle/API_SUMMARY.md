# Paddle OCR API Summary

这份文档只回答一个问题：

**我们当前接入的 Paddle OCR 异步 API，实际协议是什么。**

不是讲 `document.v1`，也不是讲渲染/翻译，只讲 provider transport 层。

相关资料：

- Paddle 官方异步接口示例：
  [`AsyncParse.md`](AsyncParse.md)
- Rust client：
  [`client.rs`](client.rs)
- Python client：
  [`services/pipeline/retainpdf_pipeline/ocr/ocr_provider/paddle_api.py`](../../../../../../pipeline/retainpdf_pipeline/ocr/ocr_provider/paddle_api.py)
- provider 边界：
  [`PROVIDER_BOUNDARY.md`](PROVIDER_BOUNDARY.md)

## 1. 我们当前用的是哪套接口

当前主链接的是 Paddle OCR 的异步任务接口：

- `POST /api/v2/ocr/jobs`
- `GET /api/v2/ocr/jobs/{jobId}`
- 下载 `resultUrl.jsonUrl`

默认基地址：

- `https://paddleocr.aistudio-app.com`

当前代码入口：

- Rust：
  [`client.rs`](client.rs)
- Python：
  [`paddle_api.py`](../../../../../../pipeline/retainpdf_pipeline/ocr/ocr_provider/paddle_api.py)

## 2. 鉴权方式

请求头：

```http
Authorization: bearer <token>
Accept: application/json
```

当前代码口径：

- 环境变量：`RETAIN_PADDLE_API_TOKEN`
- 本地 env 文件：`services/pipeline/.env/paddle.env`

Python 读取口：

- [`get_paddle_token(...)`](../../../../../../pipeline/retainpdf_pipeline/ocr/ocr_provider/paddle_api.py)

## 3. 三段式协议

### 3.1 submit

接口：

- `POST /api/v2/ocr/jobs`

两种提交方式：

1. 本地文件上传
2. 远程 URL 提交

我们当前实际支持的两种调用：

- Python：
  - `submit_local_file(...)`
  - `submit_remote_url(...)`
- Rust：
  - `submit_local_file(...)`
  - `submit_remote_url(...)`

关键入参：

- `model`
- `optionalPayload`
- 本地文件时用 multipart `file`
- 远程文件时用 JSON `fileUrl`

成功后最关键的返回字段：

- `data.jobId`

## 3.2 poll

接口：

- `GET /api/v2/ocr/jobs/{jobId}`

我们当前关心的返回字段：

- `data.state`
- `data.extractProgress.totalPages`
- `data.extractProgress.extractedPages`
- `data.resultUrl.jsonUrl`
- `data.errorMsg`

当前系统中的统一状态映射：

- `pending` -> queued
- `running` -> processing
- `done` -> succeeded
- `failed` -> failed

对应实现：

- [`status.rs`](status.rs)

## 3.3 download result

完成后不是直接拿结构化 JSON，而是去下载：

- `resultUrl.jsonUrl`

这个 URL 返回的是 `jsonl`，不是单个 JSON。

当前解包逻辑会把每一行里的：

- `result.layoutParsingResults`
- `result.dataInfo`

聚合成后续 adapter 能消费的 provider raw payload。

对应实现：

- Rust：
  [`client.rs`](client.rs)
- Python：
  [`paddle_api.py`](../../../../../../pipeline/retainpdf_pipeline/ocr/ocr_provider/paddle_api.py)

## 4. 当前我们实际传的关键参数

### `model`

当前默认模型名：

- `PaddleOCR-VL-1.6`

默认值来自共享配置：

- [`services/config/ocr_providers.json`](../../../../../../config/ocr_providers.json)

兼容归一化：

- `paddleocr-vl`
- `paddle-ocr-vl`
- `paddleocr-vl-1.6`
- `paddle-ocr-vl-1.6`
- `paddleocr-vl-1.5`
- `paddle-ocr-vl-1.5`

### `optionalPayload`

当前代码会按模型名构造不同 payload：

- `PaddleOCR-VL(-1.6/-1.5)` 走一套默认 rich-content 参数
- `PP-StructureV3` 走另一套结构化参数

对应实现：

- [`build_optional_payload(...)`](../../../../../../pipeline/retainpdf_pipeline/ocr/ocr_provider/paddle_api.py)

## 5. 错误口径

当前 transport 层主要处理这几类错误：

- HTTP 状态错误
- provider 返回 `errorCode != 0`
- 返回结构不完整
- `jobId` 缺失
- `resultUrl.jsonUrl` 缺失
- 轮询超时
- JSONL 解包失败

Rust 统一错误映射：

- [`errors.rs`](errors.rs)

## 6. 与 `document.v1` 的边界

下面这些字段仍然只属于 provider transport 层：

- `jobId`
- `state`
- `extractProgress`
- `resultUrl.jsonUrl`
- `errorCode`
- `errorMsg`

只有下载并解包完 `jsonl` 后得到的：

- `layoutParsingResults`
- `dataInfo`

才会继续进入 adapter，最终变成：

- `document.v1.json`

不要把 provider 任务态字段直接混进统一文档层。

## 7. 我们当前真实跑通的口径

当前本机真实链路已经验证：

- `workflow = book`
- `ocr.provider = paddle`
- `translation.base_url = https://api.deepseek.com/v1`
- `translation.model = deepseek-v4-flash`

能跑通：

- 上传
- Paddle OCR submit
- poll
- result download
- normalize
- translate
- render

这说明当前仓库里的 Paddle API 接入不是纸面协议，而是和主链联通的。

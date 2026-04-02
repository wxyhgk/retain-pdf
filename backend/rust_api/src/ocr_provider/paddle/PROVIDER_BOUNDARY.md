# Paddle Provider Boundary

这份文档只说明一件事：

Paddle OCR 的 provider API 边界，和 `document.v1` 的统一文档边界，必须分开。

## 1. Paddle Provider API 的三段式边界

根据 [AsyncParse.md](/home/wxyhgk/tmp/Code/rust_api/src/ocr_provider/paddle/AsyncParse.md)，Paddle 的异步接口天然分成三段：

### `submit`

- `POST /api/v2/ocr/jobs`
- 输入：
  - `fileUrl` 或 multipart `file`
  - `model`
  - `optionalPayload`
- 输出：
  - `jobId`

### `poll`

- `GET /api/v2/ocr/jobs/{jobId}`
- 状态：
  - `pending`
  - `running`
  - `done`
  - `failed`
- 运行中可拿到：
  - `extractProgress.totalPages`
  - `extractProgress.extractedPages`
- 完成后可拿到：
  - `resultUrl.jsonUrl`

### `download_result`

- 下载 `jsonUrl`
- 返回的是 `jsonl`
- 逐行解包后，才拿到真正的：
  - `result.layoutParsingResults`
  - `result.dataInfo`

## 2. 哪些属于 Provider API 层

以下内容属于 Paddle provider client / OCR service 层：

- `jobId`
- `state`
- `extractProgress`
- `resultUrl.jsonUrl`
- 提交参数：
  - `model`
  - `optionalPayload`
  - `fileUrl`
  - multipart `file`

这些信息用于：

- 提交任务
- 轮询任务
- 下载结果
- 失败排错

它们不属于 `document.v1`。

## 3. 哪些才进入 `document.v1`

只有在 `download_result` 之后，从 `jsonl` 里解出的实际 OCR 页面内容，才进入统一文档层：

- `layoutParsingResults`
- `dataInfo`

后续才由 adapter 做：

1. provider raw JSON
2. adapter 归一化
3. 生成 `document.v1.json`

也就是说：

- Paddle provider API 层解决“任务怎么跑”
- `document.v1` 层解决“文档最终长什么样”

这两层不要混。

## 4. 当前实现建议

如果后续在 Rust 或 Python 里继续接 Paddle：

- provider client 只负责：
  - submit
  - poll
  - download
  - 解包 jsonl
- adapter 只负责：
  - `layoutParsingResults/dataInfo -> document.v1`
- 翻译/渲染主链路只接受：
  - `document.v1.json`

不要把：

- `jobId`
- `state`
- `resultUrl`
- `extractProgress`

这类 provider API 运行态字段塞进 `document.v1`。

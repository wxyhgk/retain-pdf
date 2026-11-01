# GLM-OCR（智谱）

2026-10-31 加。`ocr.provider` 填 `glm_ocr`。智谱的版面解析模型 `glm-ocr`（`POST https://open.bigmodel.cn/api/paas/v4/layout_parsing`），
公式出 LaTeX、表格出 HTML，约 0.0008 元/页。它和翻译模型 `glm-5.3-flash` 用同一个智谱 key。

## 提交

```json
{
  "workflow": "book",
  "source": { "upload_id": "…" },
  "ocr": { "provider": "glm_ocr", "page_ranges": "1-30" },
  "translation": {
    "model": "glm-5.3-flash",
    "base_url": "https://open.bigmodel.cn/api/paas/v4",
    "credential_ref": "cred_zhipu"
  }
}
```

- 只支持上传的本地文件（`source.upload_id`），不支持 `source.source_url` / `source.file_url`（`GET /api/v1/providers/ocr` 里
  `capabilities.supports_remote_url_submit` 是 `false`）。
- `page_ranges` 支持：先从原文切出所选页当原文，下游页号都按切出来的这份算（和 Paddle 一样）。
- 没有客户端可填的选项。

## key 从哪来（按顺序，取到第一个为止）

1. `ocr.credential_ref`：`ocr_provider_token` 类凭据，`provider` 写 `glm_ocr`。
2. 请求里内联的 `ocr.options.credential`（建任务时导入成托管凭据，和其他命令型 provider 一样）。
3. 服务器的环境变量 `RETAIN_GLM_OCR_API_TOKEN`。
4. **翻译的 key**：以上都没有、而且 `translation.base_url` 的主机是 `open.bigmodel.cn` 时，用翻译的 key（`translation.credential_ref`
   或内联的 `translation.api_key`）。别家的翻译 key 不会发给智谱。

纯 OCR 任务（`workflow: "ocr"`）建任务时会清掉翻译凭据，第 4 条用不上，要用前 3 种给 key。
都没有时任务在 OCR 阶段失败：`GLM-OCR 缺少 API key（智谱 bigmodel 的 key）`。key 不对（401）、参数不对（4xx）直接失败，
报错里带服务端的 code 和 message，不带 key；429、5xx、网络错误自动退避重试。

## 运行

在 provider worker（Python）里跑：原文按 10 页一片串行交上去（同步接口，实测 10 页约 12 秒；分片不多花钱，2 路并发也不更快），
每片报一次进度（`stage=ocr_processing`、`substage=glm_ocr`、`progress_unit=page`）。每片的原始结果存盘，任务重试时做完的片不再请求。
图片 GLM 不回传，按块的框从原文裁到 `md/images/page-<N>/imgs/…`；整份 markdown 在 `md/full.md`。

服务器可调（一般不用动）：

| 环境变量 | 默认 | 说明 |
|---|---|---|
| `RETAIN_GLM_OCR_CHUNK_PAGES` | `10` | 每片页数，1–100 |
| `RETAIN_GLM_OCR_WORKERS` | `1` | 并发片数，1–4 |
| `RETAIN_GLM_OCR_TIMEOUT_SECONDS` | 按页数算：60 秒加每页 12 秒（10 页一片 180 秒） | 单片请求超时；写了就一律用它 |
| `RETAIN_GLM_OCR_API_URL` | 智谱官方地址 | 换接口地址（代理、测试） |

## 和翻译并行（2026-10-31）

整本任务（`workflow: "book"`）选 `glm_ocr` 时，OCR 子任务和翻译阶段**同时**开始：OCR 每做完一片就公布已做完的页
（`ocr/stream/manifest.json`、`ocr/stream/document.v1.json`），翻译跟着一轮轮翻；跨栏、跨页拼接在翻之前就定好，不会先翻半句再重翻。
OCR 做完时翻译也基本翻完，接着渲染。

对接口的影响（只增不改）：

- 父任务在 OCR 还在跑时就进入 `translating` 阶段（`stage_detail` 是"OCR 进行中，翻译跟着 OCR 开始"）；OCR 子任务（`{父任务}-ocr`）照旧有自己的记录和进度。
- 翻译阶段多了 `substage: "ocr_stream"` 的进度事件：`progress_current` / `progress_total` 是 OCR 已公布的页数 / 全书页数
  （Paddle 按片并行时已公布的页不一定是前几页，2026-11-01 起），
  `payload.round` 是第几轮，`payload.held_back_items` 是这一轮先扣住、等下一页的块数。之后照常有 `translation_batches` 的进度。
- OCR 失败、被取消时翻译跟着停，父任务按 OCR 的结果收尾（和以前串行时一样的失败说法）。
- 翻译引擎 agent、开了译前准备（`translation.preparation`）的任务：翻译阶段照样早早启动，但要等 OCR 做完再按整本翻。

## 产物

| 路径（任务目录下） | 内容 |
|---|---|
| `ocr/glm_ocr_result.json` | 各片拼成的一份原始结果（`_meta.chunks` 记每片的页范围、请求号、用量） |
| `ocr/glm_ocr_raw/chunk-<序号>-<起>-<止>.json` | 每片的原始结果；`chunks.json` 记原文 sha256 和分片页数 |
| `ocr/normalized/document.v1.json` | 归一化后的文档（`source.provider` 是 `glm_ocr`） |
| `md/full.md`、`md/images/` | 整份 markdown 和裁好的图片 |

实现见 `backend/pipeline/retainpdf_pipeline/ocr/ocr_provider/README.md` 的「智谱 GLM-OCR」一节。

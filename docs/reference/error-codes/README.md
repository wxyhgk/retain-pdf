<!-- 由 backend/api/src/api_tests/provider_error_codes.rs 从 backend/packages/retainpdf-providers/error-codes/ 生成，不要手改：
     UPDATE_ERROR_CODES=1 cargo test -p retainpdf-api --lib provider_error_codes -->

# 服务商错误码

各家 OCR 服务商、翻译模型服务商官方文档里的错误码（2026-11-23 抓取），每条带含义、给用户的提示、RetainPDF 现在怎么处理、和官方说法对不对得上。用途：任务失败时，前端按失败里的厂商和码查到对应条目，给出比「任务失败，但暂未识别出明确根因」更具体的提示。

- 数据（唯一来源）：[`backend/packages/retainpdf-providers/error-codes/`](../../../backend/packages/retainpdf-providers/error-codes/)，每家一个文件，分 `ocr/`、`llm/`；形状由契约 [`provider-error-codes.v1`](../../../contracts/provider-error-codes.v1.schema.json) 钉住。
- 接口：`GET /api/v1/providers/error-codes`（见[服务商错误码接口](../../api/08-调试诊断/03-服务商错误码.md)），可按 `kind`、`provider`、`code`、`http_status` 筛。
- 本目录全部从数据生成：`UPDATE_ERROR_CODES=1 cargo test -p retainpdf-api --lib provider_error_codes`。
- 含义、提示都是转述，不是原文；原文看每条的出处链接。
- 整理过程和 issue 逐条核对见[错误码汇总（2026-11-23）](../../ops/planning/error-codes/20261123-错误码汇总.md)。

## 怎么查一条提示

任务失败（`GET /api/v1/jobs/{job_id}/reports/failure`、任务详情和列表的 `failure`，字段见[失败结构](../../api/08-调试诊断/01-失败结构.md)）里有 `upstream`：`{provider, http_status, code}`，`provider` 就是这里的厂商编号：

1. **有 `upstream`**：`GET /api/v1/providers/error-codes?provider=<upstream.provider>&code=<upstream.code>`，对不上再用 `http_status=<upstream.http_status>` 查，拿条目的 `user_hint_zh`。翻译（直连、agent、Rust 模型执行器）和 OCR（Paddle、MinerU、GLM-OCR）失败都带；`provider` 为 `custom` 的是认不出的中转地址，只能按状态码和大类提示。
2. **没有 `upstream`**（没收到服务商回应：连不上、超时，或本地出错）：OCR 失败的 `provider` 是厂商编号（`paddle`、`mineru`、`glm_ocr`），`provider_code` 有值时照上面查；`open.bigmodel.cn` 在 OCR 阶段是 `glm_ocr`，翻译阶段是 `zhipu`。
3. **查不到条目**：用 `failure_code` 在 `failure_codes` 里找 `recovery_hint`，或者用条目、失败码对应的大类的 `user_hint_zh` 当通用提示。
4. 条目的 `retainpdf_handling.status` 为 `gap` 时，说明我们现在的分类和官方说法不一致（例如还没单独归类、落成 `unknown` 或 `python_unhandled_exception`），提示以条目为准。

## 大类

每条错误码归到一个固定的大类（`category`）。大类对照到 RetainPDF 的失败码（[失败码表](./retainpdf/失败码.md)），第一个是主名，后面是同义的另一种拼法；现在实际落到哪个码看各条的「我们怎么处理」。

| 大类 | 名称 | 说明 | 一般可重试 | 对照的失败码 | 通用提示 | 备注 |
|---|---|---|---|---|---|---|
| `auth` | 鉴权失败 | Key / Token 写错、过期、被吊销，或者没带鉴权头。 | 否 | `auth_failed` | 在设置里检查并更新这家服务商的 API Key / Token，再重试。 |  |
| `permission` | 没有权限 | Key 是对的，但没有权限用这个模型、接口或业务空间（含套餐不包含该模型、Key 类型不对）。 | 否 | `auth_failed` | 换一个有权限的 Key，或去服务商控制台开通这个模型 / 接口。 | 智谱 1311、1315 这类「套餐不含该模型」走 HTTP 429，翻译侧按业务码第一次就停、整份翻译停下，归 auth_failed（2026-11-23）。GLM-OCR 那边同样的码借用 upstream_quota_exhausted。 |
| `region` | 地区不支持 | 从服务商不支持的国家或地区访问。 | 否 | `auth_failed` | 所在地区不能直接用这家服务；换网络环境，或换一家服务商。 | 现在按 403 归「鉴权失败」，文案让用户检查 Key，不准确（缺口）。 |
| `billing` | 欠费或余额不足 | 账户余额用完、欠费、没有资源包，或套餐已到期。 | 否 | `upstream_quota_exhausted` | 去服务商控制台充值或续费；充值前重试会同样失败。 | HTTP 402、GLM-OCR 的智谱业务码，以及翻译请求层按业务码认出的欠费（OpenAI、智谱、百炼走 429，Anthropic 走 400，百炼 Arrearage 走 400 / 403）都落到这里：第一次就停、整份翻译停下（2026-11-23）。 |
| `quota` | 额度或用量上限 | 到了某个时间窗的用量上限、自设或平台的花费上限、当日页数额度，要等重置或调高上限。 | 否 | `upstream_quota_exhausted` | 等额度重置（看服务商给的重置时间）或在控制台调高上限；几分钟内重试没用。 | 翻译侧的花费上限、时段额度（OpenAI spend limit、Anthropic 消费封顶、智谱 1308 等、百炼预算和 Coding Plan、OpenCode 预算）、PaddleOCR 12001、MinerU -60018/-60019 都归 upstream_quota_exhausted（2026-11-23）。百炼 Coding Plan 的 usage allocated quota exceeded 还当限流退避（缺口）。 |
| `rate_limit` | 限流 | 请求太快、并发太多，或流量涨得太快，触发了速率限制。 | 是 | `upstream_rate_limited`、`rate_limited` | 稍后重试，或在设置里降低并发数。 | Python 流水线叫 upstream_rate_limited，Rust 兜底叫 rate_limited，两个是同一件事。 |
| `overloaded` | 服务繁忙 | 服务商整体过载、队列满、模型暂时不可用，和自己的账户无关。 | 是 | `upstream_rate_limited`、`rate_limited` | 服务商那边忙，过一会儿再试；一直不行可以换一家服务商。 | 没有单独的失败码：GLM-OCR 的 1305 重试用完归限流；翻译时过载重试用完只算这一块失败；PaddleOCR 队列满 10010 现在归「上游服务拒绝请求（400）」（缺口）。 |
| `server` | 服务端错误 | 服务商内部出错（5xx 或解析失败），通常是暂时的。 | 是 | `python_unhandled_exception`、`unknown` | 稍后重试；反复出现时把任务日志里的报错反馈给服务商或我们。 | 没有专门的失败码，重试用完后落「任务失败，但暂未识别出明确根因」（缺口，见 PaddleOCR 11003、MinerU -60010）。 |
| `timeout` | 超时 | 请求或任务在时限内没有完成，连接被关闭。 | 是 | `upstream_timeout` | 检查网络后重试；文件已提交给 OCR 服务商时，重试会重新计费。 |  |
| `invalid_request` | 请求参数错误 | 请求的格式或参数不符合服务商要求。 | 否 | `upstream_bad_request` | 检查模型配置（模型名、接口地址、协议）是否和服务商的要求一致；重试同样会失败。 |  |
| `context_length` | 输入或输出太长 | 输入超过模型上下文窗口，或输出到了 token 上限被截断。 | 否 | `upstream_bad_request` | 换上下文更长的模型，或在设置里调小每批的块数。 | HTTP 200 但输出被截断（finish_reason=length、stop_reason=max_tokens）现在会被当成完整译文收下（缺口）。 |
| `content_filter` | 内容审核 | 输入或输出被服务商的内容安全策略拦截，或模型拒答。 | 否 | `upstream_bad_request` | 这一段内容被服务商拦截了，会保留原文；可以换一家服务商重翻这一段。 |  |
| `model_not_found` | 模型不存在 | 模型名写错、模型已下线，或这个账户 / 地域没开通。 | 否 | `upstream_bad_request` | 检查设置里的模型名，或在服务商控制台确认已开通这个模型。 | 现在翻译时的 404 落「任务失败，但暂未识别出明确根因」，每个块各自失败（缺口，计划加一个「模型不存在」类失败码）。 |
| `unsupported` | 不支持的参数或调用方式 | 模型不支持某个参数、文件格式或调用方式，或接口已下线。 | 否 | `upstream_bad_request` | 换一个支持的模型或文件格式；参数类问题 RetainPDF 多数会自动去掉后重发。 |  |
| `file` | 文件问题 | 文件为空、太大、页数太多、损坏或读不了。 | 否 | `upstream_bad_request` | 换一份文件（压缩、拆分或修复后再传）；重试同一份文件没用。 | OCR 服务商的文件类错误现在多数落「暂未识别出明确根因」（缺口）。 |
| `other` | 其他 | 不属于上面任何一类：任务过期、并发冲突、重试次数上限等。 | 否 | `python_unhandled_exception`、`unknown` | 看失败详情里的原始报错；拿不准时把任务日志反馈给我们。 |  |

## 厂商

| 厂商 | 编号 | 种类 | 条目 | 缺口（高 / 中 / 低） | 文档 |
|---|---|---|---|---|---|
| PaddleOCR | `paddle` | OCR 服务商 | 23 | 0 / 7 / 6 | [ocr/paddle.md](./ocr/paddle.md) |
| MinerU | `mineru` | OCR 服务商 | 31 | 0 / 11 / 7 | [ocr/mineru.md](./ocr/mineru.md) |
| GLM-OCR（智谱 layout_parsing） | `glm_ocr` | OCR 服务商 | 32 | 0 / 6 / 5 | [ocr/glm_ocr.md](./ocr/glm_ocr.md) |
| OpenAI | `openai` | 翻译模型服务商 | 55 | 0 / 1 / 14 | [llm/openai.md](./llm/openai.md) |
| Anthropic | `anthropic` | 翻译模型服务商 | 20 | 0 / 1 / 4 | [llm/anthropic.md](./llm/anthropic.md) |
| DeepSeek | `deepseek` | 翻译模型服务商 | 10 | 0 / 0 / 1 | [llm/deepseek.md](./llm/deepseek.md) |
| 智谱（BigModel / Z.ai） | `zhipu` | 翻译模型服务商 | 35 | 0 / 1 / 2 | [llm/zhipu.md](./llm/zhipu.md) |
| 阿里云百炼（千问 / DashScope） | `qwen` | 翻译模型服务商 | 46 | 0 / 5 / 5 | [llm/qwen.md](./llm/qwen.md) |
| OpenCode Go | `opencode` | 翻译模型服务商 | 8 | 0 / 0 / 1 | [llm/opencode.md](./llm/opencode.md) |

另外两份手写的资料：[PaddleOCR 错误码](../ocr/PaddleOCR/错误码.md)、[DeepSeek 错误码](../LLM_api/DeepSeek/错误码.md)。

## 缺口汇总

数据里标了缺口（`retainpdf_handling.status = gap`）的高、中优先级条目，按优先级、厂商排。低优先级的只在各家文件里列。这里只记录，不改行为；修复各走各的分支，改完代码再改数据。

| 优先级 | 厂商 | 码 | 现在 | 应该 |
|---|---|---|---|---|
| 中 | [PaddleOCR](./ocr/paddle.md) | `10001`、`10002`、`10003`、`10004`、`10005` | Rust 归 InvalidRequest，任务失败文字是「Paddle HTTP 请求失败」，落 unknown（失败的 upstream.code 带业务码）；Python 读出 code/msg，抛 PaddleRequestRejected，报错带业务码和服务商原话，归「上游服务拒绝请求（400）」。 | Rust 路径任务失败仍落 unknown，应归 upstream_bad_request 并带服务商原话；10003–10005 是「换文件」，两条路径的建议都还是「检查配置」。 |
| 中 | [PaddleOCR](./ocr/paddle.md) | `10010` | Rust 认成 QueueFull 但提交不重试，任务直接失败；Python 归「上游服务拒绝请求（400）」且标不可重试。 | 服务端明确拒收、没有重复计费风险，可以在提交处退避重试几次；最终文案「Paddle 排队已满，稍后再试」，标可重试。 |
| 中 | [PaddleOCR](./ocr/paddle.md) | `11003` | Rust 归 ProviderFailed「Paddle 任务执行失败」，原因只放进 OCR 诊断，任务失败落 unknown；Python 现在 code 和 errorCode 两种字段都认，抛 PaddleRequestRejected（报错带业务码和服务商原话），分片上传时对失败的片重交，仍失败就是「暂未识别出明确根因」。 | 给一个「OCR 服务商解析失败」的失败码，summary 直接带 errorMsg（两条路径现在都落「暂未识别出明确根因」）。 |
| 中 | [MinerU](./ocr/mineru.md) | `-500`、`-10002`、`-60002`、`-60003`、`-60004`、`-60005`、`-60006`、`-60011`、`-60012`、`-60014`、`-60015` | 有分类和中文建议（在 OCR 诊断里），但任务层只认鉴权、额度两类，其余任务失败落 unknown「暂未识别出明确根因」（失败的 upstream.code 带业务码）。 | 加「OCR 分类 → failure_code」的表：文件类归「换文件」，参数类归 upstream_bad_request，summary 带服务商原话。 |
| 中 | [GLM-OCR（智谱 layout_parsing）](./ocr/glm_ocr.md) | `1220`、`1000`、`1001`、`1003`、`1005` | 不重试，抛 GlmOcrRequestRejected（「GLM-OCR 请求被拒绝 status=401 code=…」）；分类器认不出（文字里没有 401 Client Error，也没有 unauthorized），落「任务失败，但暂未识别出明确根因」，provider_code 是业务码。 | 应归 auth_failed：GlmOcrRequestRejected 带上 status_code，分类器就能按 401/403 认。 |
| 中 | [GLM-OCR（智谱 layout_parsing）](./ocr/glm_ocr.md) | `1301` | 不重试，抛 GlmOcrRequestRejected，落「任务失败，但暂未识别出明确根因」。 | 400 应归 upstream_bad_request，文案带业务码，并说明是内容审核。 |
| 中 | [OpenAI](./llm/openai.md) | `model_not_found` | 不重试；只算这个请求失败，不会像 401/402/403 那样整份停下；冒到任务层是「任务失败，但暂未识别出明确根因」。 | 模型名写错或没开通时每个块各自失败，最后说不清原因。应和 401/403 一样第一次就整份停下，给「模型不存在」类失败，换模型后从翻译续跑。检测接口已经能认出（model_unavailable）。 |
| 中 | [Anthropic](./llm/anthropic.md) | `not_found_error` | 不重试；只算这个请求失败，不会像 401/402/403 那样整份停下；冒到任务层是「任务失败，但暂未识别出明确根因」。 | 模型名写错或没开通时每个块各自失败，最后说不清原因。应和 401/403 一样第一次就整份停下，给「模型不存在」类失败，换模型后从翻译续跑。 |
| 中 | [智谱（BigModel / Z.ai）](./llm/zhipu.md) | `1211` | 400 不重试，这个请求失败，其余块继续；整份失败时归「上游服务拒绝请求（400）」。 | 模型名写错时每个块各自 400，应第一次就整份停下，提示改模型名后从翻译续跑。 |
| 中 | [阿里云百炼（千问 / DashScope）](./llm/qwen.md) | `invalid_parameter_error` | 400 不重试，这个请求失败，其余块继续；整份失败时归「上游服务拒绝请求（400）」。 | 模型没在模型市场开通是配置问题，应第一次就整份停下，提示去开通。 |
| 中 | [阿里云百炼（千问 / DashScope）](./llm/qwen.md) | `ModelNotFound` / `model_not_found`、`model_not_supported` | 不重试；只算这个请求失败，不会像 401/402/403 那样整份停下；冒到任务层是「任务失败，但暂未识别出明确根因」。 | 模型名写错或没开通时每个块各自失败，最后说不清原因。应和 401/403 一样第一次就整份停下，给「模型不存在」类失败，换模型后从翻译续跑。 |
| 中 | [阿里云百炼（千问 / DashScope）](./llm/qwen.md) | `WorkSpaceNotFound`、`NotFound` | 不重试；只算这个请求失败，不会像 401/402/403 那样整份停下；冒到任务层是「任务失败，但暂未识别出明确根因」。 | 模型名写错或没开通时每个块各自失败，最后说不清原因。应和 401/403 一样第一次就整份停下，给「模型不存在」类失败，换模型后从翻译续跑。Base URL 里的业务空间不对也是同一类配置错误。 |

## 我们自己的失败码

见 [RetainPDF 失败码](./retainpdf/失败码.md)：每个 `failure_code` 的产生方、用户看到的 `summary`、可不可重试、从哪个阶段续跑，以及哪些上游大类落到它。

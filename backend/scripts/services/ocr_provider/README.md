# OCR Provider API 说明

这一层专门描述“外部 OCR 服务怎么接进来”，不和当前翻译、渲染工作流耦合。

目标很明确：

- 把第三方 OCR API 当成可替换 provider，而不是主流程的一部分
- 让 MinerU、后续其他 OCR API、甚至本地 OCR，都走同一套接入思路
- 把“调用 provider API”和“消费统一 schema”彻底分开

## 设计边界

这一层负责：

- 定义 OCR provider 的能力边界
- 定义 provider API 接入的最小抽象
- 约定 provider 原始产物如何落盘
- 约定 raw payload 如何进入 `document_schema` 适配链

这一层不负责：

- 不负责翻译
- 不负责 PDF 渲染
- 不负责 Typst
- 不负责正文块策略
- 不负责任何 provider 特定 JSON 的业务消费

## 核心原则

1. 工作流只认统一 schema，不认 provider 原始 JSON
   - 主链路 OCR 输入始终是 `document.v1.json`
   - provider 原始 JSON 只能停留在 provider 层、adapter 层、调试层

2. provider API 是“采集层”，不是“业务层”
   - 它的职责是把文件送出去、拿回结果、落盘
   - 它不应该决定翻译模式、渲染模式、字体、公式保护、块策略

3. raw -> normalized 必须显式经过 adapter
   - 任何 provider 返回结果，先进入 `services/document_schema/adapters.py`
   - 不能直接让 `translation/ocr`、`rendering/` 去理解 provider JSON

4. provider 能力是可变的，统一 schema 才是稳定契约
   - provider 可能变接口、变字段、变返回格式
   - 主链路不要跟着这些变化一起抖

## 推荐抽象

如果后续要把 OCR API 层真正独立出来，建议最少拆成下面几类接口。

### 1. Provider 能力声明

每个 provider 先声明自己的能力边界，例如：

- 是否需要 token
- 是否支持 URL 解析
- 是否支持本地文件上传
- 是否支持批量
- 是否支持回调
- 是否支持表格/公式开关
- 文件大小上限
- 页数上限
- 支持的输入类型
- 默认输出类型

这部分是 provider metadata，不应散落在工作流判断里。

### 2. Provider 任务接口

统一成下面几类动作：

- `submit_url_task(...)`
- `submit_file_task(...)`
- `poll_task(...)`
- `download_result(...)`
- `unpack_result(...)`

注意这里仍然只是 provider API 语义，不是主流程语义。

比如：

- `submit_*` 返回 provider task id / batch id
- `poll_task` 返回 provider 当前状态
- `download_result` 返回 zip / markdown / json / html 等原始产物

### 3. Provider 原始产物约定

provider 层只负责把原始结果整理成稳定落盘结构，例如：

- `ocr/provider/<provider-name>/...`
- `ocr/unpacked/...`
- `ocr/provider_summary.json`

不要在 provider 层直接假设：

- 一定有 `layout.json`
- 一定有 `full.md`
- 一定是 zip
- 一定有表格和公式

这些都应当是 provider-specific artifact，而不是主流程前提。

### 4. Raw -> Schema 适配入口

provider 层产物一旦落盘，下一步只做一件事：

- 调 `document_schema` adapter，产出：
  - `document.v1.json`
  - `document.v1.report.json`

到这里 provider 的职责就结束。

## MinerU 作为一个 provider 的结论

基于当前 MinerU API 文档，可以明确几点：

1. MinerU 有两类 API
   - 精准解析 API：token、异步、支持表格/公式、多格式输出、可批量
   - Agent 轻量 API：免登录、异步、限制更紧、只给 Markdown

2. 这两类 API 都不应该直接耦合主流程
   - 它们只是不同的 provider transport / result shape
   - 不是主链路的 OCR 契约

3. MinerU 真正适合进入主链路的只有两类东西
   - 原始产物文件
   - 通过 adapter 产出的 `document.v1`

4. 不应该耦合进工作流的内容
   - MinerU 的 task state 字面值
   - MinerU 的 `layout.json` / `content_list_v2.json` 字段细节
   - MinerU 的 zip 内部文件命名
   - MinerU 的特定上传方式、batch 语义、callback 细节
   - MinerU 的模型版本名直接参与翻译/渲染决策

## 当前项目里的落位建议

当前代码里可以按下面理解：

- `services/mineru/`
  这是 MinerU provider 的具体实现，不是“OCR 总入口”
- `services/document_schema/`
  这是 OCR 统一契约层
- `runtime/pipeline/`
  这是业务编排层

后续如果接别的 OCR API，建议演进成下面的关系：

- `services/ocr_provider/`
  只放 provider 接入规范与共享抽象
- `services/mineru/`
  作为 `ocr_provider` 的一个具体实现
- `services/<other_ocr>/`
  其他 provider 的具体实现
- `services/document_schema/`
  继续作为统一 normalized contract

也就是说：

- provider 可替换
- adapter 可扩展
- workflow 不需要理解 provider 差异

## 推荐接入步骤

新增 OCR provider 时，建议顺序如下：

1. 先写 provider 能力说明
2. 再写 provider API 调用层
3. 把 provider 原始产物稳定落盘
4. 写 `document_schema` adapter
5. 补 fixture 和回归
6. 最后才允许进入 translation/rendering 主线

如果第 4 步之前就让 provider 原始 JSON 进入主流程，后面一定继续耦合。

## 对 MinerU 文档的工程化结论

从当前 MinerU API 文档看，最值得吸收的是这些抽象信息：

- 它是异步任务模型
- 它区分 URL 提交和文件上传
- 它区分批量和单文件
- 它有 provider 自己的状态机
- 它的原始产物不止一种
- 它的能力上限和限制项非常明确

这些应该进入 provider 层设计。

而下面这些不该进入主流程：

- 某个具体 HTTP 路径
- 某个具体 JSON 字段名
- 某个具体 zip 内文件名
- 某个具体 provider 独有的模型名字

## 当前建议

短期内不要把 `services/mineru/` 继续扩成“默认 OCR 平台层”。

更稳的做法是：

- 把它明确降级为“MinerU provider 实现”
- 新增这一份 `ocr_provider/README.md` 作为总约定
- 后续有新 OCR API 时，先对齐这份约定，再决定目录和 adapter

这样后续切 OCR provider，不需要再拆翻译/渲染主线。

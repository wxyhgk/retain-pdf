# Scripts 总览

`scripts/` 是整套“PDF -> OCR -> 翻译 -> 保留排版渲染”的脚本工程目录。

现在顶层按职责分成五层：

- `runtime/`
  运行时编排层，只放 pipeline。
- `services/`
  OCR、MinerU、翻译、渲染等具体实现层。
- `foundation/`
  配置、共享工具和提示词资源。
- `entrypoints/`
  人工执行入口。
- `devtools/`
  实验、迁移、示例、测试探针、诊断脚本。

## 主链路

核心流程可以概括成：

`PDF -> services/mineru -> services/translation -> services/rendering -> PDF`

更具体一点：

1. 如果只有 PDF，先由 `services/mineru` 获取并解包 OCR 结果，并生成统一中间层 `document.v1.json`
2. `services/translation/ocr` 读取 OCR 结果并抽取页面块
3. `services/translation/orchestration` 补齐布局区、continuation、translation_unit 元数据
4. `services/translation` 生成每页翻译 JSON
5. `services/rendering` 读取翻译 JSON 并生成最终 PDF
6. `runtime/pipeline` 负责把这些阶段编排成稳定总线

## 推荐入口

日常使用优先走这些入口：

- `scripts/entrypoints/run_case.py`
  已经有 OCR JSON 和 PDF 时，直接跑完整流程。
- `scripts/entrypoints/run_mineru_case.py`
  只有 PDF 时，先跑 MinerU，再翻译，再渲染。
- `scripts/entrypoints/translate_book.py`
  只翻译，不渲染。
- `scripts/entrypoints/build_book.py`
  只渲染，不重新翻译。
- `scripts/entrypoints/run_book.py`
  显式给出 JSON 和 PDF 的完整编排入口。
- `scripts/entrypoints/build_page.py`
  单页渲染调试入口。
- `scripts/entrypoints/translate_page.py`
  单页翻译调试入口。
- `scripts/entrypoints/check_math_cases.py`
  公式归一化回归检查。

## 顶层目录说明

- `services/mineru`
  MinerU 接入、下载、解包、job 组织。
- `services/translation`
  OCR payload 到翻译 JSON。
- `services/rendering`
  翻译 JSON 到 PDF。
- `runtime/pipeline`
  翻译和渲染的总编排层。
- `services/README.md`
  具体能力实现层总说明。
- `foundation/config`
  路径、字体、版式和运行时默认配置。
- `foundation/shared`
  输入解析、job 目录、环境变量、提示词加载等共享能力。
- `foundation/prompts`
  可编辑提示词模板。
- `devtools/experiments`
  实验性流程，不属于稳定主链路。
- `devtools/tests`
  测试探针和排版实验。
- `devtools/tools`
  示例脚本、迁移工具和诊断脚本。

## 结构化输出

任务输出统一落到：

- `output/<job-id>/source`
- `output/<job-id>/ocr`
- `output/<job-id>/translated`
- `output/<job-id>/typst`

其中：

- `ocr/unpacked/layout.json` 保留原始 MinerU OCR 输出
- `ocr/normalized/document.v1.json` 是当前翻译/渲染主链路使用的统一 OCR 输入
- `translated/translations` 是中间翻译结果
- `translated/*.pdf` 是最终输出 PDF
- `typst/` 保留 Typst 中间产物，便于查错和回溯

当前约定：

- 主链路优先消费 `document.v1.json`
- 如果入口给的是 raw `layout.json`，会先做一次显式规范化，再进入翻译主线
- raw MinerU 结构保留给 adapter、调试和回溯，不再作为主链路的隐式数据契约

兼容说明：

- 旧任务目录如果还是 `originPDF/jsonPDF/transPDF`，当前后端和下载接口仍然兼容

## 子目录文档

- [foundation/config/README.md](./foundation/config/README.md)
- [foundation/shared/README.md](./foundation/shared/README.md)
- [runtime/pipeline/README.md](./runtime/pipeline/README.md)
- [services/README.md](./services/README.md)
- [services/translation/README.md](./services/translation/README.md)
- [services/translation/orchestration/README.md](./services/translation/orchestration/README.md)
- [services/translation/continuation/README.md](./services/translation/continuation/README.md)
- [services/translation/policy/README.md](./services/translation/policy/README.md)
- [services/rendering/README.md](./services/rendering/README.md)
- [services/mineru/README.md](./services/mineru/README.md)

## 设计边界

- `services/translation` 不直接操作 PDF
- `services/rendering` 不直接决定翻译策略
- `runtime/pipeline` 负责编排，不下沉到实现细节
- `foundation/` 不承载具体业务流程
- `entrypoints/` 只做入口，不承载核心实现
- `devtools/` 不能反向成为主链路依赖

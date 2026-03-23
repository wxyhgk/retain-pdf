# Scripts 中文总览

`scripts/` 是整套“PDF OCR -> 翻译 -> 保留排版渲染”的工程入口目录。

这里的代码不是按命令行脚本和平铺工具随意堆放，而是按职责拆成几层：

- `config`
  配置层。把路径、字体、布局参数、运行时默认值拆开管理。
- `common`
  放通用辅助能力，比如环境变量读取、结构化输出目录创建、提示词加载。
- `mineru`
  负责 MinerU API 接入、结果解包和 job 目录组织。
- `translation`
  负责把 OCR payload 变成翻译 JSON。`ocr`、`orchestration`、`classification` 这些与翻译强绑定的子模块也已经收进这一层。
- `rendering`
  负责把翻译 JSON 重新组织并写回 PDF。
- `pipeline`
  负责把翻译阶段和渲染阶段串起来，是对外稳定的总入口层。

## 总流程

主路径可以概括成：

`PDF -> MinerU/layout.json -> translation JSON -> render payload -> PDF`

更完整一点的顺序是：

1. 输入原始 PDF。
2. 如果只有 PDF，没有 OCR JSON，就先走 `mineru` 拿到 `layout.json`。
3. `translation/ocr` 读取 `layout.json`，提取页面块。
4. `translation/orchestration` 给块补充布局区、continuation、translation_unit_id 等元数据。
5. `translation` 按模式和策略生成每页翻译 JSON。
6. `rendering` 读取翻译 JSON，按 `typst/direct/dual` 等模式生成最终 PDF。
7. `pipeline` 负责把这些阶段按正确顺序组织起来，并返回整条流程的汇总结果。

## 推荐入口

日常使用优先从这些入口开始：

- `run_case.py`
  本地已经有 `json + pdf` 时，直接跑完整流程。
- `run_mineru_case.py`
  只有 PDF 时，先走 MinerU，再翻译，再渲染。
- `translate_book.py`
  只翻译，不渲染。
- `build_book.py`
  只渲染，不重新翻译。
- `run_book.py`
  显式给出 JSON 和 PDF 的完整编排入口。

## 目录输出

结构化任务输出统一落到：

- `output/<job-id>/originPDF`
- `output/<job-id>/jsonPDF`
- `output/<job-id>/transPDF`

其中：

- `jsonPDF/unpacked/layout.json` 是翻译阶段默认使用的 OCR 输入
- `transPDF/translations` 是中间翻译结果
- `transPDF/*.pdf` 是最终输出 PDF

## 目录索引

核心模块的中文说明放在这些子 README 中：

- [config/README_CN.md](./config/README_CN.md)
- [common/README_CN.md](./common/README_CN.md)
- [translation/orchestration/README_CN.md](./translation/orchestration/README_CN.md)
- [pipeline/README_CN.md](./pipeline/README_CN.md)
- [translation/README_CN.md](./translation/README_CN.md)
- [rendering/README_CN.md](./rendering/README_CN.md)
- [mineru/README_CN.md](./mineru/README_CN.md)

其余目录的定位如下：

- `prompts`
  放可编辑提示词模板，供翻译、分类、continuation review、领域推断复用。
- `experiments`
  放实验性路径，不是当前稳定主链路。

`translation` 内部现在又分成三块：

- `translation/ocr`
  负责 OCR JSON 抽取。
- `translation/orchestration`
  负责布局区、continuation 和 translation unit 元数据。
- `translation/classification`
  只在 `precise` 模式下参与，对可疑 OCR 块做额外分类。

## 当前主链路建议

当前稳定主链路建议理解为两段：

- 翻译段：
  `layout.json -> translation/ocr -> translation/orchestration -> translation -> per-page translation JSON`
- 渲染段：
  `translation JSON -> render_payloads -> typst/direct renderer -> final PDF`

如果你要改工程结构，优先守住两条边界：

- `translation` 不直接操作 PDF
- `rendering` 不直接决定翻译策略

这样 `pipeline` 才能保持稳定，CLI 和 FastAPI 层也不用跟着频繁改。

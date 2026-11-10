# Config 分层说明

`retainpdf_pipeline/foundation/config` 用来集中管理配置，避免共享层继续承载所有职责。

## 拆分结果

- 路径（`ROOT_DIR`、`DATA_DIR`、`OUTPUT_DIR`、各缓存目录）和任务目录子目录名已经下放到底座包：
  `retainpdf_base.paths`、`retainpdf_base.output_layout`（`backend/base`），流水线和翻译共用。
- `fonts.py`
  只放字体与字号相关配置，例如默认字体路径、默认字号、Typst 默认字体族。
- `runtime.py`
  只放运行时默认项，例如默认页码、默认输出名、PDF 压缩 DPI。
- `layout.py`
  只放版式调参相关配置，以及 `apply_layout_tuning(...)`。
- `external_tools.py`
  定位不随 Python 包安装的外部程序（目前只有 typst）。

## 怎么 import

直接从拆分后的模块取：

```python
from retainpdf_pipeline.foundation.config.fonts import DEFAULT_FONT_PATH
from retainpdf_pipeline.foundation.config.layout import apply_layout_tuning
```

路径从底座包取（`retainpdf_base.paths`、`retainpdf_base.output_layout`）。
`foundation/shared/config.py` 是以前的兼容转发，现在没有代码 import 它，不要再用。

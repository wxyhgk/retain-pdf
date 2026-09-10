# local_command 插件

`local_command` 是 RetainPDF 接入本地 OCR 模型的最小稳定契约。

它不是要求你必须启动一个 HTTP 服务，而是要求你提供一个可执行命令。RetainPDF 在 OCR 阶段启动这个命令，把输入 PDF 路径、任务目录和输出文件路径通过环境变量传给它。你的命令只需要完成一件事：把 OCR 结果写到约定位置。

典型形态：

```text
RetainPDF job
  -> 启动 local_command
  -> 本地 OCR 模型 / 本地 HTTP OCR wrapper / 自定义脚本
  -> 写 raw payload 或 document.v1
  -> RetainPDF 校验 document.v1
  -> 翻译 / 渲染继续执行
```

主流程只读取最终的 `ocr/normalized/document.v1.json`，不会直接读取你的 provider 私有 JSON。

## 什么时候用

适合这些情况：

- 你有本地 OCR 模型，例如 PaddleOCR、Marker、MinerU 本地部署、自己训练的版面模型。
- 你有本地 HTTP OCR 服务，但想先用一个 wrapper 脚本接入 RetainPDF。
- 你想快速验证一个 OCR provider，而不想改 Rust API、翻译、渲染主流程。

不适合这些情况：

- provider 必须由 RetainPDF 内部负责复杂 submit / poll / download 状态机。那更适合先用 `remote_command`，稳定后再做内置 provider。
- 你希望下游直接消费 provider 私有字段。RetainPDF 不支持这样接入，必须先转成 `document.v1`。

## Provider 配置

配置文件（Phase3-2 起主真值）：

```text
backend/config/ocr_providers.json
# 历史开发环境曾使用 backend/config symlink；当前仓库不提供该路径
```

最小配置：

```json
{
  "providers": {
    "my_local_ocr": {
      "display_name": "My Local OCR",
      "kind": "local_command",
      "credential": null,
      "options": {
        "command": {
          "type": "string",
          "default": "python /opt/retainpdf-ocr/my_ocr.py"
        },
        "raw_provider": {
          "type": "string",
          "default": "generic_flat_ocr"
        }
      }
    }
  }
}
```

提交任务时选择 provider key：

```json
{
  "ocr": {
    "provider": "my_local_ocr"
  }
}
```

`command` 和 `raw_provider` 的读取顺序：

1. 任务请求或 stage spec 里的 provider options。
2. `ocr_providers.json` 里的默认值。
3. 环境变量 `RETAIN_LOCAL_OCR_COMMAND` / `RETAIN_OCR_RAW_PROVIDER`。

## 命令调用契约

RetainPDF 会在 job 根目录下执行你的命令：

```text
cwd = RETAIN_OCR_JOB_ROOT
```

命令通过 shell 执行，所以配置可以是：

```text
python /opt/retainpdf-ocr/my_ocr.py
```

也可以是：

```text
/opt/retainpdf-ocr/bin/run_ocr --model local-v1
```

退出码语义：

- `0` 表示 OCR 命令成功，RetainPDF 继续检查输出文件。
- 非 `0` 表示 OCR 阶段失败，stderr/stdout 会进入任务日志。

stdout/stderr 语义：

- 可以输出人类可读日志。
- 不要把 OCR 主结果只写到 stdout。
- OCR 主结果必须写到环境变量指定的文件路径。

## 输入环境变量

命令执行时会收到这些稳定环境变量：

```text
RETAIN_OCR_PROVIDER
RETAIN_OCR_PROVIDER_KIND
RETAIN_OCR_CREDENTIAL
RETAIN_OCR_SOURCE_PDF
RETAIN_OCR_SOURCE_URL
RETAIN_OCR_JOB_ROOT
RETAIN_OCR_SOURCE_DIR
RETAIN_OCR_DIR
RETAIN_OCR_PROVIDER_RESULT_JSON
RETAIN_OCR_NORMALIZED_DOCUMENT_JSON
RETAIN_OCR_NORMALIZATION_REPORT_JSON
RETAIN_OCR_PROVIDER_RAW_DIR
RETAIN_OCR_RAW_PAYLOAD_JSON
RETAIN_OCR_RAW_PROVIDER
```

常用字段说明：

| 变量 | 说明 |
| --- | --- |
| `RETAIN_OCR_SOURCE_PDF` | 输入 PDF 本地路径。普通本地上传任务一定有值。 |
| `RETAIN_OCR_SOURCE_URL` | URL 输入时的原始 URL。`local_command` 通常不用。 |
| `RETAIN_OCR_JOB_ROOT` | 当前 job 根目录。 |
| `RETAIN_OCR_SOURCE_DIR` | 源文件目录。URL 模式下插件必须把最终 PDF 落到这里。 |
| `RETAIN_OCR_DIR` | OCR 阶段目录。 |
| `RETAIN_OCR_NORMALIZED_DOCUMENT_JSON` | 直接输出 `document.v1.json` 的目标路径。 |
| `RETAIN_OCR_RAW_PAYLOAD_JSON` | 输出 raw payload 的目标路径。 |
| `RETAIN_OCR_RAW_PROVIDER` | raw payload 对应的 adapter 名，例如 `generic_flat_ocr`。 |
| `RETAIN_OCR_PROVIDER_RESULT_JSON` | 可选 provider 结果摘要。 |
| `RETAIN_OCR_NORMALIZATION_REPORT_JSON` | 可选归一化报告。 |
| `RETAIN_OCR_CREDENTIAL` | 后端解析后的凭据。无凭据时为空。 |

## 输出方式 A：直接写 document.v1

如果你愿意直接生成 RetainPDF 的统一文档结构，就写：

```text
$RETAIN_OCR_NORMALIZED_DOCUMENT_JSON
```

文件内容必须是 `document.v1.json`。详细字段以
[Document Schema 说明](../../../backend/pipeline/retainpdf_pipeline/ocr/document_schema/README.md)
为准。

这种方式最稳定，但接入成本最高。适合要深度接入的 OCR provider。

命令成功后 RetainPDF 会：

1. 校验 `document.v1.json`。
2. 如果没有 `document.v1.report.json`，自动补一个最小报告。
3. 如果没有 `result.json`，自动补一个 provider 摘要。
4. 让翻译/渲染继续只读取 `document.v1.json`。

## 输出方式 B：写 raw payload

更推荐先走 raw payload 模式。你的命令写：

```text
$RETAIN_OCR_RAW_PAYLOAD_JSON
```

然后 RetainPDF 用 `RETAIN_OCR_RAW_PROVIDER` 对应 adapter 转成 `document.v1.json`。

当前内置最小 adapter 是：

```text
generic_flat_ocr
```

它适合“页 -> 块 -> bbox + text”的通用 OCR 输出。

### generic_flat_ocr schema

最小结构：

```json
{
  "provider": "generic_flat_ocr",
  "pages": [
    {
      "page": 1,
      "width": 612,
      "height": 792,
      "unit": "pt",
      "blocks": [
        {
          "type": "text",
          "sub_type": "body",
          "bbox": [72, 72, 420, 120],
          "text": "OCR raw text",
          "lines": [],
          "segments": []
        }
      ]
    }
  ]
}
```

字段说明：

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `provider` | 是 | 固定为 `generic_flat_ocr`。 |
| `pages` | 是 | 页面数组。 |
| `pages[].width` / `height` | 是 | 页面尺寸。推荐使用 PDF point。 |
| `pages[].unit` | 否 | 默认 `pt`。 |
| `blocks[].type` | 否 | 默认 `text`。非文本块不会进入翻译。 |
| `blocks[].sub_type` | 否 | 默认 `body`。常用 `title`、`heading`、`abstract`、`body`、`footnote`、`reference_entry`。 |
| `blocks[].bbox` | 是 | `[x0, y0, x1, y1]`，坐标必须和页面尺寸同一坐标系。 |
| `blocks[].text` | 是 | OCR 文本。 |
| `blocks[].lines` | 否 | 行级结构。能提供就提供，目录、列表、表格说明会更稳。 |
| `blocks[].segments` | 否 | 行内片段。能提供公式、样式或 token 信息时再填。 |

`sub_type` 会影响默认策略：

- `body`、`abstract`、`heading` 会进入翻译。
- `footnote`、`reference_entry`、`header`、`footer`、`page_number` 默认不作为正文翻译。
- 如果你的 provider 能识别目录、列表、标题，应该在 adapter 或 raw payload 中明确表达，不要让渲染层再猜。

## 最小 my_ocr.py 示例

下面示例不代表真实 OCR，只展示插件该如何读写路径：

```python
import json
import os
from pathlib import Path


def main() -> None:
    source_pdf = Path(os.environ["RETAIN_OCR_SOURCE_PDF"])
    target = Path(os.environ["RETAIN_OCR_RAW_PAYLOAD_JSON"])
    target.parent.mkdir(parents=True, exist_ok=True)

    # TODO: 在这里调用你的本地 OCR 模型。
    payload = {
        "provider": "generic_flat_ocr",
        "pages": [
            {
                "page": 1,
                "width": 612,
                "height": 792,
                "unit": "pt",
                "blocks": [
                    {
                        "type": "text",
                        "sub_type": "body",
                        "bbox": [72, 72, 420, 120],
                        "text": f"OCR result from {source_pdf.name}",
                        "lines": [],
                        "segments": [],
                    }
                ],
            }
        ],
    }
    target.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
```

运行时配置：

```bash
export RETAIN_LOCAL_OCR_COMMAND="python /opt/retainpdf-ocr/my_ocr.py"
export RETAIN_OCR_RAW_PROVIDER=generic_flat_ocr
```

## 已有本地 HTTP OCR 服务怎么办

仍然建议用 `local_command` 包一层 wrapper。RetainPDF 不直接规定你的本地 HTTP API 长什么样，只规定 wrapper 的输入输出。

示例：

```python
import json
import os
from pathlib import Path

import requests


def main() -> None:
    source_pdf = Path(os.environ["RETAIN_OCR_SOURCE_PDF"])
    target = Path(os.environ["RETAIN_OCR_RAW_PAYLOAD_JSON"])
    target.parent.mkdir(parents=True, exist_ok=True)

    with source_pdf.open("rb") as file:
        response = requests.post(
            "http://127.0.0.1:8000/ocr",
            files={"file": (source_pdf.name, file, "application/pdf")},
            timeout=600,
        )
    response.raise_for_status()

    # 本地 HTTP 服务最好直接返回 generic_flat_ocr；如果不是，就在这里转换。
    payload = response.json()
    target.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")


if __name__ == "__main__":
    main()
```

这样第三方只需要维护自己的 OCR 服务和 wrapper，不需要让 RetainPDF 理解每个服务的私有 HTTP API。

## URL 输入注意事项

普通本地上传任务会给出 `RETAIN_OCR_SOURCE_PDF`。

如果任务来自 URL，可能只有：

```text
RETAIN_OCR_SOURCE_URL
```

这时插件必须把最终源 PDF 下载或物化到：

```text
$RETAIN_OCR_SOURCE_DIR/*.pdf
```

否则后续翻译和渲染没有本地源 PDF，任务会失败。

## 失败处理

插件应该遵守：

- 参数不合法、OCR 服务不可用、输出无法生成：退出非 `0`。
- 可诊断信息写 stderr 或 stdout。
- 不要生成半截 JSON 后仍退出 `0`。
- 如果退出 `0`，必须至少写出 `RETAIN_OCR_NORMALIZED_DOCUMENT_JSON` 或 `RETAIN_OCR_RAW_PAYLOAD_JSON` 之一。

RetainPDF 后续还会检查：

- 输出文件是否存在。
- raw payload 是否能被 adapter 识别。
- `document.v1.json` 是否通过 schema 校验。

## 调试检查清单

接入本地 OCR 时先检查这些点：

- provider config 里的 `kind` 是 `local_command`。
- `command` 在后端运行用户下可以执行。
- 输入 PDF 从 `RETAIN_OCR_SOURCE_PDF` 读取，不要写死路径。
- 输出写到 `RETAIN_OCR_RAW_PAYLOAD_JSON` 或 `RETAIN_OCR_NORMALIZED_DOCUMENT_JSON`。
- raw payload 的 `provider` 和 `RETAIN_OCR_RAW_PROVIDER` 一致。
- bbox 坐标和页面 `width/height` 使用同一单位。
- 页码、块顺序、bbox 不要为空或倒置。
- 命令失败时退出非 `0`，不要静默吞错。

## 和内置 provider 的边界

新增本地 OCR provider 不需要改：

- 翻译模块
- 渲染模块
- Rust job runner 主流程

只有当 `generic_flat_ocr` 表达不了你的 provider 输出时，才需要新增：

```text
backend/pipeline/retainpdf_pipeline/ocr/document_schema/provider_adapters/<your_provider>/
```

新增 adapter 后，把 `raw_provider` 指向你的 adapter 名称即可。主流程仍然只消费 `document.v1.json`。

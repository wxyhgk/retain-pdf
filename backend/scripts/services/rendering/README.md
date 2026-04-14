# Rendering 说明

`scripts/services/rendering` 负责把已经翻译好的页面数据变成最终 PDF。

这里不负责翻译，也不负责 OCR 解析，只负责“怎么渲染、怎么排版、怎么输出”。

## 阶段边界

Rendering 阶段的正式输入和输出固定为：

- 输入：
  源 PDF、翻译产物、渲染参数
- 输出：
  最终 PDF，以及必要的 overlay / typst / 压缩中间产物

明确不负责的事情：

- 不直接消费 provider raw OCR JSON
- 不负责把 raw OCR 规范化成 `document.v1.json`
- 不负责向翻译模型发请求，也不负责生成翻译文本

当前稳定交接点：

- rendering 主线只接受“源 PDF + 翻译产物”这一组输入
- 渲染阶段固定读取 `translation-manifest.json`；没有 manifest 的旧翻译目录不再支持直接渲染
- Render-only 调用协议固定为：`source_pdf_path + translations_dir` 或 `source_pdf_path + translation_manifest_path`
- Render-only 入口已支持 `job_root/specs/render.spec.json`（`render.stage.v1`）
- 如果输入不满足协议，入口统一抛出 `Render-only input error`，而不是在后续 Typst/PDF 阶段才报模糊错误
- 如果怀疑 OCR 结构有问题，应该先回到 `document.v1.json` / `document.v1.report.json` 排查
- 如果怀疑翻译内容或术语策略有问题，应该先回到 translation payload，而不是在 rendering 层补翻译逻辑
- API 凭证不写入 render stage spec；spec 中使用 `credential_ref`，由运行时环境注入真实 key

## 当前目录结构

```text
scripts/services/rendering/
  __init__.py
  README.md
  api/
  background/
  compress/
  core/
  formula/
  layout/
    payload/
    typography/
  redaction/
  typst/
```

## 渲染主路径

当前主路径可以概括为：

`translation JSON -> layout/payload -> typst -> PDF`

上层通常通过 [render_stage.py](/home/wxyhgk/tmp/Code/scripts/runtime/pipeline/render_stage.py) 调用这里的能力。

输入边界：

- rendering 主线消费的是翻译后的 page payload 和源 PDF
- 当前逐页 translation payload 与 `translation-manifest.json` 是上游默认交付物；渲染层只负责读取，不负责定义 OCR/翻译阶段协议
- 如果上游只想重跑渲染，可以显式传 `translation_manifest_path`，不必依赖固定目录扫描
- OCR provider 的 raw JSON 不应该直接流入这里
- 如果上游 OCR 结构有问题，应先回到 `document.v1.json` / `document.v1.report.json` 这一层排查，而不是在渲染层补 provider 特判

## 模块分工

- `api/`
  对内稳定入口。
- `layout/payload/`
  把翻译后的 OCR payload 转成可渲染块。
- `layout/typography/`
  排版测量和几何工具层。
- `redaction/`
  直接操作 PDF 页面对象，负责删字、盖底和写回。
- `typst/`
  负责把渲染块变成 Typst 源码并编译成 PDF。
- `formula/`
  公式归一化、公式坏例库、公式文本拼装。
- `background/`
  大背景图页面的局部背景重建。
- `compress/`
  PDF 图片型压缩。
- `core/`
  渲染层公共数据结构。

## 推荐入口

- [render_stage.py](/home/wxyhgk/tmp/Code/scripts/runtime/pipeline/render_stage.py)
- [services/rendering/api](/home/wxyhgk/tmp/Code/scripts/services/rendering/api)

## 公式回归

如果新增了一条公式归一化规则，建议同时把坏例子补到 `formula/casebook.py`，然后运行：

```bash
python scripts/entrypoints/check_math_cases.py
```

## 协作规矩

如果渲染模块单独分人维护，这里只负责“读取翻译产物并生成最终 PDF”。

- 允许在这里改 overlay、Typst、背景处理、压缩、红框擦除和版面回填
- 不要在这里补 OCR provider 特判，也不要在这里追加翻译请求或术语替换逻辑
- 正式输入边界是 `source_pdf_path + translations_dir/translation_manifest_path`
- 如果修改渲染输入协议、manifest 读取方式或最终产物命名，必须同步更新 `runtime/pipeline`、调用入口、README 和测试
- 遇到上游 OCR 或翻译问题，优先把问题退回对应模块修，不要在 rendering 层堆跨层补丁

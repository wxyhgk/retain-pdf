# Rendering 说明

`scripts/services/rendering` 负责把已经翻译好的页面数据变成最终 PDF。

这里不负责翻译，也不负责 OCR 解析，只负责“怎么渲染、怎么排版、怎么输出”。

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

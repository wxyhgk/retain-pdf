# PaddleOCR 官方说明归档

这里放的是和当前仓库集成最相关的 PaddleOCR 官方资料入口，统一从 `doc/` 进入，不再散落在源码目录里找。

## 官方来源

- PaddleOCR-VL 官方使用文档：
  <https://github.com/PaddlePaddle/PaddleOCR/blob/main/docs/version3.x/pipeline_usage/PaddleOCR-VL.md>
- PaddleOCR-VL 官方在线文档：
  <https://www.paddleocr.ai/latest/version3.x/pipeline_usage/PaddleOCR-VL.html>

## 当前仓库重点关注

对本项目最关键的不是整份部署教程，而是下面这几个官方事实：

1. `layoutParsingResults[*].markdown.text` 是官方返回的 Markdown 正文。
2. `layoutParsingResults[*].markdown.images` 是 Markdown 里引用图片的映射。
3. 多页 PDF 可以通过 `restructurePages` 做跨页重构。
4. `showFormulaNumber`、`prettifyMarkdown` 会直接影响 Markdown 输出形态。

## 本仓库整理稿

- 服务化接口与异步调用摘录：
  [async_parse_official_excerpt.md](./async_parse_official_excerpt.md)

## 使用约定

1. 这里保存官方说明的仓库内入口与整理摘录。
2. 对接实现以官方字段语义为准，不以历史兼容逻辑为准。
3. 如果官方文档更新，先改这里，再改 provider 代码和内部适配文档。

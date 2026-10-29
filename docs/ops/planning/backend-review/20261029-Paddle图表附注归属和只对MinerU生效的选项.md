# Paddle 图表附注的归属和只对 MinerU 生效的选项（2026-10-29）

OCR 归一化审查（2026-10-29）里 Paddle 的两条，用户让"先修 bug"。

## 1. vision_footnote 归到表还是图：子串匹配误判

`paddle/relations.py` 的 `resolve_vision_footnote` 以前第一步就是 `lowered.startswith("表注") or "table" in lowered`：子串匹配，排在最前。
"The stable phase…"、"Suitable conditions…"、"A notable shift…" 这些图下的注都被当成表注；图注里写「参数见 Table 2」也被算到表格名下。
归属决定这条注挂到哪张图、哪张表上（关系层、阅读器、书库合并都用）。

改成按可靠程度排：

1. 开头的标记：「表注」、`Table`、`Tab.` → 表；「图注」、`Figure`、`Fig.` → 图（整词，`Tablet` 不算）；
2. 紧挨着的前一个块是表还是图；
3. 最后才看正文里有没有整词 `table(s)` / `figure(s)` / `fig.`。

HTML 标签先去掉再判断（和 `resolve_figure_title` 一样）。

## 2. disable_formula / disable_table / language 对 Paddle 不生效——文档没写

审查说"Paddle 网络接口悄悄忽略了这几个选项"。核实下来：正式的 Rust 那条路（`ocr_flow/paddle.rs` 的 `log_paddle_unsupported_options`）对
`disable_formula`、`disable_table` 会在任务日志里写一句"不支持、忽略"，不是悄悄吞掉；Paddle VL 模型的网络接口有没有对应开关，仓库里的官方
文档没写，贸然加参数可能让请求直接报错。所以不改代码，只在 `backend/api/OCR_Service_API.md` 的"常用可选字段"下写明这几个是 MinerU 的选项、
Paddle 时不生效。`language` 默认是 `ch`、每个任务都带，没法按"写没写"判断用户是不是特意设了，所以也不加日志。

## 验证

- 新测试 `test_paddle_vision_footnote_target.py`（6 个）：含 table 子串的词跟着前一个块走、没有前一个块时是 unknown；开头标记压过前一个块；
  图注里提到 Table 留在图上；整词兜底（含 HTML 标签）。换回旧代码 5 个红。
- `document_schema` 测试 286 个全过；全套合并前检查和管线、翻译测试见合并说明。

## 没做

- 前置区规则（页上有摘要标签时，它前面的正文都当元数据不翻译）、竖排文字和印章当成 unknown、`body_repair` 在生产里不跑：审查里的中等问题，
  不是这一批的确定 bug，以后再定。

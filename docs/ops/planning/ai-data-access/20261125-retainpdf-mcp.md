# `retainpdf mcp`（第 3 步之三）

> 日期：2026-11-25
> 分支：`feat/retainpdf-mcp`
> 起因：[AI 怎么拿到书的数据](./20261124-AI怎么拿到书的数据.md) 第 3 步的最后一件。前两件：
> 「改译文按旧译文比对」（PR #200）、「AI 专用密钥」（PR #202），记录在这个目录里同日的两个文件。

## 做法

- 命令行子命令 `retainpdf mcp`（`backend/cli/src/cmd/mcp.rs`），stdio、每行一条 JSON-RPC 2.0；只实现用得着的：
  `initialize`、`ping`、`tools/list`、`tools/call`，通知不回，别的方法 `-32601`，坏 JSON `-32700`，没有的工具 `-32602`。
  没引 MCP 的 SDK：协议面就这几个方法，自己写比多一个依赖省事；命令行是同步的（`reqwest::blocking`），不为它引异步运行时。
- 两个工具（参数、行为见 [命令行文档](../../../core/cli/README.md) 的「MCP 服务」一节）：
  - `revise_translation`：`source` 写死 `agent`，`expected_old_text` 必填（方案里的「先读再写」）。后端回的拒绝按原因写成 agent 能照做的话
    （被改过就给当前译文、没过检查给问题清单）。
  - `view_page`：原文页走 `/documents/{id}/files/pages/{page}.jpg`（书的页码，锚点里的 `page=`），译文页走
    `/jobs/{job}/files/pages/{page}.jpg`（任务自己的页号，锚点块编号的 `pNNN`）。`width` 上限压到 1600（接口本身到 2400），
    默认 1000：够看公式和表格，又不至于一张图几百 KB。
- 参数里的编号拼进地址前查字符（字母、数字、`-_:.`），不合规矩的不发请求。
- 密钥：`RETAINPDF_AGENT_KEY` 优先，没有用 `backend.json` 的本机密钥（外部 Claude Code 本来就有整台电脑的权限，见方案的同日修正）。
- 后端没开照样能握手、列工具；每次调工具重新找后端。

## 测试

`mcp_tests.rs` 用假的后端：握手和版本协商、通知不回、列工具、错误码；改译文发出去的请求体（`source: agent`、带旧译文）、
成功和检查提示、被改过、没过检查；参数不对不发请求；两种页图的地址和返回的图片；后端没开。

真后端的端到端：这个分支基于 `origin/main`，那时还没合进 AI 专用密钥和旧译文比对（#200、#202），合完以后补跑一遍
（起一个临时数据目录的后端，用 AI 专用密钥走 `view_page`、`revise_translation`）。

## 没做

- `view_page` 和阅读器共用页图生成的名额，AI 连翻几十页会不会堵住阅读器：方案「没定的」里的这一条留到第 4 步面板接上、真用起来再量。
- 第 4 步桌面 AI 面板（前端会话）：ACP 客户端起 agent、`session/new` 传 `retainpdf mcp`、生成并传 AI 专用密钥、对改译文弹确认。

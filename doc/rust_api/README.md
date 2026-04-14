# Rust API 说明

这组文档是给前端联调、后端维护和问题排查用的。

如果你只想快速知道“该读哪个字段”，按下面顺序看：

1. [01-响应包装.md](/home/wxyhgk/tmp/Code/doc/rust_api/01-响应包装.md)
2. [02-任务详情与时间线.md](/home/wxyhgk/tmp/Code/doc/rust_api/02-任务详情与时间线.md)
3. [03-事件流接口.md](/home/wxyhgk/tmp/Code/doc/rust_api/03-事件流接口.md)
4. [04-任务生命周期.md](/home/wxyhgk/tmp/Code/doc/rust_api/04-任务生命周期.md)
5. [05-联调与排错.md](/home/wxyhgk/tmp/Code/doc/rust_api/05-联调与排错.md)
6. [06-产物清单与下载.md](/home/wxyhgk/tmp/Code/doc/rust_api/06-产物清单与下载.md)
7. [07-任务列表接口.md](/home/wxyhgk/tmp/Code/doc/rust_api/07-任务列表接口.md)
8. [08-Provider 校验接口.md](/home/wxyhgk/tmp/Code/doc/rust_api/08-Provider 校验接口.md)

当前几个关键结论：

- 所有成功响应都是 `code/message/data` 三层包装
- 任务详情页应以 `GET /api/v1/jobs/{job_id}` 为主接口
- “过程时间线”必须读取 `runtime.stage_history`
- “事件流”tab 读取 `GET /api/v1/jobs/{job_id}/events`
- 下载文件与产物发现应优先读取 `GET /api/v1/jobs/{job_id}/artifacts-manifest`
- 翻译参数里的 `translation.math_mode` 已可用，默认 `placeholder`，实验值为 `direct_typst`
- 新任务的 Python worker 已统一为 `--spec` 驱动，详情/列表里的 `invocation` 会显示 `input_protocol=stage_spec`
- `normalization_summary` 现在读的是 `document.v1.report.json` 的简化视图，默认值收口字段已经统一为 `document_defaults/page_defaults/block_defaults`
- 事件流接口返回的 `items` 在 `data.items`，不在顶层
- 历史老任务可能出现 `runtime = null`，这属于历史数据缺失，不是当前接口故障
- 旧任务如果仍使用 `originPDF/jsonPDF/transPDF/typstPDF` 目录布局，或数据库里仍是绝对路径 artifact 存储，详情与下载接口会直接拒绝，必须重跑

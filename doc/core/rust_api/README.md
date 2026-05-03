# Rust API 说明

这组文档是给前端联调、后端维护和问题排查用的。

如果你只想快速知道“该读哪个字段”，按下面顺序看：

1. [01-响应包装.md](./01-响应包装.md)
2. [02-任务详情与时间线.md](./02-任务详情与时间线.md)
3. [03-事件流接口.md](./03-事件流接口.md)
4. [04-任务生命周期.md](./04-任务生命周期.md)
5. [05-联调与排错.md](./05-联调与排错.md)
6. [06-产物清单与下载.md](./06-产物清单与下载.md)
7. [07-任务列表接口.md](./07-任务列表接口.md)
8. [08-Provider 校验接口.md](./08-Provider%20校验接口.md)
9. [09-协同开发约定.md](./09-协同开发约定.md)
10. [10-Rust 侧 Artifact Boundary.md](./10-Rust%20%E4%BE%A7%20Artifact%20Boundary.md)

当前几个关键结论：

- 所有成功响应都是 `code/message/data` 三层包装
- 任务详情页应以 `GET /api/v1/jobs/{job_id}` 为主接口
- “过程时间线”必须读取 `runtime.stage_history`
- “事件流”tab 读取 `GET /api/v1/jobs/{job_id}/events`
- 下载文件与产物发现应优先读取 `GET /api/v1/jobs/{job_id}/artifacts-manifest`
- Rust 侧 artifact 边界分四层：`provider raw -> normalized -> published artifact -> download API`
- 翻译参数里的 `translation.math_mode` 已可用，默认 `direct_typst`
- 新任务的 Python worker 已统一为 `--spec` 驱动，详情/列表里的 `invocation` 会显示 `input_protocol=stage_spec`
- `normalization_summary` 现在读的是 `document.v1.report.json` 的简化视图，默认值收口字段已经统一为 `document_defaults/page_defaults/block_defaults`
- 事件流接口返回的 `items` 在 `data.items`，不在顶层
- 历史老任务可能出现 `runtime = null`，这属于历史数据缺失，不是当前接口故障
- 旧任务如果仍使用 `originPDF/jsonPDF/transPDF/typstPDF` 目录布局，或数据库里仍是绝对路径 artifact 存储，详情与下载接口会直接拒绝，必须重跑

当前代码边界也有两个约定：

- `routes/*` 只做 HTTP adapter，不负责聚合 view、不直接拼装 job command
- jobs 相关依赖装配已上移到 [`backend/rust_api/src/app/jobs.rs`](../../backend/rust_api/src/app/jobs.rs)，route 不再直接知道 `job_runner` 如何启动
- `services/jobs/creation`、`services/job_snapshot_factory` 与 `services/job_launcher` 现在已拆成“纯装配”和“启动执行”两层；纯装配逻辑默认只依赖 `Db`、`AppConfig` 和显式参数，不应继续透传整个 `AppState`
- 多人协作时，新增代码默认遵守 [09-协同开发约定.md](./09-协同开发约定.md) 的落点与依赖规则

`AppState` 目前允许存在的主要位置：

- 路由入口
- job lifecycle / process runner 这类真正需要运行态资源协同的执行层

不建议再把 `AppState` 向下传到：

- 命令构建
- job snapshot 装配
- 只读 view 聚合
- 上传校验与纯输入装配

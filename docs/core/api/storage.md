# 存储结构

运行时根目录由 `RUST_API_DATA_ROOT` 决定；下文用 `DATA_ROOT` 代指这个解析后的目录。

## 主要路径

- `DATA_ROOT/uploads/`：上传文件，每个上传一个 `uploads/<upload_id>/` 目录。
  `uploads/.incoming/` 放正在收的上传（2026-10-24 起请求体边收边写到这里的 `<随机>.part`，收完校验过了换名进
  `uploads/<upload_id>/`）；请求断开、超限、校验没过的当场删，进程被杀留下的下次起服务时删掉一小时以前的。
  同一个 PDF 又传了一次（同一所有者范围里原样字节的 sha256 相同、已有那份文件还在），2026-10-28 起新的上传目录里放的是
  指向已有那份的**硬链接**：两条上传记录各有各的目录，删哪个都不影响另一个，盘上只占一份；建不了硬链接（跨盘、文件系统不支持）
  就照旧另存一份。上传目录里的文件只会整份换名替换（修复坏 PDF 就是这样），不会原地改写。
- `DATA_ROOT/jobs/{job_id}/`：任务工作目录。
- `DATA_ROOT/downloads/`：下载缓存（打包下载的 zip，每次请求都重新生成；一小时以前的由定期清理删掉）。
- `DATA_ROOT/db/jobs.db`：SQLite 数据库。
- `DATA_ROOT/db/jobs.db.runtime-owner.lock`：任务运行时的独占锁文件（进程内模式的 rust_api 或 retain-jobsd 启动时加锁，进程退出自动释放；文件本身留着无害，不要提交）。

## 任务目录

标准任务目录：

```text
jobs/{job_id}/
├── source/
├── ocr/
├── translated/
├── rendered/
├── artifacts/
└── logs/
```

常见产物：

- `ocr/`：Provider 原始结果、解包结果、标准化输入。任务成功以后（下一轮定期清理，启动时和每 6 小时），原始压缩包
  `<厂商>_bundle.zip` 删掉、记录里的 `provider_zip` 清空；MinerU 解包目录 `ocr/unpacked/` 只留记录里指着的文件（布局
  `layout.json`），原 PDF 副本、Markdown 和图片（`md/` 里有）、中间 JSON 删掉（要 `md/full.md` 在才删）。
  OCR 一片片公布时写的 `ocr/stream/document.v1.json` 收尾时和 `ocr/normalized/document.v1.json` 逐字节相同，成功以后换成指向后者的硬链接
  （只在 Unix 上；`ocr/stream/` 的清单照留，翻译重跑照样能读，2026-11-02）。
- `translated/`：翻译中间产物和 `translation-manifest.json`；每页译文 `page-001.json`（2026-10-30 以前的任务叫 `page-001-deepseek.json`，照旧能读，读的一侧按清单里的路径找文件）。
- `rendered/`：渲染输出。原地重跑（原地重渲染、精修）开跑时把上一份译文 PDF 改名成同目录的 `<名>.previous.pdf`（`artifacts.previous_output_pdf` 指向它），这一次没跑成就把 `output_pdf` 指回它；跑成了，下一轮定期清理删掉它、清空这两个字段。
  2026-10-28 以前打包下载还会在这里复制一份 `<任务>.zip`（没有地方读），现在不写了，留下的由清理删掉。
  rpr_fit 引擎的工作目录 `rendered/typst/rpr-fit-engine/`（引擎输入、版面 JSON、底图子集、叠加层）只有渲染器自己读、每次渲染前清空重建，
  任务成功以后由清理删掉（2026-11-02）。
- `artifacts/`：对外发布的稳定产物、诊断文件和索引。下载时按需生成的派生缓存（`<任务>-side-by-side.pdf`、
  `<任务>-layout-*.docx`、`*.linearized.pdf`、`preview-*.jpg` 和它们的记录文件 `.<名字>.inputs.json`）也放在这里，
  书的页预览在 `documents/<文档>/pages/`；设了 `RUST_API_DERIVED_CACHE_RETENTION_DAYS` 时，任务结束后生成超过这么多天的
  按名字删掉（只删这几种）；渲染的准备缓存 `artifacts/render_prepare/` 和预热 `artifacts/render_prewarm/` 也按这个天数删
  （预热清单 `render_source_prewarm_manifest.json` 留着，阅读器排版接口读它），管线写进 `artifacts/` 的别的东西不碰。
  排队、在跑的任务引用着的任务目录（复用的 OCR、译文所在的）这一轮不清。
- `logs/pipeline_events.jsonl`：当前事件落盘主文件。

历史兼容：

- 老任务可能只有 `logs/events.jsonl`。
- 当前读取逻辑会优先读取 `pipeline_events.jsonl`，再回退到旧文件名。

## SQLite

SQLite 主要承担：

- `uploads`：源文件名、存储路径、PDF 大小、页数和上传时间。
- `jobs`：任务状态、阶段、进度、请求/runtime 状态、失败信息和日志尾部；运行中的任务还记着 worker 的 `pid` 和 `worker_identity`（`<pid>@<启动时间指纹>`，spawn 时写，启动对账、取消杀进程前核对 pid 没被别的进程复用）。
- `artifacts`：每个任务的 artifact index JSON。
- `job_artifact_entries`：规范化 artifact manifest，用于下载和列表展示。
- `events`：结构化事件流。
- `glossaries`：命名术语表资源。

接口返回和数据库记录尽量使用相对路径，运行时再解析到真实文件，避免把机器路径暴露给前端。
解析时（`retainpdf-core` 的 `resolve_data_path`）相对路径不许带 `..`；旧记录里的绝对路径必须落在 `DATA_ROOT` 里
（符号链接展开后再比），否则当成文件不存在（2026-10-24 起；以前绝对路径原样返回）。

## 边界约定

- Rust 负责分配任务目录和登记 artifacts。
- Python worker 只消费 Rust 传入的路径。
- 前端和外部调用方不应该依赖任务目录内部布局。
- 正式产物发现入口是 `GET /api/v1/jobs/{job_id}/files`（旧的 `/artifacts-manifest` 已于 2026-10-18 删除）。

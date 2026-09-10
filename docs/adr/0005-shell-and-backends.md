# ADR-002：壳 + 后端进程组

> 状态：已采纳（2026-07-24）。**部分推翻 ADR-001** 中"不增加常驻进程数"一条。
> 触发痛点：改一行 API 代码要重启整个后端，正在跑的翻译任务被杀
> （`state_recovery` 把孤儿 worker 终止并标记 `worker_orphaned_after_restart`）。
>
> 当前实现注记（2026-09-02）：后端源码已经迁入 `services/`，主程序名仍为
> `rust_api`；权威开发入口是 `python3 ops/development/dev_stack.py`。本文中的
> 固定测试数量和性能数字是 ADR 形成时的历史快照，不是当前验收门槛。早期
> “SQLite 唯一写者”措辞也只描述当时拓扑；remote 模式下 API 与 jobsd 现在通过
> `retain-data` 和 WAL 访问同一数据库。

## 为什么推翻 ADR-001 的那一条

ADR-001 的判断针对**部署形态**（单机单用户不需要按服务伸缩），那部分依然成立。
但它没预料到两件事：

1. **rust_api 长成了身兼四职的 22.3k 行单体**：HTTP 网关 + SQLite 唯一写者 +
   任务调度 + AI 代理。四者变更频率差一个数量级——路由天天改，任务调度几周
   才动一次——却被绑在同一个进程生命周期上。
2. **痛点是开发粒度，不是部署粒度**。改路由重启进程 → 子进程 worker 被连坐，
   十分钟的翻译白跑。这是进程边界画错位置，不是"要不要微服务"。

结论：**按变更频率切进程，不按业务域切**。切完仍是本地单用户拓扑，不引服务
发现、不引消息总线、不拆库——ADR-001 的其余约束全部保留。

## 目标拓扑

```
desktop (Electron)
  └─ rust_api :41000          ← HTTP 网关 + 图书馆/文档 CRUD + AI 代理 + 监督
       ├─ retain-jobsd :41002 ← 任务调度 + worker 监督（内部 HTTP，仅监听 127.0.0.1）
       │    └─ pipeline workers（子进程，进程组隔离）
       └─ retainpdf-ai :41100 ← Python AI agent
```

改壳 → 只重启壳，jobsd 与其 worker 毫发无伤，翻译继续跑。
只有改 job_runner 才需要重启 jobsd——而那时本来就在动这块代码。

## 可行性实证（2026-07-24 实测，非推断）

| 关口 | 结论 | 依据 |
|---|---|---|
| 接缝大小 | **3 个操作，58 行** | `backend/api/src/services/runtime_gateway.rs` 全部公开面：`JobRuntimeLauncher::launch`、`RuntimeControl::{request_cancel,clear_cancel}`、`terminate_runtime_process` |
| 注入点 | **现成** | launcher 本就是 `Arc<dyn Fn(String)>` 策略对象，换实现即可，非侵入 |
| 调用点 | **2 处** | `backend/api/src/app/jobs.rs`（装配）、`backend/api/src/services/jobs/control.rs`（取消/终止） |
| 实时进度 | **已全走 DB** | `backend/api/src/services/jobs/live_stage/combined_events.rs` 读 `db.list_job_events`，壳无需任何内存态即可服务 SSE/查询 |
| 共享内存态 | **可整体搬走** | `canceled_jobs`、`job_slots` 仅被 job_runner 消费；`downloads_lock` 归壳自有 |
| 数据面 | **无需改造** | SQLite 已是 `journal_mode=WAL` + `busy_timeout`（`backend/packages/retain-data/src/db.rs`），多进程访问同一库是 SQLite 支持的配置 |

## 内部契约：jobs-control.v1

`backend/contracts/jobs-control.v1.schema.json`，四个操作一一对应现有接缝：

| 操作 | 端点 | 语义 |
|---|---|---|
| launch | `POST /internal/v1/jobs/{job_id}/launch` | 发射后不管（与现有闭包同语义） |
| cancel | `POST /internal/v1/jobs/{job_id}/cancel` | 写取消注册表 |
| clear cancel | `DELETE /internal/v1/jobs/{job_id}/cancel` | 清理竞态残留项 |
| terminate | `POST /internal/v1/processes/{pid}/terminate` | 组杀进程树 |

仅监听 `127.0.0.1`，鉴权复用 `RETAIN_API_KEYS` 单源。

## 迁移策略：双实现，默认零变化

`runtime_gateway` 的两个类型改为双实现：

- **InProcess**（默认）：今天的行为，闭包直调 `spawn_job`，单进程跑
- **Remote**：HTTP 调 jobsd，由 `RUST_API_JOBS_MODE=remote` 开启

好处是这一刀**加法式落地**：不开开关时全量测试与运行行为逐字节不变，
开关打开才走新路径。开发/桌面可各自选择，回滚只需改一个 env。

## 分期

- **Phase 1——已落地（2026-07-24）**：契约 + `backend/jobs` 二进制 +
  双实现接缝。默认 InProcess，行为零变化。
  - 接缝改造：`JobRuntime` 枚举（InProcess / Remote）收口四个操作；
    `JobRuntimeLauncher` 保持 `Arc<dyn Fn>` 形状不变，只在 `backend/api/src/app/jobs.rs`
    按模式换闭包——上层（routes / services/jobs）**一行未改**。
  - jobsd 持有自己的 `canceled_jobs` / `job_slots`；壳在远端模式下不再需要
    这两份内存态。
  - 契约双端锁：jobsd 侧 `backend/jobs/src/contract_lock.rs`
    （路由与契约端点双向相等、HTTP 方法齐备、只绑回环）、壳侧
    `backend/api/src/api_tests/jobs_control_contract.rs`
    （发出路径与契约双向相等、每个操作可追溯到它取代的接缝函数、
    默认模式必须是进程内）。
  - 验收：`cargo test --workspace` 331/331（323→331：+2 配置、+3 jobsd 锁、
    +3 壳侧锁）；架构检查通过；jobsd 四端点 + 鉴权真机冒烟通过；
    壳以 `RUST_API_JOBS_MODE=remote` 与 jobsd 并肩启动、双方 health 正常。
  - **尚未验证**：真实任务（上传 PDF → OCR → 翻译）在远端模式下端到端跑通，
    需要真 PDF 与 provider 凭据，留待 Phase 3 dev 脚本就绪后手动跑一轮。
  - 坑：`auth.local.json` 优先于 `RUST_API_KEYS` 环境变量——冒烟时用 env
    设的 key 会被静默忽略（这也正好证明壳与 jobsd 的钥匙天然同源）。
  - 坑：架构门禁是文本扫描，doc 注释里出现 `AppState` 字样也会判越界；
    改注释措辞而非放宽门禁。
- **Phase 2——已落地（2026-07-24），但目标被实测推翻并重塑**：
  - **原目标作废**：实测改壳 1.67–1.87s、改 job_runner 1.64–1.66s，两者
    几乎相同——"改壳不重编任务栈"这条收益 **ADR-001 的 crate 拆分早已兑现**
    （touch 壳代码时 retain-jobs 根本不参与重编；剩下的 1.7s 是壳自己 22k 行
    的编译链接）。照原计划再加一套 cargo feature 只会换来构建复杂度，
    收益接近零，故不做。
  - **真问题在归属而非编译**：`configure_child_process` /
    `worker_process_exists` / `terminate_job_process_tree(_blocking)` 是纯
    OS 进程操作、零任务语义，却住在 job_runner 里——导致 `ai_supervisor`
    （监督的是 Python AI 服务，与任务毫无关系）为了杀一棵进程树而依赖整个
    任务执行栈。
  - **实际做法**：抽出 `backend/packages/retain-proc`（仅 anyhow + libc + tokio），
    job_runner 侧 re-export 保持 `job_runner::` 路径不变；壳经
    `crate::process::` 直取。壳对 job_runner 的引用因此从 **5 个文件收敛
    到 2 个**，且两处恰好就是 InProcess 落点本身：
    `backend/api/src/app/jobs.rs`（spawn_job + ProcessRuntimeDeps）与
    `backend/api/src/services/runtime_gateway.rs`（取消注册表）。
  - **门禁焊死**：`backend/api/scripts/check_architecture.py` 新增
    `check_job_runner_boundary`，
    壳内除上述两文件外引用 `job_runner::` 即红。已用故意越界验证它**真会咬**
    （probe 时 exit 1，还原后 exit 0）——只会绿的门禁等于没门禁。
  - 验收：`cargo test --workspace` 331/331，进程工具的 2 个测试随代码迁入
    retain-proc（未丢失）；架构检查通过。
- **Phase 3——已落地（2026-08-18）**：
  - **dev 脚本**：当前权威入口是 `ops/development/dev_stack.py`，一键拉起
    `rust_api:41000 + retain-jobsd:41002 + retainpdf-ai:41100`。它显式启用
    `remote + supervised`；`backend/api/scripts/dev-remote.sh` 仅作为兼容转发入口。
    原始 Rust 配置不经过该启动器时仍默认 `InProcess`。
  - **桌面端监督接线**：`backend/api/src/services/jobsd_supervisor.rs` 复用
    `backend/api/src/services/ai_supervisor.rs` 模式。桌面装配位于
    `frontend/desktop/src/main/backend-env.js`、
    `frontend/desktop/main.js` 和 `frontend/desktop/scripts/prepare-app.mjs`；容器装配位于
    `ops/deployment/docker/Dockerfile.app`。
  - **健康与可观测**：公开探针是 `/health` 与 `/ready`；健康视图同时报告
    `jobsd` 和 `ai_service`。41002、41100 是内部回环端口，不是公开 API。
  - **验收**：当前应运行 workspace 测试和架构门禁，不以本文记录的历史固定
    测试数作为成功条件。
  - **剩余**：真实 PDF 端到端（上传→OCR→翻译→渲染）在 `remote + supervised` 下仍需真凭据手动跑一轮；如果未来要求 worker 跨 jobsd 重启原地存活，再扩展 B 方案的输出接管。

## 与既有欠账的关系

- **B 方案已由 durable resume 部分取代**：remote 模式仍能做到“改壳不杀任务”；
  jobsd 自身重启时不会继续接管旧 worker 的 stdout，而是终止孤儿进程，依据
  `pipeline_attempts`、committed units 和匹配 checkpoint 自动重新排队。已经提交的
  页/单元不会重做，当前未提交单元仍可能重跑。若未来要求 worker 进程跨 jobsd
  重启原地存活，才需要继续实现 stdout/退出码的重新接管。
- 桌面端 `RUST_API_AI_SUPERVISE=1` 切换与本 ADR 的 jobsd 监督可一并做（Phase 3）。

## 当前恢复边界

- `remote` jobsd 让 HTTP 壳重启不直接杀死其 worker，但 jobsd/worker 自身故障仍需
  依靠 SQLite 中的 attempt、unit、event 和流水线 checkpoint 恢复。
- 只有已经 durable commit 的页/单元可以复用；worker 内存态和未提交输出不属于
  可恢复状态。
- provider dispatch 已发出但回执不明确时必须进入显式歧义解决流程，不能静默重复
  提交远端 OCR 请求。
- workspace 的数据库、API 和 jobsd 进程级恢复测试共同锁定核心不变量：durable
  committed units 在重新排队后继续保留，新 worker 接管时推进 generation，旧
  worker 的提交被 fencing 拒绝；没有 durable attempt 的遗留 running 任务明确失败。

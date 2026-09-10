# Rust API 业务目录与边界统一迁移计划

状态：批次 1–3 位置迁移已验收；批次 4 按子任务推进，未宣称全部完成。  
编写日期：2026-09-07。  
执行位置：仓库根目录。

## 1. 目标与范围

统一原则：**一个业务一个目录、一个明确的应用入口、一个明确的资源所有者。**

这次迁移主要调整 `backend/api/src` 内部组织，不改变仓库顶层职责目录。
先固定入口与出口，再允许业务内部独立演进；不以文件数量或目录对称作为完成标准。

包含：

- 把散落的业务实现与 `*_api.rs` 收拢到同一业务目录。
- 明确路由、应用入口、业务实现和运行时管理之间的依赖方向。
- 收紧公开接口、配置来源、共享资源所有权和测试依赖。
- 将新增规则纳入已有架构检查。

不包含：

- HTTP 路径、请求字段、响应 schema、错误码和鉴权权限变更。
- 数据库 schema、数据目录、凭据存储格式迁移。
- 前端、Docker、桌面打包或翻译算法改造。
- 重写 Python AI 服务、替换模型厂商、默认执行付费模型测试。
- 为每个模块建立 repository trait，或强制所有操作改为服务对象。
- 仅因文件较大就拆分、仅因名称相似就合并不同业务。

## 2. 当前基线与实施前提

当前已合入 `main` 的基础：

- 上传逻辑已从 jobs 中抽离到 `services/uploads/`。
- 独立上传、OCR 提交和 Bundle 提交共用应用持有的上传服务。
- Agent 计算接口已把完整配置依赖缩小为数据库与数据目录。
- 合并提交：`2f679649`；上传与计算边界提交：`8c978a02`。

编写本文时，工作区另有尚未提交的 AI 网关与断连处理改动：

- 网关客户端和配置改为应用实例持有。
- 响应头等待、响应体空闲、runtime-config 总时限分开处理。
- Python 超时分类与响应生命周期取消已有调整。
- AI 监督器的健康状态源仍是进程级状态，并未完成实例化迁移。

这些改动与本次目录迁移必须分开建立基线：

1. 核对工作树，识别并保留无关修改。
2. 对现有 AI 改动完成评审、验证，并在获得提交授权后单独记录。
3. 记录实际迁移起点的 commit、测试命令和结果，再开始移动代码。

既有测试结果只作为参考，不替代迁移后验收。真实模型在旧进程返回
答案，也不能作为新代码启动或取消行为已经验收的证据。

## 3. 目标组织方式

```text
backend/api/src/
├── app/                     # 启动、路由注册、依赖装配
├── routes/                  # HTTP 参数提取与响应适配
├── services/
│   ├── uploads/
│   │   ├── mod.rs           # 模块声明、最小可见性
│   │   ├── api.rs           # 面向 HTTP 调用方的应用入口
│   │   ├── service.rs       # 上传业务流程及共享资源
│   │   ├── capacity.rs
│   │   ├── staging.rs
│   │   ├── pdf.rs
│   │   ├── error.rs
│   │   └── tests/
│   ├── ai/
│   │   ├── mod.rs
│   │   ├── api.rs
│   │   ├── gateway.rs       # Python sidecar HTTP 传输
│   │   └── tests/
│   ├── jobs/
│   ├── credentials/
│   └── …                    # 其他模块逐批收拢
├── runtime/                 # 经审查后迁入的监督器及进程生命周期实现
├── auth.rs
├── error.rs                 # 全局 HTTP 错误 envelope
├── api_tests/               # 入口、出口及跨 HTTP 边界验收
└── test_support/            # 测试数据构造器；不提供万能 AppState
```

这是职责模板，不是强制文件清单。小模块可以只保留 `mod.rs + api.rs`；
纯函数不必包装为对象；复杂模块可以继续按明确的子职责分目录。
同一模块不要同时保留 `feature.rs` 与 `feature/mod.rs` 两套入口。

数据库仍归 `database/`，共享配置/模型仍归 `backend/packages/`，
Python AI 与流水线仍分别归 `backend/ai/`、`backend/pipeline/`。

## 4. 统一依赖规则

### 4.1 应用装配

`app` 是共享资源的装配位置：

- 启动时解析配置，构造客户端、容量控制器和运行时句柄。
- 由 `AppState` 持有需要跨请求共享的服务。
- 服务不自行重新读取环境变量，也不通过全局变量寻找客户端。
- 凭据动态解析、配置 revision 和受控更新仍遵循各自协议；
  “启动配置快照”不等于把所有密钥固定在内存直到重启。

不把完整 `AppState/AppConfig` 传入业务实现。
现有尚未迁移的例外需记录，不能借本次迁移新增例外。

### 4.2 路由与应用入口

统一导入入口为 `services::<业务>::api`：

- 路由处理 HTTP 参数、身份上下文和响应，不编排文件/数据库事务。
- `api.rs` 负责应用调用入口、必要的 view 转换及错误映射。
- 不能通过 `api.rs` 把所有内部符号无差别重新导出。
- HTTP 类型可以存在于路由和 HTTP 适配入口，但不应向容量、
  文件处理、模型传输解析等内部实现扩散。

纯透传入口不需要人为增加逻辑；稳定的转导出可以保留。
是否需要包装函数，以隔离实现、转换契约或限制依赖为依据。

### 4.3 两种合法依赖形式

| 场景 | 形式 | 示例 |
| --- | --- | --- |
| 有连接池、并发额度或后台任务 | 应用持有共享服务，调用方借用句柄 | UploadService、AiGateway |
| 只需要少量数据访问或纯计算 | 窄依赖对象、目录引用或普通函数 | 字体查询、Agent 计算产物读取 |

不统一成“每次请求 new 一个服务”，否则会拆散共享限流和连接池。
也不统一成“所有模块都持有整个 AppState”。

### 4.4 跨业务调用

- 路由走 `api`；业务之间走该模块明确公开的非 HTTP 能力接口。
- 不允许跨目录访问 `capacity/staging` 等实现细节。
- 多业务协作由已有应用流程编排，例如 jobs 调用 uploads，再创建任务。
- uploads 不能反向依赖 jobs；文件下载不能暗中触发任务执行。
- 发现依赖环时先调整职责，不能用 reexport 或导入别名掩盖。

对外可见性优先 `pub(crate)`；内部优先私有或 `pub(super)`。
收紧已有 `pub` 前必须搜索仓库内其他 crate、bin 和测试的调用。

### 4.5 错误处理

目标是“每条链路只映射一次”，不是“一次重写全部 AppError”：

- 业务错误表达失败原因，不直接决定 HTTP 状态码。
- 在业务应用入口或统一应用错误转换处映射为 `AppError`。
- 全局 `error.rs` 继续负责既有 HTTP envelope。
- 已有上传错误集中转换可以保留；不为目录对称重复实现映射。
- 无关模块暂时保留现有 AppError，随其迁移单独收紧。

纯迁移不得改变错误消息、状态码、脱敏规则、404/500 判定或流式终止语义。
如发现安全或语义缺陷，单列修复提交及回归测试。

### 4.6 运行时管理

`runtime/` 放“如何启动、监督、关闭进程”的实现，不放模型业务或任务规则。

监督器已迁入 `runtime/{ai_supervisor,jobsd_supervisor}.rs`，但 `services/runtime_gateway.rs` 兼有
任务执行接口，不能仅按名字机械搬走。应先区分：

- 上层稳定的任务启动/控制能力。
- 进程内或远端执行适配。
- 子进程健康、重启、关闭及状态持有者。

本次不修改 in-process/remote 的选择语义，也不修改“监督关闭时可使用
外部启动 sidecar”的行为。健康状态实例化应独立于文件移动验收。

## 5. 路径迁移清单

以下记录迁移前路径与目标路径；实际完成状态以第 6 节及验收记录为准：

| 当前入口/实现 | 目标 | 时机 |
| --- | --- | --- |
| `services/upload_api.rs` | `services/uploads/api.rs` | 首批样板 |
| `services/ai_proxy_api.rs` | `services/ai/api.rs` | 首批样板 |
| `services/ai_proxy.rs` | `services/ai/gateway.rs` | 首批样板 |
| `services/font_api.rs + fonts.rs` | `services/fonts/{api,service}.rs` | 小模块批次 |
| `services/credentials_api.rs + credentials.rs` | `services/credentials/{api,service}.rs` | 小模块批次；不改 vault |
| `services/agent_calculation_api.rs + agent_calculations.rs` | `services/agent_calculations/{api,service}.rs` | 小模块批次 |
| `services/glossary_api.rs + glossaries*` | `services/glossaries/` 内归一入口 | 小模块批次 |
| `services/ai_supervisor.rs + jobsd_supervisor.rs` | `runtime/` 下对应模块 | 生命周期批次 |
| jobs、library、document_operations、model_requests 等 | 保持业务归属，逐个补统一入口 | 复杂模块批次 |

public document operations 与 internal document operations 暂不合并；
两者鉴权与调用对象不同，需要先验证权限边界。

移动时同步处理 `mod.rs`、`#[path]`、use/reexport、测试路径、
架构检查扫描范围和相关文档链接。不能只让编译通过，却让检查漏扫新目录。

## 6. 分批执行

### 当前执行记录（2026-09-07）

- 起点为 `main@2f679649` 加已有未提交 AI 网关与断连修复；既有修改保留，
  当前没有把迁移或 AI 修复另行提交。无关流水线 README 保持原状。
- 批次 1 已完成接线与 Rust API lib 验证：412 通过、2 忽略，
  日志 `/tmp/retainpdf-migration-wave1.log`；架构检查及 13 项规则测试通过。
- 批次 2 已完成接线；扩展规则覆盖四个小模块的新入口、私有实现和模型 facade。
- 最终 Rust 全工作区 19 个测试组：709 通过、0 失败、4 忽略，
  日志 `/tmp/retainpdf-migration-final-rust.log`；架构检查及 16 项规则测试通过。
- 全部 `src` 的函数声明排序结果与迁移前基线一致（65,433 字节），
  配合全测试回归核对测试函数未因搬迁丢失；`git diff --check` 通过。
- 本次未修改 Python，Python 既有修复的历史测试不计为本次重新验证。
- 本次未重启当前服务、调用付费模型、push 或触发 Actions。

### 批次 0：固定基线与迁移规则

- [x] ~~单独记录当前 AI 修复基线，保留无关工作树。~~ **未执行，已造成后果**
- [x] 确认待迁模块公开符号和所有调用方。
- [x] 记录入口/出口测试清单、已知限制及失败基线。
- [x] 为新路径准备架构检查的正反例。

出口：迁移起点明确，未把尚未验证的修复混入移动提交。

**本批次未按计划执行，后果记录（2026-09-08）**

第一项被跳过：AI 网关修复没有先单独建立基线，而是与目录迁移在同一工作区并行
推进。结果 `services/ai/gateway.rs` 同时是「`ai_proxy.rs` 搬到新位置」和
「配置改为实例持有 + 新增 idle_timeout + api_key trim」两件事——原文件 65 行、
新文件 84 行、127 行差异，且旧文件已删、新文件未跟踪，git 连重命名都识别不出。

事后拆分需要手工重建一份「已搬迁但未修行为」的中间态文件，属考古且无法验证
该状态是否真实存在过，故放弃拆分：Rust 侧的 AI 网关修复随迁移提交一并落盘，
在提交说明中标注。Python 侧（backend/ai/**）与 Rust 无依赖，已先行单独提交
（`725dc5b4`）。

因此第 9 节完成定义中的「行为改变均有独立记录」一条，对 AI 网关部分不成立，
以本节记录替代。后续批次若再出现并行的行为修复，必须先完成本批次第一项。

### 批次 1：uploads 与 ai 样板

- [x] 按上表移动入口和网关，更新调用方。
- [x] 保留服务实例、容量、HTTP client 和配置生命周期。
- [x] 私有实现不通过新 api 入口意外泄露。
- [x] 原有架构约束覆盖新位置，旧路径引用清零（迁移表保留历史映射）。
- [x] 验证共享容量、取消、上传发布和 AI HTTP/SSE 契约。

出口：两个模块可作为后续参考；这一批不再调整超时默认值或业务逻辑。

### 批次 2：小模块归一

- [x] 字体、凭据、Agent 计算、术语表逐个迁移。
- [x] 首轮样板先验证，再集成小模块并完成相关用例及全工作区验证。
- [x] 核对测试依赖与收集，保留既有最小 test_support，不新增测试间私有辅助依赖。

出口：调用方只依赖稳定入口，响应与存储行为不变。

### 批次 3：运行时管理归位

- [x] 明确 supervisor、health、shutdown 的所有者与消费方：app/server 管启动与关闭，app/state 注入 AI 状态函数，health_api 负责 HTTP 投影。
- [x] 单独完成位置迁移，不同时重写监督状态机；不移动任务控制 runtime_gateway。
- [ ] 可选后续：若进一步实例化健康状态，另立实现提交和取消/关闭测试，本次仍保留原子全局状态。
- [x] 使用临时服务验证启动、重启、端口释放与无残留子进程：新增 jobsd 真实临时 HTTP 子进程测试，保留 AI 启动超时重启与 shutdown 测试。

本轮专项验证：`cargo test --locked -p rust_api runtime:: --lib -q`，3 项通过；
架构检查及 18 项合成规则测试通过。新增子进程测试仅在 Unix 执行，
使用临时目录、临时端口和本地 Python 标准库，不调用模型或操作开发服务。
Windows 子进程回收尚未在本轮验证，健康状态实例化也未实施。
两个监督器的生产函数体保持不变，仅移除两项未使用的测试状态 setter。
完整 Rust workspace 回归：710 通过、0 失败、4 忽略，19 个测试组，
日志 `/tmp/retainpdf-runtime-final-rust.log`。

出口：不改变任务运行落点、健康降级和 shutdown 语义。

### 批次 4：复杂业务收口

- [ ] jobs 保留 command/query 分离，先厘清跨业务编排。
- [ ] library、文档操作、模型请求分别审查，避免职责错并。
- [ ] 按必要性引入领域错误，不进行全仓错误类型替换。
- [ ] 删除迁移期转导出，更新当前架构文档。

出口：该批涉及模块满足同一边界规则；未迁部分有明确清单。

#### 批次 4 预审结果（2026-09-07）

首个子任务已拆分依赖定义：`jobs/creation/context.rs` 拆至
`jobs/deps/{command,query,replay}.rs`，原有构造函数、字段与 owned/borrowed 行为保持。
`jobs/facade.rs` 收拢为 `jobs/facade/mod.rs`，保留现有 command/query 实现分区，
没有额外引入 trait 或第二套 facade。架构检查禁止查询依赖携带上传/提交/运行时控制能力。
library 与 book_projection 的跨域依赖仍待后续处理，不作为本轮完成项。

先处理 `jobs` 的 facade/query/command 接缝，再处理 `library_api` 与文档操作。
当前最大风险不是文件大小，而是 `library/{ocr,translate}` 直接依赖 `JobsFacade`、
`book_projection` 依赖 jobs readiness，以及多个下载 route 依赖 jobs 的类型导出。
因此下一轮应先提取稳定的 jobs capability facade 和最小下载/就绪类型，
再移动实现文件；本轮不做机械拆文件，也不改变任务运行落点。

## 7. 测试与验收

| 层次 | 验收内容 |
| --- | --- |
| 业务测试 | 规则、状态变化、容量归还、临时文件清理；使用最小依赖 |
| HTTP 契约 | 方法/路径、鉴权、请求字段、状态码、完整响应与错误 envelope |
| 流生命周期 | 首段增量、正常 done、超时、中断无伪造 done、断开释放上游 |
| 运行时集成 | 临时端口与目录下启动/关闭；不依赖当前正在运行的服务 |
| 架构检查 | 正确路径放行；跨实现导入、完整状态依赖、隐藏全局读取被拒绝 |

每批至少执行相关模块测试、架构检查及 `git diff --check`。
候选提交收口时执行 Rust 全工作区；影响 Python 代码时再跑对应 Python 全集。
记录“执行了哪些测试”，不能用编译成功代替运行验收。

```sh
python3 backend/api/scripts/check_architecture.py
python3 -m unittest discover -s backend/api/scripts -p test_check_architecture.py -q
PATH="$PWD/backend/.venv/bin:$PATH" cargo test --locked --workspace --no-fail-fast -q
backend/.venv/bin/python -m pytest backend/ai/tests -q
git diff --check
```

上述命令从仓库根运行。Cargo 由集成人员串行执行，避免多个 agent
争用同一构建目录。真实模型测试需要单独授权，不属于迁移默认门禁。

以下行为必须保持：

- 三个上传入口共享容量，取消时不能提前释放仍在执行的解析许可。
- 上传和文档记录发布成功后，后续创建任务失败不能删除已发布文件。
- SSE 已发送响应头后，中断不能伪装成正常 done 或改写为另一个 HTTP 状态。
- HTTP 断连只取消所属请求，不影响其他并发请求。
- runtime-config 的凭据引用、revision 冲突和受控重启语义不变。

## 8. 并行协作与提交策略

本轮采用 4 个 subagent 与主 agent，文件所有权不交叉：

1. 业务 A：首轮 uploads；次轮字体与 Agent 计算，含各自模块内部测试。
2. 业务 B：首轮 AI Rust 网关；次轮凭据与术语表，含各自模块内部测试。
3. 测试 C：`api_tests/` 与 `test_support/`，核对入口出口用例收集，交叉审查。
4. 架构 D：架构检查脚本、正反例测试和迁移/目录文档。
5. 主 agent：app/routes、公共声明、其他业务调用方及共享装配测试，串行 Cargo 验证。

每轮先交接公开符号和待接线调用点，再由主 agent 集成；首轮验收通过才开始次轮。

开始前明确文件所有权和接口签名；所有人保留其他人的修改。
共享装配文件不能由多个工作者同时编辑。迁移与行为修复分开提交。

临时兼容转导出仅用于跨批次衔接：必须写清调用方、删除批次和检查规则，
不能通过兼容层永久开放内部实现。纯仓库内部路径优先在同批次完成切换。

本计划不授权 commit、push、重启正在使用的后端或修改 CI；
这些动作按用户当次授权执行。

## 9. 回退与完成定义

每批以独立提交作为回退单位：

- 未发布的修改按已确认的文件范围撤回；不能覆盖无关工作树。
- 已发布的迁移优先使用反向提交，不强推或重写共享 main 历史。
- 回退生产模块时，同批回退装配、测试路径和架构扫描调整。
- 本次不迁移数据，因此不应产生数据库恢复步骤；若出现 schema/数据
  迁移需求，应暂停并另立计划。

整个迁移完成需满足：

- [ ] 本计划清单内模块已收拢，或明确记录延期原因。
- [ ] 路由入口、跨业务接口和共享资源所有权可从代码直接辨认。
- [ ] 没有残留旧路径、无期限兼容层或通过别名绕过架构检查。
- [ ] 入口出口契约未变；行为改变均有独立记录。
- [ ] 每批有验证记录；已有无关失败未被隐藏。
- [ ] 当前架构文档与代码一致，再将本文标记为完成并链接验收记录。

## 10. 关联文档

- [工程规划索引](README.md)
- [Rust API 架构入口](../../core/rust_api/README.md)
- [Rust API 实现文档](../../../backend/api/docs/README.md)
- [既有仓库职责目录迁移记录](../reports/repository-layout-migration.md)

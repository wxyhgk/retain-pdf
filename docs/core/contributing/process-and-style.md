# Issue、PR、代码风格与发布说明

## Issue 流程

提交 Bug Issue 时尽量包含：

- RetainPDF 版本、运行方式：桌面端 / Docker / 本地开发。
- 操作系统和浏览器。
- OCR provider、模型 provider、任务 workflow。
- job_id、失败阶段、错误摘要或截图。
- 可复现步骤。
- 期望结果和实际结果。
- 如涉及 PDF 样本，说明是否可以公开；不能公开时提供最小化截图、页面编号、bbox 或脱敏样本。

提交 Feature Issue 时尽量包含：

- 使用场景。
- 你希望前端/API/命令行如何暴露。
- 是否需要兼容现有 job、artifact、reader、library 或 Docker 交付。
- 可能影响的模块。

安全问题、密钥泄露、隐私数据问题不要直接贴公开 Issue。请先通过 README 里的交流群或 GitHub 私下渠道联系维护者；如果只能公开提交，请只描述影响范围，不要附带密钥、真实文件或可识别用户数据。

## PR 流程

建议流程：

1. 先开 Issue 或在已有 Issue 下说明方案，尤其是跨 Rust/Python/frontend/web/Docker 的改动。
2. 从最新 `main` 开分支。
3. 保持 PR 聚焦，一次只解决一个主题。
4. 代码改动同时补测试或说明为什么暂时无法补。
5. 更新相关文档。
6. PR 描述写清楚改了什么、为什么改、怎么验证。

PR 描述建议包含：

```md
## 变更

- ...

## 验证

- [ ] npm run test:api
- [ ] BACKEND_ROOT="$(python3 .github/scripts/resolve_backend_source.py --print-path)" && python3 "$BACKEND_ROOT/pipeline/devtools/check_pipeline_architecture.py"
- [ ] npm --prefix frontend/desktop run verify-frontend-sync

## 风险

- ...
```

如果 PR 修改了用户可见行为，请附截图、接口示例、样本 job_id 或前后对比。

## 沿用现有风格

“沿用现有模块风格和命名”的意思是：

- 先在同目录找 2 到 3 个相近实现，按它们的命名、错误处理、返回类型、测试写法和文件组织继续写。
- 已有模块叫 `*_view`、`*_payload`、`*_manifest`、`*_contract` 时，新字段或 helper 也尽量沿用同一套词，不要另起一套 `dto/result/response/entity` 混用。
- 已有代码使用窄依赖参数时，不要退回传整个 `AppState`、全局 config 或大 dict。
- 已有 API 返回走 view/projection 层时，不要在 route 里临时拼 JSON。
- 已有 Python pipeline 使用 stage spec、manifest、document.v1 时，不要直接绕过去读 provider raw JSON。

## 什么时候可以加抽象

不要为单个小需求引入新的抽象体系。下面这些情况通常不应该新增框架式抽象：

- 只是新增一个字段、一个按钮、一个下载入口或一个校验分支。
- 只是两个调用点有少量重复。
- 只是为了把名字变得“更通用”，但没有减少真实复杂度。
- 只是把原本清楚的顺序逻辑包进多层 class/factory/manager。

可以新增抽象的情况：

- 同一逻辑已经在 3 个以上地方重复，而且修改时容易漏。
- 现有函数已经混合 IO、策略、数据转换、错误处理，导致测试困难。
- 新抽象能把跨层依赖变窄，例如把 route 中的业务判断移到 service。
- 新抽象能形成稳定契约，例如 artifact manifest、reader region、translation diagnostics。

新增抽象时，PR 描述里说明：

- 它替代了哪些重复或耦合。
- 它属于哪一层。
- 哪些模块允许依赖它，哪些模块不应该依赖它。

## 改动范围

- 不要把不相关重构混进功能 PR。功能修复、重命名、目录迁移、格式化最好分开。
- 不要顺手改大量无关文件、排序 import、重排 CSS 或重写历史逻辑，除非这是本 PR 的目标。
- 不要提交本地密钥、token、真实用户文件、`data/db/jobs.db`、`data/jobs/*` 大量运行产物、`tmp/*` 或大体积实验输出。

## 性能与大样本改动

渲染、PDF 处理、翻译批处理、OCR adapter 这类改动可能对 500 页以上 PDF 有明显影响。涉及性能时建议提供：

- 样本页数和文件类型。
- 旧耗时、新耗时。
- 使用的命令或 job_id。
- 是否改变输出 PDF 内容、体积或首屏预览体验。

大样本、临时 CSV、benchmark 输出应放在 `experiments/` 或 `tmp/`，默认不要提交到仓库。

## 发布与运维

普通贡献者通常不需要打 tag 或发布包。维护者发布时会单独执行版本提交、tag、GitHub push、桌面端同步和 Docker/Release 流程。

如果你的 PR 会影响发布包，请在 PR 描述中说明：

- 是否影响桌面端 bundle。
- 是否影响 Docker runtime config。
- 是否需要迁移数据库或兼容旧 job。
- 是否需要更新 README、API 文档或用户安装说明。

维护者发布、Docker 交付和线上运维记录见 [运维与过程记录](../../ops/README.md) 和 Docker 文档。

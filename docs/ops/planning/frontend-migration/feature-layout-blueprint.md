# frontend/web 按产品功能重组目录的施工蓝图

状态：设计已定稿，尚未开工。
编写日期：2026-09-08。
执行位置：`frontend/web/`。

## 1. 目标

把 `frontend/web/src` 从「按迁移阶段沉淀出来的分层」改成「按产品功能划分」。

一条原则：

> **一个功能 = 一个目录 = 用户能指着界面说出的一件事。**

完成后 `src/js/` 目录不再存在——不是改名，是它承担的内容各自归位后自然消失。

不包含：HTTP 契约、后端接口、翻译算法、构建产物形态、桌面打包流程的任何改动。
也不包含 `frontend/packages/*` 四个 workspace 包的内部重组（reader 包保持现状，
本次只整理 `frontend/web` 侧的宿主接线）。

## 2. 为什么要改：现状的三个实测证据

### 2.1 「共享层」里多数内容只有一个页面在用

对三页入口（`src/pages/{home,detail,reader}/entry.tsx`）分别做 esbuild metafile
可达性分析，统计每个 `src/js/*` 子目录被哪些页面引用：

| 可达范围 | 目录数 | 目录 |
| --- | --- | --- |
| 仅 home | 16 | `features/{app-actions,app-shell,app-update,artifact-downloads,documents-library,glossaries,home,recent-jobs,status-detail,translation-workflow-dialog,workflow}`、`components`、`generated`、`islands`、`state`、`status-detail` |
| 三页共享 | 8 | `api`、`app-framework`、`bootstrap`、`config`、`dom`、`mock`、`utils`、`features/upload` |
| home + reader | 6 | `contracts`、`desktop`、`runtime`、`features/{credentials,job-runtime,reader-dialog}` |
| 仅 detail | 1 | `job-detail` |

`src/js/features` 下 15 个目录，**11 个只有主页可达**。它们住在一个以「跨页共享」
为存在理由的层里，而这个理由对多数内容并不成立。

### 2.2 同一功能被切成两半，且六处重名

`app-shell`、`app-update`、`credentials`、`glossaries`、`status-detail`、`workflow`
六个名字在 `src/pages/home/features/` 和 `src/js/features/` 同时存在。其中五个
（除 credentials 外）**两边都只服务主页**——分开的理由不成立，重名的代价却是实在的：
说「改 features/credentials」无法确定指哪个目录。

`credentials` 更极端，散在三处共 30 个文件：

```
src/shared/credentials/                1 文件    12 行
src/js/features/credentials/          19 文件  2487 行
src/pages/home/features/credentials/  10 文件  1326 行
```

`src/shared/` 本身构成第二个跨页共享层，与 `src/js/*` 职责重叠。

### 2.3 目录名是语言名，且迁移已经证明了正确方向

`src/js/` 共 206 个源文件，**`.js` 文件数为 0**（TS 迁移早已完成，import 仍写
`.js` 扩展名是 TS bundler 约定，与目录名无关）。

同时，迁移已经把 6 个功能整建制搬进 `src/pages/home/features/` 且工作良好：

```
library 68 文件 9096 行   home-ask 18 文件 2925 行   status 19 文件 2612 行
collections 3 文件        settings 3 文件            task-center 4 文件
```

其中 `library` 是最大的功能，全部代码在一处。**「功能自包含」不是新发明，
是本项目已验证可行的路径**，只是在另外 7 个功能上停住了。

## 3. 目标结构

```text
frontend/web/src/
├── app/                    # 三页入口与依赖装配，不承载业务规则
│   ├── home/               # entry.tsx、HomeApp、页面外壳(顶栏/底栏/导航)、装配
│   ├── detail/
│   └── reader/
├── features/               # 按产品功能划分，见第 4 节
│   └── <feature>/
│       ├── ui/             # React 组件、hooks、视图 store
│       ├── domain/         # 状态、规则、HTTP 调用、纯逻辑
│       └── index.ts        # 对外唯一出口
├── platform/               # 跨功能基础设施，不含任何产品功能
│   ├── api/                # HTTP 原语与端点构造
│   ├── config/             # 运行时配置解析
│   ├── contracts/
│   ├── mock/               # 演示模式夹具
│   ├── store/              # 原 app-framework（store/command/resource）
│   ├── desktop/
│   └── utils/
├── ui/                     # 共享 UI 组件库（原 components/ + lib/）
└── styles/
```

### 3.1 功能内部的 ui / domain 分层

每个功能内保留两层，由 `index.ts` 统一出口：

- `ui/` 只放 React：组件、hooks、视图 store。
- `domain/` 放状态、规则、HTTP 调用和纯逻辑，**不 import React**。
- 跨功能调用一律走对方的 `index.ts`，不允许深入 `ui/` 或 `domain/` 内部。

保留这层分隔的实际收益：非 React 消费方（reader 宿主、detail 页数据端口、
测试）只依赖 `domain/`，不会把 React 组件树拖进来。这条边界可以被架构测试强制。

小功能（favorites、settings）若只有 UI 没有独立逻辑，允许省略 `domain/`，
不为对称而造空目录。

## 4. 功能清单与映射表

16 个功能。「现位置」列出所有需要归并的来源；括号内为文件数。

### 4.1 图书馆域（4 个平级功能）

| 功能 | 现位置 | 说明 |
| --- | --- | --- |
| `library` | `pages/home/features/library/{page,shell,display,actions,domain}` (22)、`js/features/recent-jobs` (31)、`js/features/documents-library` (5)、`js/components/recent-jobs` (2)、`js/islands/library-search` (3)、`js/state/recent-jobs-state.ts` | 书架网格、书卡、封面、筛选、批量、搜索 |
| `book-detail` | `pages/home/features/library/detail` (41) | 书籍详情弹窗：翻译/OCR/产物/合集/元数据五个 tab |
| `collections` | `pages/home/features/collections` (3)、`pages/home/features/library/categories` (2) | 合集 |
| `favorites` | `pages/home/features/library/favorites` (1) | 收藏（reader 侧实现在 reader 包内，不迁） |

### 4.2 任务域（4 个平级功能）

| 功能 | 现位置 | 说明 |
| --- | --- | --- |
| `jobs` | `pages/home/features/status` (19)、`js/features/job-runtime` (14)、`js/state/{job-state,timer-state}.ts` | 轮询、当前任务状态机、状态卡、阶段流、进度动画、取消/重试 |
| `job-detail` | `pages/home/features/status-detail` (26)、`js/features/status-detail` (8)、`js/status-detail` (4)、`js/job-detail` (13) | 状态详情弹窗 + `detail.html` 页的产物/事件/诊断 |
| `artifacts` | `js/features/artifact-downloads` (3) | 受保护产物下载 |
| `task-center` | `pages/home/features/task-center` (4) | 任务中心 |

`jobs` 与 `job-detail` 共用展示模型，跨目录引用走各自 `index.ts`；
真值优先下沉到 `@retainpdf/domain`（已有 `job` / `job-status` 两个入口）。

### 4.3 其余功能

| 功能 | 现位置 | 说明 |
| --- | --- | --- |
| `ingest` | `pages/home/features/workflow` (11)、`js/features/{workflow(8),upload(5),app-actions(6),translation-workflow-dialog(3)}`、`js/state/upload-state.ts` | 添加 PDF：上传、翻译/OCR/仅收藏选项、页码范围、提交 |
| `ask` | `pages/home/features/home-ask` (18) | 主页 AI 问答 |
| `reader` | `pages/home/features/reader` (3)、`shared/reader` (5)、`js/features/reader-dialog` (4)、`js/bootstrap/reader-dialog-runtime-port.ts` | 阅读器宿主接线；阅读器实现在 `packages/reader`，不迁 |
| `credentials` | `pages/home/features/credentials` (10)、`js/features/credentials` (19)、`shared/credentials` (1)、`js/state/credential-state.ts` | 凭据 |
| `glossaries` | `pages/home/features/glossaries` (8)、`js/features/glossaries` (1) | 术语表 |
| `app-update` | `pages/home/features/app-update` (4)、`js/features/app-update` (4) | 应用更新 |
| `settings` | `pages/home/features/settings` (3)、`js/state/developer-state.ts`、`shared/theme` (2) | 设置外壳、主题外观、开发者选项 |

### 4.4 归入 app / platform / ui 的部分

| 现位置 | 去向 | 理由 |
| --- | --- | --- |
| `pages/{home,detail,reader}/{entry.tsx,external.ts,adapters}` | `app/<页>/` | 入口与装配 |
| `pages/home/{HomeApp.tsx,composition,home-services-context.ts,state}` | `app/home/` | 装配层 |
| `pages/home/features/{app-shell,shared}`、`js/features/{app-shell,home}`、`js/state/home-state.ts`、`shared/navigation` | `app/home/` | 页面外壳与导航是页面自身的 chrome，不是独立功能 |
| `js/bootstrap/job-domain-adapters.ts` | `app/` | 给 `@retainpdf/domain` 注入运行时端口，属装配 |
| `js/{config,contracts,mock,utils,desktop,runtime,generated}`、`js/state/{desktop-state,store,slices,actions}.ts` | `platform/` | 跨功能基础设施 |
| `js/app-framework` | `platform/store/` | store/command/resource 框架 |
| `js/api` | 见 5.3 | 需按 mock/真实两路拆解，不整体搬迁 |
| `pages/detail/components`、`pages/home/components` | 各自功能的 `ui/` 或 `app/<页>/` | 按实际归属判定 |
| `src/components`、`src/lib` | `ui/` | 共享组件库 |
| `shared/{decor,icons,react,render-font}` | `ui/` 或 `platform/` | 逐个判定 |
| `js/dom/query.ts` | 删除 | 1 行 `$ = id => getElementById(id)`，11 处引用就地展开 |

## 5. 依赖规则

### 5.1 方向

```
app  ──►  features  ──►  platform
              │              ▲
              └──► ui ───────┘
```

- `app` 可以引用任何 features 与 platform；features 之间只经对方 `index.ts`。
- `features` 不得引用 `app`。
- `platform` 与 `ui` 不得引用 `features` 或 `app`。
- 功能内 `ui/` 可引用同功能 `domain/`；`domain/` 不得引用 `ui/`，不得 import React。

### 5.2 网关的去向

现有 `pages/home/composition/external/`（8 文件、约 100 条 import）是主页对
`src/js/*` 的唯一合法入口。功能归位后，主页对某功能的依赖变成对该功能
`index.ts` 的直接引用，这个集中网关随之解散；`composition/create-*.ts` 的
依赖接线职责保留在 `app/home/`。

**不允许**用一个新的全局 barrel 取代它——那只是把同一个问题换个位置。

### 5.3 `js/api` 的特殊处理

`js/api`（14 文件、2401 行）是 mock-aware 客户端，与 workspace 包
`@retainpdf/api`（纯净实现）职责重叠。已查明的分布：

- **完全无消费方**：无（`jobs-query.ts`、`library-books.ts` 已于 2026-09-07 删除）。
- **真实路径已死、只剩 mock**：`collections`、`glossaries`、`jobs-submit`、
  `providers`、`search`、`translation-debug`（6 文件、611 行）。
- **真实路径仍存活**：`ai`、`conversations`、`documents`、`favorites`、`http`、
  `jobs-actions`、`jobs-artifacts`、`jobs-events`（8 文件、1790 行），
  被 `shared/reader/host/*`、`pages/reader/external.ts`、`js/job-detail/data-port.ts`
  三条通路直接引用。

处理顺序：先把 6 个纯 mock 文件的夹具搬进 `platform/mock/`，文件删除；
其余 8 个随所属功能迁移时，真实路径改用 `@retainpdf/api`，mock 夹具进
`platform/mock/`。**`/detail` 页经 `job-detail/data-port.ts` 绕开主页网关直连
`js/api` 这条通路必须一并收口**，否则它会继续跑手写 fetch 而非 canonical 实现。

### 5.4 全局 store 的拆解（最难的一块）

`js/state`（11 文件、439 行）是一个按 slice 划分的全局 store，slice 归属明确：

| slice | 去向 |
| --- | --- |
| `recent-jobs-state.ts` | `features/library/domain/` |
| `job-state.ts`、`timer-state.ts` | `features/jobs/domain/` |
| `upload-state.ts` | `features/ingest/domain/` |
| `credential-state.ts` | `features/credentials/domain/` |
| `developer-state.ts` | `features/settings/domain/` |
| `home-state.ts` | `app/home/` |
| `desktop-state.ts` | `platform/desktop/` |
| `store.ts`、`slices.ts`、`actions.ts` | `platform/store/`（骨架保留） |

拆解时保持单一 store 实例与现有 action 语义，只把 slice 定义挪到各自功能，
**不借本次迁移改写状态模型**。

## 6. 分批执行

每批以独立提交为单位，批内自洽、可单独回退。

### 批次 0：固定基线

- [ ] 记录迁移起点 commit、测试命令与结果。
- [ ] 补齐架构测试的正反例，确认现有门禁能拦住违规（不是永远绿灯）。
- [ ] 建立 `features/`、`platform/`、`ui/`、`app/` 四个空骨架与 index 约定。

### 批次 1：试点一个完整功能

选 `app-update`（4+4 文件、640 行，主页专用、有跨层重名、无外部消费方），
走通一条完整路径：合并两层 → 建 `ui/`+`domain/`+`index.ts` → 更新调用方 →
收窄网关 → 改架构测试 → 全量验证。

出口：迁移手法定型，后续功能照此复制。

### 批次 2：主页专用的小功能

`glossaries`、`settings`、`collections`、`favorites`、`task-center`、`artifacts`。
体量小、依赖浅，用于把手法跑熟。

### 批次 3：跨页功能

`credentials`、`reader`。这两个被 reader 宿主消费，必须先确认
`domain/` 出口足以支撑非 React 调用方，再动 UI 侧。

### 批次 4：大功能

`library`、`book-detail`、`jobs`、`job-detail`、`ingest`、`ask`。
其中 `library` 与 `book-detail` 的拆分、`jobs` 与 `job-detail` 的共享展示模型
是本批主要风险，需先厘清共享真值再搬文件。

### 批次 5：底座归位

`platform/`、`ui/`、`app/` 收口；解散 `composition/external`；
拆解 `js/state`；删除 `src/js/` 与 `src/shared/` 残余；更新全部文档。

## 7. 必须同步修改的清单

重命名与移动会打破以下**以字符串路径为准**的东西。这是本次最大的风险来源：
漏改不会报错，而是让门禁从「拦住违规」静默退化成「永远绿灯」。

- `tests/architecture/architecture-boundaries.test.mjs`：42 处写死的
  `src/js` / `src/components` / `src/pages` / `src/shared` 路径与正则，
  含 `JS_ROOT`、`SOURCE_ROOTS`、`FORBIDDEN_IMPORT_PATTERNS`、
  `HOME_FEATURES_ROOT`、`pageHasDirectJsImport()`。**必须整篇逐条过，不能只跑 sed。**
- `tests/architecture/page-dom-references.test.mjs`：`KNOWN_ORPHANS` 键名、
  `PAGES` 的 `jsDir`/`extraJsDirs`。（注：该文件曾因路径拼错长期半哑，
  已于 2026-09-07 修复，改动时留意不要退回去。）
- `tests/architecture/test-layout.test.mjs`：`webMirrorRoot` 常量。
- `tests/` 下约 189 条直接 import 内部模块的相对路径（`tests/README.md` 明文允许此例外）。
- `components.json`：shadcn 的 `aliases.components` / `ui` / `lib` / `utils`
  当前指向 `@/components`、`@/lib`。移动到 `src/ui/` 必须同步更新，
  否则后续 `npx shadcn add` 生成的组件会落错位置。
- `scripts/generate-app-version.mjs`：输出路径 `src/js/generated/app-version.ts`。
- `scripts/desktop-first-run-smoke.mjs`：`import("../src/js/desktop/index.ts")`、
  `import("../src/js/state/store.ts")`。
- 文档：`src/FEATURES.md`（需整篇重写，两套 features 的叙述作废）、
  `README.md`、`src/pages/*/README.md`、`src/pages/home/composition/README.md`、
  `tests/README.md`、`docs/core/frontend/README.md`。

**不需要改**：`tsconfig.json` 与 esbuild 的 alias 均只有 `@ → src`，不含 `js` 这一层；
1146 处写 `.js` 扩展名的 import 是 TS bundler 约定 + `jsToTsResolvePlugin` 的
扩展名映射，与目录名无关，不要混为一谈而扩大改动范围。

## 8. 验收

每批至少执行：

```sh
cd frontend/web
npm run typecheck
npm test
cd ../desktop && npm test && npm run smoke:frontend-bundle
cd ../.. && git diff --check
```

外加每批一次浏览器验证：三页在真实浏览器加载无控制台错误、模块图完整、
mock 模式（`?mock=demo`）渲染与迁移前一致。

架构门禁的验收有额外要求：**改完必须证明它仍能抓到违规**——注入一个已知
违规样例，确认报错，再移除。只看「测试通过」不足以说明门禁有效。

## 9. 风险与回退

| 风险 | 应对 |
| --- | --- |
| 架构门禁静默失效 | 每批用注入违规样例的方式验证，见第 8 节 |
| 全局 store 拆解引入状态回归 | 批次 5 单独进行，保持单实例与 action 语义不变 |
| `jobs` / `job-detail` 共享展示模型被拆散 | 先把共享真值下沉到 `@retainpdf/domain`，再搬文件 |
| reader 宿主依赖被 React 污染 | 批次 3 先验证 `domain/` 出口，架构测试禁止 `domain/` import React |
| 大批次 diff 无法 review | 每个功能一个提交；移动与行为修改分开提交 |

回退以批次为单位。已发布的批次优先用反向提交，不重写共享历史。

## 10. 施工中推翻的条目（2026-09-09 补记）

批次 1–5 执行完毕。以下条目在实测后被推翻，实际落地与本文原文不同：

| 原文 | 实际 | 理由 |
|---|---|---|
| §5.4 把 8 个 slice 分发进各自功能 | **删除 6 片，剩余两片塌缩成 `platform/desktop/state.ts`** | 那 6 片是死代码，能力早已在 `features/*` 用 `platform/store` 独立重建；分发只会制造两份平行真值。三层实证（静态 / 语义 / Proxy 探针）见提交 3780b6cc |
| §4.4 `js/features/{app-shell,home}` → `app/home/` | **按归属拆到 `features/job-detail`、`platform/contracts`、`app/home`** | 它们被 features 引用，整体进 `app/` 会造成 `features → app` |
| §4.3 `shared/theme` → `features/settings` | **进 `ui/theme`** | theme 与 decor 互耦，且 `shell-boot.ts` 在任何 composition 之前就调 `bootTheme()`——启动壳不能依赖产品功能 |
| §4.4 `js/desktop` 整体 → `platform/` | **`host.ts` 进 platform，`index.ts` 进 `app/desktop/bootstrap.ts`** | 后者 import features、直接改 DOM、派发事件，是 app 级装配 |
| §4.4 `shared/navigation` → `app/home/` | **进 `platform/navigation/`** | 被 features 8 处引用。同批把本文未提及的 `pages/navigation.ts`（被 3 个 feature 引用）一并并入 |
| §7「tests 下约 189 条」 | web 侧实际约 40 个改写目标 | 原数把 `packages/reader` 的测试路径也算了进来 |
| §7「不需要改 tsconfig」 | 结论正确，但漏列了 Tailwind `@source` 与两份 eslint 配置 | — |

§5.1 的「domain 不得 import React」原文写了但**从未被实现**，批次 5C 的 C3
补上了对应门禁（`tests/architecture/layer-boundaries.test.mjs`），实测 0 违规。

### 施工中查出的四条一直在空转的门禁

这四条都是「测试常绿」但实际什么都没检查，与蓝图 §9 预警的失效模式同类，
且**在批次 5 之前就已经在漏**：

1. `isExternalGate()` 对 `features/*/domain/` 整体豁免——178 / 331 个文件（54%）
   从迁移当天起脱离防回弹门禁
2. `FORBIDDEN_IMPORT_PATTERNS` 的 13 条规则都要求 `from`，**没有一条能匹配裸
   副作用 import** `import "路径"`
3. upload 展示层门禁的 `presentationRoot` 指向批次 4 已删除的目录，永久绿灯
4. `job-stage-contract.test.mjs` 的 `collectSourceFiles` 只收 `.js`——代码库
   早已全量 TS，一直扫 0 个文件

另有 Tailwind 的 30 条 `@source` 里 16 条指向已删除目录（含 `src/features/`
从未被列入），靠 v4 自动来源探测兜住才没出事。

## 11. 关联文档

- [前端迁移计划与审计](./README.md)
- [遗留树可达性审计](./legacy-audit.md)
- [Rust API 业务目录与边界统一迁移计划](../api-boundary-migration.md)（同类工作的体例参考）
- [前端主线文档](../../../core/frontend/README.md)

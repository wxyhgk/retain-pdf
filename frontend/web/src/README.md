# `frontend/web/src` 目录说明

生产 Web 前端源码根。三页 MPA 共享本目录，构建产物见 `../scripts/build-js-bundle.mjs`（JS）与
`../scripts/build-css.mjs`（CSS）。完整地图与门禁清单见 [`FEATURES.md`](FEATURES.md)；
样式归属见 [`styles/README.md`](styles/README.md)；测试规矩见 `../tests/README.md`。

## 四层结构与依赖方向

```text
app  ──►  features  ──►  platform
             │              ▲
             └──► ui ───────┘
```

- `app` 可引用任何一层；`features` 不得引用 `app`（主页 DI 容器是唯一显式例外）；
  `ui` 只能引用 `ui`、`platform`；`platform` 只引用 `platform`。
- 跨功能引用只能落在对方的 `index.ts` 或 `domain.ts` 出口，不得深入内部。
- `tests/architecture/layer-boundaries.test.mjs` 把守以上全部。

## `app/` —— 装配层：三页入口、依赖接线、页面外壳

| 目录 | 说明 |
|---|---|
| `home/` | 主页：`entry.tsx`（`dist/app.bundle.js` 入口）、`HomeApp.tsx`（四 Tab + 弹窗装配）、`create-home-composition.ts`（13 工厂顺序接线）、`composition/`（各域装配）、`shell/`（顶栏/底栏）、`state/`（轻状态）、`home-services-context.ts`（DI 容器） |
| `detail/` | 详情页：`entry.tsx` + 整页编排（`detail.html`，命令式孤岛较多） |
| `reader/` | 阅读器宿主：入口 + 向 `@retainpdf/reader` 包注入 API/凭据/下载/AI 能力 |
| `bootstrap/` | 给 `@retainpdf/domain` 注入运行时端口 |
| `desktop/` | 桌面首启流程 |
| `shell-boot.ts` | 三页共享启动壳（adapters → 主题 → 找根挂载，不开 StrictMode） |

## `features/` —— 15 个产品功能

`library`（书架）、`book-detail`（书详情弹窗）、`ingest`（添加 PDF）、`jobs`（任务状态）、
`job-detail`（状态详情：弹窗 + 整页双实现，见该目录注释）、`reader`（阅读器导航）、
`credentials`（凭据）、`glossaries`（术语表）、`collections`（合集）、
`artifacts`（产物下载）、`task-center`（任务中心）、
`settings`（设置：接口/术语表/外观/更新）、`app-update`（应用更新）。

每个功能固定结构：`index.ts` 唯一出口 + `ui/`（React 组件）+ `domain/`（纯逻辑，**禁 React**，
供非 React 宿主复用）。`domain.ts`（如有）是非 React 调用方的窄口。

## `platform/` —— 跨功能基础设施

| 目录 | 说明 |
|---|---|
| `api/` | `index.ts` 是唯一 API 网关（`mockable()` 做 mock/真实两路分发）；`legacy/` 是旧手写客户端，现充当 mock 侧实现。业务不得直连 `legacy/` |
| `config/` | 运行时配置、常量、持久化 |
| `contracts/` | 应用事件、下载动作、视图等跨功能契约 |
| `store/` | store 框架、通用对话框 store、资源封装 |
| `mock/` | mock 数据与夹具 |
| `desktop/` | 桌面 IPC 端口与桌面配置状态 |
| `navigation/` | 三页 URL 契约（`tab/job_id/page_idx/block_id`）、软跳转、返回态 |
| `utils/`、`runtime/`、`generated/` | 纯工具函数、vendor URL 解析、构建生成物 |

## `ui/` —— 共享 UI 组件与 React 原语

`components/`（shadcn 生成物；`dialog.tsx` 普通弹窗、`confirm-dialog.tsx` 危险确认是全站唯二弹窗壳）、
`Button.tsx`、`lib/utils.ts`、`hooks/`、`icons/`、`theme/`（主题注册）、`decor/`（皮肤槽位）、
`download-toast/`。弹窗外层样式真值在 `styles/dialog-shell.css`；`Button.tsx` 与
`components/button.tsx` 必须保持两级（macOS 大小写不敏感）。

## 配套目录

| 目录 | 说明 |
|---|---|
| `types/` | 全局 ambient 声明（如 `<library-search-island>` 自定义元素） |
| `styles/` | 三页 CSS：`entries/{home,detail,reader}.css`（reader 仅代理包样式）、`core/` 跨页基础、`pages/home|detail/` 领域样式、tokens/base/dialog-shell 共享契约 |
| `assets/` | 图片、动画、服务商图标、logo |
| `input.css` | Tailwind 旧入口残留，现构建走各 `entries/*.css` |
| `FEATURES.md` | 本目录地图与门禁清单（真值） |

# `frontend/web/src` 结构与依赖边界

本文说明 `src/` 的四层结构、每层的职责、层与层之间允许的依赖方向，
以及这些规则由哪些门禁把守。

## 总览

```text
frontend/web/src/
├── app/          # 装配层：三页入口、依赖接线、页面外壳
│   ├── home/     #   HomeApp、composition（9 个 create-*.ts 工厂）、shell、state
│   ├── detail/   #   detail.html 的入口与页面壳
│   ├── reader/   #   reader.html 入口 + @retainpdf/reader 的宿主注入面
│   ├── bootstrap/#   给 @retainpdf/domain 注入运行时端口
│   ├── desktop/  #   桌面首启流程
│   └── shell-boot.ts  # 三页共享启动壳（adapters → bootTheme → 挂载）
├── features/     # 15 个产品功能，每个 = 用户能指着界面说出的一件事
├── platform/     # 跨功能基础设施，不知道任何产品功能的存在
├── ui/           # 共享 UI 组件与 React 原语，同样不知道产品功能
├── types/        # ambient 全局声明
├── styles/       # 三页 CSS 入口与主题
└── assets/       # 图片、动画
```

## 依赖方向

```
app  ──►  features  ──►  platform
             │              ▲
             └──► ui ───────┘
```

- `app` 可以引用任何一层
- `features` 可以引用 `features`（只经对方出口）、`ui`、`platform`；**不得引用 `app`**
- `ui` 只能引用 `ui`、`platform`
- `platform` 只能引用 `platform`

由 `tests/architecture/layer-boundaries.test.mjs` 把守。

**唯一例外**：15 个 features 文件经 `@/app/home/home-services-context.js` 消费
主页装配出来的 DI 容器。它要的是 `HomeApp` 装配出来的**实例**，而
`HomeServices` 类型引用了每一个功能的类型，下沉到 platform 会造成
`platform → features`，比现状更糟。正确终局是按域拆窄 Context（代码里已有
`useHomeDialogStore` / `useHomeStatusAreaStore` / `useHomeWorkflowDialog` /
`useHomeSettingsHub` 四个先例）。在那之前用只减不增的清单把这条遗留倒置显性化，
见 `architecture-boundaries.test.mjs` 的「features 引用 app 层仅限主页 DI 容器」。

## `features/` —— 一个功能 = 一个目录

15 个目录，对应界面上 15 件事：

| 目录 | 用户看到的 |
|---|---|
| `library` | 书架：书卡、封面、筛选、批量、搜索 |
| `book-detail` | 点开一本书的详情弹窗（翻译/OCR/产物/合集/元数据五个 Tab） |
| `ingest` | 添加 PDF：上传、翻译/OCR 选项、页码范围、提交 |
| `jobs` | 任务运行中的状态卡、阶段流、进度动画、取消/重试 |
| `job-detail` | 状态详情弹窗 + `detail.html` 整页 |
| `reader` | 阅读器宿主接线（实现在 `@retainpdf/reader` 包，不在此） |
| `ask` | 主页 AI 问答 |
| `credentials` | 凭据配置与校验 |
| `glossaries` | 术语表 |
| `collections` | 合集 |
| `favorites` | 收藏 |
| `artifacts` | 受保护产物下载 |
| `task-center` | 任务中心 |
| `settings` | 设置外壳、主题外观、开发者选项 |
| `app-update` | 应用更新 |

每个功能内部固定两层，`index.ts` 是唯一出口：

```text
features/<功能>/
├── index.ts      # 唯一出口。跨功能只能从这里（或 domain.ts）取
├── domain.ts     # 可选：纯逻辑窄口，给非 React 调用方（如阅读器包）
├── ui/           # React 组件与 hooks
└── domain/       # 纯逻辑，**不得 import React**
```

`domain/` 禁 React 是硬规则：阅读器包是非 React 宿主，要复用同一份领域逻辑。
由 `layer-boundaries.test.mjs` 把守。

跨功能引用只能落在对方的 `index.js` 或 `domain.js`，不得深入内部——
同样有门禁。

## `platform/` —— 跨功能基础设施

| 子目录 | 内容 |
|---|---|
| `api/` | `index.ts` 是唯一 API 网关（58 处 `mockable()` 做 mock/真实两路分发）；`legacy/` 是 `@retainpdf/api` 出现前的手写客户端，现主要充当 mock 侧实现 |
| `config/` | 运行时配置、常量、持久化 |
| `contracts/` | 应用事件、下载动作、主页视图、书架载荷等跨功能契约 |
| `store/` | store 框架与通用对话框 store |
| `mock/` | mock 夹具 |
| `desktop/` | 桌面 IPC 端口与桌面/开发者配置状态 |
| `navigation/` | 三页 URL 契约、软跳转、返回态 |
| `utils/` `runtime/` `generated/` | 纯工具、vendor URL 解析、构建产物 |

**`features/` 不得直连 `platform/api/legacy/`**，必须经 `api/index.ts`——
直连会让 mock 模式静默走真网络。

## `ui/` —— 共享 UI

`components/`（shadcn 生成物）、`Button.tsx`、`lib/utils.ts`、`hooks/`、
`icons/`、`theme/`、`decor/`、`download-toast/`。

`components.json` 的别名指向 `@/ui` 系列，`npx shadcn add` 会生成到
`ui/components/`。

⚠️ `ui/Button.tsx` 与 `ui/components/button.tsx` **必须保持两级**——
macOS 文件系统大小写不敏感，压平会冲突。

## 门禁清单

| 文件 | 把守什么 |
|---|---|
| `tests/architecture/layer-boundaries.test.mjs` | 四层方向、跨功能只经出口、domain 禁 React、Tailwind `@source` 目录存在 |
| `tests/architecture/architecture-boundaries.test.mjs` | 防回弹（不得 import 已删除的旧世界）、DI 容器消费方清单、旧目录不得复活、共享 dialog 边界 |
| `tests/architecture/page-dom-references.test.mjs` | 三页的 DOM id/class 引用必须有归属，防运行时静默失效 |
| `tests/architecture/tsx-color-literals.test.mjs` | 主题盲颜色只减不增 |
| `tests/architecture/shell-smoke.test.mjs` | 三页挂载顺序与入口链路 |

改动这些门禁时，**必须注入一个已知违规确认它仍能报错，再移除**。
只看「测试通过」不足以说明门禁有效——批次 5 查出四条一直在空转的门禁，
都是「测试常绿」但实际扫 0 个文件或整片豁免。

## 历史

`src/` 曾长期是 `js/`（命令式领域层）+ `pages/`（React 视图层）的双树结构，
加上 `shared/` `components/` `lib/` 三个共享目录。2026-09 的批次 1–5 把它
重组为现在的四层，迁移记录见
`docs/ops/planning/frontend-migration/feature-layout-blueprint.md`。

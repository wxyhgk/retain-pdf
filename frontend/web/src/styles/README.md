# `frontend/web` CSS 架构

三页分别加载独立 CSS，不再共用一份全站样式包：

| HTML | Web 入口 | 样式真值 | 产物 |
|------|----------|----------|------|
| `index.html` | `entries/home.css` | `frontend/web/src/styles/**` | `dist/css/home.css` |
| `detail.html` | `entries/detail.css` | `frontend/web/src/styles/**` | `dist/css/detail.css` |
| `reader.html` | `entries/reader.css` | `frontend/packages/reader/styles/entry.css` | `dist/css/reader.css` |

`styles.css` 是 `home.css` 的兼容副本；HTML 已直接引用 `dist/css/*`。

当前构建不包含 `reader-legacy.css`，Reader 也不再支持 `?engine=legacy`。仓库中若仍存在旧的 `dist/css/reader-legacy.css`，它只是历史产物，不是 `build:css` 的输出或运行时依赖。

## 目录

```text
frontend/web/src/styles/
├── entries/
│   ├── home.css          # 主页入口
│   ├── detail.css        # 详情页入口
│   └── reader.css        # 指向 frontend/packages/reader/styles/entry.css 的薄代理
├── core/                 # Web 跨页基础样式
├── pages/home/           # 主页领域样式
├── pages/detail/         # 详情页领域样式
├── tokens.css / base.css / shadcn-theme.css
├── components*.css / dialog-shell.css
```

Reader 样式只改 `frontend/packages/reader/styles/*`。`src/styles/reader/` 旧镜像已于 2026-09-10 删除
（零引用、构建产物一致；命名空间门禁已跟随真值，`*-legacy.css` 与壳归一化 `base.css` 除外）。

### 书籍详情样式边界

书籍详情不再由单个 `book-detail.css` 承担全部职责，主页入口按下面的稳定顺序装配：

| 文件 | 负责范围 |
|------|----------|
| `features/book-detail/ui/` 下 5 个外壳文件 | 弹窗双栏、封面区、快速下载、右栏 Tabs、滚动条与窄屏适配（`BookDetailShell` → `ArtifactQuickDownloads` → `BookDetailLeftReading` → `BookDetailRightTabs` → `BookDetailShellResponsive`，全是普通规则，顺序不能换） |
| `features/book-detail/ui/tabs/overview/` | 概览：layout → info → activity → danger → responsive（普通规则，顺序不能换） |
| `book-detail-processing/` | 「进度」分区，按组件一个文件（见下表） |
| `book-detail-artifacts.css` | 文件分组、产物卡片、预览和下载动作 |

跨 Tab 的结构规则只放入外壳文件；业务卡片只能修改自己的文件，避免重新形成相互覆盖的巨型样式表。

`book-detail-processing/` 内部同样按组件拆分，`entries/home.css` 按下表顺序逐个引入：

| 文件 | 负责范围 |
|------|----------|
| `layout.css` | 分区根布局；**共享变量**（卡片底色 / 圆角、墨色深浅色阶）与小节标题。必须最先引入 |
| `processing-card.css` | 「处理」卡片：标题、总状态、总进度条、细化区 |
| `pipeline-rail.css` | OCR / 翻译 / 渲染 / 完成 流水线轨道 |
| `editorial-flow.css` | 编辑部精修流程图（第几轮、这一步第几批） |
| `ocr-range.css` | OCR 指定页码 |
| `translation-controls.css` | 翻译段的摘要、动作行、提示、阶段动作、状态卡容器 |
| `live-translation-entry.css` | 「实时译文」入口 |
| `job-status-card.css` | 内嵌任务状态卡（`bd-job-status-*`） |
| `failure-card.css` | 失败诊断卡片 |
| `coverage.css` | 翻译覆盖条 |
| `job-history.css` | 任务记录 |

卡片之间共享的值只在 `layout.css` 里定义成变量，其它文件引用变量，不复制数值、不借用别的组件的类名。响应式规则跟着组件走，放在各自文件末尾。

## 组件样式放在组件旁边

新写或迁移的组件样式放在组件文件旁边，同名：`TranslationCoveragePanel.tsx` 旁边是
`TranslationCoveragePanel.css`。类名不改（仍是全局类名 + 组件前缀），`entries/*.css` 逐个
`@import` 这些文件、显式写明顺序 —— Tailwind CLI 能解析任意相对路径，构建不用改。

文件开头声明归属：

```css
/* @owns translation-coverage
 * @uses status-stage-flow        ← 可选：确实要引用的别的组件的类 */
```

文件里的选择器只能用 `@owns` 的前缀、`is-` / `has-` 状态类和 `@uses` 登记的类。
跨组件共享的值（底色、圆角、色阶）定义成 CSS 变量放在共享层，组件引用变量、不复制数值。

门禁（`tests/architecture/css-module-boundaries.test.mjs`）：

- 单个样式文件 ≤ 400 行。超标清单 `helpers/css-oversize-allowlist.json` 已清空（2026-10 迁移完成），
  只减不增 —— 不要往里加，文件变大就按组件拆；
- 组件旁样式的 `@owns` / `@uses` 约束。

拆分或搬家时用 `npm run css:equivalence -- snapshot <基准.json>`（改前）和 `compare`（改后）核对
home / detail / reader 三份编译结果：
规则、声明、顺序都相同才算纯搬家；顺序变了会列出「先后调换且设置同一属性」的规则对 ——
它们若命中同一元素界面就会变。拆分时尽量保持规则原来的先后顺序。

拆分时踩过的坑：

- `@utility` 的输出顺序由 Tailwind 决定，跟它在哪个文件、第几行无关，可以随意归属；
  普通规则、`@media`、`@layer` 块按源码先后输出，只能按连续行段切，并按原顺序引入；
- 同名 `@utility`（比如 `hidden`）不要拆成两个文件里的两段 —— 输出顺序会变；
- 跨行的选择器列表（`a,\nb {`）以第一行为起点，切口落在中间会少一条规则。

## 归属规则

1. 页面专属样式只进入对应 entry：
   - 主页：书架、上传、工作流、状态、凭据、合集与设置；
   - 详情：详情壳、事件、产物和模态框；
   - Reader：由 `frontend/packages/reader/styles/entry.css` 统一装配。
2. Web 跨页基础能力放在 `core/`、tokens/base、通用 components 或 `dialog-shell.css`。
3. 不要把全站 import 重新塞回 `src/input.css` 或兼容 `styles.css`。
4. 新样式先判断页面/包归属，再确认它被正确 entry 引入。
5. 页面选择器与 import 边界由 `tests/architecture/css-page-namespace.test.mjs` 等门禁检查。
6. 弹窗与非模态浮层的外层样式只写在 `dialog-shell.css` 的 `app-dialog-*`、`app-confirm-*`、`app-floating-*` 契约中；页面文件只能覆盖业务内容布局，不得另造遮罩、纸面、圆角、关闭按钮或层级。

## 构建

```bash
npm --prefix frontend/web run build:css
# → dist/css/home.css
# → dist/css/detail.css
# → dist/css/reader.css

npm --prefix frontend/web run watch:css
```

`scripts/stamp-cache-version.mjs` 会给 HTML 中引用的三份 CSS 添加内容哈希查询参数。Reader 的代理链为：

```text
frontend/web/src/styles/entries/reader.css
  → frontend/packages/reader/styles/entry.css
  → frontend/packages/reader/styles/*.css
```

## 共享符号位置

| 符号 | 真值位置 |
|------|----------|
| `app-dialog-{overlay,content,shell,header,body,footer,close}` | `dialog-shell.css` |
| `app-confirm-*` / `app-floating-{surface,close}` | `dialog-shell.css` |
| `button-link` / `label` / `mono` | `components.utilities.css` |
| status-card / app-button / inline-error | `pages/home/components.utilities.css` |
| Web 下载 toast | `core/download-toast.css` |
| Reader UI 与主题 | `frontend/packages/reader/styles/*` |

## 相关

- `scripts/build-css.mjs`
- `scripts/stamp-cache-version.mjs`
- `frontend/packages/reader/styles/README.md`
- `src/FEATURES.md`
- `frontend/web/README.md`

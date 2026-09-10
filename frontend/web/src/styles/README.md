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
└── reader/               # 迁移后保留的旧镜像，不是当前 Reader 构建真值
```

Reader 样式请修改 `frontend/packages/reader/styles/*`。不要继续双写 `frontend/web/src/styles/reader/*`；该旧镜像应在独立清理和视觉验证后删除。

### 书籍详情样式边界

书籍详情不再由单个 `book-detail.css` 承担全部职责，主页入口按下面的稳定顺序装配：

| 文件 | 负责范围 |
|------|----------|
| `book-detail-shell.css` | 弹窗双栏、封面区、顶部 Tabs 与滚动容器 |
| `book-detail-overview.css` | 概览主视觉、元信息、阅读与活动 |
| `book-detail-processing.css` | OCR、翻译、阶段进度与内嵌任务状态 |
| `book-detail-artifacts.css` | 文件分组、产物卡片、预览和下载动作 |

跨 Tab 的结构规则只放入 shell；业务卡片只能修改自己的文件，避免重新形成相互覆盖的巨型样式表。

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

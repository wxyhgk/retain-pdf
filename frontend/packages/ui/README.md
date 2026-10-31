# @retainpdf/ui

RetainPDF 前端的基础组件，只有这一份（`frontend/web`、`frontend/packages/reader` 共用）。为什么这样收、
迁移分几步，见 [基础组件与刻度](../../../docs/ops/planning/frontend-migration/20261031-基础组件与刻度.md)。

## 用法

一律从包的根引，不引 `src`，也不引包里的子路径（门禁 `ui-primitives-ratchet` 管着）：

```tsx
import { Button, Field, Input, Menu, Panel } from "@retainpdf/ui";
```

样式由页面的 CSS 入口引一次（`frontend/web/src/styles/entries/*.css` 已经引了）：

```css
@import "@retainpdf/ui/primitives.css";
```

## 组件

| 组件 | 用在哪 | 要点 |
|---|---|---|
| `Button` | 带字的按钮 | `variant`：`primary` / `secondary` / `ghost` / `danger`；`size`：`sm` / `md` / `lg`；`pending` 转圈并禁用；默认 `type="button"`。**不给 `variant` 时原样渲染**，样子由调用方的类名决定（迁移期给还没迁的地方用） |
| `IconButton` | 只有图标的按钮 | `label` 必填，变成 `aria-label` 和悬停提示；默认 `ghost` |
| `Field` | 带标题的输入 | 包住一个控件，自动接好 `id`、`aria-describedby`、`aria-invalid` |
| `Input` / `Textarea` | 输入框 | `size`：`sm` / `md` |
| `Select` | 原生下拉加箭头 | `className` 给外层，其余属性落在 `<select>` 上 |
| `Badge` | 状态小标签 | `tone`：`muted` / `active` / `done` / `warn` / `danger`；「完成」是墨色，不用绿色 |
| `Menu` | 点开的选项列表 | radix DropdownMenu：键盘上下选、Esc 关、焦点回到按钮；`items` 里 `danger` 用红字 |
| `Panel` | 一块卡片 | `title`、`description`、`actions` 三个槽，`titleAs` 定标题级别 |
| `Sheet` | 从一边滑出的抽屉 | `side`：`left` / `right`；焦点关在里面，Esc 和点外面关 |
| `Dialog`、`ConfirmDialog` | 居中的弹窗 | 从 `web/src/ui/components` 搬来，原样；外壳样式在 web 的 `dialog-shell.css` |
| `FormStatusLine` | 表单下面一行状态 | |
| `Toaster`、`Tooltip` | 提示 | |
| `LegacyButton`、`legacyButtonVariants` | **已废弃** | shadcn 默认样子的旧按钮，只给还没迁的地方用，门禁只许它的用量减少 |

## 样式和刻度

- 每个组件一个 CSS 文件（`styles/`），变体用 `data-variant` / `data-size` / `data-tone` 区分，选择器都挂在
  `.ui-*` 类上（旧按钮也写 `data-variant`，不能用裸属性选择器）。
- 颜色只用皮肤变量（`--ink`、`--line`、`--accent`、`--danger`…），按钮主色和圆角用 `--btn-primary-bg/fg`、
  `--btn-radius`，皮肤能换按钮气质。
- 刻度在 `styles/scale.css`：字号 `--ui-text-2xs` … `--ui-text-xl`（10、11、12、13、14、16、20px），
  圆角 `--ui-radius-sm` / `-md` / `-lg` / `-pill`（6、10、14、999px）。名字带 `ui-` 前缀，因为
  `--text-*`、`--radius-*` 是 Tailwind 自己的主题变量。
- 组件样式在 Tailwind 的 `components` 层：同一元素上的 Tailwind 排版类、功能自己的 CSS 都能盖过它。
- `dist/styles.css` 是 shadcn 那几个组件用的 Tailwind 工具类，给不用 web 构建的宿主；web 自己扫描包的源码生成。

## 开发

```sh
npm --prefix frontend/packages/ui run typecheck
npm --prefix frontend/packages/ui run build
```

web 的 `npm run build` 会先构建这个包（`dist/` 提交进仓库）。测试在 `frontend/web/tests/shared/ui-primitives.test.mjs`。

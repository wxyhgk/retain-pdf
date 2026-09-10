# RetainPDF 主题皮肤系统（设计稿）

**状态：** 设计 + 基础设施已落地；「江南院落」皮肤可切换试用  
**日期：** 2026-07-21  
**目标：** 先有一套**可扩展的皮肤架构**，再逐步把硬编码色替换为语义 token。

---

## 1. 为什么要「系统」而不是直接改色

当前问题：

1. 颜色真值在 `tokens.css`，但大量页面仍写死 `#1d1d1f` / `#f5f5f7` 等。
2. 只有单一 `:root`，无法并存「黑白克制」与「江南院落」两套气质。
3. shadcn 变量（`--primary` 等）已映射到项目 token——**换肤只需换底层 token**，组件层可不动。

原则：

> **组件只认语义名（`--bg` / `--accent` / `--danger`…），皮肤只负责给语义名赋值。**

---

## 2. 语义色板（皮肤无关，名字稳定）

| Token | 角色 | 产品语义 |
|-------|------|----------|
| `--bg` | 应用背景 | 院落 / 灰砖地面 |
| `--paper` | 卡片 / 纸面 | 宣纸、浮起表面 |
| `--surface` | 半透明玻璃面 | 顶栏、底栏毛玻璃 |
| `--ink` | 主文字 / 强对比 | 墨色 |
| `--muted` | 次要文字 | 淡墨 |
| `--line` | 描边 / 分割 | 砖缝、淡线 |
| `--accent` | 主按钮 / 链接 / 焦点 | **铜绿 / 梁枋青绿** |
| `--accent-weak` | 选中弱底 | 浅青绿晕 |
| `--selection` | 当前页、选中文档 | 青绿彩画浅底（新增） |
| `--danger` | 错误 / 破坏操作 / 批注强调 | 朱砂 |
| `--danger-weak` | 错误弱底 | 朱砂薄晕 |
| `--ok` | 成功 | 可保留功能绿或偏青苔 |
| `--warn` | 警告 | 琥珀 |
| `--gold` | 高级模型 / 重要状态 | 鎏金（新增） |
| `--chrome` | 顶栏深色 / 深色模式底 | 黛瓦墨黑（新增） |
| `--reader-page` | PDF 页背景 | 宣纸米白（新增，阅读器） |

shadcn 层继续：

- `--background` ← `--bg`
- `--foreground` ← `--ink`
- `--primary` ← `--accent`
- `--destructive` ← `--danger`
- …（见 `shadcn-theme.css`）

**禁止**皮肤直接改 shadcn 名；只改项目语义 token。

---

## 3. 皮肤清单

内置皮肤（注册表 `THEME_REGISTRY`，设置 → 外观 按组展示）：

| id | 分组 | 说明 |
|----|------|------|
| `classic` | light | 默认黑白灰 |
| `jiangnan` | accent | 青砖 · 宣纸 · 铜绿 · 朱砂 |
| `seacliff` | accent | 海岬雾蓝 · 海石青 |
| `night` | dark | 黛瓦夜色（`html.theme-dark`） |

新增皮肤只需 3 步，见 **[ADDING_A_THEME.md](./ADDING_A_THEME.md)**。

江南色板细节：`skins/jiangnan.md`。

---

## 4. 运行机制

### 4.1 挂载点

```html
<html data-theme="jiangnan">  <!-- 或 classic -->
```

CSS：

```css
:root,
[data-theme="classic"] { /* classic 值 */ }

[data-theme="jiangnan"] { /* 覆盖语义 token */ }
```

### 4.2 持久化

- Key：`localStorage["retainpdf.theme"]` = `"classic" | "jiangnan" | ...`
- 启动：尽早读 storage 写到 `<html data-theme>`，避免 FOUC  
  - 脚本：`frontend/web/src/shared/theme/boot-theme.js`（各 HTML 可内联或入口首行 import）

### 4.3 切换 API（代码）

```ts
import { getTheme, setTheme, listThemes } from "./shared/theme/theme";

setTheme("jiangnan"); // 写 storage + document.documentElement.dataset.theme
```

设置页后续加「外观」一行即可接上，不必改业务组件。

---

## 5. 文件布局

```
docs/core/frontend/web/theme-system/
  THEME_SYSTEM.md          ← 本文
  skins/
    jiangnan.md            ← 江南色板说明（设计向）

frontend/web/src/styles/
  tokens.css               ← 语义契约 + 默认引入 classic
  themes/
    classic.css            ← 当前默认肤色
    jiangnan.css           ← 江南院落
  shadcn-theme.css         ← 仍映射语义 token（皮肤无关）

frontend/web/src/shared/theme/
  theme.ts                 ← get/set/list + storage
  boot-theme.ts            ← 同步写 data-theme（防闪）
```

---

## 6. 落地阶段（建议）

| 阶段 | 内容 | 风险 |
|------|------|------|
| **S0** ✅ | 语义 token 分层 + classic / jiangnan 两套 CSS + setTheme API | 低 |
| **S1** ✅ | 设置「外观」tab + 主题卡片；三页 entry `bootTheme()` | 低 |
| **S2** ✅ | 批量清中性硬编码 → token；选中态走 `--accent` | 中 |
| **S3** ✅ | 注册表多皮肤架构；`night`/`seacliff`；外观分组 UI | 中 |
| **S4** | 继续清剩余 hex；业务选中态统一 `--selection` | 中 |
| **S5** | 图标/动效随主题；社区/导入自定义皮肤（可选） | 高 |

**不要**在 S0 大改组件视觉；默认仍 classic，江南皮肤靠 `data-theme` 试用。

---

## 7. 试用江南皮肤（开发）

浏览器控制台：

```js
localStorage.setItem("retainpdf.theme", "jiangnan");
document.documentElement.dataset.theme = "jiangnan";
```

或：

```js
// 若已接入 shared/theme
import { setTheme } from "/…"; // 打包后用设置页
```

恢复默认：

```js
localStorage.setItem("retainpdf.theme", "classic");
document.documentElement.dataset.theme = "classic";
// 或 removeItem + removeAttribute
```

---

## 8. 与图标系统的关系

- 图标保持 **单色 currentColor**，换肤只改 token，图标自动跟 `--ink` / `--accent`。
- 朱砂批注、鎏金状态：用 `--danger` / `--gold` 给 badge 上色，不要把色画死在 SVG 里。

---

## 9. 决策记录

| 决策 | 选择 | 原因 |
|------|------|------|
| 切换方式 | `data-theme` 属性 | 不依赖 React 也能首屏生效；CSS 纯选择器 |
| 默认皮肤 | classic | 不破坏现有观感与测试截图 |
| 品牌主色 | `--accent` 可随皮肤变绿 | 主按钮/焦点统一走 accent |
| 危险色 | 各皮肤可微调，语义仍是 danger | 删除/失败保持可识别 |
| 硬编码清理 | 分期 | 一次全换 diff 过大 |

---

## 10. 一句话

**皮肤 = 给同一套语义 CSS 变量换色；应用 = 只写语义变量。**  
江南院落是第一套「有故事」的皮肤；classic 保底。

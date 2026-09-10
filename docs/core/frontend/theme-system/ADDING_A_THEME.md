# 如何新增一套主题皮肤

目标：后期加大量主题时，**只动 3 处**，不动业务组件。

---

## 步骤（约 10 分钟）

### 1. 写 CSS 皮肤文件

复制模板：

```bash
cp frontend/web/src/styles/themes/classic.css \
   frontend/web/src/styles/themes/<id>.css
```

编辑为：

```css
/* 皮肤 <id>：一句话说明 */
[data-theme="<id>"] {
  --bg: …;
  --paper: …;
  --surface: …;
  --ink: …;
  --muted: …;
  --line: …;

  --accent: …;
  --accent-weak: …;
  --selection: …;

  --danger: …;
  --danger-weak: …;
  --ok: …;
  --ok-weak: …;
  --warn: …;
  --warn-weak: …;

  --gold: …;
  --gold-weak: …;
  --chrome: …;
  --reader-page: …;
}
```

**必选变量**见 `frontend/web/src/styles/themes/_contract.css`。

注意：

- 主按钮文字用 `var(--paper)` 叠在 `var(--accent)` 上，请保证对比度。
- 深色皮肤：`group: "dark"`，`--ink` 应是浅色字，`--bg` 深底。

### 2. 挂进构建

`frontend/web/src/styles/themes/index.css` 增加一行：

```css
@import "./<id>.css";
```

### 3. 登记注册表

`frontend/web/src/shared/theme/registry.ts` 的 `THEME_REGISTRY` 数组追加：

```ts
{
  id: "<id>",
  label: "显示名",
  description: "一句话",
  group: "light" | "dark" | "accent",
  order: 50, // 排序
  preview: {
    bg: "#……",
    paper: "#……",
    accent: "#……",
    ink: "#……",
    danger: "#……",
  },
},
```

`preview` 只用于设置页色块，**请与 CSS 主色一致**。

### 4. 构建

```bash
cd frontend/web && npm run build:css && npm run build:js
```

### 5. 验证

```js
localStorage.setItem("retainpdf.theme", "<id>");
location.reload();
// 或 设置 → 外观 点选
```

---

## 禁止事项

| 不要 | 原因 |
|------|------|
| 在组件里写 `if (theme === 'xxx')` 换色 | 应走 CSS 变量 |
| 在业务 CSS 写死 `#1d1d1f` | 用 `var(--ink)` |
| 改 shadcn 变量名 | 只改底层 `--accent` 等 |
| 忘记 index.css import | 皮肤不会进 dist |

---

## 可选增强

- 设计说明：`docs/core/frontend/web/theme-system/skins/<id>.md`
- 监听换肤：`window.addEventListener('retainpdf:theme-change', …)`
- 深色特例：`html.theme-dark` 或 `[data-theme-group="dark"]`

---

## 检查清单

- [ ] `themes/<id>.css` 含全部必选 token  
- [ ] `themes/index.css` 已 import  
- [ ] `registry.ts` 已登记且 preview 对齐  
- [ ] 主按钮 / 选中 tab 在该皮肤下可读  
- [ ] `npm run build:css` 通过  

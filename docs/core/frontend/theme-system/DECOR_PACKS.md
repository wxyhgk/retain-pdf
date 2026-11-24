# 装饰包（Decor Packs）契约

> 状态：契约 + 图片版舞台已落地（three 引擎未实现，model 层暂走 fallback 图）。
> 代码真值：`frontend/web/src/ui/decor/{slots,contract,stage-plan}.ts` · `DecorStage.tsx`
> slot 定位：`frontend/web/src/styles/core/decor-stage.css` · 示范包：`frontend/web/decor/jiangnan/`
> 测试：`frontend/web/tests/decor-contract.test.mjs` · `tests/decor-stage.test.mjs`

## 是什么

现有主题体系（`data-theme` + 语义 CSS 变量）只管**配色**。装饰包在其上叠加一层
**可选的视觉世界**：全幅背景插画、分层道具、可点击播动画的 3D 模型、题字横幅——
即概念稿里的"国风/园林/草原"主题。

```
装饰主题 = 配色皮肤 (themes/<id>.css)  ← 既有体系，不动
         + 装饰包   (decor/<pack>/manifest.json + 资产)
```

`registry.ts` 的 `ThemeDefinition.decorPack` 指向包名。**没有 decorPack 的皮肤
（classic / night）零装饰、零额外下载**——three.js chunk 只在装饰包含 model 层时
动态 import。

## 第一原则：功能 UI 永远是 DOM

书库网格、顶栏、搜索、按钮全部保持 React/DOM。装饰层只能挂在**具名锚点（slot）**
上，分三个层级带：

```
z-index 低 → 高
  bg   全幅背景插画          （永远被 UI 面板盖住）
  ---- 功能 UI 背板（半透明 --surface）----
  mid  中景道具：人物/铜鼎/马 （可被 UI 面板局部遮挡）
  ---- 功能 UI 内容 ----
  fg   前景压边：花枝/流苏    （压在 UI 边缘上，pointer-events: none）
```

## 锚点地图（slots.ts 真值）

```
┌─────────────────────────────────────────────┐
│ left-top      top-center        right-top   │
│                  hero              quote    │
│ e┌─────────────────────────────────────┐e   │
│ d│                                     │d   │
│ g│         功能 UI（书库面板）          │g   │
│ e│                                     │e   │
│ -│                                     │-   │
│ l└─────────────────────────────────────┘r   │
│ left-bottom                   right-bottom  │
│              （right-bottom-fg：右下前景位）  │
│              backdrop（全幅）                │
└─────────────────────────────────────────────┘
```

- slot 在哪、多大、什么 z-index：**舞台 CSS 统一实现**（待建 DecorStage），
  manifest 只声明"资产挂哪个 slot"。资产侧与布局侧解耦。
- 一个 slot 只挂一层。要堆叠 → slots.ts 开新锚点，不在 manifest 里叠罗汉。
- 新增锚点 = slots.ts 登记一条 + 舞台 CSS 补一条定位，校验自动放行。

## manifest 示例

```jsonc
// decor/guofeng/manifest.json
{
  "version": 1,
  "id": "guofeng",
  "layers": [
    { "type": "image", "slot": "backdrop",    "src": "bg.webp", "parallax": 0.05 },
    { "type": "image", "slot": "left-bottom", "src": "dragon.webp" },
    { "type": "model", "slot": "left-top",    "src": "girl.glb",
      "fallback": "girl.webp", "idleClip": "Breathe", "clickClip": "TurnPage" }
  ],
  "quote": { "slot": "quote", "text": "知其所来\n明其所往" }
}
```

## 装饰位（ornaments）

锚点（slots）是整页舞台上的位置；**装饰位**是挂在具体组件上的小图——书库标题旁的印章、弹窗角花、底栏按钮贴面、
顶栏页签贴面、阅读器顶栏两端等。任何主题的装饰包都能挂，不用改组件、不用写点名主题 id 的 CSS。
真值：白名单 `web/src/ui/decor/ornaments.ts`，校验 `ornament-contract.ts`，注入 `ornament-plan.ts` / `ornament-runtime.ts`，
显示规则 `packages/ui/styles/ornaments.css`。

### manifest 写法

```jsonc
{
  "version": 1,
  "id": "mojia",
  "layers": [ /* 舞台层；只想挂装饰位、不要舞台时可以写 [] */ ],
  "ornaments": {
    "bottom-add":      { "src": "gear-btn.webp",  "hideIcon": true, "hover": "rotate" },
    "bottom-settings": { "src": "tools-btn.webp", "hideIcon": true, "hover": "lift" },
    "library-title":   { "src": "seal.webp", "width": 32, "height": 32, "offsetX": 4, "offsetY": -2 }
  }
}
```

| 字段 | 说明 |
|---|---|
| `src` | 必填。包内相对路径，只许字母、数字、`.` `_` `-` `/`；扩展名 webp/png/svg/avif。不许绝对路径、协议、`..`、引号括号空白 |
| `width` / `height` | 显示宽高 px，1~512；缺省用下表的建议尺寸。铺满型（`cover-placeholder`）不能写 |
| `offsetX` / `offsetY` | 相对默认位置的偏移 px，-200~200，右、下为正 |
| `hideIcon` | `true` = 用这张图替换宿主原图标 / 底板（只有表里「可换」的装饰位能写） |
| `hover` | `"rotate"` 悬停转 45°，`"lift"` 悬停上抬 2px（只有按钮、页签类能写）；写的是名字，不能写任意 transform |

名字不在白名单、路径不安全、扩展名不对、数值越界都会被 `validateDecorManifest` 拒绝。单个装饰图同样受 512 KB 预算。

### 白名单

| 名字 | 挂在哪 | 建议尺寸 | 默认定位 | hideIcon |
|---|---|---|---|---|
| `library-title` | 书库标题「全部书库」旁（LibraryToolbar） | 28×28 | 跟在标题后，垂直居中 | 不可 |
| `dialog-corner` | 所有弹窗右上角（@retainpdf/ui DialogContent） | 56×56 | 向外探出 4px，在关闭钮下面 | 不可 |
| `empty-state` | 空状态插画（EmptyState） | 96×96 | 仪器图标上方居中 | 可：整块换掉仪器图标 |
| `cover-placeholder` | 无封面书的占位（BookCardCover） | 铺满 | 铺满封面区（cover） | 可：藏掉 PDF 图标和字 |
| `bottom-add` / `bottom-tasks` / `bottom-guide` / `bottom-settings` | 底栏四个按钮 | 46×46 | 按钮正中 | 可：去掉按钮的底、描边、阴影，藏 svg，整颗换成图 |
| `top-tab-library` / `top-tab-collections` | 顶栏「图书馆」「合集」页签 | 24×24 | 页签左侧图标位 | 可：藏原图标 |
| `book-cover-tape` | 书卡封面顶边的纸胶带 | 64×22 | 顶边正中，倾斜 -3° | 不可 |
| `reader-bar-left` / `reader-bar-right` | 阅读器顶栏两端 | 40×40 | 「目录」右边 / 下载关闭托盘左边；≤ 720px 不显示 | 不可 |

### 怎么工作

1. 组件里放钩子 `<span class="theme-ornament" data-ornament="<名字>" aria-hidden="true" />`。不设图时 `display:none`，
   不占位、不占 flex 间距——**没有装饰位的皮肤逐像素不变**。
2. 运行时拉当前主题装饰包的 manifest，`planOrnaments` 算出变量，写到 `<html>`：
   `--ornament-<名字>`（`url("…")`，运行时用 `document.baseURI` 拼成绝对地址，因为 CSS 变量里的相对地址按样式表位置算）、
   `-w -h -x -y -hover`，再写两个标记 `data-ornaments="名字 …"`（有图的）、`data-ornaments-hide="名字 …"`（要换掉原图标的）。
   CSS 靠这两个标记决定显示和 hideIcon，因为 CSS 判断不了变量是否存在。换主题时先清旧的再写新的。
3. 首页：`DecorStage` 拉到 manifest 后顺手注入（不多请求一次）；阅读页没有舞台，入口 `app/reader/entry.tsx`
   调 `bootOrnaments()`，按当前主题拉 manifest、只注入装饰位，监听 `THEME_CHANGE_EVENT`。
4. 新增装饰位：`ornaments.ts` 登记 → `ornaments.css` 补一块显示规则（默认尺寸要和白名单一致）→ 组件里放钩子；
   `tests/shared/decor-ornaments.test.mjs` 核对三处对得上。
5. `book-cover-tape` 这类需要宿主做定位基准的（封面区要 `position: relative`），宿主自己负责。

## 硬规则（validateDecorManifest 强制）

| 规则 | 理由 |
|---|---|
| model 层 `fallback` 必填 | 降级链是契约：reduced-motion / 无 WebGL / 低端机 → 静态图 |
| backdrop 禁挂 3D | 性能红线；背景用 image + parallax 以假乱真 |
| 3D 图层 ≤ 3 | 单画布单 renderer，多了必卡 |
| 图层总数 ≤ 12 | 防"贴满屏"失控 |
| src 仅包内相对路径 | 禁止 `..` / 绝对路径 / http: / data: / `//`；字符只许 `[A-Za-z0-9._/-]`（装饰位路径会拼进 CSS `url("…")`，必须防注入） |
| parallax ∈ [0, 0.2] | 视差是点缀不是特技 |
| quote 只能挂 textCapable 锚点 | 文字排版由舞台统一处理 |

## 资产预算（contract.ts 常量，管线门禁用）

| 项 | 上限 |
|---|---|
| 单个 glb（Draco+KTX2 压缩后） | 2048 KB |
| 单模型三角面 | 50,000 |
| 单张装饰图（webp） | 512 KB |

AI 产模型管线：AI 生成 → `gltf-transform optimize`（Draco 几何 + KTX2 纹理）→
预算门禁（npm script，超限拒绝入库）→ 动画 clip 命名（`idleClip`/`clickClip`
引用的名字必须存在于 glb）→ 入库。

## 交互模型（舞台引擎实现时遵守）

- 单个全屏透明 WebGL canvas 承载所有 model 层，`pointer-events: none`。
- window 级监听 click，raycast 命中注册了 `clickClip` 的对象才播动画——
  UI 事件与装饰互不干扰。
- `idleClip` 循环播放；`prefers-reduced-motion` 时不加载 three，直接用 fallback 图。
- image 层可声明 `clickQuote`：舞台在该图层上叠一个透明热点按钮
  （只盖人物实体部、恢复 `pointer-events`），点击轮播语录气泡、5s 自动收起；
  装饰 `<img>` 本体依旧 `pointer-events: none` + `alt=""`，交互走真按钮。

## 新增一个装饰包

1. `decor/<pack>/` 放 manifest.json + 资产（过预算门禁）
2. **同目录写 `ASSETS.md` 资产规格书**（给 AI 生成工具的逐资产提示词 +
   尺寸/构图/配色硬约束，模板见 `decor/jiangnan/ASSETS.md`）
3. `registry.ts` 对应主题加 `decorPack: "<pack>"`
4. 跑 `tests/decor-contract.test.mjs`（schema 变更时）+ 舞台引擎的 manifest 校验会在加载时兜底

## 路线图位置

1. ✅ manifest 契约 + slot 注册表（本文档）
2. ✅ CSS 硬编码收敛（461→0，棘轮基线 `{}`）
3. ✅ 门禁（tests/css-color-literals.test.mjs，测试即门禁）
4. ⬜ L3 组件 token（按钮/卡片形态可换肤）——由舞台实践反哺 token 清单
5. ✅ DecorStage 图片版（jiangnan 示范包：雾山/竹枝/朱砂印/竖排题字；
   视差 rAF 节流；<1100px 安全区只留背景；classic 等无包主题零开销）
6. ⬜ three 引擎 + 第一个 3D 道具 + 资产管线门禁脚本

# 装饰包（Decor Packs）契约

> 状态：契约 + 图片版舞台已落地（three 引擎未实现，model 层暂走 fallback 图）。
> 代码真值：`frontend/web/src/shared/decor/{slots,contract,stage-plan}.ts` · `DecorStage.tsx`
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

## 硬规则（validateDecorManifest 强制）

| 规则 | 理由 |
|---|---|
| model 层 `fallback` 必填 | 降级链是契约：reduced-motion / 无 WebGL / 低端机 → 静态图 |
| backdrop 禁挂 3D | 性能红线；背景用 image + parallax 以假乱真 |
| 3D 图层 ≤ 3 | 单画布单 renderer，多了必卡 |
| 图层总数 ≤ 12 | 防"贴满屏"失控 |
| src 仅包内相对路径 | 禁止 `..` / 绝对路径 / http: / data: |
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

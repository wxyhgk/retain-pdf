# 「墨家」装饰包 —— 美术资产说明

> 本文件格式沿用 `decor/jiangnan/ASSETS.md` 模板（契约真值见
> `docs/core/frontend/web/theme-system/DECOR_PACKS.md`）。当前包内资产为**正式稿**：
> 背景为用户提供的绢本框景图；道具由 10 张墨家机关题材透明 PNG 素材
> （1254×1254 RGBA）经 ImageMagick 裁边 / 缩放 / 合成 / 压缩而来。
> 替换资产时同名覆盖即可生效。

---

## 1. 主题气质（所有资产共同遵守）

**意象**：墨家工坊 · 竹简卷帙 · 青铜机关 · 规矩绳墨。端方、克制、暖素。
**禁止**：高饱和色、赛博/现代元素、拥挤构图、兵器特写压屏。

配色从皮肤 token 取（`src/styles/themes/mojia.css`）：

| token | 值 | 用途 |
|---|---|---|
| 素绢 `--paper` | `#faf8f1` | 亮部 / 留白 |
| 暖绢底 `--bg` | `#f2efe8` | 背景基调 / 道具底雾 |
| 青铜 `--accent` | `#4c6658` | 主强调 |
| 玄墨 `--ink` | `#26221b` | 主按钮底 / 点睛 |
| 青铜金 `--gold` | `#8f7442` | 小面积点缀 |

**对比度红线**：背景垫在 ~92% 不透明纸面板之下，整体明度必须 ≥ `#dde2dd`。

**摆放纪律**（真机目检换来的）：

- 站立/坐卧的物件只能放 **bottom 锚点**（脚踩屏幕底缘接地）；
  top 锚点只放会飞的（木鸢）——立件放 top = 悬空贴纸
- `hero` 落在书库面板横幅区、`top-center` 与悬浮导航相撞，**两锚点禁用**
- 同侧物件按"组图"合成一张（一 slot 一层），不要散摆成四角贴纸

## 2. 通用技术规格（契约强制）

- 格式：`webp`（首选）/ `png` / `svg` / `avif`；**道具类必须透明背景**
- 单文件 ≤ **512 KB**（`IMAGE_BUDGET_KB`，contract.ts 真值）
- 色彩空间 sRGB；命名与 manifest.json 的 `src` 一致；替换 = 同名覆盖

## 3. 逐资产规格（现状 + 复现管线）

素材源：`墨家透明素材包_10个元素/*.png`。通用预处理：`magick <素材> -trim +repage`。
道具统一融合工序：`-modulate 100,90,100` 降饱和 + 底部叠 `--bg` 色雾带渐隐
（贴底件 220px 浓到 55%），与 bg 底部雾感同一语言；**不加硬接地阴影**
（浮空锚点上阴影比道具更显假）。压缩：`-define webp:alpha-quality=95 -quality 85`。

### 3.1 `bg.webp`（backdrop 全幅背景，31 KB）

- 来源：**用户提供稿**（绢本暖底 + 四角回纹框 + 两下角淡墨远山/齿轮），
  原尺寸 1672×941 直接转 webp，不做二次加工
- 构图天然满足契约：上部 60% 留白、下部淡景、明度远高于红线

### 3.2 `kite.webp`（left-top 双木鸢 ← 素材 07）

- 出图：**560×720** 透明；主鸢 300 宽（+170,+60，仰 6°）、副鸢 165 宽
  （+40,+150，俯 4°），朝右上飞进画面，只占画布上部——
  left-top 是唯一"会飞的东西"该待的锚点（top-center 撞悬浮导航，禁用）

### 3.3 `master.webp`（right-bottom-fg 机关大师单人 ← 素材 02）

- 出图：**600×840** 透明，人物高 800（画布 95%）贴右贴底，底部 220px 雾带接地
- 曾是 scholar 组图一员，现按目检要求单人放大；挂 **right-bottom-fg**（fg 带，
  压在面板之上，避免袍角没入面板边缘），并带 `clickQuote` 两句《墨子》语录
  （点击人物轮播：志不强者智不达，言不信者行不果 / 兴天下之利，除天下之害）

### 3.4 `scholar.webp` / `lantern-lock.webp`（备用，未挂层）

- 两组图（大师书案 / 灯下机巧，规格见 git 历史），真机目检后撤下；文件留库可复挂

### 3.5 `boy.webp`（备用，未挂层 ← 素材 01）

- 出图：440×520 透明。英雄位（hero）落在书库面板横幅区，
  人物会被纸面压成"水印残影"——布局演变前不入库挂层

### 3.6 `gear-btn.webp`（"添加"按钮贴面 ← 素材 03，不经 manifest）

- 出图：**128×125** 透明（40px 钮面的 3x 余量），齿轮紧凑裁边、不雾化
- 消费方是 `themes/mojia.css` 的 `.library-bottom-icon-btn-ornament` 规则
 *（组件 AppBottomBar 预留的换装钩子），把底栏"+"钮面换成真齿轮、
  悬停转 45°；不经 manifest、不进舞台图层
- **注意**：主题 CSS 里以 data: URI 内联此图（112px q80 派生版，约 8KB），
  图变了要同步重生成内联版。另一个坑：钩子是组件改动，**必须
  `npm run build:js` 重出 bundle**——只跑 build:css 会出现"皮肤藏起 + 号、
  钩子元素不存在"的空白钮

### 3.7 `tools-btn.webp`（"设置"按钮贴面 ← 素材 06，不经 manifest）

- 出图：**128×128** 透明；主题 CSS 内联 112px q80 派生版（约 6KB）
- 消费方同齿轮钮：`#app-settings-btn` 的 ornament 钩子；"设置=规矩工具"，悬停轻抬

### 3.8 `scroll-btn.webp` / `library-btn.webp` / `fav-btn.webp`（顶栏 tab 图标贴面 ← 素材 08 / 11 / 12，不经 manifest）

- 出图：均 **128px** 透明；主题 CSS 内联 96px q80 派生版（各约 3KB）
- 消费方：`#library-top-tab-{categories,library,favorites}` 的
  `.library-top-tab-ornament` 钩子（LibraryTopTabs 组件预留），24px 图标位微出血；
  语义：图书馆=机关书架竹简、合集=竹简卷轴、收藏=入函典藏
- **注意**：素材 11 / 12 是 RGB 白底图（非 RGBA），入库前必须抠图：
  `-alpha set -fuzz 9% -fill none -floodfill +2+2 white`（四角各一次）；
  08 等前 10 张素材本身透明，直接 `-trim` 即可

### 3.9 题字（quote）—— 不是图片资产

竖排文字由舞台直接渲染。当前文案：「兼相爱 / 交相利」（《墨子·兼爱》）。

## 4. 空置锚点

| slot | 状态 | 原因 |
|---|---|---|
| `hero` / `top-center` | **禁用** | 落在功能面板/悬浮导航区，见 §1 摆放纪律 |
| 底部中央（底栏两侧） | **禁用** | 书库面板全高占满底部：mid 带被面板压住成残影、fg 带压在书卡上像贴纸。曾为此登记过 `bottom-center` 锚点（齿轮核心），真机目检否决后回退 |
| `right-top` | 空 | 题字条幅独占右上，再放道具会互相压盖 |
| `edge-left` / `edge-right` | 空 | fg 压边带；如加（璎珞/绳墨线）必须极稀疏，中部 80% 留空 |

素材 05 连弩 / 09 城楼：用户框景图已含远景，剪影方案废弃，原图留作日后
3D 化或其他主题的原料；素材 03 齿轮改作"添加"按钮贴面（见 §3.6）。

## 5. 验收（替换/新增资产后必跑）

```bash
cd frontend/web
node --import ./tests/helpers/register-jsx.mjs --test tests/decor-stage.test.mjs
find decor/mojia -type f \( -name '*.webp' -o -name '*.png' -o -name '*.svg' -o -name '*.avif' \) -size +512k
# ↑ 有输出 = 超预算，压缩后再入库
```

浏览器目检：切主题到「墨家」，确认 <1100px 窄屏只留背景、
功能面板文字可读性不受背景干扰。

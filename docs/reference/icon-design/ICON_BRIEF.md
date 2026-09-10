# RetainPDF 图标 / 动效需求说明

**用途：** 给你（或设计师）按清单出图；产品会逐步替换现有 Lucide 线框 SVG 与内联 path。  
**日期：** 2026-07-21  
**风格参考：** 轻量、阅读产品、偏 Apple / 学术工具——**细线、圆角、少装饰**；主色跟随 UI（`currentColor`），不要写死黑底大色块。

---

## 1. 交付约定（请按这个出）

### 1.1 静态图标（UI 线标）

| 项 | 要求 |
|----|------|
| 格式 | **SVG** 优先（矢量）；也可附带 24/48/96 PNG 预览 |
| 画板 | **24×24** viewBox（统一）；重要入口可另出 **32×32 / 48×48** 变体 |
| 描边 | 建议 **1.6–2.0** 视觉粗细，圆角线帽（round） |
| 颜色 | **单色**，用 `currentColor` / `#000` 描边即可，我们会在 CSS 里换色 |
| 边距 | 图形四周留约 **2px** 安全边，避免贴边裁切 |
| 命名 | 小写 kebab-case，见下方文件名 |
| 放置 | 做好后放进本目录的 `deliverables/`（你建也行），例如：`docs/reference/icon-design/deliverables/nav-library.svg` |

### 1.2 动态图标（可选加分）

| 项 | 要求 |
|----|------|
| 格式 | **Lottie JSON**（优先，项目已有 lottie-web）或 **APNG / 短循环 WebM** |
| 时长 | 循环 **1–2s**；处理中类可更长 |
| 尺寸 | 导出逻辑 **64×64 或 128×128**，透明底 |
| 命名 | `anim-<用途>.json`，如 `anim-processing.json` |
| 注意 | 避免过重粒子；状态卡里会很小显示 |

### 1.3 已有动效（可换代，不必重做清单外的）

现有 Lottie 在 `frontend/src/assets/animations/`：

| 文件 | 用途（管线阶段） |
|------|------------------|
| `pdf_upload_Lottie.json` | 上传 |
| `ocr_Lottie.json` | OCR |
| `deepseek_lottie.json` | 翻译（模型） |
| `typst_rendering.json` | 排版 / 渲染 |
| `pdf_download_Lottie.json` | 下载 / 产出 |

若你要「更好看的动效」，优先换这 5 个 + 下文 **P0 动态** 即可。

---

## 2. 优先级总览

| 优先级 | 说明 |
|--------|------|
| **P0** | 每天看到：顶栏 Tab、底栏、阅读器模式/关闭/FAB、卡片状态徽标 |
| **P1** | 书架操作、工具条、空状态、设置入口 |
| **P2** | Toast / 通用对话框关闭、细节装饰 |

---

## 3. P0 — 必须先做（导航 + 阅读器）

### 3.1 主页顶栏 Tab（三枚一组，风格要统一）

| 文件名建议 | 语义 | 界面文案 | 现用大致形态 | 尺寸场景 |
|------------|------|----------|--------------|----------|
| `nav-library.svg` | 图书馆 / 书架 | 图书馆 | 书脊并排 | 16–18px 内联 |
| `nav-collections.svg` | 合集 / 文件夹书堆 | 合集 | 多层 stack | 同上 |
| `nav-favorites.svg` | 收藏 / 书签摘录 | 收藏 | 书签 bookmark | 同上 |

**设计提示：** 三者并排在白色 pill 里；选中态会变白描边，**请保证在深底上仍清晰**。

### 3.2 主页底栏

| 文件名 | 语义 | 文案 | 现用 |
|--------|------|------|------|
| `action-add-pdf.svg` | 添加 / 上传 PDF | 添加 PDF | 粗 **+** |
| `action-settings.svg` | 设置 | 设置 | 齿轮 |

可选：`action-search.svg`（搜索框左侧装饰，当前是纯 input）。

### 3.3 阅读器顶栏模式（三枚一组）

| 文件名 | 语义 | 文案 | 现用 Lucide |
|--------|------|------|-------------|
| `reader-mode-source.svg` | 原文单栏 | 原文 | FileText |
| `reader-mode-translated.svg` | 译文单栏 | 译文 | Languages |
| `reader-mode-compare.svg` | 左右对照 | 对照阅读 | Columns2 |

### 3.4 阅读器操作

| 文件名 | 语义 | 文案 / 场景 | 现用 |
|--------|------|-------------|------|
| `reader-close.svg` | 关闭 / 回主页 | 关闭 | X |
| `reader-fab.svg` | 悬浮工具钮主图标 | 工具菜单 | 菜单感 / 点阵亦可 |
| `reader-notes.svg` | 批注列表 | 批注 | StickyNote |
| `reader-download.svg` | 下载入口 | 下载 | Download |
| `reader-download-source.svg` | 下原文 PDF | 原文 | FileText |
| `reader-download-translated.svg` | 下译文 PDF | 译文 | Languages |
| `reader-download-compare.svg` | 下对照 PDF | 对照 | Columns2 |
| `reader-note-add.svg` | 选区加批注 | 加批注 | StickyNote |
| `reader-shortcuts.svg` | 快捷键帮助 | 快捷键 | Keyboard |

### 3.5 书架卡片状态徽标（小，11–14px）

| 文件名 | 语义 | 状态文案方向 | 现用 key |
|--------|------|--------------|----------|
| `badge-archive.svg` | 仅馆藏 / 未翻译 | 库存 | archive |
| `badge-translated.svg` | 已翻译 | 已译 | languages |
| `badge-processing.svg` | 处理中 | 进行中 | loader（可转） |
| `badge-failed.svg` | 失败 | 失败 | alert |
| `badge-queued.svg` | 排队 | 排队 | clock |

**动态优先：** `anim-badge-processing.json`（替换 CSS spin 的 loader）。

---

## 4. P1 — 书架与空状态

| 文件名 | 语义 | 出现位置 |
|--------|------|----------|
| `shelf-continue-book.svg` | 继续阅读封面占位 | 继续阅读条 |
| `shelf-empty-favorites.svg` | 还没有收藏 | 收藏 Tab 空态 |
| `shelf-empty-collection.svg` | 空合集 | 合集封面堆空 |
| `shelf-view-grid.svg` | 网格视图 | 工具条 |
| `shelf-view-list.svg` | 列表视图 | 工具条 |
| `shelf-batch-select.svg` | 批量选择 | 工具条 |
| `shelf-batch-delete.svg` | 批量删除 | 批量栏 |
| `shelf-batch-collection.svg` | 加入合集 | 批量栏 |
| `book-read.svg` | 读原文 / 眼睛 | 列表行、详情 |
| `book-compare.svg` | 对照阅读 | 卡片操作 |
| `book-translate.svg` | 发起翻译 | 详情 / 卡片 |
| `book-cover-fallback.svg` | 无封面占位 | 卡片封面 |
| `upload-lock.svg` | 未配凭据门禁 | 上传区 |
| `collection-manage.svg` | 管理合集 | 合集卡片齿轮 |

### 设置中心（Settings Hub 三栏）

| 文件名 | 语义 |
|--------|------|
| `settings-api.svg` | 接口 / 凭据 |
| `settings-glossary.svg` | 术语表 |
| `settings-about.svg` | 关于 / 更新 |

---

## 5. P2 — 系统与反馈

| 文件名 | 语义 | 现用 |
|--------|------|------|
| `toast-success.svg` | 成功 | CircleCheck |
| `toast-info.svg` | 信息 | Info |
| `toast-warning.svg` | 警告 | TriangleAlert |
| `toast-error.svg` | 错误 | OctagonX |
| `toast-loading.svg` | 加载中（可动态） | Loader2 spin |
| `dialog-close.svg` | 对话框关闭 | X |

---

## 6. 建议优先做的「动态」清单

若时间有限，动态只做这些：

| 文件名 | 场景 | 说明 |
|--------|------|------|
| `anim-processing.json` | 卡片处理中 / 状态卡 | 温和旋转或进度环，可循环 |
| `anim-upload.json` | 上传中 | 可替换 `pdf_upload_Lottie.json` |
| `anim-ocr.json` | OCR 阶段 | 可替换 `ocr_Lottie.json` |
| `anim-translate.json` | 翻译阶段 | 可替换 `deepseek_lottie.json` |
| `anim-render.json` | 排版阶段 | 可替换 `typst_rendering.json` |
| `anim-download.json` | 下载完成/进行 | 可替换 `pdf_download_Lottie.json` |
| `anim-empty-favorites.json`（可选） | 收藏空态 | 书签轻动，不要吵 |

---

## 7. 视觉统一建议

1. **同一套笔触**：全站 24 画板、相近 stroke。  
2. **语义分组形状**：  
   - 书 / 页 → 圆角矩形 + 折角  
   - 翻译 → 文 / A 或双文气泡  
   - 对照 → 双栏  
   - 收藏 → 书签（不要用心形，和「喜欢」混淆）  
3. **状态色由 UI 上色**：图标本身单色；失败/成功由外层 badge 背景表达。  
4. **动效克制**：阅读场景避免闪烁；`prefers-reduced-motion` 时我们会停动画，请保证静态帧也看得懂。

---

## 8. 交付目录结构（请按此丢文件）

```
docs/reference/icon-design/
  ICON_BRIEF.md          ← 本说明
  deliverables/
    svg/
      nav-library.svg
      nav-collections.svg
      ...
    lottie/
      anim-processing.json
      ...
    preview/             ← 可选：拼一张总览 PNG/PDF 方便评审
```

做完后告诉我文件已就位，我可以按文件名接到 `frontend/src/assets/icons/` 并替换代码里的 Lucide / 内联 SVG。

---

## 9. 最小开工包（若只想先做 12 个）

按产品曝光排序，**先做这 12 个**就够换一版气质：

1. `nav-library`  
2. `nav-collections`  
3. `nav-favorites`  
4. `action-add-pdf`  
5. `action-settings`  
6. `reader-mode-source`  
7. `reader-mode-translated`  
8. `reader-mode-compare`  
9. `reader-close`  
10. `reader-notes`  
11. `badge-processing`（+ 可选 `anim-processing`）  
12. `badge-translated`  

其余可第二批发。

---

## 10. 代码侧现状（给你对照，不必改）

- 阅读器：大量 `lucide-react`（ModeTabs / Fab / Close / Selection）。  
- 主页：大量内联 `<svg>`（TopTabs / BottomBar / Badge / Toolbar）。  
- 品牌：`frontend/src/assets/RetainPDF-logo.svg`（Logo 另算，不在本清单强制范围）。  
- 阶段动效：Lottie 见 §1.3。

有问题可以直接在 `deliverables/` 旁加 `notes.md` 写你的命名或变体说明。

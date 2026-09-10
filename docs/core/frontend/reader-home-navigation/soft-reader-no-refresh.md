# 主页 ↔ 阅读器：关闭不刷新（Soft Reader）

**日期：** 2026-07-21  
**范围：** `frontend` 主页打开 PDF 阅读、关闭后回书架  
**状态：** 已落地

---

## 1. 现象

1. 主页点进阅读器后，右上角没有「关闭 / 回主页」。
2. 加上关闭后：点 × 会**整页刷新**主页，书架**滚动位置丢失**。
3. 用户期望：关阅读器后书架立刻回来，**不要像重新打开网站**。

---

## 2. 背景演进

| 阶段 | 方案 | 问题 |
|------|------|------|
| A | 主页 Radix Dialog + **iframe** 嵌 `reader.html` | 双文档生命周期、postMessage、样式双包、容易变成「小弹窗」 |
| B | 主页 `location.assign(reader.html)` 整页跳转 | 关闭只能 `history.back` / 再 `assign(index.html)`，主页被卸载，**必然重载感** |
| C（当前） | **Soft Reader**：主页不卸载 + 全屏阅读层 | 关 × 不刷新，滚动天然保留；地址栏仍是 `reader.html?…` |

用户明确不喜欢「套一层 dialog 的 iframe 壳」，但可以接受**为了不刷新主页**而用的全屏宿主层（技术上仍是 iframe 载入完整阅读器 SPA，**没有** dialog 小窗）。

---

## 3. 根因

### 3.1 为何会「刷新」

```
主页 index.html  ──location.assign──►  reader.html
       ▲                                    │
       └──────── assign(index) / back ──────┘
```

- `assign` 离开主页时，**主页文档被销毁**（React 树、滚动容器、轮询状态全没）。
- 关闭时即使用 `history.back()`：
  - 有 **bfcache** 时：可能瞬间恢复（本项目里轮询等常使 bfcache **不稳定**）；
  - 无 bfcache：浏览器**重新加载** `index.html` → 用户感知就是刷新。
- 书架滚动在 `#recent-jobs-scroll-body`（不是 `window`），硬重载后浏览器也**不会**自动恢复该元素的 `scrollTop`。

### 3.2 为何 sessionStorage 滚回不够

曾加过「离开前记滚动、回来后写回」：

- 能缓解**硬回主页**时的位置丢失；
- **消除不了**整页白屏 / React 冷启动的刷新感。

要「不刷新」，必须让**主页文档一直活着**。

---

## 4. 解法：Soft Reader（软打开）

### 4.1 思路

从**主页文档**打开阅读时：

1. **不要** `location.assign` 卸掉主页；
2. `history.pushState` 把地址改成 `reader.html?job_id=…`（可分享、刷新仍进真阅读页）；
3. 在主页上盖一层 **全屏宿主**（`SoftReaderHost`），内嵌 `iframe[src=reader.html?…]` 跑完整阅读器；
4. 主页 DOM（含 `#recent-jobs-scroll-body`）**始终保留**。

关闭时：

1. 阅读器（iframe 内）`postMessage` 通知父页；
2. 父页 `history.back()` 卸掉 soft 层；
3. 主页立刻露出，**无导航重载**。

```
┌──────────── index.html（始终存活）────────────┐
│  书架 / 合集 / 收藏 …  scroll 保留             │
│  ┌──────── SoftReaderHost (fixed 全屏) ─────┐ │
│  │  iframe → reader.html + reader.bundle    │ │
│  │  [× 关闭] → postMessage → history.back   │ │
│  └──────────────────────────────────────────┘ │
└───────────────────────────────────────────────┘
```

### 4.2 关键文件

| 路径 | 职责 |
|------|------|
| `frontend/web/src/shared/navigation/soft-reader.ts` | `trySoftOpenReader` / `closeSoftReaderOnHost`、history state、消息类型 |
| `frontend/web/src/shared/navigation/home-return-state.ts` | 离开前滚动/tab 快照（硬跳转兜底） |
| `frontend/web/src/pages/home/features/reader/navigate-to-reader.ts` | 默认 soft open；`replace` 仍硬跳 |
| `frontend/web/src/pages/home/features/reader/SoftReaderHost.tsx` | 全屏层 + iframe + popstate / message |
| `frontend/web/src/pages/home/features/reader/ReaderDialog.tsx` | 监听 `openReaderRequested` → `navigateToReader` |
| `frontend/web/src/pages/reader/components/react-pdf/ReaderCloseHome.tsx` | ×：iframe 内 postMessage；独立页 back/assign |
| `frontend/web/src/pages/home/features/library/page/useHomeReturnRestore.ts` | 硬回主页时恢复滚动（兜底） |
| `frontend/web/src/styles/pages/home/library-shell.css` | `.soft-reader-host` / `.soft-reader-frame` |

### 4.3 打开路径（主页点书）

```
openReaderRequested
  → ReaderDialog
  → navigateToReader(url)
  → captureHomeReturnState({ allowBack: true })
  → trySoftOpenReader(url)          // 主页文档上
       history.pushState({ retainpdfSoftReader, readerUrl }, "", absoluteUrl)
       dispatch retainpdf:soft-reader-open
  → SoftReaderHost 显示 iframe
```

仅当**当前不是主页文档**（已在 `reader.html` / `detail.html`）或 soft 失败时，才 `location.assign`。

深链 `?view=reader&job_id=` 仍用 **`replace: true` 硬进** `reader.html`（避免 history 死循环）。

### 4.4 关闭路径

**A. 软打开（iframe 内）**

```
点击 ×
  → navigateReaderToHome()
  → parent.postMessage({ type: "retainpdf:soft-reader-close" }, origin)
  → 父页 closeSoftReaderOnHost()
  → history.back()
  → SoftReaderHost popstate → 卸 iframe
  → 主页仍在，滚动未动
```

**B. 独立 `reader.html`（书签 / 刷新后）**

```
× → history.back()（若 session 标记从主页来）
  或 location.assign(index.html)
  + useHomeReturnRestore 尽量恢复滚动
```

### 4.5 与「旧 iframe 对话框」的区别

| | 旧 Dialog+iframe | Soft Reader |
|--|------------------|-------------|
| 壳 | Radix Dialog，易成小窗 | `position:fixed; inset:0` 真全屏 |
| 主页 | 常还在，但壳/样式耦合重 | 明确「主页保活」为产品目标 |
| 通信 | 进度 postMessage 等一堆 | **仅关闭**一条 close 消息 |
| URL | 多为主页 URL | **pushState 成 reader URL** |
| 刷新阅读 URL | 可能仍在主页 | 直接打开真正的 `reader.html` |

---

## 5. 场景矩阵

| 场景 | 行为 |
|------|------|
| 主页点卡片 / 对照阅读 → 读 → 关 × | Soft open，**不刷新**，滚动保留 |
| 浏览器「返回」 | 同 soft 关闭 |
| 地址栏直接打开 / 刷新 `reader.html` | 独立阅读页；× 回主页可能整页加载（可接受） |
| 主页 `?view=reader&job_id=` | `replace` 硬进阅读页 |
| 阅读页内再开链接跨页 | 仍走阅读器自身导航 |

---

## 6. 构建与验证

```bash
cd frontend/web
npm run build:css
npm run build:js
# 硬刷新浏览器后再测主页 → 阅读 → 关闭
```

建议手测：

1. 主页书架往下滚一段；
2. 打开一本书；
3. 点右上角「关闭」；
4. 期望：书架瞬时出现、**无白屏重载**、滚动位置仍在。

相关测试（导航契约，多用 mock navigate）：

- `frontend/web/tests/reader-dialog-component.test.mjs`
- `frontend/web/tests/home-app-component.test.mjs`

---

## 7. 后续可选

- Soft 层 loading 遮罩（iframe 首包前避免闪空）。
- 独立阅读页关闭时更强的滚动恢复 / bfcache 友好（停轮询于 `pagehide`）。
- 若产品允许「同包内嵌 `ReaderAppReactPdf`」：可去掉 iframe，进一步减双 bundle；代价是 home bundle 体积上升。

---

## 8. 一句话

**关阅读器不刷新的本质：别用整页导航卸掉主页；用 history + 全屏层保活主页，阅读器仍跑完整 `reader.html`。**

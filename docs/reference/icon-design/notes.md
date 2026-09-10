# 图标交付说明（notes）

## 规格

- 画板：全部 `viewBox="0 0 24 24"`，图形安全边约 2px
- 描边：圆角线帽/拐角（round）；**主套装 1.8**，徽标类（`badge-*`）与 `action-add-pdf` 用 **2.0**（小尺寸更清晰）
- 颜色：单色 `currentColor`，无写死色值；少量点缀元素（FAB 点阵、键盘按键、播放三角、星星、锁孔、感叹号圆点）用 `fill="currentColor"` 实心
- 深底：已按白/深两色底在 `preview/index.html` 验证

## 复用关系（同形不同名，按清单命名各出一份）

| 相同图形 | 文件 |
|----------|------|
| 文档+折角 | `reader-mode-source` = `reader-download-source` |
| 文+A | `reader-mode-translated` = `reader-download-translated` = `book-translate`（`badge-translated` 同形但 2.0 描边） |
| 双栏 | `reader-mode-compare` = `reader-download-compare` = `book-compare` |
| 齿轮 | `action-settings` = `collection-manage` |
| 圆圈 i | `settings-about` = `toast-info` |
| 三角警告 | `badge-failed`（2.0）= `toast-warning`（1.8） |
| 转圈弧 | `badge-processing`（2.0）= `toast-loading`（1.8） |
| 叉 | `reader-close` = `dialog-close` |

如后续想改某一处的造型，注意同步同名族文件，或改为引用同一份。

## 各图标造型说明

- `nav-library`：两本直立 + 一本斜靠（11°）+ 底线书架
- `nav-collections`：三本书叠放（下宽上窄）
- `nav-favorites`：书签（不用心形，遵 §7）
- `reader-fab`：3×3 实心点阵（菜单感，遵清单提示）
- `reader-notes` / `reader-note-add`：右下角折角便签，后者内嵌加号
- `badge-processing`：288° 圆弧，CSS `transform: rotate` 中心旋转即可成 loading
- `shelf-empty-favorites`：书签 + 小星（空态点缀）
- `shelf-empty-collection` / `shelf-batch-collection`：文件夹 / 文件夹+加号
- `settings-api`：钥匙（凭据）；`settings-glossary`：摊开的书；`settings-about`：圆圈 i

## Lottie

- `anim-processing.json`：64×64、30fps、60 帧（2s 循环），288° 圆弧匀速旋转
- 颜色为中性灰 `#6B7280`（JSON 内 `c.k`，lottie 无法直接用 currentColor，接入时按需改色）
- 静态首帧即可读（缺口圆弧），`prefers-reduced-motion` 停帧无问题

## 预览

- `preview/index.html`：全部 SVG 在 16/24/48px、白/深底下的总览（由根目录 `build_preview.py` 生成）
- `preview/contact-sheet.png`：上面页面的截图
- `preview/anim-processing-frames.png`：Lottie 第 0/15/30 帧定格

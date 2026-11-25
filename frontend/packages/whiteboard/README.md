# @retainpdf/whiteboard

两样东西：**无限白板**（`Board`，自己写字、放卡片，公式用 Markdown 的 `$…$`）和**讲解脚本播放器**（`Whiteboard`，AI 一步步写的讲解）。

学习系统的白板讲解板：Teaching Agent 写一份 JSON 讲解脚本，白板一步一步画出来。设计见
[白板讲解板](../../../docs/ops/planning/learning-system/20261125-白板讲解板.md)。

```tsx
import { Whiteboard } from "@retainpdf/whiteboard";
import "@retainpdf/whiteboard/styles.css";

<Whiteboard script={scriptFromModel} />
```

- `src/script/`：脚本格式（`types.ts`）和校验（`validate.ts`，写错的指令变成「跳过」，不抛错）。
- `src/layout/`：自动排版，位置对整份脚本一次算定；文字按字符估宽，公式尺寸由 MathJax 给。
- `src/render/frame.ts`：`frameAt(脚本, 排版, 第几步, 过了多少毫秒)` 纯函数，给出这一帧画什么。
- `src/math/engine.ts`：TeX → SVG（mathjax-full，按需加载；去掉链接和事件属性）。
- `src/react/`：`BoardSvg` 画一帧，`Whiteboard` 管播放（上一步、下一步、自动播放、重播；← → 空格 R）。

颜色只用皮肤变量（`--ink`、`--paper`、`--accent`、`--ok`、`--danger`…），见 `styles/whiteboard.css`。

## 无限白板（`src/board/`）

```tsx
import { Board, useBoardStorage } from "@retainpdf/whiteboard";

const [doc, setDoc] = useBoardStorage("retainpdf:board:<书>:v1");
<Board doc={doc} onChange={setDoc} />
```

- 拖空白处移动、⌘/Ctrl + 滚轮（触控板捏合）以鼠标为中心缩放、滚轮 / 两指滑动平移；双击空白处放一张卡片、双击卡片改字；
  选中后 Delete 删、回车改、⌘/Ctrl+Z 撤销。
- 卡片里直接写 **Markdown**，公式 `$…$`（行内）、`$$…$$`（单独一块），也认 `\(…\)`、`\[…\]`（`src/markdown/math-markdown.ts`）。
  渲染时 Markdown 里的原始 HTML 转义成文字，链接只认 http(s)/mailto，不加载外部图片。
- 公式好打（`MathMarkdownEditor`、`board/math-typing.ts`）：
  - `$` 自带收尾；在空的 `$|$` 里再打一个 `$` 变单独一块；选着字打 `$` 就包起来；
  - 光标在公式里时，公式在光标上方实时画出来；写错时留着上一次画对的，停手一秒才说错在哪；
  - `\fr` 出补全菜单（带画出来的样子），回车 / Tab 填成 `\frac{|}{}`；`{` 自带 `}`；空 `{}` 退格一起删；
    Tab 跳进下一个 `{}`，没有了就跳出这一层 `{}`，再按跳出公式。
  - 补全、括号这几样搬自用户自己的 notes-studio（`src/math/latex-assist.ts`）。
- 公式用 MathJax（已经加载后同步排，`math/engine.ts` 的 `mathHtmlNow`）；存档 `board-state.ts` 的 `BoardDoc`（版本 1，坏数据当空白板）。
- 演示页 `frontend/web/whiteboard.html`（默认就是白板；`?mode=script` 是讲解脚本）。


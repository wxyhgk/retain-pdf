# @retainpdf/whiteboard

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

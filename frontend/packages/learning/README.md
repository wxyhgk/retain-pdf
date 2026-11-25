# @retainpdf/learning

学习系统的学习区：阅读页「学习」页签的右栏。设计见 [学习区界面](../../../docs/ops/planning/learning-system/20261125-学习区界面.md)。

```tsx
import { LearningPane, SZABO_CH3_COURSE } from "@retainpdf/learning";
import "@retainpdf/learning/styles.css";

<LearningPane course={SZABO_CH3_COURSE} host={{ currentPage, navigate, setMarkers, close }} />
```

- 不认识阅读器、不认识后端：宿主给 `LearningHost`（跳到书里、页边小圆点、当前页），课程数据从外面传进来。
  阅读页的接法在 `frontend/web/src/app/reader/learning-side-pane.tsx`。
- `src/course/types.ts`：课程数据（知识点和锚点、题、讲解脚本、写死的问答）。
- `src/state/session.ts`：画面和规则（纯函数）：状态只跟答题证据走，提示一级一级给，说「懂了」不算会。
- `src/ui/`：`LearningPane`（三层外壳 + 提问框）、`screens.tsx`（本章地图、知识点卡、做题、讲解、问答）。
- `src/demo/`：原型的写死数据，Szabo 第 3 章（草稿，物理内容待审）；白板演示页也用这里的讲解脚本。
- 依赖 `@retainpdf/whiteboard`（讲解、公式）和 `@retainpdf/ui`（按钮）。颜色只用皮肤变量。

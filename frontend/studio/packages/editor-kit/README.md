# @blog/editor-kit

Studio 里 Milkdown 编辑器的部件里，**不认识 Studio 的那些**：不调后端、不碰打开的文章、不引用 `src/studio`。文章编辑器和 AI 面板的输入框都用这一份，所以公式在两处一样好打。

| 文件 | 内容 |
|---|---|
| `math/inline-math.ts` | 行内公式：`$…$` 在原处显示源码、上面浮着渲染结果，离开就画成公式；`formulaTakesEnter` 说回车该不该归公式 |
| `math/display-math.ts` | 行间公式：画在原处，点开就在原处所见即所得地改（`visual-math.ts`），「源码」或 MathLive 不认识的写法在弹窗里改 LaTeX |
| `math/visual-math.ts` | 用 MathLive（cortexjs.io，MIT）所见即所得地改公式：第一次用时才加载；没改过就不写回，原文一字不动；末尾的 `\tag` 暂时拿开再放回；空位写回成 `{}` |
| `math/formula-typing.ts` | 边打边画：画不出来时留着上一次画好的，停手一秒才报错 |
| `math/latex-assist.ts`、`math/latex-completion-menu.ts` | 命令补全（`\fr` → `\frac{}{}`）和括号自动配对 |
| `math/equation-numbers.ts` | 作者写的 `\tag{…}` 编号 |
| `math/math-brackets.ts` | `\(…\)`、`\[…\]` 写法也当公式（用 `@blog/markdown` 的 remark 插件） |
| `math/formula-block.ts` | 哪些代码块算公式（`$$` 块、```math） |
| `math/source-popup.ts` | 行间公式的源码弹窗 |
| `math/math.css` | 上面这些的样式。在编辑器外面那个元素上加 `math-editor` 类才生效；用网站的颜色变量 |
| `near-screen.ts` | 长文章只画屏幕附近的公式、引用这类块 |
| `changed-range.ts` | 一次编辑改了文档的哪一段，块只在改动附近重画 |

用法：

```ts
import { inlineMathPlugins } from '@blog/editor-kit/math/inline-math.ts';
import { displayMathPlugins } from '@blog/editor-kit/math/display-math.ts';
import { mathBracketsRemark } from '@blog/editor-kit/math/math-brackets.ts';

crepe.editor.use(inlineMathPlugins).use(displayMathPlugins).use(mathBracketsRemark);
```

```css
@import '@blog/editor-kit/math/math.css'; /* 编辑器外层元素加 class="math-editor" */
```

规矩：这里的代码只能引用 `@milkdown/*`、`katex` 和别的 `@blog/*` 包，不能引用 `src/studio`。

测试在仓库根目录的 `tests/`（`inline-math`、`formula-typing`、`latex-assist`、`science-source-popup`）和 `tests/e2e/formula.spec.ts`，`npm test` 和浏览器测试会一起跑。

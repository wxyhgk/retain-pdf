# Inline Content Rendering 说明

`services/rendering/layout/inline_content/` 负责一件事：

把“带公式、Markdown、Typst inline 内容的翻译文本”整理成排版阶段可用的文本形态。

这里不负责：

- OCR 公式检测
- 翻译模型调用
- PDF 页面排版
- Typst 整页编译

它只是渲染链里的一个小模块，负责“公式文本怎么进入渲染主链”。

## 当前设计原则

当前这块已经按两条线拆开：

- `core/`
  主链。放现在正常渲染一定会经过的逻辑。
- `fallback/`
  兜底链。放历史兼容、placeholder 路径、LaTeX-ish 修补、公式 PNG 渲染。

不要再使用 `shared/`、`modes/` 这种语义模糊的目录名。

## 当前目录

```text
layout/inline_content/
  README.md
  __init__.py
  mode_router.py
  core/
    __init__.py
    inline_math.py
    markdown.py
  fallback/
    __init__.py
    latex_normalizer.py
    placeholder_markdown.py
    png_renderer.py
```

## 主链怎么走

当前默认思路是：

1. 上游给出 `protected_text`、`formula_map`、`math_mode`
2. `mode_router.py` 决定走哪条路径
3. 如果是 `direct_typst`
   直接走 `core/inline_math.py` + `core/markdown.py`
4. 如果是 `placeholder`
   走 `fallback/placeholder_markdown.py`
5. 最终输出 markdown/plain-text，交给 layout / typst / redaction

也就是说：

- `mode_router.py` 只负责分发
- `core/` 负责主链文本整理
- `fallback/` 负责旧路径和兜底能力

## 文件职责

### `mode_router.py`

唯一职责：根据 `math_mode` 选择路径。

现在只应该做：

- `item_render_math_mode`
- `is_direct_typst_math_mode`
- `build_render_markdown`
- `build_item_render_markdown`

不应该在这里堆公式清洗细节。

### `core/inline_math.py`

负责 inline math 级别的轻量处理。

主要是：

- 识别已有的 `$...$`
- 只对非数学片段做文本替换
- `direct_typst` 模式下做最小兼容清洗
- 给行内公式补必要空格

这里应该保持轻量，不要塞 placeholder 逻辑。

### `core/markdown.py`

负责主链 markdown 文本构建。

主要是：

- 从普通文本构建可渲染 markdown
- 做 inline math 提升
- 处理 citation-like 文本
- 提供 plain-text 构建辅助

这里代表“当前主路径真正想保留的公式文本规则”。

### `fallback/placeholder_markdown.py`

负责 placeholder 公式路径。

输入通常是：

- `protected_text`
- `formula_map`

职责是：

- 按 token 切分文本
- 用 `formula_map` 回填公式
- 必要时把 citation 还原成普通文本
- 最后再调用主链的 markdown 文本整理

如果未来彻底去掉 placeholder，这个文件会继续缩小。

### `fallback/latex_normalizer.py`

负责旧 LaTeX-ish 公式修补。

它不是主链核心能力，而是兼容层：

- 修正常见 OCR 噪声
- 处理历史遗留格式
- 给 placeholder / PNG fallback 提供更稳定的输入

如果某条规则只服务老数据，不要放进 `core/`，放这里。

### `fallback/png_renderer.py`

负责把单条公式转成 PNG。

这个能力主要给：

- redaction 路径
- 某些公式无法直接按文本渲染时的兜底路径

它不代表主链。

当前主链还是优先走文本 / direct typst，而不是把公式都转成图片。

## 依赖方向

这一层必须遵守下面的依赖方向：

- `mode_router -> core`
- `mode_router -> fallback`
- `fallback -> core`
- `core` 不反向依赖 `fallback`

也就是说：

- `core` 只能放真正底层、稳定、主链的东西
- `fallback` 可以调用 `core`
- 不能让 `core` 再 import 回 `fallback`

否则目录虽然拆了，实际还是耦合的。

## 对外暴露什么

外部模块通常只应该依赖这些稳定口：

- `services.rendering.layout.inline_content.mode_router`
- `services.rendering.layout.inline_content.core.markdown`
- `services.rendering.layout.inline_content.core.inline_math`
- `services.rendering.layout.inline_content.fallback.placeholder_markdown`
- `services.rendering.layout.inline_content.fallback.latex_normalizer`
- `services.rendering.layout.inline_content.fallback.png_renderer`

不要再引用已经删除的历史路径，比如：

- `services.rendering.formula.*` 旧路径已删除，不要再使用。
- `services.rendering.layout.inline_content.math_utils`
- `services.rendering.layout.inline_content.normalizer`
- `services.rendering.layout.inline_content.typst_formula_renderer`
- `services.rendering.layout.inline_content.shared.*`
- `services.rendering.layout.inline_content.modes.*`

## 修改建议

如果以后再改这块，按这个顺序判断：

1. 这是主链必经逻辑吗？
   如果是，优先放 `core/`
2. 这是 placeholder / 旧 LaTeX / PNG fallback / 历史兼容吗？
   如果是，放 `fallback/`
3. 这是路径选择吗？
   放 `mode_router.py`
4. 这是测试坏例吗？
   放到
   [`devtools/tests/translation/test_formula_math_markers.py`](/home/wxyhgk/tmp/Code/backend/scripts/devtools/tests/translation/test_formula_math_markers.py)

## 当前你最该看的文件

如果你想快速理解这里，阅读顺序建议是：

1. [`mode_router.py`](/home/wxyhgk/tmp/Code/backend/scripts/services/rendering/layout/inline_content/mode_router.py)
2. [`core/markdown.py`](/home/wxyhgk/tmp/Code/backend/scripts/services/rendering/layout/inline_content/core/markdown.py)
3. [`core/inline_math.py`](/home/wxyhgk/tmp/Code/backend/scripts/services/rendering/layout/inline_content/core/inline_math.py)
4. [`fallback/placeholder_markdown.py`](/home/wxyhgk/tmp/Code/backend/scripts/services/rendering/layout/inline_content/fallback/placeholder_markdown.py)
5. [`fallback/latex_normalizer.py`](/home/wxyhgk/tmp/Code/backend/scripts/services/rendering/layout/inline_content/fallback/latex_normalizer.py)
6. [`fallback/png_renderer.py`](/home/wxyhgk/tmp/Code/backend/scripts/services/rendering/layout/inline_content/fallback/png_renderer.py)

## 当前状态

当前这块已经完成的整理是：

- `direct_typst` 主链和 placeholder 兜底链分开
- `shared/`、`modes/` 这种假边界已经移除
- `core` 与 `fallback` 的循环导入已经拆掉

还剩下的非逻辑问题是：

- 目录里还有 `.ipynb_checkpoints`
- 目录里还有 `__pycache__`

这些不影响运行，但会影响阅读体验，后续可以直接清掉。

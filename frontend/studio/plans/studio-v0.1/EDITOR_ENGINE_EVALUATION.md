# Studio 编辑器引擎调研

## 决策摘要

Studio 不再以“补齐自研 ProseMirror 编辑器”为主线。

第一轮真实页面实验后，候选优先级调整为：

1. **Milkdown Crepe：下一优先实测。** Crepe 已经在 Milkdown 内核之上提供块手柄、添加按钮、斜杠菜单和浮动编辑组件，交互模型更接近 Notion。
2. **Vditor：不作为正式 Studio 主编辑器。** 实验确认其传统 Markdown 工具栏和源码痕迹与目标体验差异过大；仅暂时保留实验页用于 Markdown 往返对照。

BlockNote、Tiptap 和 SiYuan Protyle 不进入当前实测阶段。现有编辑器暂时保留，只作为对照和回退，不继续扩展通用编辑能力。

> 2026-08-09 实测记录：Vditor 可以渲染真实文章公式，但在未编辑时就把 Hartree–Fock 测试文章从 1221 字符规范化为 1218 字符（合并空行），并且默认交互明显是传统 Markdown 编辑器而非 Notion 风格。因此停止向正式 Studio 迁移 Vditor。

> 2026-08-09 Crepe 首轮实测：块加号、拖拽手柄、分组斜杠菜单、浮动工具栏、表格、代码块与普通 LaTeX 均可工作，整体交互方向符合 Studio。frontmatter 已从编辑器输入中分离并由文档层原样保留。Crepe 仍会规范化正文空行（1221 → 1218、1605 → 1604），实验页只报告差异，不会在用户真正编辑前把规范化结果标记为待保存。`mhchem` 的 `\\ce{}` 尚未渲染，科学 fenced code 当前可保留但尚未接入分子预览。

## 不能继续自研的原因

编辑器真正昂贵的部分不是标题、粗体或公式节点，而是长期正确处理：

- 中文输入法和 composition 事件；
- 光标、选区、跨块删除与移动端行为；
- Word、网页和 Markdown 粘贴；
- 表格、嵌套列表、任务列表；
- 撤销、重做、拖拽和历史合并；
- Markdown 解析、序列化及未知语法的无损往返；
- 插件之间的键盘、选区和事务冲突。

这些是成熟编辑器内核应该承担的成本。我们的代码应集中在文章目录模型、Git 工作流、科学数据块和博客发布上。

## 候选比较

| 编辑器 | Markdown 地位 | 开箱编辑体验 | 科学块扩展 | 许可证 | 当前结论 |
| --- | --- | --- | --- | --- | --- |
| Vditor | 一等输入/输出格式；实测会规范化多余空行 | 很高，但属于传统 Markdown 编辑器 | 可按 fenced code language 注册 `customRenders` | MIT | 排除为正式主编辑器，实验页暂留 |
| Milkdown Crepe | Markdown-first，基于 remark 与 ProseMirror | 高；已有块手柄、加号与斜杠菜单 | 很强，可自定义 schema、remark 插件和 NodeView | MIT | 下一优先实测 |
| BlockNote | 内部 BlockNote JSON；官方说明 Markdown 导入导出有损 | 很高，接近 Notion | 自定义块能力强 | Core 为 MPL-2.0 | 不符合 Markdown 唯一数据原则 |
| Tiptap | Markdown 功能仍标为 Beta | 很高 | 很强 | Core 为 MIT | 当前不以 Beta Markdown 作为存储边界 |
| SiYuan Protyle | `.sy`/BlockDOM 是真实数据，Markdown 是导入导出格式 | 很高 | 与 SiYuan Kernel 深度绑定 | AGPL-3.0 | 不直接嵌入 |

## Vditor

Vditor 是当前最值得先做兼容性实验的方案：

- 原生 JavaScript/TypeScript 组件，不要求 React；
- 已包含 WYSIWYG、即时渲染和分屏预览三种编辑模式；
- 已包含公式、表格、任务列表、大纲、上传、粘贴处理等通用能力；
- `getValue`/`setValue` 以 Markdown 字符串作为交互边界；
- `customRenders` 可以按代码块语言挂接渲染逻辑，和现有 `smiles`、`sdf`、`xyz`、`gjf` fenced code 约定相符；
- MIT 许可证适合当前项目。

但“支持 Markdown”不等于“原文逐字无损”。Vditor 底层解析器可能对空白、列表、表格或 HTML 做规范化；`customRenders` 也可能只负责展示，而不能提供完整的富交互节点编辑。两点都必须用真实文章验证，不能只根据演示页面决定。

## Milkdown

Milkdown 的优势是架构边界更清晰：Markdown-first、headless、插件驱动，并直接建立在 remark 和 ProseMirror 上。对本项目而言，可以为公式和分子代码块定义明确的 parse/serialize 规则，再为预览建立 NodeView。

它比 Vditor 更容易做到“科学块是编辑器中的一等节点”，但菜单、上传、资源浏览、节点交互以及部分 Notion 风格体验仍需要组装和维护。因此它是兼容性或扩展性不满足时的后备方案，不是最低成本方案。

## 明确排除的方案

### BlockNote

BlockNote 很适合快速获得 Notion 风格的块编辑体验，但官方文档明确说明 Markdown 导入/导出是有损转换，其完整文档格式是 BlockNote JSON。采用它就会让 Markdown 退化为交换格式，与 `blog/<slug>/index.md` 是唯一正文数据的决定冲突。

### Tiptap

Tiptap 的节点扩展和 UI 生态成熟，但其 Markdown 功能仍处于 Beta。它可以减少一部分 ProseMirror 样板代码，却不能消除本项目最关键的 Markdown 往返风险，当前不作为主候选。

### SiYuan Protyle

Protyle 不是独立发布的通用编辑器组件，依赖 SiYuan App、Kernel API、WebSocket、BlockDOM 与 `.sy` 数据模型。直接抽取等于长期维护一个 SiYuan 前端分支，详细结论见 [SIYUAN_EDITOR_EVALUATION.md](./SIYUAN_EDITOR_EVALUATION.md)。

## 兼容性实验方案

使用独立的 `/studio/editor-lab` 并排运行候选编辑器，不替换当前 `/studio/`。Vditor 第一轮已经完成并被排除；下一轮切换为 Milkdown Crepe。

### 测试材料

必须使用当前两篇真实文章，并补充一个边界用例 fixture，覆盖：

- YAML frontmatter、未知字段、空行和 HTML；
- 行内公式、块公式、`mhchem` 的 `\\ce{}`；
- `smiles`、`sdf`、`xyz`、`gjf` fenced code；
- `@file ./assets/...` 外部科学文件引用；
- 图片相对路径、引用式链接和脚注；
- 表格、任务列表、嵌套列表、中文输入和混合粘贴。

### 必测行为

1. 加载后不编辑，读取 Markdown，比较差异。
2. 分别编辑普通段落、公式和四类科学块，再保存和重新加载。
3. 在中文输入法组合阶段测试撤销、回车、反斜杠和行内公式。
4. 从网页、Word 和 Markdown 源码粘贴混合内容。
5. 验证自定义渲染器在滚动、切换模式、撤销和内容更新后不会重复挂载或泄漏。
6. 验证 RDKit 与 3Dmol.js 可以延迟加载，不阻塞普通文章编辑。

### 通过门槛

- 未编辑保存时，不得发生语义损坏；如果编辑器必然格式化文本，必须先定义并接受统一的 canonical Markdown 规则，不能静默改写。
- 未知 frontmatter 和 Markdown 节点不得丢失。
- 四类科学 fenced code 必须原样往返，并能显示预览。
- 中文输入、粘贴、表格、列表、撤销和重做没有阻断性问题。
- Studio 的文件 API 继续只读写 article bundle，不引入第二套文档数据库。

## 下一步

下一实现切片不是重写 `/studio/`，而是：

1. 保留 Vditor 实验结果，不迁移到正式 `/studio/`。
2. 把 `/studio/editor-lab` 的编辑内核换成 Milkdown Crepe。
3. 先验证块手柄、加号、斜杠菜单、浮动工具栏与 Notion 式留白体验。
4. 复用相同的 round-trip fixture，记录所有 Markdown 规范化差异。
5. 加入一个科学 fenced code 节点，验证扩展和序列化生命周期。

## 主要资料

- Vditor 仓库与 API：https://github.com/Vanessa219/vditor
- Vditor 问题列表：https://github.com/Vanessa219/vditor/issues
- Milkdown 仓库：https://github.com/Milkdown/milkdown
- Milkdown 官方文档：https://milkdown.dev/docs
- BlockNote Markdown 导入导出：https://www.blocknotejs.org/docs/features/import/markdown
- Tiptap Markdown 文档：https://tiptap.dev/docs/editor/markdown
- SiYuan 仓库：https://github.com/siyuan-note/siyuan

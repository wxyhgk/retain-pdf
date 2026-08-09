# SiYuan 编辑器复用评估

## 结论

不建议把 SiYuan 的 Protyle 编辑器源码直接搬进当前 Astro Studio。

推荐方案是：

1. 不直接复用 Protyle；通用编辑器主线已改为评估成熟的可嵌入方案，见 [EDITOR_ENGINE_EVALUATION.md](./EDITOR_ENGINE_EVALUATION.md)。
2. 将 Markdown 与 Article Bundle 继续作为唯一真实数据。
3. 如果以后确实需要 SiYuan 的数据库、双链和查询能力，把完整 SiYuan 作为独立服务，通过 API 做可选同步，不把 Protyle 源码嵌入 Studio。
4. 可以单独评估 Lute 作为 Markdown 转换/兼容性工具，但不直接采用 SiYuan 的 `.sy` 文档格式。

## 为什么不能当成普通编辑器组件使用

SiYuan 的可编辑内核是 `app/src/protyle/` 下的 Protyle。它并不是发布在 npm 上的独立编辑器库：

- `Protyle` 构造函数要求传入完整的 SiYuan `App`。
- 初始化过程会读取 `app.plugins`、`window.siyuan.config` 和 `window.siyuan.storage`。
- 编辑器会创建 SiYuan 的 WebSocket `Model`。
- 文档读取、事务保存、引用、查询和资源操作会请求大量 `/api/...` Kernel 接口。
- WYSIWYG 模块直接依赖菜单、布局、移动端、数据库视图、搜索、同步、付费状态等应用模块。
- 事务层操作的是带块 ID 的 BlockDOM，而不是一段独立 Markdown 字符串。

因此，抽取 Protyle 不是“复制一个组件”，而是长期维护一个 SiYuan 前端分支，并为它仿制相当一部分 Kernel 与全局运行环境。

## `Protyle` 导出包的误区

SiYuan 的 `webpack.export.js` 会生成一个名为 `Protyle` 的 UMD 包，但入口是 `app/src/protyle/method.ts`。

这个包只暴露以下静态渲染能力：

- KaTeX 公式渲染
- Mermaid、Graphviz、Flowchart 等图表渲染
- 代码高亮
- HTML、图表和脑图渲染

它用于导出的 HTML/PDF 预览，不包含 WYSIWYG 编辑器，不能替代当前 ProseMirror。

## 数据模型冲突

当前项目的目标是：

```text
blog/<slug>/index.md = 唯一正文数据
```

SiYuan 的真实文档存储则是 `.sy` JSON/BlockDOM，并通过 Kernel 建立块 ID、引用、索引和数据库。标准 Markdown 是导入/导出格式，不是内部唯一数据。

如果采用完整 SiYuan：

```text
index.md
  -> 导入 SiYuan
  -> .sy + 块 ID + 数据库
  -> 编辑
  -> exportMdContent
  -> 覆盖 index.md
```

这会产生两份真实数据、格式归一化、块 ID 生命周期、图片路径映射和双向同步冲突，与当前“Git 中的 Markdown 永远为准”原则相反。

## 许可证影响

- SiYuan 主仓库是 AGPL-3.0。
- 直接复制、修改并通过网页提供 Protyle，需要认真承担 AGPL 对网络服务源代码提供等义务。
- Lute 独立仓库使用 Mulan PSL v2，复用边界相对宽松，但仍需保留许可证和版权声明。

许可证结论只用于技术选型提醒；实际发布前仍应进行正式许可证审核。

## 三条路线比较

| 路线 | Markdown 唯一数据 | 工作量 | 升级成本 | 推荐度 |
| --- | --- | ---: | ---: | --- |
| 直接抽取 Protyle | 很难保持 | 很高 | 很高 | 不推荐 |
| 完整运行 SiYuan，通过 API 同步 | 否，形成双数据源 | 中到高 | 中 | 仅作为未来可选集成 |
| 保留 ProseMirror，借鉴 Protyle 交互 | 是 | 可控 | 可控 | 推荐 |

## 可以借鉴的 Protyle 能力

下一步可以按 Protyle 的成熟交互逐项实现：

1. 左侧块手柄与拖拽排序。
2. `/` 菜单和中文关键词检索。
3. 选区悬浮格式工具栏。
4. 空段落快速切换标题、列表、公式和科学块。
5. 公式默认渲染，选中后编辑原始 LaTeX。
6. 图片上传、缩放、题注和资源路径管理。
7. 块折叠、标题大纲和聚焦模式。
8. 表格编辑和任务列表。

这些能力可以建立在现有 Markdown codec、ProseMirror schema 和 Science NodeView 上，不需要引入 `.sy` 或 SiYuan Kernel。

## 可执行的下一步

先做一个“Protyle 交互层”迭代：

- 不更换当前 ProseMirror 文档模型。
- 增加块手柄、拖拽排序和 `/` 菜单。
- 把公式 NodeView 的交互统一成 Protyle 风格。
- 选择 SMILES、SDF、XYZ、GJF 作为第一批科学块 NodeView。
- 用 SiYuan 只做交互参考，不复制其 AGPL 源码。

完成这一层后，再评估是否有必要单独接入 Lute 做更复杂的 Markdown 兼容。

## 主要参考

- SiYuan 主仓库与架构：https://github.com/siyuan-note/siyuan
- Protyle 编辑器入口：https://github.com/siyuan-note/siyuan/blob/master/app/src/protyle/index.ts
- WYSIWYG 实现：https://github.com/siyuan-note/siyuan/blob/master/app/src/protyle/wysiwyg/index.ts
- 块事务实现：https://github.com/siyuan-note/siyuan/blob/master/app/src/protyle/wysiwyg/transaction.ts
- 导出渲染包入口：https://github.com/siyuan-note/siyuan/blob/master/app/src/protyle/method.ts
- SiYuan API：https://github.com/siyuan-note/siyuan/blob/master/API.md
- Lute：https://github.com/88250/lute

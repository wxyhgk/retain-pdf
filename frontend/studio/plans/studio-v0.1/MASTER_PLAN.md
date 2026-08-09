# Studio v0.1 主计划

## 目标

把现有的 Markdown 源码编辑页升级为一个接近 Notion 使用方式的本地科学笔记平台，同时保持以下原则：

- `blog/<slug>/` 是一篇文章的完整工作区。
- `index.md` 是正文的唯一真实数据，不额外保存一份编辑器 JSON。
- 可视化编辑、源码编辑、博客构建使用同一份 Markdown。
- 公式、二维分子、三维分子和轨迹是正式的科学内容块，不是预览页上的临时 DOM 补丁。
- 数据库、搜索索引、恢复记录都只是可以从 Article Bundle 重建的辅助数据。

## 三个工作流

### A. 编辑器内核

负责类似 Notion 的写作体验和 Markdown 保真转换。

主要范围：

- ProseMirror 可视化编辑器。
- CodeMirror 源码模式。
- 两种模式共享的 `ArticleStore`。
- Markdown 解析、局部序列化和诊断。
- Frontmatter Properties 面板。
- Slash menu、块选择、移动、撤销和重做。
- 科学块的编辑器 NodeView 接口。

不负责：

- 直接读写磁盘。
- 上传文件或解析真实文件路径。
- 博客发布、Git checkpoint 和全文索引。

建议文件归属：

```text
src/studio/
├── document/
├── editor/
│   ├── commands/
│   ├── nodeviews/
│   └── slash-menu/
└── state/
```

首轮交付 E0：

- 建立 Markdown fixture 测试集。
- 完成 frontmatter/body 分割和顶层块原文切片。
- 保证未编辑文档 `serialize(parse(source)) === source`。
- 未知 Markdown、HTML、YAML 字段可以原样保存。

### B. 内容数据层

这组暂不叫“数据库组”。当前不需要用数据库替代文件系统；它负责 Article Bundle、API、资源、恢复、版本和以后可重建的索引。

主要范围：

- Article Repository 与统一 schema。
- 文章列表、创建、读取、保存和删除。
- `img/`、`assets/`、`ai/`、`article.config.yaml` 与机器生成的 `article.views.json` 的安全访问。
- SHA-256 revision 乐观锁和原子写入。
- 本地自动恢复、Git checkpoint、发布状态和搜索索引。
- 修复 `draft: true` 文章仍可能生成公开路由的问题。

不负责：

- 编辑器内部状态和光标行为。
- Markdown 块的视觉表现。
- 科学格式渲染。

建议文件归属：

```text
src/studio/server/
├── article-repository.ts
├── bundle-paths.ts
├── schemas.ts
├── atomic-write.ts
├── file-repository.ts
├── recovery-store.ts
├── git-checkpoints.ts
├── search-index.ts
└── http/
```

非 Git 辅助状态放在：

```text
.studio/
├── recovery/
├── cache/
├── trash/
├── tmp/
└── locks/
```

首轮交付 D1：

- 建立唯一的 Article Repository 和 frontmatter/config schema。
- 让 Studio 和 Astro 共用校验逻辑，不再用正则单独提取标题。
- 保留现有读取、保存与 revision 冲突检测行为。
- 修复草稿公开路由泄漏。

### C. 科学组件层

负责公式、分子、图片、附件和轨迹的统一内容模型与渲染运行时。

主要范围：

- `math`、`molecule-2d`、`molecule-3d`、`image`、`attachment`、`trajectory` 内容块。
- KaTeX、RDKit 和 3Dmol.js 的懒加载与生命周期管理。
- SMILES、SDF、MOL、XYZ、GJF/COM、PDB 等格式识别。
- 博客渲染适配器和 Studio NodeView 适配器。
- 内联内容与 `@file ./assets/...` 引用的统一模型。

不负责：

- 向磁盘写文件。
- 决定文章保存时机。
- 自行拼接或信任文件系统路径。

建议文件归属：

```text
src/science/
├── model/
├── parsers/
├── runtime/
└── resources/

src/components/science/
src/studio/blocks/science/
src/plugins/science-markdown/
```

首轮交付 W0/W1：

- 为当前 `ChemistryRenderers.astro` 建立特征测试。
- 抽取共享格式解析器和渲染 runtime。
- 保持现有博客效果不变。
- 明确资源解析接口，但暂不实现大型轨迹播放器。

## 三组之间的固定契约

### 文档保存契约

编辑器只接收并提交完整 Markdown 和 revision：

```ts
type ArticlePayload = {
  slug: string;
  source: string;
  revision: string;
  capabilities: {
    writable: boolean;
    visualEditor: boolean;
  };
};
```

```http
GET /api/studio/articles/:slug
PUT /api/studio/articles/:slug
```

保存请求使用：

```json
{
  "source": "完整 Markdown",
  "expectedRevision": "sha256"
}
```

编辑器不接触绝对路径，数据层不理解 ProseMirror 文档。

### 科学块契约

Markdown 继续使用 fenced code block：

````md
```smiles
CCO
```

```xyz
@file ./assets/water.xyz
```
````

共享模型：

```ts
type ResourceRef =
  | { kind: 'inline'; text: string }
  | { kind: 'file'; path: string };

type ScienceBlock = {
  kind: 'math' | 'molecule-2d' | 'molecule-3d' | 'trajectory';
  format: string;
  resource: ResourceRef;
};
```

- 科学组件只发出编辑、重试、替换文件、改变视图等 intent。
- 编辑器负责把 block 序列化回 Markdown。
- 数据层负责校验路径、读取和写入文件。
- `@file` 只允许当前文章内的 `./img/` 或 `./assets/`，拒绝绝对路径、`..` 和符号链接越界。

## 开发顺序

三个工作流可以并行，但必须通过共同的集成门。

### 阶段 0：基线与契约

并行进行：

- 编辑器组完成 E0 Markdown 保真测试。
- 数据组完成 D1 Repository/schema，并修复 draft 路由。
- 组件组完成 W0/W1 特征测试和解析器抽取。

集成门：

- 当前文章打开后不做修改直接保存，Git diff 必须为零。
- 当前博客构建与科学渲染不能退化。
- 三组只能通过本文约定的 payload、resource 和 intent 交互。

### 阶段 1：可用的 Notion 式编辑

- 编辑器组：ProseMirror 基础块、单栏编辑、源码模式切换。
- 数据组：文章 CRUD、资源列表和文件 API。
- 组件组：语义化 Science Block，以及博客和 Studio 两个适配器。

集成门：

- 可以新建文章、编辑标题/正文、保存并由 Astro 正常构建。
- 可视化与源码模式反复切换不会丢失未知语法。
- 公式、SMILES、SDF、XYZ、GJF 至少能显示错误状态并恢复原始内容。

### 阶段 2：文章工作区

- Properties 面板与 YAML 局部修改。
- Slash menu 和块操作。
- `img/` 图片上传、`assets/` 文件管理和 `@file` 插入。
- 自动恢复与外部文件修改冲突 UI。

### 阶段 3：科学笔记完善

- 科学块原位编辑和视图切换。
- 大文件按需读取。
- 多帧 XYZ/轨迹播放。
- 科学组件性能、WebGL/WASM 释放和移动端退化。

### 阶段 4：版本与发布

- 单文章 Git checkpoint、diff 和恢复。
- 草稿到发布的明确操作。
- 可重建的全文索引；只有规模或并发确实需要时再引入 SQLite。
- Studio 稳定后再恢复 `plans/ai-agent-integration/PLAN.md` 中的 AI 工作流。

## 避免并行冲突的规则

- `src/studio/main.ts` 只做装配，不允许任何一组继续把核心实现堆进去。
- 编辑器组不修改 server/repository；数据组不修改 ProseMirror schema；组件组不实现文件写入。
- 共享类型先在接口文件中评审确定，再由各组实现适配器。
- 跨组改动拆成“接口提交”和“实现提交”，不在一个提交中大范围移动三组文件。
- 每个阶段先合并测试与契约，再合并 UI。
- 不提交用户文章正文的临时编辑内容。

## v0.1 验收标准

- 默认进入可视化编辑，源码模式是可选工具，而不是主界面。
- 常用块可以通过 `/` 菜单创建，并支持撤销/重做。
- 不修改直接保存时，`index.md` 字节不变化。
- 修改一个块不会重写未修改块；修改一个 Property 不会重排其他 YAML。
- 未知 Markdown、HTML、配置字段不会丢失。
- 公式及核心 2D/3D 化学块可原位渲染、编辑、报错和恢复。
- `@file` 不会把大型文件内联进 Markdown，也不能逃出文章目录。
- 自动恢复、revision 冲突和 Astro 构建均通过验证。
- 草稿不会出现在列表、RSS、站点地图或可访问的公开文章路由中。

## 立即执行的第一个迭代

先做基础层，不马上堆更多外观：

1. 编辑器组建立保真 codec fixture 与测试。
2. 数据组抽出 Article Repository，并修复 draft 路由。
3. 组件组为现有化学渲染建立测试并抽取 parser。
4. 三项都通过后，再接入 ProseMirror 的段落、标题、列表和代码块。

这四步完成后，Studio 才具备继续做 Notion 式交互的可靠地基。

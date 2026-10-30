# 翻译编辑部（可视化组件）

把翻译 agent 里各个角色怎么分工、一页稿子怎么在他们之间流转画出来。书详情「进度」面板里，翻译 agent
跑的任务接真实事件（见下面「真实进度」）；演示页用模拟数据回放。

- 代码：`frontend/web/src/features/editorial-room/`
- 演示页：`frontend/web/editorial.html`，默认就是用户会看到的样子；`?debug=1` 是调试视图，`?scenario=quota` 打开「额度用完停下」的场景
- 测试：`frontend/web/tests/editorial-room/`

## 两个视图

给用户看的是 `EditorialStage`：一眼看懂「几位编辑在接力翻这本书，翻到第几页了」，不需要读字。

- 上面书名、一条进度条和「第 3 / 6 页」；底下一行「正在……」，术语表改了出一句「术语表已更新」（过几条事件收起），有块退回原文时出「需要人看 N 处」。
- 中间是 2.5D 编辑部全景（`ui/office/`），斜 45° 俯视的一间办公室：
  - 后排：调度机器人（墙上看板挂着还没派的页）→ 通读员 → 译者；拐角是质检闸门，灯亮绿、黄、红；
  - 前排：审校 ← 修订机器人 ← 档案柜，定稿的页一张张叠上去，退回原文的那页标红；
  - 一条传送带串起来，稿纸带着页码沿带子从一个工位滑到下一个，退回重翻时从闸门滑回译者；
  - 墙上的术语表白板（版本号、歧义单便签），地上一只「待人看」筐，最前面一排灰色空桌是筹备中的工位。
- 忙的角色头上一个词（「读书中」「翻译第 3 页」「审第 2 页」「修订」），细节在悬停提示里。没有数字卡片、模型名、事件列表、按钮。
- 小人和机器人都是自己画的线描 SVG；立体感靠同一个皮肤色的三档深浅（`color-mix`），五套皮肤都跟着变。

调试视图是 `EditorialRoom`，信息全：

| 区域 | 内容 |
|---|---|
| 顶部 | 书名、模型、状态（通读中 / 翻译中 / 停下了的原因 / 全部定稿） |
| 累计数字 | 定稿几页、合格、警告、不合格、退回原文、重翻、审校改了、没收、术语表第几版、歧义单 |
| 车间 | 七个工位排成流水线：调度 → 通读员 → 译者 → 质检 → 审校 → 修订 → 归档。模型干的活画小人，程序干的画成机器。每个工位显示在不在忙、手上是哪一页、一句现在在做什么 |
| 侧栏 | 术语表白板（版本号、最近 5 次改动、歧义单便签）、「待人看」筐 |
| 每页走到哪 | 每页一个小格，颜色表示阶段，有块退回原文的带红点 |
| 广播 | 最近 6 条事件，说成给人看的话 |
| 筹备中 | 目录 agent、重排 agent、表格 agent、原文核对员、一致性检查员，灰色占位 |

小人是自己画的线描 SVG，没有用外部素材。颜色全走皮肤的语义变量，五套皮肤都跟着变；小人和机器只在有活时动，停下或做完就静止。

## 事件和状态

后端事件格式（`editorial.v1`）和各字段的取值全集以后端文档为准（`docs/ops/planning/translation-agent/` 下的「编辑部可视化和事件格式」），前端的类型在 `domain/events.ts`，中文文案在 `domain/narration.ts`。前端怎么处理：

- `parseEditorialEvent`：版本不是 `editorial.v1`、`type` 不认识的整条跳过；缺的字段给 0 或空串；多的字段不管。后端约定只加不改，新加的事件类型前端没跟上时只是不显示。
- `reduceEditorialEvent`：一条事件叠到状态上，纯函数。每页有一个阶段（待派、已派、翻译中、质检、退回重翻、审校中、修订中、定稿）。工位手上是哪一页不单独记，由阶段推出来；同一工位有几页时显示最近动过的那页。
- 质检数按每页最近一次算，重翻的块不重复计；定稿后按 `page_done` 的终态算。
- `run_stopped` 只改状态和原因，各页停在原地。
- 续跑：同一串事件里第二条 `run_started` 不清空。术语表、歧义单、待人看筐、通读结果和已定稿的页都留着；第 1..`resumed` 页标定稿（这一轮不再发它们的事件），上一轮停在半路的页回到「待派」。`page` 是全书里的第几页，续跑接着编号。
- `translate_call` 按 `role` 记到工位：缺省和 `translator` 是译者，`reviewer` 算审校中，`reviser` 算修订中，`reader` 不动页。
- 质检代码分 error、warn、info 三级；广播只念 error 和 warn，info（`hedge_lost`、`person_lost`、`review_*`）只算指标不念。不认识的代码照原样显示。

## 真实进度

接口 `GET /api/v1/jobs/:job_id/progress/editorial?after=<n>`（说明在 `docs/api/02-进度事件/03-编辑部事件.md`），请求函数是 `@retainpdf/api/jobs-events` 的 `fetchEditorialEvents`。

- 哪些任务有：翻译覆盖接口的 `jobs[].engine === "agent"` 或 `has_editorial_events`（`book-detail/domain/translation-coverage.ts` 的 `hasEditorialRoom`）。legacy 任务不去读。
- 怎么读（`domain/live-feed.ts`）：`after` 带上次的 `next_after`，`has_more` 就接着取；`next_after` 比带去的 `after` 小说明事件文件重开了，从 0 重取，之前叠的状态作废。
- `ui/useEditorialLive.ts`：任务在跑时每 3 秒取一次新的，收到 `run_done` 就停；不在跑时只读一次。读失败保留上一次的画面。
- `ui/EditorialLivePanel.tsx`：没有事件时什么都不画；在跑时是用户视图跟着动；跑完 / 停下后停在最后的样子，可以点「回放这次翻译」。
- 样式：主页入口 `src/styles/entries/home.css` 只引用户视图用到的几份（`EditorialMotion`、`EditorialStage`、`office/EditorialOffice`、`EditorialFigure`、`EditorialRobot`、`EditorialLivePanel`），调试视图不进主页。共用的动效在 `EditorialMotion.css`，两个入口都引。

回放用 `<EditorialRoomReplay events={events} />`：默认是用户视图、循环播放、没有按钮；加 `debug` 换成调试视图和回放按钮。按事件 `ts` 的间隔播放，每两条之间压在 0.52–1.8 秒，再按倍速（0.5×–4×）缩短。可以暂停、单步、拖进度条、从头播。

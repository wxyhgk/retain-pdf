# 前端文档

这里存放当前生产前端的架构、联调和状态检查资料。

- [后端改动交接](./backend-changes-handoff.md) —— 需要前端配合的新端点/新字段/新错误码
- [前端状态 Smoke](./status_smoke.md)
- [图书馆数据层 API](./library-api.md)
- [统一 React SPA 目标架构](./spa-architecture.md)
- [主题皮肤系统](./theme-system/THEME_SYSTEM.md)
- [主页与阅读器软导航](./reader-home-navigation/soft-reader-no-refresh.md)
- [阅读页改译文](./reader-block-edit.md) —— 在译文的框里直接改一段、看修订历史，攒几处再点一次重新排版
- [阅读页对比版本、待处理](./reader-version-compare-issues.md) —— 左栏换成另一份译文逐段对着看、一键换用；底栏列出没翻成和质检挑出问题的段落，N 跳下一处
- [上传弹窗（添加 PDF）](./upload-dialog.md) —— 标题、模式、普通 / Agent 翻译、流程条、拖放区，从上到下各是什么
- [阅读页 Ctrl + 滚轮缩放、深色文档](./reader-zoom-dark.md) —— 手势中只做 CSS 预览、停手才重画，以鼠标为中心；书页黑底白字（底栏开关、D），画布反色、叠层换深色
- [阅读页画笔](./reader-ink.md) —— 书页上右键出画笔小菜单（Shift+右键是浏览器菜单），P 进出画笔模式，笔迹按页按栏存在本机
- [阅读页悬停框的「改」「复制」放哪](./reader-hover-tools.md) —— 候选位置 + 碰撞检测，放框外不挡字，页边窄换图标版
- [阅读页第二栏（宿主页签）](./reader-side-pane.md) —— 宿主往顶栏加一个页签（学习系统的「学习」），左书右宿主内容；阅读器只给按锚点跳、页边小圆点、当前页
- [学习区](../../../frontend/packages/learning/README.md) —— 「学习」页签的右栏：本章地图、知识点卡、做题、白板讲解、随时提问（原型，写死 Szabo 第 3 章）
- [翻译编辑部可视化组件](./editorial-room.md) —— 翻译 agent 各角色分工的动画，editorial.v1 事件回放
- [白板讲解板](../../../frontend/packages/whiteboard/README.md) —— 学习系统用：模型写 JSON 讲解脚本，白板一步步画（公式、箭头、批注、能级图）；演示页 `whiteboard.html`，设计见 [学习系统](../../ops/planning/learning-system/README.md)
- [历史前端优化记录](../../ops/reports/frontend-optimization-notes.md)
- [React 迁移计划与审计](../../ops/planning/frontend-migration/)
- [前端状态 Smoke 最新报告](../../ops/reports/frontend-status-smoke-latest.json)

主要代码入口：

- `frontend/web/src/app/`（装配层）
- `frontend/web/src/features/`（15 个产品功能）
- `frontend/web/src/platform/`、`frontend/web/src/ui/`
- `frontend/web/src/styles/`
- `frontend/packages/reader/`
- `frontend/packages/ui/`
- `frontend/packages/whiteboard/`（白板讲解板）
- `frontend/packages/learning/`（学习区）

桌面端同步：

- `frontend/web/` 是桌面端前端 bundle 的输入目录。
- 桌面打包入口和校验脚本位于 `frontend/desktop/`；不要手工维护第二份前端源码。

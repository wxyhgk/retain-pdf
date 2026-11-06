# 前端文档

这里存放当前生产前端的架构、联调和状态检查资料。

- [后端改动交接](./backend-changes-handoff.md) —— 需要前端配合的新端点/新字段/新错误码
- [前端状态 Smoke](./status_smoke.md)
- [图书馆数据层 API](./library-api.md)
- [统一 React SPA 目标架构](./spa-architecture.md)
- [主题皮肤系统](./theme-system/THEME_SYSTEM.md)
- [主页与阅读器软导航](./reader-home-navigation/soft-reader-no-refresh.md)
- [翻译编辑部可视化组件](./editorial-room.md) —— 翻译 agent 各角色分工的动画，editorial.v1 事件回放
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

桌面端同步：

- `frontend/web/` 是桌面端前端 bundle 的输入目录。
- 桌面打包入口和校验脚本位于 `frontend/desktop/`；不要手工维护第二份前端源码。

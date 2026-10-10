// admin —— 商业版多用户的管理后台（admin.html）：账号列表（搜索 / 筛选 / 排序 / 分页 / 批量）、
// 单个账号（统计、重置密码、停用启用、改身份、软删除与恢复、发放扣减页数、账目、任务）。
// 只给多用户模式下的管理员；接口见 docs/core/api/index.md 13.5、13.6。
//
// domain/ 文案、排序、批量操作的计划与逐个执行、接口端口
// ui/     整页外壳、账号列表、单个账号、设置里的入口

export { AdminApp } from "./ui/AdminApp.jsx";
export { AdminConsoleEntry } from "./ui/AdminConsoleEntry.jsx";
export { defaultAdminApi, type AdminApi } from "./domain/admin-api.js";

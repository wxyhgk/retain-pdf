// user-guide —— 软件里的使用说明书。页面是 frontend/web/guide/<页>.md（按前端模块一页），跟着网页一起发。
//
// domain/ 有哪些页、链接指到哪、怎么画成 HTML（纯函数）；打开说明书的事件
//         render.ts 带着 marked，只给弹窗用（弹窗是懒加载的），不从出口导出，免得 marked 进主页首屏。
// ui/     说明书弹窗（目录 + 当前页），主页上挂的 UserGuideHost

export { UserGuideHost } from "./ui/UserGuideHost.jsx";
export { openUserGuide, USER_GUIDE_OPEN_EVENT } from "./domain/open.js";
export { GUIDE_HOME, headingSlug, parseGuideIndex, resolveGuideLink, resolveGuideAsset } from "./domain/guide-pages.js";

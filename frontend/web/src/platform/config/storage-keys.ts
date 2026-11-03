// 浏览器持久化 key 的唯一真源。
// 各 feature 不得再硬编码字符串；已有对外导出的模块保留 re-export 以免断链。
export const BROWSER_CONFIG_STORAGE_KEY = "retainpdf.browser.config.v1";
export const DEVELOPER_CONFIG_STORAGE_KEY = "retainpdf.developer.config.v1";

/** jobs：当前正在轮询的任务 id（localStorage）。 */
export const ACTIVE_JOB_STORAGE_KEY = "retainpdf.activeJobId";

/** settings：渲染字体族（localStorage）。 */
export const RENDER_FONT_STORAGE_KEY = "retainpdf.render.typst_font_family";

/** app-update：更新检查结果缓存（localStorage）。 */
export const UPDATE_CHECK_CACHE_STORAGE_KEY = "retainpdf:update-check:v1";

/** navigation：主页 ↔ 阅读器回程状态（sessionStorage）。 */
export const HOME_RETURN_STORAGE_KEY = "retainpdf.home.return.v1";

/** ui/theme：当前皮肤 id（localStorage）。 */
export const THEME_STORAGE_KEY = "retainpdf.theme";

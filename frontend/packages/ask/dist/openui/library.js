// 提问窗回答里的互动块用的组件库：OpenUI 的 Intelligent UI 组件库（@openuidev/intelligent-ui-library，MIT），去掉会访问外网的组件。
// 用户 2026-11-26 定：任意网址的图片、YouTube 去掉，HtmlView（沙盒里跑模型写的网页）留着。地图、搜图本来就不在这个库里。
// 改了这里要重新生成给 agent 的说明：npm run generate:openui --workspace @retainpdf/ask（scripts/openui-guide.mjs 里有同一份名单）。
import { library } from "@openuidev/intelligent-ui-library";
export const OPENUI_REMOVED_COMPONENTS = ["Image", "YouTube"];
export const askOpenUILibrary = library.extend({ components: { remove: [...OPENUI_REMOVED_COMPONENTS] } });

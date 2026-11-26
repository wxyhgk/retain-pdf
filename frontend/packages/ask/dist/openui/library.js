// 提问窗回答里的互动块用的组件库：OpenUI 的 Intelligent UI 组件库（@openuidev/intelligent-ui-library，MIT），去掉会访问外网的组件。
// 用户 2026-11-26 定：任意网址的图片、YouTube 去掉，HtmlView（沙盒里跑模型写的网页）留着。地图、搜图本来就不在这个库里。
// 改了去掉的名单要重新生成给 agent 的说明：npm run generate:openui --workspace @retainpdf/ask（scripts/openui-spec.mjs 里有同一份名单）。
//
// 只改渲染、不改规格的（说明不用重新生成）：Flashcard 不写 hint 时组件库显示英文「Tap to flip」，这里默认换成中文。
import { createElement } from "react";
import { library } from "@openuidev/intelligent-ui-library";
export const OPENUI_REMOVED_COMPONENTS = ["Image", "YouTube"];
export const FLASHCARD_HINT = "点一下翻面";
const flashcard = library.components.Flashcard;
/** Flashcard 原样，只是 hint 没写时给中文。 */
const chineseFlashcard = {
    ...flashcard,
    component: (args) => createElement(flashcard.component, { ...args, props: { ...args.props, hint: args.props?.hint || FLASHCARD_HINT } }),
};
export const askOpenUILibrary = library.extend({
    components: { remove: [...OPENUI_REMOVED_COMPONENTS], override: [chineseFlashcard] },
});

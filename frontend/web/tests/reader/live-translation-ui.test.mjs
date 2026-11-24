/** 翻译中阅读页的几处界面：进来就叠上译文、顶栏进度和「跳到最新」、没翻到的页提示、翻完提示看对照。 */
import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  EMPTY_LIVE_TRANSLATION_STATE,
  latestLiveTranslationPage,
  liveTranslationPageMissing,
  shouldAutoOpenLiveTranslation,
  shouldOfferLiveTranslationCompletion,
} from "../../../../frontend/packages/reader/src/shared/data/live-translation-state.ts";
import { ReaderWorkspaceTabs } from "../../../../frontend/packages/reader/src/components/react-pdf/ReaderWorkspaceTabs.tsx";

const page = (seq) => ({ lastEventSeq: seq });
const live = (over = {}) => ({
  ...EMPTY_LIVE_TRANSLATION_STATE,
  connection: "live",
  layoutByPage: new Map([[0, {}], [1, {}], [2, {}], [3, {}]]),
  pagesByPage: new Map([[0, page(3)], [2, page(9)], [1, page(5)]]),
  ...over,
});

test("「跳到最新」跳最近一次落进来的页，不是页码最大的页", () => {
  assert.equal(latestLiveTranslationPage(live()), 3);
  assert.equal(latestLiveTranslationPage(live({ pagesByPage: new Map([[5, page(2)], [1, page(7)]]) })), 2);
  assert.equal(latestLiveTranslationPage(EMPTY_LIVE_TRANSLATION_STATE), null);
});

test("没翻到的页才提示；一页都没有、或者任务停了，不在页上提示", () => {
  assert.equal(liveTranslationPageMissing(live(), 3), true);
  assert.equal(liveTranslationPageMissing(live(), 0), false);
  assert.equal(liveTranslationPageMissing(live({ pagesByPage: new Map() }), 3), false);
  assert.equal(liveTranslationPageMissing(live({ connection: "terminal", jobStatus: "failed" }), 3), false);
  assert.equal(liveTranslationPageMissing(undefined, 3), false);
});

test("翻译中、没有最终译文时打开就叠上译文；有最终译文或任务已结束时不自动开", () => {
  assert.equal(shouldAutoOpenLiveTranslation({ liveTranslationAvailable: true, sourceViewOnly: true, jobTerminal: false }), true);
  assert.equal(shouldAutoOpenLiveTranslation({ liveTranslationAvailable: true, sourceViewOnly: false, jobTerminal: false }), false,
    "有最终译文时自动叠加会出现左右都是中文");
  assert.equal(shouldAutoOpenLiveTranslation({ liveTranslationAvailable: true, sourceViewOnly: true, jobTerminal: true }), false);
  assert.equal(shouldAutoOpenLiveTranslation({ liveTranslationAvailable: false, sourceViewOnly: true, jobTerminal: false }), false);
});

test("看着翻完了才提示看对照；打开时已完成、已在对照、失败的都不提示", () => {
  const done = live({ connection: "terminal", jobStatus: "succeeded" });
  assert.equal(shouldOfferLiveTranslationCompletion({ state: done, sourceViewOnly: false, visibleMode: "source" }), true);
  assert.equal(shouldOfferLiveTranslationCompletion({ state: done, sourceViewOnly: false, visibleMode: "compare" }), false);
  assert.equal(shouldOfferLiveTranslationCompletion({ state: done, sourceViewOnly: true, visibleMode: "source" }), false);
  assert.equal(shouldOfferLiveTranslationCompletion({
    state: { ...done, pagesByPage: new Map() }, sourceViewOnly: false, visibleMode: "source",
  }), false, "打开时就已完成的书没跟实时译文");
  assert.equal(shouldOfferLiveTranslationCompletion({
    state: { ...done, jobStatus: "failed" }, sourceViewOnly: false, visibleMode: "source",
  }), false);
});

const tabs = (props) => renderToStaticMarkup(createElement(ReaderWorkspaceTabs, {
  mode: "source",
  documentReady: true,
  sourceViewOnly: true,
  onModeChange: () => {},
  ...props,
}));

test("顶栏显示进度，不在最新页时给「跳到最新」", () => {
  const html = tabs({
    liveTranslation: { visible: true, state: live(), onToggle() {}, latestPage: 3, currentPage: 1, onJumpToLatest() {} },
  });
  assert.match(html, /已译 3 \/ 4 页/);
  assert.match(html, /跳到最新/);
  assert.match(html, /点一下看原文/);
  const atLatest = tabs({
    liveTranslation: { visible: true, state: live(), onToggle() {}, latestPage: 3, currentPage: 3, onJumpToLatest() {} },
  });
  assert.doesNotMatch(atLatest, /跳到最新/);
});

test("翻完后顶栏换成「翻译完成 · 看对照」", () => {
  const html = tabs({ sourceViewOnly: false, liveTranslation: null, completion: { onOpenCompare() {} } });
  assert.match(html, /翻译完成 · 看对照/);
  assert.doesNotMatch(tabs({ sourceViewOnly: false }), /翻译完成/);
});

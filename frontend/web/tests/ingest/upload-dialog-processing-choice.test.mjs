// 上传弹窗「处理方式」状态的复位契约。
//
// 这两条锁的是同一类毛病：ocrOnly（「翻译」/「仅 OCR」Tab）和 translationOptionsOpen
// （「翻译选项」面板展开态）都只有「设置」没有「复位」的写入点，于是状态会在
// 用户看不见的时候悄悄跨越一次弹窗生命周期活下来。两者都不报错、不留痕迹，
// 只会在下一次打开弹窗时给出一个「用户没选过」的选择。

import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

import { createTranslationWorkflowDialogRuntime } from "../../src/features/ingest/domain/translation-workflow-dialog-runtime.js";

// --- 1. runtime 层：openUpload 必须先复位、再 open --------------------------
//
// 曾经的 openUpload 只调 uploadSessionPort.resetUploadSession()，而那个复位
// （upload/session.ts）只管 upload 域：清 upload state、复位文件卡片、清页码、
// 刷新提交态。ocrOnly 与选项面板展开态住在另外两个 store 里，全仓没有任何地方
// 复位过它们。
//
// 顺序也是契约的一部分：
//   - 复位必须早于 dialogStatePort.open()——open() 才是让 React 挂上弹窗内容
//     的那一拍，晚一步组件就会先读到上一次的脏快照；
//   - resetProcessingChoice 必须早于 resetUploadSession——后者末尾会
//     refreshSubmitControls()，而提交按钮文案是按 ocrOnly 算的，ocrOnly 没归位
//     的话这次刷新算出来的还是「开始 OCR」。
// 不写这条测试，任何一次「把复位挪到 open 之后 / 挪到 close 里」的重构都不会
// 被发现——单看快照两种顺序的最终值一模一样。

function createRuntimeHarness() {
  const calls = [];
  const runtime = createTranslationWorkflowDialogRuntime({
    dialogStatePort: {
      open: (mode) => {
        calls.push(`dialog.open:${mode}`);
        return { open: true, mode };
      },
      close: () => {
        calls.push("dialog.close");
        return { open: false, mode: "upload" };
      },
      setMode: (mode) => ({ open: true, mode }),
      getSnapshot: () => ({ open: false, mode: "upload" }),
      subscribe: () => () => {},
      store: null,
    },
    statusAreaPort: { hide: () => calls.push("statusArea.hide") },
    processingChoicePort: {
      resetProcessingChoice: () => calls.push("resetProcessingChoice"),
    },
    uploadSessionPort: {
      resetUploadSession: () => calls.push("resetUploadSession"),
    },
    documentRef: { getElementById: () => null },
  });
  return { runtime, calls };
}

test("openUpload 先复位处理方式、再复位上传会话，最后才打开对话框", () => {
  const { runtime, calls } = createRuntimeHarness();

  runtime.openUpload();

  assert.deepEqual(calls, [
    "statusArea.hide",
    "resetProcessingChoice",
    "resetUploadSession",
    "dialog.open:upload",
  ]);
});

test("走 openTranslationWorkflow 事件打开时同样复位（用户唯一的真实入口）", () => {
  const { runtime, calls } = createRuntimeHarness();

  // 「添加 PDF」按钮不直接调 openUpload，而是 dispatch 事件 → openFromEvent。
  runtime.openFromEvent({ detail: { mode: "upload" } });

  assert.ok(
    calls.indexOf("resetProcessingChoice") >= 0,
    "事件入口漏掉复位的话，用户点「添加 PDF」永远拿不到干净状态",
  );
  assert.ok(
    calls.indexOf("resetProcessingChoice") < calls.indexOf("dialog.open:upload"),
    "复位必须早于 open，否则组件挂载时读到的还是上一次的脏快照",
  );
});

test("没有注入 processingChoicePort 时 openUpload 不炸（端口是可选的）", () => {
  const opened = [];
  const runtime = createTranslationWorkflowDialogRuntime({
    dialogStatePort: {
      open: (mode) => opened.push(mode),
      close: () => {},
      setMode: () => {},
      getSnapshot: () => ({ open: false, mode: "upload" }),
      subscribe: () => () => {},
      store: null,
    },
    documentRef: { getElementById: () => null },
  });

  runtime.openUpload();
  assert.deepEqual(opened, ["upload"]);
});

// --- 2. 装配层：真实 composition 关掉再打开，两个状态都回默认 --------------
//
// 上面那条只证明 runtime 会调端口；这条证明 create-home-composition.ts 真的把
// 端口接到了 workflowView.setOcrOnly / uploadView.closeTranslationOptions 上。
// 实测复现过的用户路径：选「仅 OCR」并展开选项面板 → 关闭弹窗 → 再打开 →
// 还停在「仅 OCR」、面板还开着。用户上次做完一次 OCR，下次想翻译时弹窗默认
// 是 OCR 模式，很容易把一本想翻译的书误提交成 OCR 任务。
//
// 这里刻意断言 store 快照而不是 DOM：ui/hooks/use-store.ts 另有一个「store 在
// 无订阅者期间被改动后重新挂载会渲染过期快照」的问题，复位恰好就发生在组件
// 卸载期间。store 对不对与那条渲染问题是两件事，本文件只锁前者。

function installDom() {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "http://localhost/index.html",
  });
  const restore = [];
  for (const key of ["window", "document", "CustomEvent", "Event", "KeyboardEvent", "HTMLElement", "Node"]) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, key);
    restore.push([key, previous]);
    Object.defineProperty(globalThis, key, {
      value: dom.window[key] ?? dom.window,
      writable: true,
      configurable: true,
    });
  }
  return () => {
    for (const [key, descriptor] of restore) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
    dom.window.close();
  };
}

async function bootComposition() {
  const { createHomeComposition } = await import("../../src/app/home/create-home-composition.js");
  return createHomeComposition({
    fetchGlossaries: async () => ({ items: [] }),
    loadPersistedDeveloperConfig: () => ({}),
    loadPersistedBrowserConfig: () => ({}),
  });
}

test("弹窗重新以上传态打开时，ocrOnly 回 false 且翻译选项面板收起", async () => {
  const uninstallDom = installDom();
  try {
    const services = await bootComposition();

    services.workflowDialog.openUpload();

    // 用户在上一次会话里的两个选择
    services.workflowView.setOcrOnly(true);
    services.stores.uploadView.actions.openTranslationOptions({ maxPage: 12 });
    assert.equal(services.stores.workflowView.getSnapshot().ocrOnly, true);
    assert.equal(services.stores.uploadView.getSnapshot().translationOptionsOpen, true);

    services.workflowDialog.close();
    services.workflowDialog.openUpload();

    assert.equal(
      services.stores.workflowView.getSnapshot().ocrOnly,
      false,
      "重开弹窗必须回到「翻译」模式，否则下一份 PDF 会被默默当成 OCR 任务提交",
    );
    assert.equal(
      services.stores.uploadView.getSnapshot().translationOptionsOpen,
      false,
      "重开弹窗必须收起「翻译选项」面板",
    );

    services.dispose();
  } finally {
    uninstallDom();
  }
});

test("新端口只复位处理方式，清页码仍归 upload 会话复位管", async () => {
  const uninstallDom = installDom();
  try {
    const services = await bootComposition();

    services.workflowDialog.openUpload();
    services.stores.uploadView.actions.openTranslationOptions({ maxPage: 12 });
    services.stores.uploadView.actions.setPageRange({ start: "3", end: "9" });

    // 页码是 upload 会话的一部分，resetUploadSession 会清掉它——这里断言的是
    // 「清页码来自 upload 会话复位」这条既有行为没被新端口改写成别的语义。
    services.workflowDialog.close();
    services.workflowDialog.openUpload();

    const snapshot = services.stores.uploadView.getSnapshot();
    assert.equal(snapshot.translationOptionsOpen, false);
    assert.equal(snapshot.pageRangeStart, "");
    assert.equal(snapshot.pageRangeEnd, "");

    services.dispose();
  } finally {
    uninstallDom();
  }
});

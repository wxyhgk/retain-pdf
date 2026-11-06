/**
 * 「这本书能不能读」各处规则要一致：只要有过任何成功的、带译文的任务，就能对照阅读。
 *
 * 曾经的样子：书卡和详情左栏只看当前任务（active_job）是不是 succeeded；阅读器却按全部
 * 成功任务合并（后端 resolve_reading_target）。于是早就翻译完的书，一旦重新翻译 / 重新渲染
 * 正在跑或失败了 —— 书卡角标变「失败」、阅读按钮降级成「读原文」、详情的「对照阅读」消失，
 * 而后端其实一直能打开旧译文。
 *
 * 现在：书库列表接口带 `has_translation`（数据库查「有没有成功的非 OCR 任务」），书卡按它
 * 给阅读入口；详情用已经拉到的 translation-coverage（translated_pages > 0）或同一个字段；
 * 失败角标只表示「最近一次处理失败」，降级成次要提示，不再盖掉可读。
 */

import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { resolveLibraryReadPresentation } from "../../src/features/library/domain/card/library-card-semantics.js";
import { libraryCardBadge } from "../../src/features/library/domain/card/library-card-badge.js";
import { buildReadBookCardAction } from "../../src/features/library/domain/actions/read.js";
import { shapeDocumentCardItem } from "../../src/features/library/domain/documents/document-card-item.js";
import { BookCard, cardSignatureOf } from "../../src/features/library/ui/shell/BookCard.js";
import { BookListRow } from "../../src/features/library/ui/shell/BookListRow.js";
import {
  bookDetailHasTranslation,
  deriveBookDetailCoverState,
} from "../../src/features/book-detail/ui/use-book-detail-cover.js";

// 旧译文成功、最新一次（重新翻译）失败。
const failedRetranslation = {
  job_id: "job-retranslate",
  active_job_id: "job-retranslate",
  document_id: "doc-old-translation",
  workflow: "book",
  status: "failed",
  stage: "failed",
  library_only: false,
  has_translation: true,
  title: "早已翻译完的书",
  page_count: 12,
};
// 旧译文成功、最新一次（重新渲染）正在跑。
const runningRerender = {
  ...failedRetranslation,
  job_id: "job-rerender",
  active_job_id: "job-rerender",
  workflow: "render",
  status: "running",
  stage: "render",
};

test("书卡阅读入口：旧译文成功 + 最新任务失败 / 运行中，仍是「对照阅读」", () => {
  for (const item of [failedRetranslation, runningRerender]) {
    const presentation = resolveLibraryReadPresentation(item);
    assert.equal(presentation.label, "对照阅读", `${item.status}：阅读按钮被降级成 ${presentation.label}`);
    assert.equal(presentation.target, "job");
    assert.equal(presentation.documentId, "doc-old-translation");
  }

  // 点了走阅读器（阅读器按 document 解析出真正可读的那个任务 / 合并结果）。
  const calls = [];
  const [action] = buildReadBookCardAction(failedRetranslation, {
    onReader: (jobId, documentId) => calls.push(["job", jobId, documentId]),
    onReadSource: (documentId) => calls.push(["source", documentId]),
  });
  action.onClick();
  assert.deepEqual(calls, [["job", "job-retranslate", "doc-old-translation"]]);
});

test("没有任何译文时规则不变：失败 → 读原文", () => {
  const neverTranslated = { ...failedRetranslation, has_translation: false };
  assert.equal(resolveLibraryReadPresentation(neverTranslated).label, "读原文");
  const legacyPayload = { ...failedRetranslation };
  delete legacyPayload.has_translation;
  assert.equal(resolveLibraryReadPresentation(legacyPayload).label, "读原文", "老后端不带字段时按旧规则");
});

test("角标：失败只表示最近一次处理失败，可读的书降级成次要提示，不再是「失败」", () => {
  const badge = libraryCardBadge(failedRetranslation);
  assert.ok(badge, "最近一次失败仍要有提示");
  assert.notEqual(badge.label, "失败", "可读的书挂着醒目的「失败」");
  assert.doesNotMatch(badge.cls, /bg-destructive/, "次要提示不该用失败的实心底色");
  // 从没翻译成功过的书，失败照旧是「失败」。
  assert.equal(libraryCardBadge({ ...failedRetranslation, has_translation: false })?.label, "失败");
});

test("网格卡与列表行：旧译文 + 最新失败时给出对照阅读", () => {
  for (const Component of [BookCard, BookListRow]) {
    const markup = renderToStaticMarkup(React.createElement(Component, {
      item: failedRetranslation,
      onReader() {},
      onReadSource() {},
    }));
    assert.match(markup, /aria-label="对照阅读"/);
    assert.doesNotMatch(markup, /aria-label="读原文"/);
    assert.doesNotMatch(markup, /data-badge-label="失败"/);
  }
});

test("has_translation 从文档列表带到卡片 item，且进 memo 签名", () => {
  const document = {
    document_id: "doc-old-translation",
    active_job_id: "job-retranslate",
    title: "早已翻译完的书",
    has_translation: true,
  };
  const withProjection = shapeDocumentCardItem(document, { job_id: "job-retranslate", status: "failed" });
  assert.equal(withProjection.has_translation, true);
  const withoutProjection = shapeDocumentCardItem(document, null);
  assert.equal(withoutProjection.has_translation, true);
  // 投影里如果混进了同名字段，以文档列表为准（文档级事实）。
  const projectionSaysNo = shapeDocumentCardItem(document, { job_id: "job-retranslate", has_translation: false });
  assert.equal(projectionSaysNo.has_translation, true);

  assert.notEqual(
    cardSignatureOf(failedRetranslation),
    cardSignatureOf({ ...failedRetranslation, has_translation: false }),
    "签名不含 has_translation，后台补到字段后卡片不会重渲",
  );
});

test("详情左栏：旧译文 + 最新任务失败 / 运行中，仍给出对照阅读", () => {
  // 一：item 自带 has_translation（从书卡点进来）。
  for (const item of [failedRetranslation, runningRerender]) {
    const state = deriveBookDetailCoverState({ item });
    assert.equal(state.readerAvailable, true, `${item.status}：详情的对照阅读消失了`);
    assert.equal(state.readPresentation.label, "对照阅读");
  }

  // 二：item 不带字段（老后端 / 别处打开），靠已经拉到的 translation-coverage。
  const bare = { ...failedRetranslation };
  delete bare.has_translation;
  const coverage = { page_count: 12, translated_pages: 12, contributing_jobs: 1, segments: [], jobs: [] };
  assert.equal(bookDetailHasTranslation({ item: bare, coverage }), true);
  assert.equal(bookDetailHasTranslation({ item: bare, coverage: { ...coverage, translated_pages: 0 } }), false);
  assert.equal(bookDetailHasTranslation({ item: bare, coverage: null }), false);
  const fromCoverage = deriveBookDetailCoverState({ item: bare, hasTranslation: true });
  assert.equal(fromCoverage.readerAvailable, true);
  assert.equal(fromCoverage.readPresentation.label, "对照阅读");

  // 三：当前任务正在跑、全局 statusCard 也在播它 —— 旧规则会藏掉阅读入口。
  const runningCard = { snapshot: { jobId: "job-rerender", status: "running" } };
  const whileRunning = deriveBookDetailCoverState({ item: runningRerender, statusCardState: runningCard });
  assert.equal(whileRunning.readerAvailable, true, "重新渲染进行中，旧译文照样能读");

  // 对照：从没翻译成功过、当前在跑 → 仍然没有对照阅读。
  const firstRun = { ...runningRerender, has_translation: false };
  assert.equal(
    deriveBookDetailCoverState({ item: firstRun, statusCardState: runningCard }).readerAvailable,
    false,
  );
});

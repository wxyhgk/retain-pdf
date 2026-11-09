// retain-pdf-rendering/fit-model/run.js
// Host-agnostic: never reference the host application or plugin globals here.
//
// The pass order with its option sets (runLayoutParityEngine of fit.js):
// reads like a recipe; every step lives in tuning.js or passes/*.
(function (root, factory) {
  "use strict";
  const NAME = "run";
  const DEPENDENCIES = [["document", "./document"]];
  const isNode = typeof module === "object" && module && module.exports;
  const parts = isNode ? null : ((root.RetainPdfRendering || {}).FitModelParts || {});
  const resolved = DEPENDENCIES.map(([key, file]) => {
    const value = isNode ? require(file) : parts[key];
    if (!value) throw new Error(`retain-pdf-rendering/fit-model: load ${file.replace(/^(\.\.?\/)+/, "fit-model/")}.js before ${NAME}`);
    return value;
  });
  const api = factory(root, ...resolved);
  if (isNode) module.exports = api;
  else {
    const namespace = root.RetainPdfRendering = root.RetainPdfRendering || {};
    (namespace.FitModelParts = namespace.FitModelParts || {})[NAME] = api;
  }
})(typeof this === "object" && this ? this : globalThis, function (root, document) {
  "use strict";
  const { isStream, Select } = document;

  function runFit(run, steps) {
    const { all, scopedNodes, fitOptions, strictSourceFit } = run;
    const { capBodyNodes, tuneGroup, tuneEach, syncInheritedBodyFontToBodyGroup } = steps.tuning;
    const { demoteFalseSingleLineText, expandUnderfilledTitles, clusterTitleFontSizes, keepShortTitlesOnOneLine } = steps.titles;
    const { clampTranslatedOverflow, clampTranslatedCodeOverflow } = steps.clamps;
    const { enforceFinalTextCollisionSafety } = steps.finalAudit;
    const { fitLayoutFormulas } = steps.formulas;
    // Typography profile "retain": retain-pdf's body pipeline replaces the
    // shared body group, and non-body line ratios stay within its leading cap.
    const retainBody = steps.retainBody;
    const nonBody = retainBody ? retainBody.nonBodyOptions : (options => options);

    // ----- runLayoutParityEngine -----

    // Both parsed-source and translated reading views should start compact,
    // then fill until actual glyphs collide. The explicit strict-source view
    // remains an opt-in no-overflow inspection mode.
    const collisionFirstTextFit = !strictSourceFit;

    if (retainBody) retainBody.prepare();
    demoteFalseSingleLineText();
    // Initial pass: shrink-only so oversized un-fitted formulas do not become
    // false body-text barriers during shared font iteration.
    fitLayoutFormulas();

    const titleFitOptions = {
      label: "title",
      step: 0.25,
      minFont: 6.0,
      maxFont: 28.0,
      lineStep: 0.025,
      minLineRatio: 0.98,
      maxLineRatio: 1.35,
      // MinerU title boxes commonly describe the source ink band and are
      // only 10-12px tall.  Let translated headings extend beyond that box;
      // their actual glyphs are still checked against every other block's
      // bbox and against the page boundary below.
      allowOverflow: true,
      stopWhenFilled: false,
      avoidBlockOverlap: true,
      avoidPageOverflow: true,
      checkAllTextForCollisions: true,
      enforceInitialCollisionBackoff: true
    };
    // Article titles retain their own scale.  Every other heading shares one
    // document-wide font/line-height pair, limited by the first heading that
    // reaches another block.  Group peers remain barriers so adjacent
    // section/subsection headings cannot overlap each other.
    // Profile "retain": every heading is sized on its own like retain-pdf's
    // solve_title_fit (passes/retain-titles.js) instead of sharing one size.
    const retainTitles = steps.retainTitles;
    if (retainTitles) retainTitles.fitTitles(Select.anyTitle);
    else {
    tuneEach(Select.mainTitle, { ...titleFitOptions, label: "main-title" });
    tuneGroup(Select.otherTitle, { ...titleFitOptions, includeGroupPeers: true });
    expandUnderfilledTitles(Select.otherTitle, {
      ...titleFitOptions,
      maxFont: 42.0,
      titleFillAreaThreshold: 0.42,
      titleFillDimensionThreshold: 0.72
    });
    clusterTitleFontSizes(Select.anyTitle, 1.0);
    keepShortTitlesOnOneLine(Select.otherTitle, { maxCharacters: 12, maxBorrowPx: 18, maxWidthRatio: 1.35 });
    }
    const bodyMaxFont = Number(fitOptions.bodyMaxFont);
    if (retainBody) {
      // Non-body sizes are scheduled first (body paragraphs are then tested
      // against them, not against seed sizes); their safety net runs once the
      // body has settled.
      retainBody.scheduleNonBody();
      retainBody.fitBody(steps.retainSmoothing || null);
      retainBody.repairNonBody();
      // Headings were sized from their boxes; now that the body has settled,
      // back them off where their ink still touches something.
      if (retainTitles) retainTitles.backoffTitles(Select.anyTitle);
    }
    else {
    if (fitOptions.bodyNodeFontCaps) {
      capBodyNodes(scopedNodes(Select.body), {
        maxFont: Number.isFinite(bodyMaxFont) && bodyMaxFont > 0 ? Math.min(13, bodyMaxFont) : 13,
        minFont: 4.8,
        step: 0.25,
        minLineRatio: Number.isFinite(fitOptions.bodyCapMinLineRatio) ? fitOptions.bodyCapMinLineRatio : 1.12
      });
    }
    tuneGroup(Select.body, {
      label: "body",
      step: 0.5,
      minFont: collisionFirstTextFit ? 4.8 : undefined,
      minLineRatio: collisionFirstTextFit ? 1.12 : undefined,
      maxFont: Number.isFinite(bodyMaxFont) && bodyMaxFont > 0 ? Math.min(13, bodyMaxFont) : 13,
      lineStep: 0.04,
      maxLineRatio: 1.45,
      // 以原始可读字号作为统一基线。后续二次迭代只允许整组正文同步增大字号，
      // 避免从最小字号起步时被邻近表格或题注不必要地压缩正文。
      allowOverflow: !strictSourceFit,
      avoidBlockOverlap: true,
      avoidPageOverflow: collisionFirstTextFit,
      includeGroupPeers: collisionFirstTextFit,
      // 两栏正文由各自的框宽决定换行；相邻栏的文字不再成为全篇字号上限。
      // 同列上下块、重叠源框及页面边界仍照常保护。
      bodyColumnIndependentFit: true,
      // 只有正文按逐行实际文字检测；其余文本类型保持按布局边框判定。
      bodyTextCollisionGeometry: true,
      // 首轮统一字号本身也可能碰撞，因此先对整组字号做全局安全回退，
      // 再进入“统一字号、局部调行距”的正文二次迭代。
      enforceInitialCollisionBackoff: collisionFirstTextFit,
      // 标题与正文的边界经常完全相邻，首行字形顶部允许少量光学悬出；
      // 正文向下增长，因此仍严格保护底边和左右边界。
      ignoreTopOverflow: collisionFirstTextFit,
      sharedEdgeTolerance: 4.0,
      sharedHorizontalEdgeTolerance: 3.0,
      // 对未填满正文执行二次迭代，但所有正文始终共享同一个字号。
      continueUnderfilledNodes: collisionFirstTextFit,
      minTextFillRatio: 0.85,
      collisionMinLineRatio: 1.02,
      // 首轮共享增长只改字号；二次迭代发生碰撞时，仅允许碰撞源局部降低行距，
      // 禁止任何正文块单独降低字号。
      coupleFontAndLine: true,
      // 首轮字体碰撞后不再对整组放大行距，正文二次迭代会单独处理碰撞源行距。
      skipLineExpansionAfterFontCollision: true
    });
    syncInheritedBodyFontToBodyGroup();
    }
    // The DOM rules for lists, multi-line text, captions and references. The
    // "retain" profile sized all of them in retainBody (schedule/repairNonBody).
    if (!retainBody) {
    const genericTextOptions = {
      step: 0.35,
      minFont: collisionFirstTextFit ? 4.8 : undefined,
      minLineRatio: collisionFirstTextFit ? 0.98 : undefined,
      maxFont: 13,
      lineStep: 0.035,
      maxLineRatio: 1.85,
      allowOverflow: !strictSourceFit,
      avoidBlockOverlap: true,
      avoidPageOverflow: collisionFirstTextFit,
      ignoreTopOverflow: collisionFirstTextFit,
      startFromMinimum: collisionFirstTextFit,
      stopWhenFilled: !collisionFirstTextFit
    };
    tuneGroup(Select.list, nonBody({ ...genericTextOptions, label: "list", includeGroupPeers: collisionFirstTextFit }));
    // A recognized contents stream owns its row grid, indentation and page
    // column.  Treating it as generic multi-line prose lets the fitter
    // change its fixed 8.2px/1.22 baseline and can clip a dense directory.
    tuneEach(Select.debugTextMulti, nonBody({ ...genericTextOptions, label: "text" }));
    tuneEach(Select.textBlockMulti, nonBody({ ...genericTextOptions, label: "text-block" }));
    const captionOptions = {
      step: 0.25,
      minFont: 5.2,
      maxFont: 10.5,
      lineStep: 0.025,
      minLineRatio: 1.0,
      maxLineRatio: 1.55,
      allowOverflow: false,
      avoidBlockOverlap: true
    };
    for (const type of ["table_caption", "table_footnote", "chart_caption", "image_caption", "image_footnote"]) {
      tuneGroup(Select.captionType(type), nonBody({ ...captionOptions, label: `caption:${type}` }));
    }
    tuneGroup(Select.refs, nonBody({
      label: "refs",
      step: 0.25,
      minFont: 4.8,
      maxFont: 12,
      lineStep: 0.025,
      minLineRatio: 0.98,
      maxLineRatio: 1.65,
      allowOverflow: false,
      avoidBlockOverlap: true
    }));
    }
    if (fitOptions.translatedClamp) clampTranslatedOverflow();
    clampTranslatedCodeOverflow();
    enforceFinalTextCollisionSafety();
    // A document may save a manual body-font override. Re-fitting must
    // retain it, with line height scaled alongside the font.
    const userBodyFontPt = Number(fitOptions.userBodyFontPt);
    if (Number.isFinite(userBodyFontPt) && userBodyFontPt > 0) {
      for (const node of all) {
        if (isStream(node) && node.styleKind === "body_text" && node.flowKind === "text") {
          node.style.fontSize = Number((userBodyFontPt * 4 / 3).toFixed(2));
          node.userBodyFontPt = Number(userBodyFontPt.toFixed(2));
        }
      }
    }
    // Post-pass: adapt formulas to bbox and right-align equation numbers.
    fitLayoutFormulas({ expand: true });
    // Post-fit: balanced breaking of justified lines on the final sizes.
    if (steps.justify) steps.justify.balanceJustifiedLines();
  }

  return { runFit };
});

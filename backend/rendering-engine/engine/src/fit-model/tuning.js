// retain-pdf-rendering/fit-model/tuning.js
// Host-agnostic: never reference the host application or plugin globals here.
//
// Group tuning: shared font/line growth with collision and overflow stops
// (tuneNodes), the body's second iteration, per-paragraph body caps and the
// inherited-body sync. Created per fit run (needs the run's node scope).
(function (root, factory) {
  "use strict";
  const NAME = "tuning";
  const DEPENDENCIES = [["rects", "./rects"], ["document", "./document"]];
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
})(typeof this === "object" && this ? this : globalThis, function (root, rects, document) {
  "use strict";
  const { gallopingGrow } = rects;
  const { applyGroup, layoutControlFontSize, controlLineRatio, Select } = document;

  function createTuning(ctx, run, { geometry: geo, collision }) {
    const trace = ctx.trace;
    const { scopedNodes } = run;
    const { geometry, measureTextBand } = geo;
    const { textCollisionDetails, measureGroup, wouldCollideWithBlocks } = collision;

    // bodyNodeFontCaps (overlay hosts, where every paragraph owns its source
    // box): one shared body size stops at the tightest paragraph of the whole
    // document. Give each paragraph that cannot reach maxFont inside its own
    // box a ceiling instead: first the loosest line ratio (down to
    // minLineRatio) that fits at maxFont, else that tight ratio plus the
    // largest size on the step ladder that fits. A paragraph sitting at its
    // ceiling no longer overflows, so it stops limiting the group.
    function capBodyNodes(nodes, { maxFont, minFont, step, minLineRatio }) {
      for (const node of nodes) {
        delete node.fontCap;
        delete node.lineRatioCap;
        const saved = { fontSize: node.style.fontSize, lineRatio: node.style.lineRatio };
        const fits = (font, ratio) => {
          node.style.fontSize = font;
          node.style.lineRatio = ratio;
          return !measureGroup([node]).overflow;
        };
        const baseRatio = Number(node.lineRatio || 1.1);
        if (!fits(maxFont, baseRatio)) {
          const tightRatio = Math.min(baseRatio, minLineRatio);
          if (fits(maxFont, tightRatio)) {
            let low = tightRatio;
            let high = baseRatio;
            while (high - low > 0.01) {
              const middle = (low + high) / 2;
              if (fits(maxFont, middle)) low = middle;
              else high = middle;
            }
            node.lineRatioCap = Math.floor(low * 1000) / 1000;
          }
          else {
            node.lineRatioCap = tightRatio;
            let low = -1;
            let high = Math.floor((maxFont - minFont) / step + 1e-9);
            while (high - low > 1) {
              const middle = (low + high) >> 1;
              if (fits(minFont + middle * step, tightRatio)) low = middle;
              else high = middle;
            }
            node.fontCap = minFont + Math.max(0, low) * step;
          }
        }
        node.style.fontSize = saved.fontSize;
        node.style.lineRatio = saved.lineRatio;
      }
    }

    function tuneNodes(nodes, options) {
      if (!nodes.length) return null;
      const baseFont = Math.max(...nodes.map((node) => Number(node.baseFont || 8)));
      const baseLineRatio = Math.max(...nodes.map((node) => Number(node.lineRatio || 1.1)));
      let fontSize = baseFont;
      let lineRatio = baseLineRatio;
      const minFont = Number.isFinite(options.minFont) ? options.minFont : Math.max(4.8, fontSize * 0.55);
      const minLineRatio = Number.isFinite(options.minLineRatio) ? options.minLineRatio : 1.0;
      if (options.coupleFontAndLine) {
        lineRatio = Math.max(minLineRatio, Math.min(options.maxLineRatio, lineRatio));
      }
      if (options.startFromMinimum) {
        fontSize = minFont;
        lineRatio = minLineRatio;
      }
      let stopReason = "unknown";
      let lastCollision = null;
      applyGroup(nodes, fontSize, lineRatio);
      let safety = 0;
      while (safety < 120 && (!options.allowOverflow || options.enforceInitialCollisionBackoff)) {
        safety += 1;
        const groupState = !options.allowOverflow ? measureGroup(nodes) : null;
        const collision = options.enforceInitialCollisionBackoff
          ? wouldCollideWithBlocks(nodes, options)
          : null;
        const blockingOverflow = Boolean(groupState && groupState.overflow) && !options.allowOverflow;
        if (!blockingOverflow && !collision) break;
        if (trace) trace("initial-backoff", { pass: options.label, fontSize, lineRatio, collision: collision ? textCollisionDetails(nodes, options) : null, overflow: blockingOverflow });
        let changed = false;
        if (!options.coupleFontAndLine && lineRatio > minLineRatio) {
          lineRatio = Math.max(minLineRatio, lineRatio - options.lineStep);
          changed = true;
        } else if (fontSize > minFont) {
          fontSize = Math.max(minFont, fontSize - options.step);
          changed = true;
        }
        applyGroup(nodes, fontSize, lineRatio);
        if (!changed) {
          stopReason = collision ? "min-block-overlap" : "min-overflow";
          break;
        }
      }
      safety = 0;
      const needFillState = options.stopWhenFilled !== false;
      // Purely collision-constrained growth (generic per-node text): the stop
      // condition is a monotone "first colliding tick", with no overflow or fill
      // early-out that would need per-tick measurement. Bracket-and-bisect that
      // boundary instead of probing every tick. Restricted to SINGLE-node groups
      // with a wide remaining range and no initial-backoff anchor (titles); those
      // collide just above baseFont and are better served by the linear scan.
      const remainingTicks = (options.maxFont - fontSize) / options.step;
      const monotoneFontSearch = options.gallop !== false &&
        options.allowOverflow && !needFillState &&
        options.avoidBlockOverlap && !options.coupleFontAndLine &&
        !options.enforceInitialCollisionBackoff &&
        nodes.length === 1 && remainingTicks >= 8;
      if (monotoneFontSearch && fontSize < options.maxFont) {
        const grown = gallopingGrow(fontSize, options.maxFont, options.step, (value) => {
          applyGroup(nodes, value, lineRatio);
          return Boolean(textCollisionDetails(nodes, options));
        });
        fontSize = grown.value;
        applyGroup(nodes, fontSize, lineRatio);
        stopReason = fontSize >= options.maxFont - 1e-6 ? "max-font" : "block-overlap";
      } else {
        while (safety < 80) {
          safety += 1;
          const groupState = (!options.allowOverflow || needFillState) ? measureGroup(nodes) : null;
          if (groupState && groupState.overflow && !options.allowOverflow) {
            stopReason = "overflow";
            break;
          }
          if (needFillState && groupState && groupState.allReachedBand) {
            stopReason = "filled";
            break;
          }
          const nextFont = fontSize + options.step;
          if (nextFont > options.maxFont) {
            stopReason = "max-font";
            break;
          }
          applyGroup(nodes, nextFont, lineRatio);
          const nextState = !options.allowOverflow ? measureGroup(nodes) : null;
          const collision = options.avoidBlockOverlap ? textCollisionDetails(nodes, options) : null;
          if (collision) {
            if (trace) trace("font-grow-collision", { pass: options.label, fontSize: nextFont, lineRatio, collision });
            applyGroup(nodes, fontSize, lineRatio);
            stopReason = "block-overlap";
            lastCollision = collision;
            break;
          }
          if (nextState && nextState.overflow && !options.allowOverflow) {
            applyGroup(nodes, fontSize, lineRatio);
            stopReason = "font-overflow";
            break;
          }
          fontSize = nextFont;
        }
      }
      safety = 0;
      while (!options.coupleFontAndLine && safety < 80 && !(options.skipLineExpansionAfterFontCollision && stopReason === "block-overlap")) {
        safety += 1;
        const groupState = (!options.allowOverflow || needFillState) ? measureGroup(nodes) : null;
        if ((groupState && groupState.overflow && !options.allowOverflow) || (needFillState && groupState && groupState.allReachedBand)) {
          stopReason = groupState && groupState.overflow && !options.allowOverflow ? "overflow" : "filled";
          break;
        }
        const nextRatio = lineRatio + options.lineStep;
        if (nextRatio > options.maxLineRatio) {
          stopReason = "max-line";
          break;
        }
        applyGroup(nodes, fontSize, nextRatio);
        const nextState = !options.allowOverflow ? measureGroup(nodes) : null;
        const collision = options.avoidBlockOverlap ? textCollisionDetails(nodes, options) : null;
        if (collision) {
          applyGroup(nodes, fontSize, lineRatio);
          stopReason = "block-overlap";
          lastCollision = collision;
          break;
        }
        if (nextState && nextState.overflow && !options.allowOverflow) {
          applyGroup(nodes, fontSize, lineRatio);
          stopReason = "line-overflow";
          break;
        }
        lineRatio = nextRatio;
      }
      for (const node of nodes) {
        node.fit = {
          pass: options.label || "",
          stopReason,
          limiter: lastCollision ? lastCollision.source === node : false,
          blocker: lastCollision && lastCollision.source === node ? lastCollision.blockerName : ""
        };
      }
      return { fontSize, lineRatio, stopReason, collision: lastCollision };
    }

    // 正文二次迭代必须始终保持统一字号：所有正文同步增大字号，
    // 发生碰撞时只压缩碰撞源的行距；如果行距降到下限仍无法消除碰撞，
    // 则撤销本轮所有正文的字号增长并结束二次迭代，绝不单独缩小某个正文块。
    function continueUnderfilledNodes(nodes, options) {
      const targetFill = Number.isFinite(options.minTextFillRatio) ? options.minTextFillRatio : 0.85;
      const bodyNodes = (nodes || []).filter(Boolean);
      const fillRatio = (node) => {
        const metrics = measureTextBand(node);
        const clientHeight = geometry(node).clientHeight;
        if (!metrics.hasText || clientHeight <= 0) return 0;
        return Math.min(1, Math.max(0, metrics.lastBottom) / clientHeight);
      };
      if (!bodyNodes.length || !bodyNodes.some((node) => fillRatio(node) < targetFill)) return;
      const minLineRatio = Number.isFinite(options.collisionMinLineRatio) ? options.collisionMinLineRatio : 1.02;
      const snapshotStyles = () => bodyNodes.map((node) => ({
        node,
        fontSize: layoutControlFontSize(node),
        lineRatio: controlLineRatio(node, 1.1)
      }));
      const restoreStyles = (snapshots) => {
        for (const snapshot of snapshots) applyGroup([snapshot.node], snapshot.fontSize, snapshot.lineRatio);
      };
      const recoverCollisionByLineRatio = (source, initialCollision) => {
        let collision = initialCollision;
        const fontSize = layoutControlFontSize(source);
        let lineRatio = controlLineRatio(source, 1.1);
        // 正文碰撞只允许降低碰撞源自己的行距，最低保持 1.02 倍字号；字号
        // 仍属于全文共享状态，禁止任何正文块单独缩小字号。
        for (let safety = 0; collision && safety < 80 && lineRatio > minLineRatio + 0.001; safety += 1) {
          lineRatio = Math.max(minLineRatio, lineRatio - options.lineStep);
          applyGroup([source], fontSize, lineRatio);
          collision = textCollisionDetails([source], options);
        }
        return { collision, fontSize, lineRatio };
      };
      for (let safety = 0; safety < 320; safety += 1) {
        if (!bodyNodes.some((node) => fillRatio(node) < targetFill)) return;
        const snapshots = snapshotStyles();
        const currentFont = Math.min(...snapshots.map((snapshot) => snapshot.fontSize));
        const nextFont = currentFont + options.step;
        if (!Number.isFinite(nextFont) || nextFont > options.maxFont + 0.0001) return;
        // 每个正文块保留自己的行距，但所有正文统一应用同一个候选字号。
        for (const snapshot of snapshots) applyGroup([snapshot.node], nextFont, snapshot.lineRatio);
        let collision = options.avoidBlockOverlap ? textCollisionDetails(bodyNodes, options) : null;
        while (collision) {
          const source = collision.source;
          const recovery = recoverCollisionByLineRatio(source, collision);
          if (trace) trace("shared-grow-collision", { pass: options.label, fontSize: nextFont, collision, recovered: !recovery.collision });
          if (recovery.collision) {
            // 行距已经降到可读下限仍发生碰撞：撤销整组本轮增长并终止，保持正文统一字号。
            restoreStyles(snapshots);
            source.fit = { ...(source.fit || {}), pass: "body-shared", stopReason: "line-backoff-exhausted", limiter: true, blocker: recovery.collision.blockerName };
            return;
          }
          collision = options.avoidBlockOverlap ? textCollisionDetails(bodyNodes, options) : null;
        }
      }
    }

    function tuneGroup(predicate, options) {
      const nodes = scopedNodes(predicate);
      if (!nodes.length) return;
      tuneNodes(nodes, options);
      if (options.continueUnderfilledNodes) continueUnderfilledNodes(nodes, options);
    }

    function tuneEach(predicate, options) {
      for (const node of scopedNodes(predicate)) tuneNodes([node], options);
    }

    // Short single-column transitions inherit the shared body font, then back
    // off locally during the final collision audit if necessary.
    function syncInheritedBodyFontToBodyGroup() {
      const bodyNodes = scopedNodes(Select.body);
      const inheritedNodes = scopedNodes(Select.bodyInherited);
      if (!bodyNodes.length || !inheritedNodes.length) return;
      const fontSize = Math.min(...bodyNodes
        .map((node) => layoutControlFontSize(node, 0))
        .filter((value) => Number.isFinite(value) && value > 0));
      if (!Number.isFinite(fontSize) || fontSize <= 0) return;
      for (const node of inheritedNodes) applyGroup([node], fontSize, controlLineRatio(node, 1.1));
    }

    return { capBodyNodes, tuneNodes, continueUnderfilledNodes, tuneGroup, tuneEach, syncInheritedBodyFontToBodyGroup };
  }

  return { createTuning };
});

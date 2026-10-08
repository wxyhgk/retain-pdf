// retain-pdf-rendering/fit
// Host-agnostic: never reference Zotero, LitMTrans or plugin globals here.
// Host services (preferences, hashing, abort signals, asset lookup, markdown
// rendering) are passed in by the caller.
(function (root, factory) {
  "use strict";
  const api = factory(root);
  if (typeof module === "object" && module && module.exports) module.exports = api;
  else {
    const namespace = root.RetainPdfRendering = root.RetainPdfRendering || {};
    namespace.Fit = api;
  }
})(typeof this === "object" && this ? this : globalThis, function (root) {
  "use strict";

  // Glyph-measured fitting: measures rendered text rectangles, detects
  // collisions between layout blocks and iterates font size / line height.
  // All mutable fitting state (scheduled pages, inspection round counter)
  // belongs to one fitter instance, so several documents can fit
  // independently.
  //
  // options.document            DOM document that holds the layout pages.
  // options.window              Its window (NodeFilter, getComputedStyle and
  //                             the optional __mineruInitialFitCache /
  //                             __gallopDisabled inspection hooks).
  // options.getStorage()        Returns a Storage-like object (getItem, setItem,
  //                             removeItem, key, length) for the fit cache;
  //                             options.storage is accepted instead. Access
  //                             errors disable the cache.
  // options.isDevelopmentMode() Adds formula fit labels outside layout-debug.
  //
  // The body of createFitter deliberately keeps the indentation it had in the
  // workbench, so the fitter stays byte-comparable with its history and with
  // the text patches applied by the layout-parity profiler.
  function createFitter(options = {}) {
  const document = options.document;
  const window = options.window;
  const NodeFilter = window ? window.NodeFilter : undefined;
  const getComputedStyle = (element) => window.getComputedStyle(element);
  const fitStorage = () => (typeof options.getStorage === "function" ? options.getStorage() : options.storage);
  const isDevelopmentMode = () => Boolean(typeof options.isDevelopmentMode === "function" && options.isDevelopmentMode());

  function layoutTextRects(node) {
    if (!node?.isConnected) return [];
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, {
      acceptNode(textNode) {
        if (!textNode.textContent?.trim()) return NodeFilter.FILTER_REJECT;
        if (textNode.parentElement?.closest(".layout-line-debug-box, .layout-collision-debug-layer, [aria-hidden='true']")) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    const range = document.createRange();
    const rects = [];
    let textNode;
    while ((textNode = walker.nextNode())) {
      range.selectNodeContents(textNode);
      for (const rect of range.getClientRects()) {
        if (rect.width <= .5 || rect.height <= .5) continue;
        rects.push({
          left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom,
          width: rect.width, height: rect.height
        });
      }
    }
    range.detach?.();
    return rects;
  }

  function layoutRectsOverlap(first, second, tolerance = 1.5) {
    return (
      Math.min(first.right, second.right) - Math.max(first.left, second.left) > tolerance
      && Math.min(first.bottom, second.bottom) - Math.max(first.top, second.top) > tolerance
    );
  }

  // Use cheap block/union checks as a broad phase, then compare glyph ranges
  // only for candidates that may actually overlap.
  function layoutRectUnion(rects) {
    if (!rects?.length) return null;
    let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
    for (const rect of rects) {
      if (!rect) continue;
      left = Math.min(left, rect.left);
      top = Math.min(top, rect.top);
      right = Math.max(right, rect.right);
      bottom = Math.max(bottom, rect.bottom);
    }
    return Number.isFinite(left) ? { left, top, right, bottom } : null;
  }

  function layoutNodeCollision(node, sourceRects = null) {
    const page = node?.closest?.(".layout-page");
    if (!page) return null;
    const own = node.getBoundingClientRect();
    const rects = sourceRects || layoutTextRects(node);
    if (!rects.length) return null;
    const textUnionBox = layoutRectUnion(rects);
    const barriers = [...page.querySelectorAll(":scope > .layout-flow-stream, :scope > .layout-block")]
      .filter(barrier => barrier !== node && !barrier.hidden && barrier.getClientRects().length);
    for (const barrier of barriers) {
      const barrierBox = barrier.getBoundingClientRect();
      if (!layoutRectsOverlap(own, barrierBox, 0) && !layoutRectsOverlap(textUnionBox, barrierBox, 0)) continue;
      const barrierIsText = barrier.matches(".layout-flow-stream, .layout-block.layout-text, .layout-block.layout-title, .layout-block.layout-caption");
      const barrierRects = barrierIsText ? layoutTextRects(barrier) : [barrierBox];
      const barrierUnionBox = layoutRectUnion(barrierRects) || barrierBox;
      if (!layoutRectsOverlap(textUnionBox, barrierUnionBox, 1.5)) continue;
      for (const rect of rects) {
        for (const barrierRect of barrierRects) {
          if (!layoutRectsOverlap(rect, barrierRect, 1.5)) continue;
          // Adjacent columns and stacked boxes often share a mathematical
          // boundary. A small italic/MathJax optical overhang is harmless;
          // deeper ink intrusion is a real collision and must constrain the
          // document-wide fit.
          const sharesRight = Math.abs(own.right - barrierBox.left) <= 1.5;
          const sharesLeft = Math.abs(own.left - barrierBox.right) <= 1.5;
          const sharesBottom = Math.abs(own.bottom - barrierBox.top) <= 1.5;
          const sharesTop = Math.abs(own.top - barrierBox.bottom) <= 1.5;
          const horizontalIntrusion = Math.min(rect.right, barrierRect.right) - Math.max(rect.left, barrierRect.left);
          const verticalIntrusion = Math.min(rect.bottom, barrierRect.bottom) - Math.max(rect.top, barrierRect.top);
          if ((sharesRight || sharesLeft) && horizontalIntrusion <= 2.5) continue;
          if ((sharesBottom || sharesTop) && verticalIntrusion <= 2.5) continue;
          return { source: node, blocker: barrier, rect, barrierRect };
        }
      }
    }
    return null;
  }

  function layoutNodeFits(node, allowHorizontalOverflow = false, allowOwnOverflow = false) {
    if (!node?.isConnected || node.clientHeight <= 0 || node.clientWidth <= 0) return true;
    const vertical = node.scrollHeight <= node.clientHeight + 1;
    const horizontal = allowHorizontalOverflow || node.scrollWidth <= node.clientWidth + 1;
    if (!allowOwnOverflow && (!vertical || !horizontal)) {
      node._litmtransFitFailure = { type: vertical ? "horizontal-overflow" : "vertical-overflow" };
      return false;
    }
    const page = node.closest(".layout-page");
    if (!page) return true;
    const pageRect = page.getBoundingClientRect();
    const rects = layoutTextRects(node);
    for (const rect of rects) {
      if (rect.bottom > pageRect.bottom + 1 || rect.top < pageRect.top - 3) {
        node._litmtransFitFailure = { type: "page-vertical-overflow", rect };
        return false;
      }
      if (!allowHorizontalOverflow && (rect.left < pageRect.left - 1 || rect.right > pageRect.right + 1)) {
        node._litmtransFitFailure = { type: "page-horizontal-overflow", rect };
        return false;
      }
    }
    const collision = layoutNodeCollision(node, rects);
    if (collision) {
      node._litmtransFitFailure = { type: "block-collision", ...collision };
      return false;
    }
    node._litmtransFitFailure = null;
    return true;
  }

  function applyLayoutNodeStyle(node, fontPx, lineRatio) {
    node.style.fontSize = `calc(${fontPx}px * var(--layout-scale))`;
    node.style.lineHeight = String(lineRatio);
    node.dataset.fittedFontPx = Number(fontPx).toFixed(2);
    node.dataset.fittedLineRatio = Number(lineRatio).toFixed(3);
  }

  function allNodesFit(nodes, allowHorizontal, allowOwnOverflow = false) {
    let ok = true;
    for (const node of nodes) {
      if (!layoutNodeFits(node, allowHorizontal, allowOwnOverflow)) ok = false;
    }
    return ok;
  }

  function medianValueLocal(values) {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  function layoutTitleFrameFill(node) {
    const frame = node?.getBoundingClientRect?.();
    const ink = layoutRectUnion(layoutTextRects(node));
    if (!frame || !ink || frame.width <= 0 || frame.height <= 0) return { area: 0, width: 0, height: 0 };
    const usedWidth = Math.max(0, Math.min(frame.right, ink.right) - Math.max(frame.left, ink.left));
    const usedHeight = Math.max(0, Math.min(frame.bottom, ink.bottom) - Math.max(frame.top, ink.top));
    const width = Math.min(1, usedWidth / frame.width);
    const height = Math.min(1, usedHeight / frame.height);
    return { area: width * height, width, height };
  }

  // After the shared section-title pass, only titles that leave most of their
  // original source frame unused may grow on their own. Their glyphs still
  // undergo the same page-boundary and collision checks as every other block.
  function expandUnderfilledLayoutTitles(nodes, options = {}) {
    const areaThreshold = Number(options.areaThreshold ?? .42);
    const dimensionThreshold = Number(options.dimensionThreshold ?? .72);
    const maxFont = Number(options.maxFont ?? 42);
    const step = Number(options.fontStep ?? .25);
    for (const node of nodes || []) {
      const initial = layoutTitleFrameFill(node);
      if (initial.area >= areaThreshold || (initial.width >= dimensionThreshold && initial.height >= dimensionThreshold)) continue;
      let font = Number(node.dataset.fittedFontPx || node.dataset.baseFont || 8);
      const lineRatio = Number(node.dataset.fittedLineRatio || node.dataset.baseLineRatio || 1.12);
      for (let iteration = 0; iteration < 136 && font + step <= maxFont; iteration++) {
        const next = font + step;
        applyLayoutNodeStyle(node, next, lineRatio);
        if (!layoutNodeFits(node, true, true)) {
          applyLayoutNodeStyle(node, font, lineRatio);
          break;
        }
        font = next;
        const fill = layoutTitleFrameFill(node);
        if (fill.area >= areaThreshold || (fill.width >= dimensionThreshold && fill.height >= dimensionThreshold)) break;
      }
    }
  }

  // Keep near-equal headings visually coherent after the exceptional recovery
  // above. A cluster spans at most one px from its smallest member; different
  // semantic levels remain separate. Shrinking cannot introduce collisions.
  function clusterLayoutTitleFontSizes(nodes, maxDifference = 1.0) {
    const entries = (nodes || [])
      .filter(node => node?.isConnected)
      .map(node => ({ node, font: Number(node.dataset.fittedFontPx || node.dataset.baseFont || 0) }))
      .filter(entry => entry.font > 0)
      .sort((left, right) => left.font - right.font);
    let cluster = [];
    let minimum = 0;
    const applyCluster = () => {
      if (cluster.length < 2) return;
      for (const entry of cluster) {
        applyLayoutNodeStyle(entry.node, minimum, Number(entry.node.dataset.fittedLineRatio || entry.node.dataset.baseLineRatio || 1.12));
      }
    };
    for (const entry of entries) {
      if (!cluster.length || entry.font - minimum <= maxDifference + .001) {
        cluster.push(entry);
        if (cluster.length === 1) minimum = entry.font;
      } else {
        applyCluster();
        cluster = [entry];
        minimum = entry.font;
      }
    }
    applyCluster();
  }

  function collectPageColumnRights(page) {
    const pageWidth = Number(page.dataset.sourceWidth || page.clientWidth || 612);
    const nodes = [...page.querySelectorAll(".layout-flow-stream, .layout-block.type-text")];
    if (!nodes.length) return null;

    const columns = [];
    for (const node of nodes) {
      if (node.classList.contains("refs") || node.classList.contains("toc-stream")
        || node.classList.contains("layout-caption") || node.classList.contains("layout-title")) continue;
      const leftPct = Number.parseFloat(node.style.left);
      const widthPct = Number.parseFloat(node.style.width);
      if (!Number.isFinite(leftPct) || !Number.isFinite(widthPct)) continue;
      const left = leftPct * pageWidth / 100;
      const width = widthPct * pageWidth / 100;
      const right = left + width;
      if (width > pageWidth * 0.82 || width < 20) continue;
      const key = String(node.dataset.columnKey || "");
      if (key === "full") continue;

      let col = key
        ? columns.find(c => c.key === key)
        : columns.find(c => Math.abs(c.anchor - left) < 28);

      if (!col) {
        col = { key: key || `col-${columns.length}`, anchor: left, minLeft: left, maxRight: right };
        columns.push(col);
      } else {
        col.minLeft = Math.min(col.minLeft, left);
        col.maxRight = Math.max(col.maxRight, right);
      }
    }
    return columns.length ? columns : null;
  }

  function calibrateEquationNumberRight(block, target, page, columns) {
    const pageWidth = Number(page.dataset.sourceWidth || page.clientWidth || 612);
    const blockLeftPct = Number.parseFloat(block.style.left);
    const blockWidthPct = Number.parseFloat(block.style.width);
    if (!Number.isFinite(blockLeftPct)) return;

    const blockLeft = blockLeftPct * pageWidth / 100;
    const blockWidth = (Number.isFinite(blockWidthPct) ? blockWidthPct : 0) * pageWidth / 100;
    const blockRight = blockLeft + blockWidth;

    let bestCol = null;
    let minDist = Infinity;
    for (const col of columns) {
      const dist = Math.abs(blockLeft - col.anchor);
      if (dist < minDist) {
        minDist = dist;
        bestCol = col;
      }
    }
    if (!bestCol) return;

    let targetRight = bestCol.maxRight;
    const colWidth = Math.max(1, bestCol.maxRight - bestCol.minLeft);

    if (blockWidth >= colWidth * 1.25 || blockRight > bestCol.maxRight + 15) {
      const spanningCols = columns.filter(col => col.maxRight >= blockLeft && col.minLeft <= blockRight + 15);
      if (spanningCols.length > 1) {
        targetRight = Math.max(...spanningCols.map(c => c.maxRight));
      }
    }

    const desiredNumberRightPx = targetRight - blockLeft;
    if (desiredNumberRightPx > 20) {
      const currentVal = Number.parseFloat(target.style.getPropertyValue("--equation-number-right") || "0");
      if (!currentVal || desiredNumberRightPx > currentVal + 4) {
        target.style.setProperty("--equation-number-right", `${desiredNumberRightPx.toFixed(2)}px`);
      }
    }
  }

  function applyFormulaScale(formula, scale) {
    formula.style.transform = Math.abs(scale - 1) > 0.005 ? `scale(${scale.toFixed(4)})` : "";
  }

  function formulaGrowthCollides(page, block, formula) {
    const formulaBox = formula.getBoundingClientRect();
    if (formulaBox.width <= 0 || formulaBox.height <= 0) return false;
    const neighbours = [...page.querySelectorAll(":scope > .layout-flow-stream, :scope > .layout-block")]
      .filter(node => node !== block && !node.hidden && node.getClientRects().length);
    for (const node of neighbours) {
      for (const rect of layoutTextRects(node)) {
        if (layoutRectsOverlap(formulaBox, rect)) return true;
      }
    }
    return false;
  }

  // Binary-search the largest scale in (fitted, wanted] that keeps the formula
  // clear of neighbouring glyphs; the fitted scale is the safe floor.
  function largestClearFormulaScale(page, block, formula, fitted, wanted) {
    let low = fitted;
    let high = wanted;
    for (let step = 0; step < 8 && high - low > 0.005; step += 1) {
      const middle = (low + high) / 2;
      applyFormulaScale(formula, middle);
      if (formulaGrowthCollides(page, block, formula)) high = middle;
      else low = middle;
    }
    applyFormulaScale(formula, low);
    return low;
  }

  function fitLayoutFormulas(pages, { expand = false } = {}) {
    for (const page of (pages || []).filter(Boolean)) {
      const formulas = [...page.querySelectorAll(".layout-block.layout-formula")];
      if (!formulas.length) continue;

      const columns = expand ? collectPageColumnRights(page) : null;

      for (const block of formulas) {
        const target = block.querySelector(".layout-formula-target") || block;
        const number = target.querySelector(".layout-equation-number");
        const formula = target.querySelector(".katex, .litmtrans-math") || target.firstElementChild || target;

        if (expand && number && columns) {
          calibrateEquationNumberRight(block, target, page, columns);
        }

        formula.style.transform = "";
        formula.style.transformOrigin = number ? "left center" : "center center";
        formula.style.display = "inline-block";
        // `.litmtrans-math` normally has max-width:100% for flowing Markdown.
        // Inside an absolute equation block that cap hides the true overflowing
        // content width from getBoundingClientRect(), so the scale calculation
        // can report success while descendants still cross into the next column.
        // Measure its intrinsic equation width, matching MathJax's width:auto
        formula.style.width = "max-content";
        formula.style.maxWidth = "none";
        formula.style.overflow = "visible";

        const blockRect = block.getBoundingClientRect();
        const formulaRect = formula.getBoundingClientRect();
        if (blockRect.width <= 0 || formulaRect.width <= 0) continue;

        const availableWidth = Math.max(1, blockRect.width - 4);
        let maxFormulaWidth = availableWidth;
        if (number) {
          const numRect = number.getBoundingClientRect();
          if (numRect.left > formulaRect.left) {
            const spaceBeforeNumber = numRect.left - formulaRect.left - 8;
            if (spaceBeforeNumber > 10) {
              maxFormulaWidth = Math.min(maxFormulaWidth, spaceBeforeNumber);
            }
          }
        }

        const scaleW = maxFormulaWidth / Math.max(1, formulaRect.width);
        // The shrink-only scale is what the text fitter measured against.
        const fittedScale = Math.min(1, scaleW);
        let scale = fittedScale;

        if (expand && blockRect.height > 0 && formulaRect.height > 0) {
          const targetHeight = blockRect.height * 0.92;
          const scaleH = targetHeight / formulaRect.height;
          scale = Math.min(scaleW, Math.max(0.7, scaleH), 1.35);
        }

        if (Math.abs(scale - 1) > 0.005) {
          formula.style.transform = `scale(${scale.toFixed(4)})`;
        }
        // This pass runs after text fitting, so neighbouring text cannot move
        // out of the way any more. Growth beyond the fitted scale must stay
        // clear of every other block's glyphs.
        if (expand && scale > fittedScale + 0.005 && formulaGrowthCollides(page, block, formula)) {
          scale = largestClearFormulaScale(page, block, formula, fittedScale, scale);
        }
        block.classList.toggle("layout-fitted", scale < .999);
        if (isDevelopmentMode() || document.body.classList.contains("layout-debug")) {
          block.dataset.fitLabel = `formula · ${scale.toFixed(3)}×`;
        }
      }
    }
  }

  function fitLayoutPages(pageNodes) {
    const pages = (pageNodes || []).filter(Boolean);
    const wraps = pages.map(page => page.closest(".layout-page-wrap")).filter(Boolean);

    // Initial pass: shrink-only so oversized un-fitted formulas do not become
    // false body-text barriers during shared font iteration.
    fitLayoutFormulas(pages);
    runLayoutParityEngine(wraps, false);
    // Post-pass: adapt formulas to bbox and right-align equation numbers.
    fitLayoutFormulas(pages, { expand: true });
  }

  // Limit fitting to the pages scheduled by the reader.
  let activeFitPages = null;
  // This namespace invalidates incompatible browser-side fit caches.
  const fitCacheVersion = 'layout-fit-v43-logical-span-lines';
  // A narrow transition may back off without changing the shared body font.
  const ALLOW_INHERITED_BODY_FONT_BACKOFF = true;
  let bodyIterationInspectionRound = 0;

  // Retain the first collision for the optional layout inspection view.
  function isBodyIterationNode(node) {
    return Boolean(node && node.matches && node.matches(
      '.layout-flow-stream[data-style-kind="body_text"][data-flow-kind="text"]:not([data-body-inherited="1"])'
    ));
  }

  function bodyIterationNodes(nodes) {
    return (nodes || []).filter(isBodyIterationNode);
  }

  // Show fitting diagnostics only in the inspection view.
  function setDiagnosticTitle(node, text) {
    if (!node) return;
    node.title = document.body.classList.contains('layout-debug') ? (text || '') : '';
  }

  function resetBodyIterationInspection(nodes) {
    for (const node of bodyIterationNodes(nodes)) {
      node.classList.remove('body-iteration-collision');
      node.dataset.bodyIterationCollisionRound = '';
      node.dataset.bodyIterationCollisionPhase = '';
      node.dataset.bodyIterationLastRound = '0';
    }
  }

  function beginBodyIterationProbe(nodes, phase) {
    const bodyNodes = bodyIterationNodes(nodes);
    if (!bodyNodes.length) return null;
    const round = ++bodyIterationInspectionRound;
    for (const node of bodyNodes) {
      node.dataset.bodyIterationLastRound = String(round);
    }
    return { round, phase };
  }

  function recordBodyIterationCollision(collision, probe) {
    if (!probe || !collision || !isBodyIterationNode(collision.source)) return;
    const source = collision.source;
    if (!source.dataset.bodyIterationCollisionRound) {
      source.dataset.bodyIterationCollisionRound = String(probe.round);
      source.dataset.bodyIterationCollisionPhase = probe.phase;
    }
    source.classList.add('body-iteration-collision');
  }

  function publishBodyIterationInspection(nodes) {
    const bodyNodes = bodyIterationNodes(nodes);
    const globalLimiter = bodyNodes.find((node) => node.dataset.bodyIterationCollisionRound);
    const globalLimiterRound = globalLimiter ? globalLimiter.dataset.bodyIterationCollisionRound : '';
    const globalLimiterPhase = globalLimiter ? globalLimiter.dataset.bodyIterationCollisionPhase : '';
    for (const node of bodyNodes) {
      const fontSize = layoutControlFontSize(node, 0);
      const lineRatio = parseFloat(node.style.lineHeight || node.dataset.lineRatio || '0') || 0;
      const collisionRound = node.dataset.bodyIterationCollisionRound;
      const lastRound = node.dataset.bodyIterationLastRound || '0';
      const globalText = globalLimiterRound
        ? `全文已收敛 R${lastRound} · 全局限制 R${globalLimiterRound}（${globalLimiterPhase || 'probe'}）`
        : `全文已收敛 R${lastRound} · 未发现碰撞`;
      const localText = collisionRound ? '当前框为限制源' : '当前框无碰撞';
      node.dataset.fitLabel = `正文迭代 · ${globalText} · ${localText} · 字号 ${fontSize.toFixed(2)}px · 行距 ${lineRatio.toFixed(3)}`;
      node.dataset.fitDebug = node.dataset.fitLabel;
      setDiagnosticTitle(node, node.dataset.fitLabel);
    }
  }

  function publishCachedBodyIterationInspection() {
    const nodes = Array.from(document.querySelectorAll(
      '.layout-flow-stream[data-style-kind="body_text"][data-flow-kind="text"]:not([data-body-inherited="1"])'
    ));
    const bodyNodes = bodyIterationNodes(nodes);
    const globalLimiter = bodyNodes.find((node) => node.dataset.bodyIterationCollisionRound);
    const globalText = globalLimiter
      ? `全文已收敛（完整缓存） · 全局限制 R${globalLimiter.dataset.bodyIterationCollisionRound || '?'}（${globalLimiter.dataset.bodyIterationCollisionPhase || 'probe'}）`
      : '全文已收敛（完整缓存）';
    for (const node of bodyNodes) {
      const fontSize = layoutControlFontSize(node, 0);
      const lineRatio = parseFloat(node.style.lineHeight || node.dataset.lineRatio || '0') || 0;
      const localText = node === globalLimiter ? '当前框为限制源' : '当前框无碰撞';
      const label = `正文迭代 · ${globalText} · ${localText} · 字号 ${fontSize.toFixed(2)}px · 行距 ${lineRatio.toFixed(3)}`;
      node.dataset.fitLabel = label;
      node.dataset.fitDebug = label;
      setDiagnosticTitle(node, label);
    }
  }

  function scopedNodes(selector) {
    const nodes = Array.from(document.querySelectorAll(selector));
    if (!activeFitPages) return nodes;
    return nodes.filter((node) => activeFitPages.has(node.closest('.layout-page-wrap')));
  }

  function fitCacheKey() {
    const fingerprint = document.body ? document.body.dataset.layoutCacheKey : '';
    const scope = document.body ? document.body.dataset.layoutCacheScope : '';
    if (!fingerprint || !scope) return '';
    return `${fitCacheVersion}:${scope}:${fingerprint}`;
  }

  function fitCacheNodes() {
    return Array.from(document.querySelectorAll('.layout-flow-stream, .layout-block'));
  }

  function restoreFitCache() {
    const key = fitCacheKey();
    if (!key) return false;
    try {
      const warm = window.__mineruInitialFitCache;
      const payload = warm && warm.key === key
        ? warm.payload
        : JSON.parse(fitStorage().getItem(key) || 'null');
      const nodes = fitCacheNodes();
      if (!payload || payload.complete !== true || payload.count !== nodes.length || !Array.isArray(payload.styles)) return false;
      for (let index = 0; index < nodes.length; index += 1) {
        const value = payload.styles[index];
        if (!value) continue;
        const node = nodes[index];
        if (value.f) node.style.fontSize = value.f;
        if (value.l) node.style.lineHeight = value.l;
        if (value.o) node.dataset.originalLines = value.o;
        if (value.n === '1' && value.w) {
          node.style.width = value.w;
          node.style.whiteSpace = 'nowrap';
          node.dataset.shortTitleNoWrap = '1';
        }
      }
      const inspection = payload.bodyInspection || {};
      const cachedRound = String(inspection.lastRound || '0');
      for (const node of bodyIterationNodes(nodes)) node.dataset.bodyIterationLastRound = cachedRound;
      const limiterIndex = Number(inspection.limiterIndex);
      const limiter = Number.isInteger(limiterIndex) ? nodes[limiterIndex] : null;
      if (isBodyIterationNode(limiter)) {
        limiter.dataset.bodyIterationCollisionRound = String(inspection.limiterRound || '?');
        limiter.dataset.bodyIterationCollisionPhase = String(inspection.limiterPhase || 'probe');
        limiter.classList.add('body-iteration-collision');
      }
      document.body.dataset.layoutFitCached = '1';
      publishCachedBodyIterationInspection();
      return true;
    } catch (_error) {
      return false;
    }
  }

  function saveFitCache() {
    const key = fitCacheKey();
    if (!key) return;
    try {
      const nodes = fitCacheNodes();
      const styles = nodes.map((node) => ({
        f: node.style.fontSize || '',
        l: node.style.lineHeight || '',
        o: node.dataset.originalLines || '',
        n: node.dataset.shortTitleNoWrap === '1' ? '1' : '',
        w: node.dataset.shortTitleNoWrap === '1' ? (node.style.width || '') : '',
      }));
      const bodyNodes = bodyIterationNodes(nodes);
      const limiter = bodyNodes.find((node) => node.dataset.bodyIterationCollisionRound);
      const bodyInspection = {
        lastRound: Math.max(0, ...bodyNodes.map((node) => Number(node.dataset.bodyIterationLastRound || 0))),
        limiterIndex: limiter ? nodes.indexOf(limiter) : -1,
        limiterRound: limiter ? String(limiter.dataset.bodyIterationCollisionRound || '') : '',
        limiterPhase: limiter ? String(limiter.dataset.bodyIterationCollisionPhase || '') : '',
      };
      const scope = document.body ? document.body.dataset.layoutCacheScope : '';
      const stalePrefix = scope ? `${fitCacheVersion}:${scope}:` : '';
      if (stalePrefix) {
        const staleKeys = [];
        for (let index = 0; index < fitStorage().length; index += 1) {
          const candidate = fitStorage().key(index) || '';
          if (candidate !== key && candidate.startsWith(stalePrefix)) staleKeys.push(candidate);
        }
        for (const staleKey of staleKeys) fitStorage().removeItem(staleKey);
      }
      fitStorage().setItem(key, JSON.stringify({ complete: true, count: nodes.length, styles, bodyInspection }));
    } catch (_error) {
      // localStorage may be unavailable for file URLs or over quota.
    }
  }

  function measureTextBand(el) {
    const hostRect = el.getBoundingClientRect();
    const scaleY = hostRect.height > 0 && el.offsetHeight > 0 ? hostRect.height / el.offsetHeight : 1;
    const walker = document.createTreeWalker(
      el,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          if (!node.textContent || !node.textContent.trim()) return NodeFilter.FILTER_REJECT;
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;
          if (parent.closest(
            '.mjx-assistive-mml, .katex-mathml, .layout-line-debug-box, .layout-collision-debug-layer'
          )) return NodeFilter.FILTER_REJECT;
          // KaTeX marks its visible HTML glyph tree aria-hidden because the
          // sibling MathML tree owns accessibility. Reject ordinary hidden
          // UI text, but keep that visible glyph tree measurable.
          if (parent.closest('[aria-hidden="true"]') && !parent.closest('.katex-html')) {
            return NodeFilter.FILTER_REJECT;
          }
          const style = getComputedStyle(parent);
          return style.display !== 'none' && style.visibility !== 'hidden'
            ? NodeFilter.FILTER_ACCEPT
            : NodeFilter.FILTER_REJECT;
        }
      }
    );
    const range = document.createRange();
    let firstTop = null;
    let lastBottom = 0;
    let hasText = false;
    let node;
    while ((node = walker.nextNode())) {
      range.selectNodeContents(node);
      const rects = Array.from(range.getClientRects()).filter((rect) => rect.width > 0.5 && rect.height > 0.5);
      for (const rect of rects) {
        const top = (rect.top - hostRect.top) / scaleY;
        const bottom = (rect.bottom - hostRect.top) / scaleY;
        if (firstTop === null || top < firstTop) firstTop = top;
        if (bottom > lastBottom) lastBottom = bottom;
        hasText = true;
      }
    }
    return {
      hasText,
      firstTop: firstTop ?? 0,
      lastBottom,
    };
  }

  // Layout fitting uses source PDF coordinates. The reader composes the page
  // at a canonical width of 920px, so DOM offsets and Range rectangles are
  // larger by this factor. Convert
  // all collision geometry back to source-page units before applying the
  // original fitter's fixed 1px/1.5px tolerances.
  function layoutPageCoordinateScale(page) {
    const sourceWidth = Number(page?.dataset?.sourceWidth || 0);
    const renderedWidth = Number(page?.offsetWidth || 0);
    return sourceWidth > 0 && renderedWidth > 0
      ? renderedWidth / sourceWidth
      : 1;
  }

  function layoutPageSourceSize(page) {
    const coordinateScale = layoutPageCoordinateScale(page);
    const sourceWidth = Number(page?.dataset?.sourceWidth || 0);
    const sourceHeight = Number(page?.dataset?.sourceHeight || 0);
    return {
      width: sourceWidth > 0 ? sourceWidth : Number(page?.offsetWidth || 0) / coordinateScale,
      height: sourceHeight > 0 ? sourceHeight : Number(page?.offsetHeight || 0) / coordinateScale,
    };
  }

  function textRectsInPage(el) {
    const page = el.closest('.layout-page');
    if (!page) return [];
    const pageRect = page.getBoundingClientRect();
    const scaleX = page.offsetWidth > 0 ? pageRect.width / page.offsetWidth : 1;
    const scaleY = page.offsetHeight > 0 ? pageRect.height / page.offsetHeight : 1;
    const coordinateScale = layoutPageCoordinateScale(page);
    const walker = document.createTreeWalker(
      el,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          if (!node.textContent || !node.textContent.trim()) return NodeFilter.FILTER_REJECT;
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;
          if (parent.closest(
            '.mjx-assistive-mml, .katex-mathml, .layout-line-debug-box, .layout-collision-debug-layer'
          )) return NodeFilter.FILTER_REJECT;
          if (parent.closest('[aria-hidden="true"]') && !parent.closest('.katex-html')) {
            return NodeFilter.FILTER_REJECT;
          }
          const style = getComputedStyle(parent);
          return style.display !== 'none' && style.visibility !== 'hidden'
            ? NodeFilter.FILTER_ACCEPT
            : NodeFilter.FILTER_REJECT;
        }
      }
    );
    const range = document.createRange();
    const rects = [];
    let node;
    while ((node = walker.nextNode())) {
      range.selectNodeContents(node);
      for (const rect of Array.from(range.getClientRects())) {
        if (rect.width <= 0.5 || rect.height <= 0.5) continue;
        rects.push({
          left: (rect.left - pageRect.left) / scaleX / coordinateScale,
          top: (rect.top - pageRect.top) / scaleY / coordinateScale,
          right: (rect.right - pageRect.left) / scaleX / coordinateScale,
          bottom: (rect.bottom - pageRect.top) / scaleY / coordinateScale,
        });
      }
    }
    return rects;
  }

  function viewportRectInPage(page, rect) {
    const pageRect = page.getBoundingClientRect();
    const scaleX = page.offsetWidth > 0 ? pageRect.width / page.offsetWidth : 1;
    const scaleY = page.offsetHeight > 0 ? pageRect.height / page.offsetHeight : 1;
    const coordinateScale = layoutPageCoordinateScale(page);
    return {
      left: (rect.left - pageRect.left) / scaleX / coordinateScale,
      top: (rect.top - pageRect.top) / scaleY / coordinateScale,
      right: (rect.right - pageRect.left) / scaleX / coordinateScale,
      bottom: (rect.bottom - pageRect.top) / scaleY / coordinateScale,
    };
  }

  // 正文专用的内容几何：文字取每个可见行的 Range rect；公式取 MathJax
  // 完成排版后的容器；图片和表格取实际元素的渲染矩形。没有可测内容时回退到块框。
  function renderedContentRectsInPage(el) {
    const page = el && el.closest ? el.closest('.layout-page') : null;
    if (!page) return [];
    const rects = textRectsInPage(el);
    const visualNodes = el.querySelectorAll
      ? el.querySelectorAll('mjx-container, img, table, svg, canvas')
      : [];
    const seen = new Set();
    for (const node of visualNodes) {
      if (!node || seen.has(node)) continue;
      seen.add(node);
      const style = getComputedStyle(node);
      if (style.display === 'none' || style.visibility === 'hidden') continue;
      const rect = node.getBoundingClientRect();
      if (rect.width <= 0.5 || rect.height <= 0.5) continue;
      rects.push(viewportRectInPage(page, rect));
    }
    return rects.length ? rects : [elementBoxInPage(el)];
  }

  function elementBoxInPage(el) {
    const page = el.closest('.layout-page');
    const coordinateScale = layoutPageCoordinateScale(page);
    return {
      left: el.offsetLeft / coordinateScale,
      top: el.offsetTop / coordinateScale,
      right: (el.offsetLeft + el.offsetWidth) / coordinateScale,
      bottom: (el.offsetTop + el.offsetHeight) / coordinateScale,
    };
  }

  function singleLineTextExceedsPage(node, tolerance = 1.5) {
    const page = node.closest('.layout-page');
    if (!page) return false;
    const pageWidth = layoutPageSourceSize(page).width;
    if (pageWidth <= 0) return false;
    const textRects = textRectsInPage(node);
    if (!textRects.length) return false;
    return textRects.some((rect) => rect.left < -tolerance || rect.right > pageWidth + tolerance);
  }

  function demoteFalseSingleLineText(pages = null) {
    const selector = [
      '.layout-flow-stream.debug-text[data-flow-kind="text"][data-original-lines="single"]',
      '.layout-block.type-text[data-original-lines="single"]',
    ].join(', ');
    const nodes = Array.isArray(pages)
      ? pages.flatMap(page => [...page.querySelectorAll(selector)])
      : scopedNodes(selector);
    for (const node of nodes) {
      if (!singleLineTextExceedsPage(node)) continue;
      node.dataset.originalLines = 'multi';
      node.dataset.singleLineAlign = 'left';
      node.dataset.fitLabel = node.dataset.fitLabel || 'DEMOTED single->multi';
      node.dataset.fitDebug = [
        'single line exceeded page bounds',
        `self=${blockDebugName(node)}`,
      ].join(' ');
      setDiagnosticTitle(node, node.dataset.fitDebug);
    }
  }

  function rectsOverlap(a, b, padding) {
    return a.left < b.right - padding &&
      a.right > b.left + padding &&
      a.top < b.bottom - padding &&
      a.bottom > b.top + padding;
  }

  // Conservative broad-phase envelope for rendered text rectangles. All
  // candidates still reach the exact per-rectangle test below, so this can
  // only avoid unnecessary work; it cannot hide a real glyph collision.
  function rectUnion(rects) {
    if (!rects || !rects.length) return null;
    let left = Infinity;
    let top = Infinity;
    let right = -Infinity;
    let bottom = -Infinity;
    for (const rect of rects) {
      if (!rect) continue;
      left = Math.min(left, rect.left);
      top = Math.min(top, rect.top);
      right = Math.max(right, rect.right);
      bottom = Math.max(bottom, rect.bottom);
    }
    return Number.isFinite(left) ? { left, top, right, bottom } : null;
  }

  function horizontalBoxesOverlap(a, b, padding = 0) {
    return a.left < b.right - padding && a.right > b.left + padding;
  }

  function blockDebugName(el) {
    if (!el) return 'unknown';
    const role = el.dataset.styleKind || el.dataset.flowKind || '';
    const classes = Array.from(el.classList || []).filter((name) => (
      name.startsWith('debug-') || name.startsWith('type-') || name === 'from-list' || name === 'refs'
    ));
    const box = elementBoxInPage(el);
    const text = (el.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 42);
    return [
      role || 'block',
      classes.join('.'),
      `@${Math.round(box.left)},${Math.round(box.top)},${Math.round(box.right - box.left)}x${Math.round(box.bottom - box.top)}`,
      text
    ].filter(Boolean).join(' ');
  }

  function textCollisionDetails(nodes, options = {}) {
    const nodeSet = new Set(nodes);
    const renderedRectCache = new Map();
    const includeGroupPeers = Boolean(options.includeGroupPeers);
    const ignoreTopOverflow = Boolean(options.ignoreTopOverflow);
    const checkAllTextForCollisions = Boolean(options.checkAllTextForCollisions);
    const avoidPageOverflow = Boolean(options.avoidPageOverflow);
    const bodyColumnIndependentFit = Boolean(options.bodyColumnIndependentFit);
    for (const node of nodes) {
      const page = node.closest('.layout-page');
      if (!page) continue;
      const own = elementBoxInPage(node);
      const sharedEdgeTolerance = Number.isFinite(options.sharedEdgeTolerance)
        ? options.sharedEdgeTolerance
        : 0;
      const sharedHorizontalEdgeTolerance = Number.isFinite(options.sharedHorizontalEdgeTolerance)
        ? options.sharedHorizontalEdgeTolerance
        : 0;
      const ignoreNodeTopOverflow = ignoreTopOverflow || (
        Boolean(options.ignoreBodyTopOverflow) && node.dataset.styleKind === 'body_text'
      );
      const sourceIsBodyText = node.dataset.styleKind === 'body_text';
      // 每个文本源都逐行检测自身实际文字。区别仅在障碍物：正文迭代以实际
      // 内容为障碍；其它文本迭代以布局边框为障碍。
      const sourceRects = textRectsInPage(node).filter((rect) => {
        return checkAllTextForCollisions || rect.bottom > own.bottom + 1 ||
          (!ignoreNodeTopOverflow && rect.top < own.top - 1) ||
          rect.left < own.left - 1 ||
          rect.right > own.right + 1;
      });
      if (!sourceRects.length) continue;
      const barriers = Array.from(page.querySelectorAll('.layout-flow-stream, .layout-block'))
        .filter((candidate) => candidate !== node && (includeGroupPeers || !nodeSet.has(candidate)))
        .map((element) => {
          const box = elementBoxInPage(element);
          // 正文迭代：正文实际文字对所有块的实际内容；其它文本迭代：自己的
          // 实际文字对所有块的边框。这样正文不受空白边框的保守限制，而题注、
          // 标题等仍以稳定的布局边框作为外部约束。
          const barrierUsesTextGeometry = Boolean(options.bodyTextCollisionGeometry) &&
            sourceIsBodyText;
          const contentGeometry = barrierUsesTextGeometry
            ? (renderedRectCache.get(element) || (() => {
              const rects = renderedContentRectsInPage(element);
              const geometry = { rects, bounds: rectUnion(rects) || box };
              renderedRectCache.set(element, geometry);
              return geometry;
            })())
            : { rects: [box], bounds: box };
          return { element, box, contentRects: contentGeometry.rects, contentBounds: contentGeometry.bounds };
        });
      for (const rect of sourceRects) {
        const pageSize = layoutPageSourceSize(page);
        if (avoidPageOverflow && (
          rect.left < -1.5 || rect.top < -1.5 ||
          rect.right > pageSize.width + 1.5 || rect.bottom > pageSize.height + 1.5
        )) {
          return {
            source: node,
            blocker: null,
            rect,
            sourceName: blockDebugName(node),
            blockerName: 'page-boundary',
          };
        }
        const hit = barriers.find((barrier) => {
          // 正文的字号填充只受同列（或原始框已相互侵入）的块约束。
          // 并列栏即使处于同一高度，也不应互相压低字号；页面左右越界仍由
          // avoidPageOverflow 单独保护。这里按源框投影而非文字墨迹判断，故仍能
          // 捕获错误扩宽的正文框和向下增长压到同列块的情形。
          if (bodyColumnIndependentFit && node.dataset.styleKind === 'body_text' &&
              !horizontalBoxesOverlap(own, barrier.box, 1.5)) {
            return false;
          }
          if (!rectsOverlap(rect, barrier.contentBounds, 1.5)) return false;
          const contentHit = barrier.contentRects.some((contentRect) => rectsOverlap(rect, contentRect, 1.5));
          if (!contentHit) return false;
          // Adjacent source bboxes can overlap by a rounding pixel. Ignore only
          // that upper shared edge for body text; horizontal and lower-edge
          // collisions from the same first line are still enforced.
          if (ignoreNodeTopOverflow && rect.top < own.top && barrier.box.bottom <= own.top + 1.5) {
            return false;
          }
          // Inline math and justified CJK glyphs can overhang a column edge by
          // a few pixels even though the line box itself remains in-column.
          // Treat only a shallow overhang across an exactly shared vertical
          // edge as optical ink; any deeper intrusion remains a collision.
          const sharesRightEdge = Math.abs(own.right - barrier.box.left) <= 1.5;
          const sharesLeftEdge = Math.abs(own.left - barrier.box.right) <= 1.5;
          if (sharedEdgeTolerance > 0 && (
            (sharesRightEdge && rect.right <= own.right + sharedEdgeTolerance) ||
            (sharesLeftEdge && rect.left >= own.left - sharedEdgeTolerance)
          )) {
            return false;
          }
          const sharesBottomEdge = Math.abs(own.bottom - barrier.box.top) <= 1.5;
          const sharesTopEdge = Math.abs(own.top - barrier.box.bottom) <= 1.5;
          if (sharedHorizontalEdgeTolerance > 0 && (
            (sharesBottomEdge && rect.bottom <= own.bottom + sharedHorizontalEdgeTolerance) ||
            (sharesTopEdge && rect.top >= own.top - sharedHorizontalEdgeTolerance)
          )) {
            return false;
          }
          return true;
        });
        if (hit) {
          return {
            source: node,
            blocker: hit.element,
            rect,
            sourceName: blockDebugName(node),
            blockerName: blockDebugName(hit.element),
          };
        }
      }
    }
    return null;
  }

  function applyGroup(nodes, fontSize, lineRatio) {
    for (const node of nodes) {
      if (!node || !node.style) continue;
      const coordinateScale = Number(node.dataset.layoutFontScale || 1);
      node.style.fontSize = `${(fontSize * coordinateScale).toFixed(2)}px`;
      node.style.lineHeight = lineRatio.toFixed(3);
    }
  }

  function layoutControlFontSize(node, fallback = 8) {
    const rendered = parseFloat(node?.style?.fontSize || '');
    const coordinateScale = Number(node?.dataset?.layoutFontScale || 1);
    return Number.isFinite(rendered) && rendered > 0
      ? rendered / Math.max(.0001, coordinateScale)
      : (parseFloat(node?.dataset?.baseFont || String(fallback)) || fallback);
  }

  function measureGroup(nodes) {
    let overflow = false;
    let allReachedBand = true;
    let maxBottomGap = 0;
    let details = [];
    for (const node of nodes) {
      if (!node || !node.style) continue;
      const pageHeight = parseFloat(node.dataset.pageHeight || "792");
      const fitBandRatio = parseFloat(node.dataset.fitBandRatio || "");
      const band = Number.isFinite(fitBandRatio)
        ? Math.max(1.0, node.clientHeight * fitBandRatio)
        : pageHeight * 0.02;
      const metrics = measureTextBand(node);
      const coordinateScale = layoutPageCoordinateScale(node.closest('.layout-page'));
      const overflowTolerance = 1.5 * coordinateScale;
      const bottomGap = Math.max(0, node.clientHeight - metrics.lastBottom);
      const overflowAmount = Math.max(
        0,
        metrics.lastBottom - node.clientHeight - overflowTolerance,
        node.dataset.styleKind === 'body_text' ? 0 : -metrics.firstTop - overflowTolerance
      );
      maxBottomGap = Math.max(maxBottomGap, bottomGap);
      if (overflowAmount > 0.5) {
        overflow = true;
      }
      if (!metrics.hasText || bottomGap > band) {
        allReachedBand = false;
      }
      details.push({
        node,
        hasText: metrics.hasText,
        bottomGap,
        band,
        overflowAmount,
        reachedBand: metrics.hasText && bottomGap <= band,
      });
    }
    return { overflow, allReachedBand, maxBottomGap, details };
  }

  function measureAt(nodes, fontSize, lineRatio) {
    applyGroup(nodes, fontSize, lineRatio);
    return measureGroup(nodes);
  }

  function wouldCollideWithBlocks(nodes, options) {
    if (!options.avoidBlockOverlap) return false;
    return Boolean(textCollisionDetails(nodes, options));
  }

  function clearFitMarks(nodes) {
    for (const node of nodes) {
      if (!node || !node.classList) continue;
      node.classList.remove('fit-limiter');
      node.classList.remove('fit-blocker');
      node.dataset.fitLabel = '';
      node.dataset.fitDebug = '';
      setDiagnosticTitle(node, '');
    }
  }

  function ensureCollisionDebugLayer(page) {
    let layer = page.querySelector(':scope > .layout-collision-debug-layer');
    if (layer) return layer;
    layer = document.createElement('div');
    layer.className = 'layout-collision-debug-layer';
    layer.setAttribute('aria-hidden', 'true');
    page.appendChild(layer);
    return layer;
  }

  function clearCollisionDebugLayer(page) {
    const layer = page && page.querySelector(':scope > .layout-collision-debug-layer');
    if (layer) layer.replaceChildren();
  }

  function clearAllCollisionDebugLayers() {
    for (const page of document.querySelectorAll('.layout-page')) {
      clearCollisionDebugLayer(page);
    }
  }

  function drawCollisionDebug(collision) {
    if (!collision || !collision.source || !collision.blocker) return;
    if (!document.body.classList.contains('layout-debug')) return;
    const page = collision.source.closest('.layout-page');
    if (!page) return;
    const layer = ensureCollisionDebugLayer(page);
    const rect = collision.rect;
    const blockerBox = elementBoxInPage(collision.blocker);
    const sourceBox = elementBoxInPage(collision.source);
    const coordinateScale = layoutPageCoordinateScale(page);
    const hitBox = document.createElement('div');
    hitBox.className = 'layout-collision-debug-box';
    hitBox.dataset.debugLabel = 'TEXT HIT';
    hitBox.style.left = `${(rect.left * coordinateScale).toFixed(2)}px`;
    hitBox.style.top = `${(rect.top * coordinateScale).toFixed(2)}px`;
    hitBox.style.width = `${Math.max(1, (rect.right - rect.left) * coordinateScale).toFixed(2)}px`;
    hitBox.style.height = `${Math.max(1, (rect.bottom - rect.top) * coordinateScale).toFixed(2)}px`;
    hitBox.title = `text overflow hit blocker\nsource=${collision.sourceName}\nblocker=${collision.blockerName}`;
    layer.appendChild(hitBox);
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.classList.add('layout-collision-debug-line');
    svg.setAttribute('viewBox', `0 0 ${Math.max(1, page.offsetWidth)} ${Math.max(1, page.offsetHeight)}`);
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', (((sourceBox.left + sourceBox.right) / 2) * coordinateScale).toFixed(2));
    line.setAttribute('y1', (((sourceBox.top + sourceBox.bottom) / 2) * coordinateScale).toFixed(2));
    line.setAttribute('x2', (((blockerBox.left + blockerBox.right) / 2) * coordinateScale).toFixed(2));
    line.setAttribute('y2', (((blockerBox.top + blockerBox.bottom) / 2) * coordinateScale).toFixed(2));
    line.setAttribute('stroke', 'rgba(185, 28, 28, 0.95)');
    line.setAttribute('stroke-width', '2');
    line.setAttribute('stroke-dasharray', '5 3');
    svg.appendChild(line);
    layer.appendChild(svg);
  }

  function markLimiter(nodes, fontSize, lineRatio, options, stopReason) {
    const finalState = measureAt(nodes, fontSize, lineRatio);
    const collision = options.avoidBlockOverlap ? textCollisionDetails(nodes, options) : null;
    const nextFontState = fontSize + options.step <= options.maxFont
      ? measureAt(nodes, fontSize + options.step, lineRatio)
      : null;
    const nextLineState = lineRatio + options.lineStep <= options.maxLineRatio
      ? measureAt(nodes, fontSize, lineRatio + options.lineStep)
      : null;
    applyGroup(nodes, fontSize, lineRatio);
    const fontLimiters = new Set(
      (nextFontState?.details || [])
        .filter((detail) => detail.overflowAmount > 0.5)
        .map((detail) => detail.node)
    );
    const lineLimiters = new Set(
      (nextLineState?.details || [])
        .filter((detail) => detail.overflowAmount > 0.5)
        .map((detail) => detail.node)
    );
    const candidates = finalState.details
      .slice()
      .sort((a, b) => {
        const aNextOverflow = (fontLimiters.has(a.node) ? 1 : 0) + (lineLimiters.has(a.node) ? 1 : 0);
        const bNextOverflow = (fontLimiters.has(b.node) ? 1 : 0) + (lineLimiters.has(b.node) ? 1 : 0);
        if (aNextOverflow !== bNextOverflow) return bNextOverflow - aNextOverflow;
        return a.bottomGap - b.bottomGap;
      });
    const limiter = candidates.find((detail) => fontLimiters.has(detail.node) || lineLimiters.has(detail.node))
      || (collision ? candidates.find((detail) => detail.node === collision.source) : null)
      || candidates.find((detail) => !detail.reachedBand)
      || candidates[0];
    for (const detail of finalState.details) {
      const gap = detail.bottomGap.toFixed(1);
      const band = detail.band.toFixed(1);
      const overflow = detail.overflowAmount.toFixed(1);
      const isLimiter = limiter && detail.node === limiter.node;
      if (detail.node.classList) detail.node.classList.toggle('fit-limiter', isLimiter);
      const labelPrefix = options.labelPrefix || 'LIMIT';
      const labelReason = collision && isLimiter ? `${labelPrefix} ${stopReason} hit` : `${labelPrefix} ${stopReason} gap ${gap}`;
      detail.node.dataset.fitLabel = (isLimiter || options.markAll) ? labelReason : '';
      detail.node.dataset.fitDebug = [
        `font=${fontSize.toFixed(2)}`,
        `line=${lineRatio.toFixed(3)}`,
        `gap=${gap}`,
        `band=${band}`,
        `overflow=${overflow}`,
        `stop=${stopReason}`,
        `self=${blockDebugName(detail.node)}`,
        collision ? `collisionSource=${collision.sourceName}` : '',
        collision ? `collisionBlocker=${collision.blockerName}` : '',
        `nextFontOverflow=${nextFontState ? fontLimiters.has(detail.node) : 'max'}`,
        `nextLineOverflow=${nextLineState ? lineLimiters.has(detail.node) : 'max'}`
      ].filter(Boolean).join(' ');
      setDiagnosticTitle(detail.node, detail.node.dataset.fitDebug);
    }
    if (collision && collision.blocker && document.body.classList.contains('layout-debug')) {
      collision.blocker.classList.add('fit-blocker');
      collision.blocker.dataset.fitLabel = 'BLOCKER';
      collision.blocker.dataset.fitDebug = [
        'collision blocker',
        `source=${collision.sourceName}`,
        `blocker=${collision.blockerName}`,
      ].join(' ');
      setDiagnosticTitle(collision.blocker, collision.blocker.dataset.fitDebug);
      drawCollisionDebug(collision);
    }
  }

  function tuneGroup(selector, options) {
    const nodes = scopedNodes(selector);
    if (!nodes.length) return;
    tuneNodes(nodes, options);
    if (options.continueUnderfilledNodes) {
      continueUnderfilledNodes(nodes, options);
    }
  }

  // Short single-column transitions inherit the shared body font, then back
  // off locally during the final collision audit if necessary.
  function syncInheritedBodyFontToBodyGroup() {
    const bodyNodes = scopedNodes(
      '.layout-flow-stream[data-style-kind="body_text"][data-flow-kind="text"]:not([data-body-inherited="1"])'
    );
    const inheritedNodes = scopedNodes(
      '.layout-flow-stream[data-style-kind="body_text"][data-flow-kind="text"][data-body-inherited="1"]'
    );
    if (!bodyNodes.length || !inheritedNodes.length) return;
    const fontSize = Math.min(...bodyNodes
      .map((node) => layoutControlFontSize(node, 0))
      .filter((value) => Number.isFinite(value) && value > 0));
    if (!Number.isFinite(fontSize) || fontSize <= 0) return;
    for (const node of inheritedNodes) {
      const lineRatio = parseFloat(node.style.lineHeight || node.dataset.lineRatio || '1.1') || 1.1;
      applyGroup([node], fontSize, lineRatio);
    }
  }

  function tuneEach(selector, options) {
    const nodes = scopedNodes(selector);
    for (const node of nodes) {
      tuneNodes([node], options);
    }
  }

  function titleFrameFill(node) {
    const own = elementBoxInPage(node);
    const ownWidth = Math.max(1, own.right - own.left);
    const ownHeight = Math.max(1, own.bottom - own.top);
    const ink = rectUnion(textRectsInPage(node));
    if (!ink) return { area: 0, width: 0, height: 0 };
    const usedWidth = Math.max(0, Math.min(own.right, ink.right) - Math.max(own.left, ink.left));
    const usedHeight = Math.max(0, Math.min(own.bottom, ink.bottom) - Math.max(own.top, ink.top));
    const width = Math.min(1, usedWidth / ownWidth);
    const height = Math.min(1, usedHeight / ownHeight);
    return { area: width * height, width, height };
  }

  function expandUnderfilledTitles(selector, options) {
    const areaThreshold = Number.isFinite(options.titleFillAreaThreshold)
      ? options.titleFillAreaThreshold
      : 0.42;
    const dimensionThreshold = Number.isFinite(options.titleFillDimensionThreshold)
      ? options.titleFillDimensionThreshold
      : 0.72;
    for (const node of scopedNodes(selector)) {
      const initialFill = titleFrameFill(node);
      if (initialFill.area >= areaThreshold || (
        initialFill.width >= dimensionThreshold && initialFill.height >= dimensionThreshold
      )) continue;
      let fontSize = layoutControlFontSize(node);
      const lineRatio = parseFloat(node.style.lineHeight || node.dataset.lineRatio || '1.12') || 1.12;
      for (let safety = 0; safety < 136 && fontSize + options.step <= options.maxFont; safety += 1) {
        const nextFont = fontSize + options.step;
        applyGroup([node], nextFont, lineRatio);
        if (textCollisionDetails([node], options)) {
          applyGroup([node], fontSize, lineRatio);
          break;
        }
        fontSize = nextFont;
        const fill = titleFrameFill(node);
        if (fill.area >= areaThreshold || (
          fill.width >= dimensionThreshold && fill.height >= dimensionThreshold
        )) break;
      }
    }
  }

  function clusterTitleFontSizes(selector, maxDifference = 1.0) {
    const nodes = scopedNodes(selector)
      .filter((node) => node && node.style)
      .map((node) => ({ node, fontSize: layoutControlFontSize(node, 0) }))
      .filter((entry) => entry.fontSize > 0)
      .sort((left, right) => left.fontSize - right.fontSize);
    let cluster = [];
    let clusterMinimum = 0;
    const applyCluster = () => {
      if (cluster.length < 2) return;
      for (const entry of cluster) {
        applyGroup([entry.node], clusterMinimum, parseFloat(entry.node.style.lineHeight || entry.node.dataset.lineRatio || '1.12') || 1.12);
      }
    };
    for (const entry of nodes) {
      if (!cluster.length || entry.fontSize - clusterMinimum <= maxDifference + 0.001) {
        cluster.push(entry);
        if (cluster.length === 1) clusterMinimum = entry.fontSize;
        continue;
      }
      applyCluster();
      cluster = [entry];
      clusterMinimum = entry.fontSize;
    }
    applyCluster();
  }

  function renderedTextLineCount(node, topTolerance = 1.5) {
    const tops = [];
    const rects = textRectsInPage(node).sort((left, right) => (
      left.top - right.top || left.left - right.left
    ));
    for (const rect of rects) {
      if (!tops.some((top) => Math.abs(top - rect.top) <= topTolerance)) {
        tops.push(rect.top);
      }
    }
    return tops.length;
  }

  // Keep a short translated title on one line only when a bounded width
  // extension is collision-free. Use rendered lines, not MinerU's label.
  function keepShortTitlesOnOneLine(selector, options = {}) {
    const maxCharacters = Number.isFinite(options.maxCharacters) ? options.maxCharacters : 12;
    const maxBorrowPx = Number.isFinite(options.maxBorrowPx) ? options.maxBorrowPx : 18;
    const maxWidthRatio = Number.isFinite(options.maxWidthRatio) ? options.maxWidthRatio : 1.35;
    for (const node of scopedNodes(selector)) {
      const text = (node.innerText || '').replace(/\s+/g, ' ').trim();
      if (Array.from(text).length < 2 || Array.from(text).length > maxCharacters) continue;
      if (renderedTextLineCount(node) <= 1) continue;

      const originalWidth = node.style.width;
      const originalWhiteSpace = node.style.whiteSpace;
      const page = node.closest('.layout-page');
      const coordinateScale = layoutPageCoordinateScale(page);
      const own = elementBoxInPage(node);
      const ownWidth = Math.max(1, own.right - own.left);
      node.style.whiteSpace = 'nowrap';

      const nowrapRects = textRectsInPage(node);
      const ink = rectUnion(nowrapRects);
      if (!ink || renderedTextLineCount(node) !== 1) {
        node.style.width = originalWidth;
        node.style.whiteSpace = originalWhiteSpace;
        continue;
      }
      const requiredWidth = Math.max(ownWidth, ink.right - own.left + 0.75);
      const borrowedWidth = requiredWidth - ownWidth;
      if (ink.left < own.left - 1.5 || borrowedWidth > maxBorrowPx || requiredWidth / ownWidth > maxWidthRatio) {
        node.style.width = originalWidth;
        node.style.whiteSpace = originalWhiteSpace;
        continue;
      }

      node.style.width = `${(requiredWidth * coordinateScale).toFixed(2)}px`;
      const collision = textCollisionDetails([node], {
        avoidBlockOverlap: true,
        avoidPageOverflow: true,
        checkAllTextForCollisions: true,
      });
      if (collision) {
        node.style.width = originalWidth;
        node.style.whiteSpace = originalWhiteSpace;
        continue;
      }
      node.dataset.shortTitleNoWrap = '1';
    }
  }

  // Monotone collision-constrained growth: find the largest value in
  // [start, max] (stepped by `step`) at which `collides(value)` is still false.
  // Chromium line breaks are only weakly monotone, so recheck the tick above
  // the bisected boundary. `collides` leaves the node at the probed value.
  function gallopingGrow(start, max, step, collides) {
    if (start >= max) return { value: start, probes: 0 };
    const ticks = Math.floor((max - start) / step + 1e-6);
    if (ticks <= 0) return { value: start, probes: 0 };
    const at = (t) => Math.min(max, start + t * step);
    let probes = 0;
    let lastOk = 0;
    let firstBad = -1;
    let jump = 1;
    while (lastOk + jump <= ticks) {
      const t = lastOk + jump;
      probes += 1;
      if (collides(at(t))) { firstBad = t; break; }
      lastOk = t;
      jump *= 2;
    }
    // A doubling jump can pass the final tick (for example 1, 3, 7, 15 on a
    // 23-tick search).  Probe that endpoint before declaring max feasible;
    // otherwise a collision in the unvisited tail can be accepted as max.
    if (firstBad === -1 && lastOk < ticks) {
      probes += 1;
      if (collides(at(ticks))) firstBad = ticks;
      else lastOk = ticks;
    }
    if (firstBad === -1) {
      return { value: at(ticks), probes, lastProbed: at(ticks) };
    }
    let lo = lastOk;
    let hi = firstBad;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      probes += 1;
      if (collides(at(mid))) hi = mid; else lo = mid;
    }
    let best = lo;
    for (let t = lo + 1; t <= Math.min(ticks, lo + 1); t += 1) {
      probes += 1;
      if (collides(at(t))) break;
      best = t;
    }
    return { value: at(best), probes, lastProbed: at(Math.min(ticks, best + 1)) };
  }

  function tuneNodes(nodes, options) {
    if (!nodes.length) return null;
    clearFitMarks(nodes);
    const baseFont = Math.max(...nodes.map((node) => parseFloat(node.dataset.baseFont || "8")));
    const baseLineRatio = Math.max(...nodes.map((node) => parseFloat(node.dataset.lineRatio || "1.1")));
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
    let stopReason = 'unknown';
    let lastCollision = null;
    applyGroup(nodes, fontSize, lineRatio);
    let safety = 0;
    while (safety < 120 && (!options.allowOverflow || options.enforceInitialCollisionBackoff)) {
      safety += 1;
      // measureGroup forces a synchronous reflow and a full glyph walk per node.
      // Its result here is consumed only through groupState.overflow, which cannot
      // block when overflow is allowed. Skip the measurement in that case so a
      // grow loop that permits overflow no longer pays for an unused reflow.
      const groupState = !options.allowOverflow ? measureGroup(nodes) : null;
      const initialProbe = beginBodyIterationProbe(nodes, 'initial-backoff');
      const collision = options.enforceInitialCollisionBackoff
        ? wouldCollideWithBlocks(nodes, options)
        : null;
      recordBodyIterationCollision(collision, initialProbe);
      const blockingOverflow = Boolean(groupState && groupState.overflow) && !options.allowOverflow;
      if (!blockingOverflow && !collision) break;
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
        stopReason = collision ? 'min-block-overlap' : 'min-overflow';
        break;
      }
    }
    safety = 0;
    // The current-state measurement is read only for overflow (inert when
    // overflow is allowed) and for the fill-stop test (inert when the group
    // never stops on fill, e.g. overflow-first body/title/generic text). Skip
    // it whenever neither consumer can act on it.
    const needFillState = options.stopWhenFilled !== false;
    // Purely collision-constrained growth (generic per-node text): the stop
    // condition is a monotone "first colliding tick", with no overflow or fill
    // early-out that would need per-tick measurement. Bracket-and-bisect that
    // boundary instead of probing every tick. Restricted to SINGLE-node groups
    // with a wide remaining range and no initial-backoff anchor (titles); those
    // collide just above baseFont and are better served by the linear scan.
    // window.__gallopDisabled forces the linear path for controlled comparison.
    const remainingTicks = (options.maxFont - fontSize) / options.step;
    const monotoneFontSearch = (typeof window === 'undefined' || window.__gallopDisabled !== true) &&
      options.allowOverflow && !needFillState &&
      options.avoidBlockOverlap && !options.coupleFontAndLine &&
      !options.enforceInitialCollisionBackoff &&
      nodes.length === 1 && remainingTicks >= 8;
    if (monotoneFontSearch && fontSize < options.maxFont) {
      const grown = gallopingGrow(fontSize, options.maxFont, options.step, (value) => {
        applyGroup(nodes, value, lineRatio);
        beginBodyIterationProbe(nodes, 'font-grow');
        return Boolean(textCollisionDetails(nodes, options));
      });
      fontSize = grown.value;
      applyGroup(nodes, fontSize, lineRatio);
      stopReason = fontSize >= options.maxFont - 1e-6 ? 'max-font' : 'block-overlap';
    } else {
      while (safety < 80) {
        safety += 1;
        const groupState = (!options.allowOverflow || needFillState) ? measureGroup(nodes) : null;
        if (groupState && groupState.overflow && !options.allowOverflow) {
          stopReason = 'overflow';
          break;
        }
        if (needFillState && groupState && groupState.allReachedBand) {
          stopReason = 'filled';
          break;
        }
        const nextFont = fontSize + options.step;
        if (nextFont > options.maxFont) {
          stopReason = 'max-font';
          break;
        }
        applyGroup(nodes, nextFont, lineRatio);
        const nextState = !options.allowOverflow ? measureGroup(nodes) : null;
        const fontProbe = beginBodyIterationProbe(nodes, 'font-grow');
        const collision = options.avoidBlockOverlap ? textCollisionDetails(nodes, options) : null;
        recordBodyIterationCollision(collision, fontProbe);
        if (collision) {
          applyGroup(nodes, fontSize, lineRatio);
          stopReason = 'block-overlap';
          lastCollision = collision;
          break;
        }
        if (nextState && nextState.overflow && !options.allowOverflow) {
          applyGroup(nodes, fontSize, lineRatio);
          stopReason = 'font-overflow';
          break;
        }
        fontSize = nextFont;
      }
    }
    safety = 0;
    while (!options.coupleFontAndLine && safety < 80 && !(options.skipLineExpansionAfterFontCollision && stopReason === 'block-overlap')) {
      safety += 1;
      const groupState = (!options.allowOverflow || needFillState) ? measureGroup(nodes) : null;
      if ((groupState && groupState.overflow && !options.allowOverflow) || (needFillState && groupState && groupState.allReachedBand)) {
        stopReason = groupState && groupState.overflow && !options.allowOverflow ? 'overflow' : 'filled';
        break;
      }
      const nextRatio = lineRatio + options.lineStep;
      if (nextRatio > options.maxLineRatio) {
        stopReason = 'max-line';
        break;
      }
      applyGroup(nodes, fontSize, nextRatio);
      const nextState = !options.allowOverflow ? measureGroup(nodes) : null;
      const lineProbe = beginBodyIterationProbe(nodes, 'line-grow');
      const collision = options.avoidBlockOverlap ? textCollisionDetails(nodes, options) : null;
      recordBodyIterationCollision(collision, lineProbe);
      if (collision) {
        applyGroup(nodes, fontSize, lineRatio);
        stopReason = 'block-overlap';
        lastCollision = collision;
        break;
      }
      if (nextState && nextState.overflow && !options.allowOverflow) {
        applyGroup(nodes, fontSize, lineRatio);
        stopReason = 'line-overflow';
        break;
      }
      lineRatio = nextRatio;
    }
    if (options.showLimiter) {
      markLimiter(nodes, fontSize, lineRatio, options, stopReason);
    }
    return { fontSize, lineRatio, stopReason, collision: lastCollision };
  }

  // 正文二次迭代必须始终保持统一字号：所有正文同步增大字号，
  // 发生碰撞时只压缩碰撞源的行距；如果行距降到下限仍无法消除碰撞，
  // 则撤销本轮所有正文的字号增长并结束二次迭代，绝不单独缩小某个正文块。
  function continueUnderfilledNodes(nodes, options) {
    const targetFill = Number.isFinite(options.minTextFillRatio)
      ? options.minTextFillRatio
      : 0.85;
    const bodyNodes = (nodes || []).filter((node) => node && node.style);
    const fillRatio = (node) => {
      const metrics = measureTextBand(node);
      if (!metrics.hasText || node.clientHeight <= 0) return 0;
      return Math.min(1, Math.max(0, metrics.lastBottom) / node.clientHeight);
    };
    if (!bodyNodes.length || !bodyNodes.some((node) => fillRatio(node) < targetFill)) return;

    const minLineRatio = Number.isFinite(options.collisionMinLineRatio)
      ? options.collisionMinLineRatio
      : 1.02;

    const snapshotStyles = () => bodyNodes.map((node) => ({
      node,
      fontSize: layoutControlFontSize(node),
      lineRatio: parseFloat(node.style.lineHeight || node.dataset.lineRatio || '1.1') || 1.1,
    }));

    const restoreStyles = (snapshots) => {
      for (const snapshot of snapshots) {
        applyGroup([snapshot.node], snapshot.fontSize, snapshot.lineRatio);
      }
    };

    const markUniformFontStop = (source, collision, restoredFont) => {
      if (!document.body.classList.contains('layout-debug') || !source || !source.classList) return;
      source.classList.add('fit-limiter');
      source.dataset.fitLabel = 'STOP 统一字号';
      source.dataset.fitDebug = [
        '正文统一字号二次迭代停止',
        'reason=line-backoff-exhausted',
        `font=${restoredFont.toFixed(2)}`,
        `line=${parseFloat(source.style.lineHeight || '0').toFixed(3)}`,
        `fill=${(fillRatio(source) * 100).toFixed(1)}%`,
        collision ? `blocker=${collision.blockerName}` : '',
        `self=${blockDebugName(source)}`,
      ].filter(Boolean).join(' ');
      setDiagnosticTitle(source, source.dataset.fitDebug);
    };

    const recoverCollisionByLineRatio = (source, initialCollision) => {
      let collision = initialCollision;
      const fontSize = layoutControlFontSize(source);
      let lineRatio = parseFloat(source.style.lineHeight || source.dataset.lineRatio || '1.1') || 1.1;
      const sourceMinLineRatio = minLineRatio;

      // 正文碰撞只允许降低碰撞源自己的行距，最低保持 1.02 倍字号；字号
      // 仍属于全文共享状态，禁止任何正文块单独缩小字号。
      for (let safety = 0; collision && safety < 80 && lineRatio > sourceMinLineRatio + 0.001; safety += 1) {
        lineRatio = Math.max(sourceMinLineRatio, lineRatio - options.lineStep);
        applyGroup([source], fontSize, lineRatio);
        const recoveryProbe = beginBodyIterationProbe([source], 'collision-line-backoff');
        collision = textCollisionDetails([source], options);
        recordBodyIterationCollision(collision, recoveryProbe);
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
      for (const snapshot of snapshots) {
        applyGroup([snapshot.node], nextFont, snapshot.lineRatio);
      }

      const sharedProbe = beginBodyIterationProbe(bodyNodes, 'shared-font-grow');
      let collision = options.avoidBlockOverlap ? textCollisionDetails(bodyNodes, options) : null;
      recordBodyIterationCollision(collision, sharedProbe);

      while (collision) {
        const initialCollision = collision;
        const source = collision.source;
        const recovery = recoverCollisionByLineRatio(source, collision);

        if (initialCollision.blocker && document.body.classList.contains('layout-debug')) {
          drawCollisionDebug(initialCollision);
        }

        if (recovery.collision) {
          // 行距已经降到可读下限仍发生碰撞：撤销整组本轮增长并终止，保持正文统一字号。
          restoreStyles(snapshots);
          markUniformFontStop(source, recovery.collision, currentFont);
          return;
        }

        const retryProbe = beginBodyIterationProbe(bodyNodes, 'shared-recheck');
        collision = options.avoidBlockOverlap
          ? textCollisionDetails(bodyNodes, options)
          : null;
        recordBodyIterationCollision(collision, retryProbe);
      }
    }
  }

  function clampTranslatedOverflow() {
    if (!document.body.classList.contains('layout-translated')) return;
    for (const node of scopedNodes('.layout-flow-stream[data-flow-kind="ref_text"]')) {
      if (!node || !node.style) continue;
      let fontSize = layoutControlFontSize(node);
      let lineRatio = parseFloat(node.style.lineHeight || node.dataset.lineRatio || "1.1") || 1.1;
      const isRef = node.dataset.flowKind === "ref_text";
      const minFont = isRef ? 4.8 : 5.0;
      const minLineRatio = isRef ? 0.98 : 1.0;
      applyGroup([node], fontSize, lineRatio);
      for (let i = 0; i < 120 && node.scrollHeight > node.clientHeight + 1 && (fontSize > minFont || lineRatio > minLineRatio); i += 1) {
        if (lineRatio > minLineRatio) {
          lineRatio = Math.max(minLineRatio, lineRatio - 0.025);
        } else {
          fontSize = Math.max(minFont, fontSize - 0.25);
        }
        applyGroup([node], fontSize, lineRatio);
      }
      node.dataset.baseFont = fontSize.toFixed(2);
      node.dataset.lineRatio = lineRatio.toFixed(3);
    }
  }

  // A translated code block owns a fixed source frame. Let its text become
  // denser before exposing an internal scrollbar; never let the pre silently
  // clip the tail of the translation while the following blocks keep their
  // original positions.
  function clampTranslatedCodeOverflow() {
    const nodes = scopedNodes('#translation-layout .layout-block.type-code');
    let changed = false;
    for (const node of nodes) {
      if (!node || !node.style) continue;
      const code = node.querySelector(':scope > .layout-code') || node.querySelector('.layout-code');
      if (!code) continue;
      const minFont = 7.0;
      const minLineRatio = 1.10;
      const requestedFont = layoutControlFontSize(node, 10);
      const requestedLineRatio = parseFloat(node.style.lineHeight || node.dataset.lineRatio || '1.18') || 1.18;
      let fontSize = Math.max(minFont, requestedFont);
      let lineRatio = Math.max(minLineRatio, requestedLineRatio);
      if (fontSize !== requestedFont || lineRatio !== requestedLineRatio) changed = true;
      code.style.overflow = 'hidden';
      applyGroup([node], fontSize, lineRatio);
      for (let i = 0; i < 160 && code.scrollHeight > code.clientHeight + 1
        && (lineRatio > minLineRatio + 0.001 || fontSize > minFont + 0.001); i += 1) {
        if (lineRatio > minLineRatio + 0.001) {
          lineRatio = Math.max(minLineRatio, lineRatio - 0.025);
        } else {
          fontSize = Math.max(minFont, fontSize - 0.25);
        }
        applyGroup([node], fontSize, lineRatio);
        changed = true;
      }
      if (code.scrollHeight > code.clientHeight + 1) {
        // The fallback is explicit and local to the code frame, so it cannot
        // cover or push any content below the positioned block.
        code.style.overflow = 'auto';
        node.dataset.codeFit = 'scroll';
      } else {
        node.dataset.codeFit = 'fit';
      }
      node.dataset.baseFont = fontSize.toFixed(2);
      node.dataset.lineRatio = lineRatio.toFixed(3);
    }
    return changed;
  }

  // All groups are tuned independently, so perform one final glyph-level
  // audit after every style mutation. Unlike the iteration probes, this checks
  // every visible glyph against every layout box, including cross-group cases
  // such as body text beside references. Only a detected source is backed off.
  function enforceFinalTextCollisionSafety() {
    const nodes = scopedNodes(
      '.layout-flow-stream[data-flow-kind="text"], .layout-flow-stream[data-flow-kind="ref_text"]'
    ).filter((node) => node && node.style);
    const exhausted = new Set();
    const repairCounts = new Map();
    // Covers the full 42px-to-4.8px backoff range with a small margin.
    const MAX_FINAL_COLLISION_REPAIRS_PER_NODE = 192;
    const options = {
      avoidBlockOverlap: true,
      avoidPageOverflow: true,
      includeGroupPeers: true,
      checkAllTextForCollisions: true,
      ignoreTopOverflow: false,
      ignoreBodyTopOverflow: true,
      bodyColumnIndependentFit: true,
      bodyTextCollisionGeometry: true,
      sharedEdgeTolerance: 4.0,
      sharedHorizontalEdgeTolerance: 3.0,
    };
    // The legacy loop restarted from node zero after every backoff.  That is
    // quadratic. Recheck the changed source, then continue in source order.
    let scanIndex = 0;
    while (scanIndex < nodes.length) {
      const candidate = nodes[scanIndex];
      if (!candidate || exhausted.has(candidate)) {
        scanIndex += 1;
        continue;
      }
      const finalProbe = beginBodyIterationProbe([candidate], 'final-safety-audit');
      const collision = textCollisionDetails([candidate], options);
      recordBodyIterationCollision(collision, finalProbe);
      if (!collision) {
        scanIndex += 1;
        continue;
      }
      const source = collision.source;
      const repairs = (repairCounts.get(source) || 0) + 1;
      repairCounts.set(source, repairs);
      if (repairs > MAX_FINAL_COLLISION_REPAIRS_PER_NODE) {
        // The fallback is deliberately local. The rest of the paper still
        // receives an exact audit, and an exceptional source cannot freeze
        // the host by repeatedly restarting the entire document scan.
        exhausted.add(source);
        if (document.body.classList.contains('layout-debug') && source.classList) {
          source.classList.add('fit-limiter');
          source.dataset.fitLabel = 'FINAL collision guard';
          source.dataset.fitDebug = `final collision repair limit=${MAX_FINAL_COLLISION_REPAIRS_PER_NODE} self=${blockDebugName(source)}`;
          setDiagnosticTitle(source, source.dataset.fitDebug);
        }
        scanIndex += 1;
        continue;
      }
      let fontSize = layoutControlFontSize(source);
      let lineRatio = parseFloat(source.style.lineHeight || source.dataset.lineRatio || '1.1') || 1.1;
      const minFont = source.dataset.flowKind === 'ref_text' ? 4.8 : 4.8;
      // Short single-column transitions inherit the body baseline but must
      // never constrain its document-wide fit. They can still back off here
      // if a translated sentence genuinely cannot fit its source band.
      const isInheritedBodyText = source.dataset.styleKind === 'body_text'
        && source.dataset.bodyInherited === '1';
      const isBodyText = source.dataset.styleKind === 'body_text'
        && (!isInheritedBodyText || !ALLOW_INHERITED_BODY_FONT_BACKOFF);
      const minLineRatio = isBodyText ? 1.02 : 0.98;
      const ownBox = elementBoxInPage(source);
      const firstLineTopCollision = !isBodyText
        && collision.rect
        && collision.rect.top < ownBox.top - 1;
      // Increase leading when first-line ink crosses the source box's top edge.
      if (ALLOW_INHERITED_BODY_FONT_BACKOFF && isInheritedBodyText && fontSize > minFont + 0.001) {
        // The shared body font is restored first. If this one narrow
        // transition cannot fit, only this source may give back font size.
        fontSize = Math.max(minFont, fontSize - 0.25);
      } else if (firstLineTopCollision && lineRatio < 1.85 - 0.001) {
        lineRatio = Math.min(1.85, lineRatio + 0.025);
      } else if (lineRatio > minLineRatio + 0.001) {
        lineRatio = Math.max(minLineRatio, lineRatio - 0.025);
      } else if (isBodyText) {
        // 最终安全检查同样禁止单独缩小正文。行距到底仍冲突时放弃处理该正文块，
        // 避免最后一道检查重新破坏二次迭代已经保证的统一字号。
        exhausted.add(source);
        scanIndex += 1;
        continue;
      } else if (fontSize > minFont + 0.001) {
        fontSize = Math.max(minFont, fontSize - 0.25);
      } else {
        exhausted.add(source);
        scanIndex += 1;
        continue;
      }
      applyGroup([source], fontSize, lineRatio);
      // Only this source moved, so it is the sole node that needs another
      // glyph-level probe before the audit advances to the next source.
      if (document.body.classList.contains('layout-debug') && source.classList) {
        source.classList.add('fit-limiter');
        source.dataset.fitLabel = 'FINAL collision backoff';
        source.dataset.fitDebug = [
          'final glyph collision backoff',
          `font=${fontSize.toFixed(2)}`,
          `line=${lineRatio.toFixed(3)}`,
          `blocker=${collision.blockerName}`,
          `self=${blockDebugName(source)}`,
        ].join(' ');
        setDiagnosticTitle(source, source.dataset.fitDebug);
      }
    }
  }

  function refreshLayoutPageScales(pageWraps = null) {
    const wraps = pageWraps || [...document.querySelectorAll('.layout-page-wrap')];
    for (const wrap of wraps) {
      const page = wrap?.querySelector?.('.layout-page');
      page?._litmtransRefreshLayoutScale?.(false);
    }
  }

  // This is the only text-fitting rule set used by the host reader. The
  // surrounding scaling and scheduling code adapts it to the host.
  function runLayoutParityEngine(pageWraps = null, persist = false) {
    activeFitPages = pageWraps ? new Set(pageWraps) : null;
    try {
      const debugMode = document.body.classList.contains('layout-debug');
      const strictSourceFit = document.body.classList.contains('layout-source-strict-fit');
      // Both parsed-source and translated reading views should start compact,
      // then fill until actual glyphs collide. The explicit strict-source view
      // remains an opt-in no-overflow inspection mode.
      const collisionFirstTextFit = !strictSourceFit;
      clearAllCollisionDebugLayers();

      // Apply the page scale before measuring glyphs. Geometry helpers convert
      // the result back to source coordinates, so view scaling does not alter
      // fixed tolerances.
      refreshLayoutPageScales(pageWraps);
      resetBodyIterationInspection(scopedNodes(
        '.layout-flow-stream[data-style-kind="body_text"][data-flow-kind="text"]:not([data-body-inherited="1"])'
      ));
      demoteFalseSingleLineText();
      const titleFitOptions = {
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
        enforceInitialCollisionBackoff: true,
        showLimiter: debugMode
      };
      // Article titles retain their own scale.  Every other heading shares one
      // document-wide font/line-height pair, limited by the first heading that
      // reaches another block.  Group peers remain barriers so adjacent
      // section/subsection headings cannot overlap each other.
      tuneEach('.layout-block.type-title.main-title', titleFitOptions);
      tuneGroup('.layout-block.type-title:not(.main-title)', {
        ...titleFitOptions,
        includeGroupPeers: true
      });
      expandUnderfilledTitles('.layout-block.type-title:not(.main-title)', {
        ...titleFitOptions,
        maxFont: 42.0,
        titleFillAreaThreshold: 0.42,
        titleFillDimensionThreshold: 0.72
      });
      clusterTitleFontSizes('.layout-block.type-title', 1.0);
      keepShortTitlesOnOneLine('.layout-block.type-title:not(.main-title)', {
        maxCharacters: 12,
        maxBorrowPx: 18,
        maxWidthRatio: 1.35,
      });
      tuneGroup('.layout-flow-stream[data-style-kind="body_text"][data-flow-kind="text"]:not([data-body-inherited="1"])', {
        step: 0.5,
        minFont: collisionFirstTextFit ? 4.8 : undefined,
        minLineRatio: collisionFirstTextFit ? 1.12 : undefined,
        maxFont: 13,
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
        skipLineExpansionAfterFontCollision: true,
        showLimiter: debugMode
      });
      syncInheritedBodyFontToBodyGroup();
      tuneGroup('.layout-flow-stream[data-from-list="1"][data-flow-kind="text"]', {
        step: 0.35,
        minFont: collisionFirstTextFit ? 4.8 : undefined,
        minLineRatio: collisionFirstTextFit ? 0.98 : undefined,
        maxFont: 13,
        lineStep: 0.035,
        maxLineRatio: 1.85,
        allowOverflow: !strictSourceFit,
        avoidBlockOverlap: true,
        avoidPageOverflow: collisionFirstTextFit,
        includeGroupPeers: collisionFirstTextFit,
        ignoreTopOverflow: collisionFirstTextFit,
        startFromMinimum: collisionFirstTextFit,
        stopWhenFilled: !collisionFirstTextFit,
        showLimiter: debugMode
      });
      // A recognized contents stream owns its row grid, indentation and page
      // column.  Treating it as generic multi-line prose lets the fitter
      // change its fixed 8.2px/1.22 baseline and can clip a dense directory.
      tuneEach('.layout-flow-stream.debug-text[data-flow-kind="text"][data-original-lines="multi"]', {
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
        stopWhenFilled: !collisionFirstTextFit,
        showLimiter: debugMode
      });
      tuneEach('.layout-block.type-text[data-original-lines="multi"]', {
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
        stopWhenFilled: !collisionFirstTextFit,
        showLimiter: debugMode
      });
      const tuneCaptionGroup = (selector) => tuneGroup(selector, {
        step: 0.25,
        minFont: 5.2,
        maxFont: 10.5,
        lineStep: 0.025,
        minLineRatio: 1.0,
        maxLineRatio: 1.55,
        allowOverflow: false,
        avoidBlockOverlap: true,
        markAll: true,
        labelPrefix: 'CAP',
        showLimiter: debugMode
      });
      tuneCaptionGroup('.layout-block.type-table_caption');
      tuneCaptionGroup('.layout-block.type-table_footnote');
      tuneCaptionGroup('.layout-block.type-chart_caption');
      tuneCaptionGroup('.layout-block.type-image_caption');
      tuneCaptionGroup('.layout-block.type-image_footnote');
      tuneGroup('.layout-flow-stream[data-flow-kind="ref_text"]', {
        step: 0.25,
        minFont: 4.8,
        maxFont: 12,
        lineStep: 0.025,
        minLineRatio: 0.98,
        maxLineRatio: 1.65,
        allowOverflow: false,
        avoidBlockOverlap: true,
        showLimiter: debugMode
      });
      clampTranslatedOverflow();
      clampTranslatedCodeOverflow();
      enforceFinalTextCollisionSafety();
      publishBodyIterationInspection(scopedNodes(
        '.layout-flow-stream[data-style-kind="body_text"][data-flow-kind="text"]:not([data-body-inherited="1"])'
      ));
      if (persist) saveFitCache();
      // A document may save a manual body-font override. Re-fitting must
      // retain it, with line height scaled alongside the font.
      const userBodyFontPt = parseFloat(document.body.dataset.userBodyFontPt || '');
      if (Number.isFinite(userBodyFontPt)) {
        for (const node of document.querySelectorAll(
          '.layout-flow-stream[data-style-kind="body_text"][data-flow-kind="text"]'
        )) {
          node.style.fontSize = `${userBodyFontPt}pt`;
          node.dataset.userBodyFontPt = userBodyFontPt.toFixed(2);
        }
      }
    } catch (error) {
      if (!document.body.classList.contains('layout-debug')) return;
      for (const node of document.querySelectorAll('.layout-flow-stream')) {
        node.classList.add('fit-limiter');
        node.dataset.fitLabel = 'ERROR';
        node.dataset.fitDebug = String(error && error.message ? error.message : error);
        setDiagnosticTitle(node, node.dataset.fitDebug);
      }
    } finally {
      activeFitPages = null;
    }

  }

  return {
    fitLayoutPages,
    fitLayoutFormulas,
    runLayoutParityEngine,
    demoteFalseSingleLineText,
    clampTranslatedOverflow,
    clampTranslatedCodeOverflow,
    refreshLayoutPageScales,
    layoutPageCoordinateScale,
    restoreFitCache,
    saveFitCache,
    // Pure helpers exposed for unit tests; not a stable API.
    _internal: {
      gallopingGrow,
      rectsOverlap,
      rectUnion,
      horizontalBoxesOverlap,
      layoutRectsOverlap,
      layoutRectUnion,
      medianValueLocal,
      fitCacheVersion
    }
  };
  }

  return { createFitter };
});

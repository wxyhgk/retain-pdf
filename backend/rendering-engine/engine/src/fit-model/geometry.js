// retain-pdf-rendering/fit-model/geometry.js
// Host-agnostic: never reference the host application or plugin globals here.
//
// Per-node geometry in source-page units: line rects, glyph rects, content
// heights, formula and code boxes, the strict-collision barrier of a node,
// and the per-fitter caches that make repeated lookups cheap.
(function (root, factory) {
  "use strict";
  const NAME = "geometry";
  const DEPENDENCIES = [["constants", "./constants"], ["rects", "./rects"], ["document", "./document"]];
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
})(typeof this === "object" && this ? this : globalThis, function (root, constants, rects, document) {
  "use strict";
  const { STREAM_PADDING_LEFT, STREAM_PADDING_RIGHT, CODE_PADDING_X, CODE_PADDING_Y } = constants;
  const { rectUnion } = rects;
  const { isStream, hasClassDebugText, layoutControlFontSize, effectiveLineRatio, nodeBox, fontRole, measurerForNode, textAlign } = document;

  function createGeometry(ctx, lineModel) {
    const measurer = ctx.measurer;
    const { layoutText, paragraphRhythm } = lineModel;
    const measurerFor = node => measurerForNode(ctx, node);

    // ----- geometry -----

    const geometryCache = new Map();

    function geometryKey(node) {
      return [
        layoutControlFontSize(node),
        effectiveLineRatio(node),
        node.style.width ?? "",
        node.style.nowrap ? 1 : 0,
        node.originalLines || "",
        node.formula ? `${node.formula.scale}|${node.formula.numberRight}` : "",
        // retain profile only: first-line ink floor (passes/retain-body.js).
        node.retainInkFloor ?? "",
        node.retainLift ?? "",
        // balanced line breaking accepted by passes/justify.js.
        node.balanceLines ? 1 : ""
      ].join("|");
    }

    // Tuning alternates a node between a few candidate styles (probe, then
    // back to the accepted one for collision checks), so keep the geometry of
    // several styles per node instead of only the latest.
    const GEOMETRY_ENTRIES_PER_NODE = 16;

    function geometry(node) {
      // Fast path: the same style as the previous lookup for this node, which
      // collision scans hit millions of times, without building the string key.
      const last = node._geometryLast;
      const fontSize = layoutControlFontSize(node);
      const lineRatio = effectiveLineRatio(node);
      if (last && last.fontSize === fontSize && last.lineRatio === lineRatio &&
          last.width === node.style.width && last.nowrap === Boolean(node.style.nowrap) &&
          last.originalLines === node.originalLines &&
          last.formulaScale === node.formula?.scale && last.numberRight === node.formula?.numberRight &&
          last.inkFloor === node.retainInkFloor && last.lift === node.retainLift && last.balance === Boolean(node.balanceLines)) {
        return last.value;
      }
      const value = cachedGeometry(node);
      node._geometryLast = {
        fontSize, lineRatio, width: node.style.width, nowrap: Boolean(node.style.nowrap),
        originalLines: node.originalLines, formulaScale: node.formula?.scale, numberRight: node.formula?.numberRight,
        inkFloor: node.retainInkFloor, lift: node.retainLift, balance: Boolean(node.balanceLines), value
      };
      return value;
    }

    function cachedGeometry(node) {
      let entries = geometryCache.get(node);
      if (!entries) geometryCache.set(node, entries = new Map());
      const key = geometryKey(node);
      const cached = entries.get(key);
      if (cached) {
        entries.delete(key);
        entries.set(key, cached);
        return cached;
      }
      const value = computeGeometry(node);
      entries.set(key, value);
      if (entries.size > GEOMETRY_ENTRIES_PER_NODE) entries.delete(entries.keys().next().value);
      return value;
    }

    function pushLineRects(rects, lines, originX, originY, paragraph) {
      for (const line of lines) {
        const record = {
          paragraph,
          start: line.start,
          end: line.end,
          x: originX + line.x,
          top: originY + line.top,
          baseline: originY + line.baseline,
          width: line.width,
          glyphTop: originY + line.glyphTop,
          glyphBottom: originY + line.glyphBottom,
          justified: Boolean(line.justified),
          // For outputs that place every glyph themselves (measurer.placeLine).
          forced: Boolean(line.forced),
          lead: Boolean(line.lead)
        };
        rects.lines.push(record);
        // Line models with a fit band (retain): the overflow test measures the
        // band, collisions keep the ink rects below.
        if (Number.isFinite(line.fitTop) && (line.end > line.start || line.width > .5)) {
          (rects.band || (rects.band = [])).push({ left: record.x, right: record.x + line.width, top: originY + line.fitTop, bottom: originY + line.fitBottom });
        }
        if (line.width <= .5 || record.glyphBottom - record.glyphTop <= .5) continue;
        if (line.end > line.start || line.width > .5) {
          rects.text.push({ left: record.x, right: record.x + line.width, top: record.glyphTop, bottom: record.glyphBottom });
        }
      }
    }

    function naturalWidth(prepared, fontSize, ratio, role = null, using = measurer, text = "") {
      const result = layoutText(using, prepared, { fontSize, lineHeight: ratio, nowrap: true, text }, role);
      const line = result.lines[0];
      return {
        width: result.maxLineWidth,
        height: line ? line.glyphBottom - line.glyphTop : 0,
        lines: result.lines
      };
    }

    function computeGeometry(node) {
      const measurer = measurerFor(node);
      const box = nodeBox(node);
      const fontSize = layoutControlFontSize(node);
      const ratio = effectiveLineRatio(node);
      const out = { box, lines: [], text: [], visual: [], contentHeight: 0, scrollWidth: box.right - box.left };
      const clientHeight = box.bottom - box.top;
      const content = node.content || {};
      if (isStream(node)) {
        const contentLeft = box.left + STREAM_PADDING_LEFT;
        const contentRight = box.right - STREAM_PADDING_RIGHT;
        const width = Math.max(0, contentRight - contentLeft);
        let y = 0;
        if (node.toc) {
          const L = fontSize * ratio;
          (content.tocRows || []).forEach((row, index) => {
            if (row.gap) { y += .40 * fontSize; return; }
            const indent = row.unparsed ? 0 : row.level * .82 * fontSize;
            const label = naturalWidth(row.label, fontSize, ratio, null, measurer, row.labelText);
            const lineTop = box.top + y;
            const glyph = label.lines[0];
            const glyphTop = lineTop + (glyph ? glyph.glyphTop : 0);
            const glyphBottom = lineTop + (glyph ? glyph.glyphBottom : L);
            let pageWidth = 0;
            if (row.page) {
              pageWidth = naturalWidth(row.page, fontSize, ratio, null, measurer).width;
              out.text.push({ left: contentRight - pageWidth, right: contentRight, top: glyphTop, bottom: glyphBottom });
            }
            // .toc-label is clipped (overflow: hidden) to its grid track.
            const labelMax = row.unparsed ? width : Math.max(0, width - indent - pageWidth - 12 - .74 * fontSize);
            const labelWidth = Math.min(label.width, labelMax);
            if (labelWidth > .5) out.text.push({ left: contentLeft + indent, right: contentLeft + indent + labelWidth, top: glyphTop, bottom: glyphBottom });
            out.lines.push({ paragraph: index, toc: true, x: contentLeft + indent, top: lineTop, baseline: lineTop + (glyph ? glyph.baseline : L), width: labelWidth, pageWidth, glyphTop, glyphBottom });
            y += L;
          });
        }
        else {
          const paragraphs = content.paragraphs || [];
          const singleNowrap = hasClassDebugText(node) && node.originalLines === "single";
          const align = singleNowrap ? "left" : textAlign(node);
          const rhythm = paragraphRhythm(fontSize, ratio, node.paragraphGap);
          y = rhythm.top;
          if (lineModel.contentInsets) {
            const insets = lineModel.contentInsets(fontSize, clientHeight, paragraphs, node);
            y += insets.top;
            out.bandBottomInset = insets.bottom;
          }
          paragraphs.forEach((paragraph, index) => {
            const result = layoutText(measurer, paragraph.prepared, {
              fontSize,
              lineHeight: ratio,
              width,
              align,
              nowrap: singleNowrap || node.style.nowrap,
              firstLineIndent: node.refs || singleNowrap ? 0 : Math.max(0, paragraph.indent || 0),
              hangingIndent: node.refs ? 1.1 * fontSize : 0,
              text: paragraph.text,
              ...(node.balanceLines && ctx.balance ? { balance: ctx.balance } : {})
            });
            let originX = contentLeft;
            if (singleNowrap && node.singleLineAlign === "center") {
              originX = contentLeft + width / 2 - result.maxLineWidth / 2;
            }
            pushLineRects(out, result.lines, originX, box.top + y, index);
            out.scrollWidth = Math.max(out.scrollWidth, originX + result.maxLineWidth + STREAM_PADDING_RIGHT - box.left);
            y += result.height;
            if (index < paragraphs.length - 1) y += rhythm.between;
          });
          y += rhythm.top;
        }
        out.contentHeight = y;
      }
      else if (content.formula) {
        const scale = node.formula ? node.formula.scale : 1;
        const natural = naturalWidth(content.formula, fontSize, ratio, node.content.formulaIsText ? "math" : null, measurer, content.formulaText);
        const hasNumber = Boolean(content.number);
        const cy = (box.top + box.bottom) / 2;
        const formulaHeight = natural.height || fontSize;
        let left;
        if (hasNumber) left = box.left; // .has-number: justify-content flex-start, origin left
        else left = (box.left + box.right) / 2 - natural.width * scale / 2;
        const formulaRect = {
          left,
          right: left + natural.width * scale,
          top: cy - formulaHeight * scale / 2,
          bottom: cy + formulaHeight * scale / 2
        };
        out.formulaNatural = { width: natural.width, height: formulaHeight };
        out.formulaRect = formulaRect;
        if (natural.width > .5) out.text.push(formulaRect);
        if (hasNumber) {
          const number = naturalWidth(content.number, fontSize, ratio, "math", measurer, content.numberText);
          const anchor = node.formula && Number.isFinite(node.formula.numberRight)
            ? node.formula.numberRight
            : box.right - box.left; // var(--equation-number-right, 100%)
          const right = box.left + anchor;
          const numberRect = { left: right - number.width, right, top: cy - number.height / 2, bottom: cy + number.height / 2 };
          out.numberRect = numberRect;
          out.text.push(numberRect);
        }
        out.contentHeight = clientHeight;
      }
      else if (typeof content.code === "string") {
        // Monospace stand-in: 0.6 em per character, 1 em for wide characters;
        // pre-wrap breaks anywhere once a line is full.
        const L = fontSize * ratio;
        const innerLeft = box.left + CODE_PADDING_X;
        const innerWidth = Math.max(1, box.right - box.left - 2 * CODE_PADDING_X);
        const codeArea = lineModel.codeArea(measurer, fontSize);
        const halfLeading = (L - codeArea) / 2;
        let y = CODE_PADDING_Y;
        for (const sourceLine of content.code.split("\n")) {
          let lineWidth = 0;
          const flush = () => {
            if (lineWidth > .5) out.text.push({ left: innerLeft, right: innerLeft + lineWidth, top: box.top + y + halfLeading, bottom: box.top + y + halfLeading + codeArea });
            y += L;
            lineWidth = 0;
          };
          for (const character of [...sourceLine]) {
            const advance = (/[ᄀ-ᅟ⺀-꓏가-힣豈-﫿︰-﹏＀-｠￠-￦]/.test(character) ? 1 : .6) * fontSize;
            if (lineWidth + advance > innerWidth + 1e-6 && lineWidth > 0) flush();
            lineWidth += advance;
          }
          flush();
        }
        out.codeScrollHeight = y + CODE_PADDING_Y;
        out.codeClientHeight = clientHeight;
        out.contentHeight = clientHeight;
      }
      else if (content.opaque) {
        out.visual.push({ left: box.left, top: box.top, right: box.right, bottom: box.bottom });
        out.contentHeight = clientHeight;
      }
      else {
        const paragraphs = content.paragraphs || [];
        const width = Math.max(0, box.right - box.left);
        const align = textAlign(node);
        const rhythm = paragraphRhythm(fontSize, ratio, 0);
        let y = rhythm.top;
        if (lineModel.contentInsets) {
          const insets = lineModel.contentInsets(fontSize, clientHeight, paragraphs, node);
          y += insets.top;
          out.bandBottomInset = insets.bottom;
        }
        paragraphs.forEach((paragraph, index) => {
          const result = layoutText(measurer, paragraph.prepared, {
            fontSize,
            lineHeight: ratio,
            width,
            align: node.style.nowrap ? "left" : align,
            nowrap: node.style.nowrap,
            text: paragraph.text,
            ...(node.balanceLines && ctx.balance ? { balance: ctx.balance } : {})
          }, fontRole(node));
          pushLineRects(out, result.lines, box.left, box.top + y, index);
          out.scrollWidth = Math.max(out.scrollWidth, result.maxLineWidth);
          y += result.height;
          if (index < paragraphs.length - 1) y += rhythm.between;
        });
        out.contentHeight = y + rhythm.top;
      }
      out.clientHeight = clientHeight;
      out.scrollHeight = Math.max(clientHeight, out.contentHeight);
      return out;
    }

    // Strict-mode barrier of one node. It depends only on the node's current
    // geometry (box and ink), so it is cached on that geometry object.
    const strictBarriers = new WeakMap();
    function strictBarrier(element, box) {
      const value = geometry(element);
      const cached = strictBarriers.get(value);
      if (cached && cached.box.left === box.left && cached.box.top === box.top &&
          cached.box.right === box.right && cached.box.bottom === box.bottom) {
        return cached;
      }
      const ink = renderedContentRectsInPage(element);
      // Ink a node keeps inside its own box is its own; ink that
      // spills out is that node's collision to resolve when it is
      // the source (and in the final audit), not a barrier here.
      const owned = ink.filter(rect => rect.left >= box.left - 1e-6 && rect.right <= box.right + 1e-6 &&
        rect.top >= box.top - 1e-6 && rect.bottom <= box.bottom + 1e-6);
      const withBox = owned.concat([box]);
      // allInk (spilled ink included) is only used by the final audit: two
      // spills meeting in the gap between boxes are invisible to the owned-ink
      // rule from both sides.
      // Text nodes contribute their glyphs only (source boxes often overlap by
      // a fraction of a point); a node without text already returns its box.
      const allInk = ink;
      const barrier = {
        element, box, ink: owned, inkBounds: rectUnion(owned), withBox, withBoxBounds: rectUnion(withBox),
        allInk, allInkBounds: rectUnion(allInk)
      };
      strictBarriers.set(value, barrier);
      return barrier;
    }

    function textRectsInPage(node) {
      return geometry(node).text;
    }

    // 正文专用的内容几何：文字取每个可见行的 Range rect；公式取 MathJax
    // 完成排版后的容器；图片和表格取实际元素的渲染矩形。没有可测内容时回退到块框。
    function renderedContentRectsInPage(node) {
      const value = geometry(node);
      const rects = value.text.concat(value.visual);
      return rects.length ? rects : [elementBoxInPage(node)];
    }

    function elementBoxInPage(node) {
      return nodeBox(node);
    }

    function measureTextBand(node) {
      const value = geometry(node);
      const top = value.box.top;
      let firstTop = null;
      let lastBottom = 0;
      let hasText = false;
      if (value.band) {
        for (const rect of value.band) {
          const rectTop = rect.top - top;
          const bottom = rect.bottom - top + (value.bandBottomInset || 0);
          if (firstTop === null || rectTop < firstTop) firstTop = rectTop;
          if (bottom > lastBottom) lastBottom = bottom;
          hasText = true;
        }
        return { hasText, firstTop: firstTop ?? 0, lastBottom };
      }
      for (const rect of value.text) {
        const rectTop = rect.top - top;
        const bottom = rect.bottom - top;
        if (firstTop === null || rectTop < firstTop) firstTop = rectTop;
        if (bottom > lastBottom) lastBottom = bottom;
        hasText = true;
      }
      return { hasText, firstTop: firstTop ?? 0, lastBottom };
    }

    function blockDebugName(node) {
      if (!node) return "unknown";
      const box = elementBoxInPage(node);
      return [
        node.styleKind || node.flowKind || node.type || "block",
        node.id ? `#${node.id}` : "",
        `@${Math.round(box.left)},${Math.round(box.top)},${Math.round(box.right - box.left)}x${Math.round(box.bottom - box.top)}`
      ].filter(Boolean).join(" ");
    }

    return {
      geometry, naturalWidth, computeGeometry, strictBarrier, textRectsInPage, renderedContentRectsInPage,
      elementBoxInPage, measureTextBand, blockDebugName
    };
  }

  return { createGeometry };
});

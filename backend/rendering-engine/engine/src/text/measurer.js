// retain-pdf-rendering/text/measurer
// Host-agnostic: never reference the host application or plugin globals here.
//
// Text measurement without a browser or Typst: paragraph layout from font
// metrics (text/metrics.js) and a Typst-compatible greedy line breaker
// (text/linebreak.js). Exposed as RetainPdfRendering.Text.
//
//   const measurer = Text.createMeasurer({ metrics });  // metrics: Text.createMetrics(table) or the table itself
//   const prepared = measurer.prepare(content);           // once per paragraph
//   measurer.layout(prepared, { fontSize, lineHeight, width, ... });
//   measurer.fitFontSize(prepared, { width, maxHeight, lineHeight, minFont, maxFont, step });
//
// content: array of runs
//   { type: "text", text }
//   { type: "math", tex, display, widthEm, heightEm, depthEm }  atomic inline box, em of the run font
//   { type: "break" }                                           forced line break
//
// Units: fontSize, widths, indents and every returned length are in the
// layout model's units (CSS px of the source page == Typst pt).
//
// Vertical model (what the Typst output emits): a text line extends
// `ascender` above and `descender` below its baseline (top-edge "ascender",
// bottom-edge "descender": 1 em for Source Han Serif), an inline formula box
// can make a line taller, and consecutive lines are separated by Typst's
// `par(leading)`. A CSS-style line-height ratio maps to
//     leading = max(0, (lineHeight - 1) * fontSize)
// so a paragraph of n plain lines is n * fontSize + (n - 1) * leading tall —
// one leading shorter than CSS, which also puts half a leading above the
// first and below the last line. `height` is the Typst block height.
(function (root, factory) {
  "use strict";
  const isNode = typeof module === "object" && module && module.exports;
  const namespace = isNode ? null : (root.RetainPdfRendering || {});
  const metrics = isNode ? require("./metrics") : namespace.TextMetrics;
  const linebreak = isNode ? require("./linebreak") : namespace.TextLinebreak;
  const api = factory(metrics, linebreak);
  if (isNode) module.exports = api;
  else {
    const target = root.RetainPdfRendering = root.RetainPdfRendering || {};
    target.Text = api;
  }
})(typeof this === "object" && this ? this : globalThis, function (Metrics, Linebreak) {
  "use strict";

  if (!Metrics || !Linebreak) {
    throw new Error("retain-pdf-rendering/text/measurer: load text/uax14-data.js, text/metrics.js and text/linebreak.js first");
  }

  const { LINE_SEPARATOR, isSpace } = Linebreak;
  const FIT_EPSILON = 1e-6;
  // Steps fitFontSize walks from the estimated size before bisecting.
  const MAX_ESTIMATE_WALK = 3;

  // A formula the host could not render is set as its raw LaTeX in one
  // unbreakable box (the reference Typst emitter uses DejaVu Sans Mono at
  // 0.8 em: 0.602 em advance, ascender 0.928, descender 0.236).
  function fallbackMathBox(tex) {
    const characters = [...String(tex || "")].length;
    return { widthEm: 0.602 * 0.8 * characters, heightEm: 0.8 * (0.928 + 0.236), depthEm: 0.8 * 0.236, fallback: true };
  }

  function toSegments(content) {
    const segments = [];
    for (const run of Array.isArray(content) ? content : []) {
      if (!run || typeof run !== "object") continue;
      if (run.type === "break") segments.push({ type: "text", value: LINE_SEPARATOR });
      else if (run.type === "math") {
        const box = [run.widthEm, run.heightEm, run.depthEm].every(Number.isFinite) ? run : { ...run, ...fallbackMathBox(run.tex) };
        segments.push({ type: "math", run, widthEm: Number(box.widthEm), heightEm: Number(box.heightEm), depthEm: Number(box.depthEm) });
      }
      else {
        const text = String(run.text ?? "").replace(/\r\n?|\n/g, LINE_SEPARATOR);
        if (text) segments.push({ type: "text", value: text });
      }
    }
    return segments;
  }

  function stepLadder(minFont, maxFont, step) {
    const values = [];
    const count = Math.floor((maxFont - minFont) / step + 1e-9);
    for (let k = 0; k <= count; k++) values.push(Math.round((minFont + k * step) * 1e6) / 1e6);
    return values;
  }

  function createMeasurer(options = {}) {
    const fontMetrics = options.metrics instanceof Metrics.FontMetrics
      ? options.metrics
      : Metrics.createMetrics(options.metrics);

    function prepare(content) {
      const prepared = Linebreak.prepare(toSegments(content), fontMetrics);
      prepared.content = content;
      return prepared;
    }

    function resolveIndents(layoutOptions, fontSize) {
      const first = Number(layoutOptions.firstLineIndent) || 0;
      const hang = Number(layoutOptions.hangingIndent) || 0;
      return {
        indent: first + (Number(layoutOptions.firstLineIndentEm) || 0) * fontSize,
        hang: hang + (Number(layoutOptions.hangingIndentEm) || 0) * fontSize
      };
    }

    function layout(prepared, layoutOptions = {}) {
      const fontSize = Number(layoutOptions.fontSize);
      const width = Number(layoutOptions.width);
      if (!(fontSize > 0) || !Number.isFinite(width)) throw new RangeError("layout needs a positive fontSize and a finite width");
      const lineHeight = Number.isFinite(Number(layoutOptions.lineHeight)) ? Number(layoutOptions.lineHeight) : 1;
      const align = layoutOptions.align || "justify";
      const { indent, hang } = resolveIndents(layoutOptions, fontSize);
      // Breaking: greedy first-fit (Typst "simple", the default here),
      // linebreaks: "optimized" (Typst's default Knuth–Plass, which may shrink
      // a justified line's spaces), or opt-in balanced greedy (see Linebreak.layout).
      const breakOptions = { indent, hang };
      if (layoutOptions.linebreaks === "optimized") Object.assign(breakOptions, { optimized: true, justify: align === "justify" });
      else if (layoutOptions.balance) breakOptions.balance = layoutOptions.balance;
      const core = Linebreak.layout(prepared, fontSize, width, breakOptions);
      const leading = Math.max(0, (lineHeight - 1) * fontSize);
      const lines = [];
      let y = 0;
      let maxLineWidth = 0;
      core.lines.forEach((line, index) => {
        const first = index === 0;
        const last = index === core.lines.length - 1;
        const offset = first ? indent : hang;
        const contentWidth = Math.max(0, line.width - (first ? indent : 0));
        const available = Math.max(0, (first ? width : width - hang) - (first ? indent : 0));
        const forced = line.mandatory && line.end < prepared.n;
        const justified = align === "justify" && !last && !forced;
        let x = offset;
        if (align === "center") x = offset + (available - contentWidth) / 2;
        else if (align === "right") x = offset + available - contentWidth;
        const top = y;
        const baseline = top + line.top;
        lines.push({
          start: line.start,
          end: line.end,
          width: contentWidth,
          x,
          top,
          baseline,
          ascent: line.top,
          descent: line.bottom,
          glyphTop: top,
          glyphBottom: baseline + line.bottom,
          justified,
          // Optional extras: room on this line, and whether it ends in a
          // forced break (content "break" run or paragraph end). A line wider
          // than its room (optimized breaking only) is drawn shrunk to it.
          available,
          shrunk: contentWidth > available + 1e-4,
          // Narrowest the line can be drawn: squeezing stops at its
          // shrinkability, so a line of unbreakable formulas stays too wide.
          minWidth: Math.max(0, contentWidth - (Number(line.shrinkable) || 0)),
          forced: line.mandatory
        });
        maxLineWidth = Math.max(maxLineWidth, x + (justified ? available : contentWidth));
        y = baseline + line.bottom + (last ? 0 : leading);
      });
      return { lines, height: y, maxLineWidth, leading };
    }

    // Largest size on the ladder minFont, minFont + step, ... <= maxFont whose
    // layout fits maxHeight (and maxWidth when given, e.g. for single-line
    // nodes measured unwrapped). Binary search assumes the height grows with
    // the font size; greedy breaking can violate that locally, so the step
    // above the result is verified and, if it also fits, the search walks up
    // until a size fails.
    function fitFontSize(prepared, fitOptions = {}) {
      const minFont = Number(fitOptions.minFont);
      const maxFont = Number(fitOptions.maxFont);
      const step = Number(fitOptions.step) > 0 ? Number(fitOptions.step) : 0.1;
      if (!(minFont > 0) || !(maxFont >= minFont)) throw new RangeError("fitFontSize needs 0 < minFont <= maxFont");
      const maxHeight = Number(fitOptions.maxHeight);
      const maxWidth = Number.isFinite(Number(fitOptions.maxWidth)) ? Number(fitOptions.maxWidth) : Infinity;
      const ladder = stepLadder(minFont, maxFont, step);
      let probes = 0;
      const cache = new Map();
      const attempt = index => {
        if (cache.has(index)) return cache.get(index);
        probes += 1;
        const result = layout(prepared, { ...fitOptions, fontSize: ladder[index] });
        const ok = result.height <= maxHeight + FIT_EPSILON && result.maxLineWidth <= maxWidth + FIT_EPSILON;
        const entry = { ok, result };
        cache.set(index, entry);
        return entry;
      };
      // Start next to the size the square-root estimate predicts and walk a
      // few steps; a poor estimate falls back to bisecting the interval the
      // walk has bracketed, so the answer matches a plain binary search.
      const last = ladder.length - 1;
      const guess = estimateFitIndex(prepared, fitOptions, ladder, step);
      let low = -1;
      let high = ladder.length;
      if (attempt(guess).ok) {
        low = guess;
        for (let walk = 0; walk < MAX_ESTIMATE_WALK && low < last; walk++) {
          if (attempt(low + 1).ok) low += 1;
          else { high = low + 1; break; }
        }
      }
      else {
        high = guess;
        for (let walk = 0; walk < MAX_ESTIMATE_WALK && high > 0; walk++) {
          if (attempt(high - 1).ok) { low = high - 1; break; }
          high -= 1;
        }
      }
      if (low < 0) {
        if (!attempt(0).ok) return { fontSize: ladder[0], layout: attempt(0).result, fits: false, probes };
        low = 0;
      }
      if (high > last && attempt(last).ok) low = last;
      while (high - low > 1) {
        const middle = (low + high) >> 1;
        if (attempt(middle).ok) low = middle;
        else high = middle;
      }
      while (low + 1 < ladder.length && attempt(low + 1).ok) low += 1;
      return { fontSize: ladder[low], layout: attempt(low).result, fits: true, probes };
    }

    // Height grows roughly with the square of the font size: a paragraph
    // needs about fontSize * widthEm / width lines plus a part-filled last
    // line, and each line is fontSize * lineHeight tall. Solving that
    // quadratic for maxHeight gives the starting size; maxWidth caps it for
    // unwrapped single-line nodes.
    function estimateFitIndex(prepared, fitOptions, ladder, step) {
      const stats = paragraphStats(prepared);
      const width = Number(fitOptions.width);
      const maxHeight = Number(fitOptions.maxHeight);
      const lineHeight = Math.max(1, Number.isFinite(Number(fitOptions.lineHeight)) ? Number(fitOptions.lineHeight) : 1);
      let estimate = ladder[ladder.length - 1];
      if (stats.totalEm > 0 && width > 0 && maxHeight > 0) {
        const a = stats.totalEm / width * lineHeight;
        const b = (0.5 * stats.paragraphs - 1) * lineHeight + 1;
        estimate = (-b + Math.sqrt(b * b + 4 * a * maxHeight)) / (2 * a);
      }
      const maxWidth = Number(fitOptions.maxWidth);
      if (Number.isFinite(maxWidth) && stats.widestEm > 0) estimate = Math.min(estimate, maxWidth / stats.widestEm);
      if (!Number.isFinite(estimate)) return ladder.length - 1;
      const index = Math.floor((estimate - ladder[0]) / step + 1e-9);
      return Math.max(0, Math.min(ladder.length - 1, index));
    }

    // Natural paragraph widths in em (one unwrapped line per paragraph),
    // cached on the prepared content.
    function paragraphStats(prepared) {
      if (prepared.paragraphStats) return prepared.paragraphStats;
      const unwrapped = Linebreak.layout(prepared, 1, Infinity, { indent: 0, hang: 0 });
      let totalEm = 0;
      let widestEm = 0;
      for (const line of unwrapped.lines) {
        totalEm += line.width;
        widestEm = Math.max(widestEm, line.width);
      }
      prepared.paragraphStats = { totalEm, widestEm, paragraphs: Math.max(1, unwrapped.lines.length) };
      return prepared.paragraphStats;
    }

    function naturalWidth(prepared, layoutOptions = {}) {
      const fontSize = Number(layoutOptions.fontSize);
      return Linebreak.naturalWidth(prepared, fontSize, resolveIndents(layoutOptions, fontSize));
    }

    // Text of units [start, end) with formula placeholders replaced by their
    // runs — what the output emitter draws for one line.
    function lineRuns(prepared, start, end) {
      const runs = [];
      let text = "";
      const flush = () => { if (text) runs.push({ type: "text", text }); text = ""; };
      for (let i = start; i < end; i++) {
        const c = prepared.text[i];
        if (c === LINE_SEPARATOR) continue;
        const box = prepared.boxes.get(i);
        if (box) { flush(); runs.push(box.run); }
        else text += c;
      }
      flush();
      return runs;
    }

    return { metrics: fontMetrics, prepare, layout, fitFontSize, naturalWidth, lineRuns };
  }

  // ----- TeX math delimiters -----
  //
  // A left-to-right scanner, modelled on retain-pdf's
  // render/layout/text_tokens.py (the tokenizer behind its translations):
  //   - `\(..\)` inline, `\[..\]` display, `$$..$$` display, `$..$` inline.
  //   - Inside math a backslash escapes the next character, so `$\$1.4$` is one
  //     formula and `\{`/`\}` never close anything.
  //   - Formulas are consumed in order, so adjacent formulas (`$a$$b$`) parse
  //     as two inline formulas, not as "a closing `$` followed by `$`".
  //   - Inline math may be padded (`$ \geq $`): the body is trimmed. An empty
  //     body, a newline before the closing `$`, or more than
  //     MAX_INLINE_MATH_CHARS characters leaves the opening `$` as text.
  //   - Outside math `\$` is a literal dollar sign.
  //   - Only when a text has an odd number of unescaped `$` (pairing is
  //     ambiguous) are currency-like dollars (`$5`, `US$12`) taken literally
  //     first; balanced texts are never second-guessed.
  // Corpus behind these rules: experiments/math-delims (31 retain-pdf jobs).
  const MAX_INLINE_MATH_CHARS = 1200;

  function isEscapedAt(text, index) {
    let count = 0;
    for (let cursor = index - 1; cursor >= 0 && text[cursor] === "\\"; cursor--) count += 1;
    return count % 2 === 1;
  }

  // Index just past the closing delimiter, or -1. Escapes are skipped.
  function findMathClose(text, from, close, { stopAtNewline = false, maxChars = Infinity } = {}) {
    for (let cursor = from; cursor < text.length; cursor++) {
      if (cursor - from > maxChars) return -1;
      const char = text[cursor];
      if (stopAtNewline && char === "\n") return -1;
      if (char === "\\" && !(close.startsWith("\\") && text.startsWith(close, cursor))) { cursor += 1; continue; }
      if (text.startsWith(close, cursor)) return cursor + close.length;
    }
    return -1;
  }

  // Dollars that read as currency: `$` + digit, preceded by start, whitespace,
  // an opening bracket or a currency prefix (US$, HK$, A$, C$).
  function currencyDollars(text) {
    const set = new Set();
    const pattern = /(?:^|(?<=[\s(\uff08,\uff0c:\uff1a;\uff1b]|US|HK|A|C|NZ|S))\$(?=\d)/g;
    for (const match of text.matchAll(pattern)) set.add(match.index);
    return set;
  }

  // text -> [{ type: "text", text } | { type: "math", tex, display, raw, start, end }]
  function scanMath(input) {
    const text = String(input ?? "");
    const segments = [];
    let plain = "";
    const flush = () => { if (plain) segments.push({ type: "text", text: plain }); plain = ""; };
    let unescaped = 0;
    for (let index = 0; index < text.length; index++) if (text[index] === "$" && !isEscapedAt(text, index)) unescaped += 1;
    const literalDollars = unescaped % 2 === 1 ? currencyDollars(text) : new Set();
    const pushMath = (start, end, open, close, display) => {
      const body = text.slice(start + open, end - close);
      if (!body.trim()) return false;
      flush();
      segments.push({ type: "math", tex: body.trim(), display, raw: text.slice(start, end), start, end });
      return true;
    };
    let index = 0;
    while (index < text.length) {
      const char = text[index];
      if (char === "\\" && (text[index + 1] === "(" || text[index + 1] === "[")) {
        const display = text[index + 1] === "[";
        const end = findMathClose(text, index + 2, display ? "\\]" : "\\)");
        if (end > 0 && pushMath(index, end, 2, 2, display)) { index = end; continue; }
      }
      if (char === "\\" && text[index + 1] === "$") { plain += "$"; index += 2; continue; }
      if (char === "\\") { plain += text.slice(index, index + 2); index += 2; continue; }
      if (char === "$" && !literalDollars.has(index)) {
        if (text[index + 1] === "$") {
          const end = findMathClose(text, index + 2, "$$");
          if (end > 0 && pushMath(index, end, 2, 2, true)) { index = end; continue; }
        }
        else {
          const end = findMathClose(text, index + 1, "$", { stopAtNewline: true, maxChars: MAX_INLINE_MATH_CHARS });
          if (end > 0 && pushMath(index, end, 1, 1, false)) { index = end; continue; }
        }
      }
      plain += char;
      index += 1;
    }
    flush();
    return segments;
  }

  // TeX the renderer does not know but whose intent is unambiguous.
  // (retain-pdf does the Angstrom part in
  // render/layout/inline_content/core/inline_math.py.)
  function normalizeTeX(tex) {
    return String(tex || "")
      .replace(/\\(AA)(?![A-Za-z])(?:\{\})?/g, "\u00c5")
      .replace(/\\(aa)(?![A-Za-z])(?:\{\})?/g, "\u00e5")
      .replace(/\\L(?![A-Za-z])(?:\{\})?/g, "\u0141")
      .replace(/\\l(?![A-Za-z])(?:\{\})?/g, "\u0142")
      // `x'_{i}'`: a second prime after a subscript is a double superscript
      // in TeX; give it an empty base like LaTeX users write by hand.
      .replace(/('+_(?:\{[^{}]*\}|[A-Za-z0-9]))'/g, "$1{}'");
  }

  // "text \(x\) more\nnext line" -> runs. renderMathBox(tex, display) returns
  // { widthEm, heightEm, depthEm }, or null / throws / a box flagged
  // `fallback` for a formula it cannot render. Such a formula becomes plain
  // text (its normalized TeX, no delimiters), measured and painted in the
  // body font like any other text; options.failedMath "box" restores the old
  // raw-LaTeX fallback box instead. Without a renderer every formula counts
  // as failed.
  function contentFromText(input, options = {}) {
    const renderMathBox = typeof options.renderMathBox === "function" ? options.renderMathBox : null;
    const failedAsBox = options.failedMath === "box";
    const runs = [];
    const pushText = value => {
      const parts = value.split(/\r\n?|\n|\u2028/);
      parts.forEach((part, index) => {
        if (index) runs.push({ type: "break" });
        if (part) runs.push({ type: "text", text: part });
      });
    };
    for (const segment of scanMath(input)) {
      if (segment.type === "text") { pushText(segment.text); continue; }
      const tex = normalizeTeX(segment.tex);
      const display = segment.display;
      let box = null;
      if (renderMathBox) {
        try { box = renderMathBox(tex, display); }
        catch (_) { box = null; }
      }
      const valid = box && !box.fallback && [box.widthEm, box.heightEm, box.depthEm].every(value => Number.isFinite(Number(value)));
      if (valid) runs.push({ type: "math", tex, display, widthEm: Number(box.widthEm), heightEm: Number(box.heightEm), depthEm: Number(box.depthEm) });
      else if (failedAsBox) runs.push({ type: "math", tex, display, ...fallbackMathBox(display ? `$$${tex}$$` : `$${tex}$`) });
      else pushText(tex.replace(/\s*[\r\n]+\s*/g, " "));
    }
    return runs;
  }

  return {
    createMeasurer,
    createMetrics: Metrics.createMetrics,
    contentFromText,
    scanMath,
    normalizeTeX,
    fallbackMathBox,
    isSpace,
    _internal: { Linebreak, Metrics, stepLadder }
  };
});

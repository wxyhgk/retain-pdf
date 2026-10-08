// retain-pdf-rendering/text/linebreak
// Host-agnostic: never reference the host application or plugin globals here.
//
// Pure-JS paragraph layout that reproduces Typst's `linebreaks: "simple"`
// (Typst 0.15.1, `set text(lang: "zh")`, top-edge "ascender", bottom-edge
// "descender") for the text the layout pipeline emits, so the fitter can
// measure without running Typst or a browser.
//
// Mirrored Typst behaviour (crates/typst-layout/src/inline):
//   shaping.rs  add_cjk_latin_spacing  — +1/4 em between a Han/kana glyph and
//                                        an adjacent Latin/Greek/Cyrillic
//                                        letter or digit
//               calculate_adjustability — consecutive CJK punctuation shares
//                                        half a glyph width (GB style, "zh")
//   line.rs     adjust_cj_at_line_boundaries — opening punctuation at a line
//                                        start / closing at a line end lose
//                                        their blank half; CJK–Latin spacing
//                                        at a line boundary is removed
//               trailing whitespace does not count toward the line width
//   linebreak.rs linebreak_simple       — greedy: keep the last attempt that fit
//               hanging indent           — lines after the first get
//                                        region - hang
// Break opportunities: UAX #14 (the algorithm of the `linebreak` package,
// MIT, (c) Devon Govett, ported below over the class table generated into
// uax14-data.js), adjusted to what Typst's ICU segmenter does (verified
// against Typst by experiments/measure/compare-typst.js):
//   - inline boxes (U+FFFC, class CB) allow a break on both sides (LB20);
//     they are analysed as an ideograph
//   - a Latin letter/digit may break before an East Asian opening bracket
//     (current LB30 only blocks non-East-Asian OP)
//   - double quotes “ ” behave like brackets (break before “, also after
//     Latin punctuation; break after ”), except that ” never breaks before
//     a non-East-Asian character such as a Latin word; single quotes ‘ ’
//     keep the strict quotation rule
//   - Typst's link special case: after "://" (or at "www.") the URL is
//     broken at letter/digit/other transitions and UAX #14 opportunities
//     inside it are dropped
//   - a first-line or hanging indent is a spacing item that Typst puts into
//     the paragraph text as a space: it adds a break opportunity right after
//     the indent, and the first line no longer "starts with" punctuation
//
// Everything that does not depend on the font size is computed once per
// paragraph (prepare); a layout at one size/width is a single greedy pass.
(function (root, factory) {
  "use strict";
  const isNode = typeof module === "object" && module && module.exports;
  const data = isNode ? require("./uax14-data") : (root.RetainPdfRendering || {}).Uax14Data;
  const api = factory(data);
  if (isNode) module.exports = api;
  else {
    const namespace = root.RetainPdfRendering = root.RetainPdfRendering || {};
    namespace.TextLinebreak = api;
  }
})(typeof this === "object" && this ? this : globalThis, function (UAX14) {
  "use strict";

  if (!UAX14 || !UAX14.ranges || !UAX14.pairs) {
    throw new Error("retain-pdf-rendering/text/linebreak: load text/uax14-data.js first");
  }

  // ---------------------------------------------------------------------
  // UAX #14 (port of the `linebreak` package's LineBreaker).

  const OP = 0, SP = 41, BK = 34, CR = 36, LF = 37, NL = 38, AL = 12, NS = 5;
  const WJ = 22, ZWJ = 31, HL = 13, HY = 16, BA = 17, RI = 28;
  const AI = 33, SA = 39, SG = 40, XX = 42, CJ = 35;
  const DI_BRK = 0, IN_BRK = 1, CI_BRK = 2, CP_BRK = 3;
  const RANGES = UAX14.ranges;
  const PAIRS = UAX14.pairs;

  function rawClass(cp) {
    // RANGES is [start0, class0, start1, class1, ...]; binary search on starts.
    let low = 0;
    let high = RANGES.length / 2 - 1;
    while (low < high) {
      const middle = (low + high + 1) >> 1;
      if (RANGES[middle * 2] <= cp) low = middle;
      else high = middle - 1;
    }
    return RANGES[low * 2 + 1];
  }

  function mapClass(c) {
    if (c === AI || c === SA || c === SG || c === XX) return AL;
    if (c === CJ) return NS;
    return c;
  }

  function mapFirst(c) {
    if (c === LF || c === NL) return BK;
    if (c === SP) return WJ;
    return c;
  }

  // Yields { position, required } like the package's LineBreaker.nextBreak().
  function uax14Breaks(string) {
    const out = [];
    let pos = 0;
    let lastPos = 0;
    let curClass = null;
    let nextClass = null;
    let lb8a = false;
    let lb21a = false;
    let lb30a = 0;
    const nextCharClass = () => {
      const code = string.charCodeAt(pos++);
      const next = string.charCodeAt(pos);
      let cp = code;
      if (code >= 0xd800 && code <= 0xdbff && next >= 0xdc00 && next <= 0xdfff) {
        pos++;
        cp = (code - 0xd800) * 0x400 + (next - 0xdc00) + 0x10000;
      }
      return mapClass(rawClass(cp));
    };
    const simpleBreak = () => {
      switch (nextClass) {
        case SP: return false;
        case BK: case LF: case NL: curClass = BK; return false;
        case CR: curClass = CR; return false;
        default: return null;
      }
    };
    const pairTableBreak = lastClass => {
      let shouldBreak = false;
      switch (PAIRS[curClass][nextClass]) {
        case DI_BRK: shouldBreak = true; break;
        case IN_BRK: shouldBreak = lastClass === SP; break;
        case CI_BRK:
          shouldBreak = lastClass === SP;
          if (!shouldBreak) return false;
          break;
        case CP_BRK:
          if (lastClass !== SP) return shouldBreak;
          break;
        default: break;
      }
      if (lb8a) shouldBreak = false;
      if (lb21a && (curClass === HY || curClass === BA)) {
        shouldBreak = false;
        lb21a = false;
      }
      else lb21a = curClass === HL;
      if (curClass === RI) {
        lb30a++;
        if (lb30a === 2 && nextClass === RI) {
          shouldBreak = true;
          lb30a = 0;
        }
      }
      else lb30a = 0;
      curClass = nextClass;
      return shouldBreak;
    };
    if (!string.length) return out;
    const firstClass = nextCharClass();
    curClass = mapFirst(firstClass);
    nextClass = firstClass;
    lb8a = firstClass === ZWJ;
    lb30a = 0;
    while (pos < string.length) {
      lastPos = pos;
      const lastClass = nextClass;
      nextClass = nextCharClass();
      if (curClass === BK || (curClass === CR && nextClass !== LF)) {
        curClass = mapFirst(mapClass(nextClass));
        out.push({ position: lastPos, required: true });
        continue;
      }
      let shouldBreak = simpleBreak();
      if (shouldBreak === null) shouldBreak = pairTableBreak(lastClass);
      lb8a = nextClass === ZWJ;
      if (shouldBreak) out.push({ position: lastPos, required: false });
    }
    if (lastPos < string.length) out.push({ position: string.length, required: false });
    return out;
  }

  // ---------------------------------------------------------------------
  // Typst-specific break adjustments and the paragraph model.

  const OBJECT = "￼";        // an inline box (formula), like Typst's OBJ_REPLACE
  const LINE_SEPARATOR = "\u2028"; // forced break (emitter: linebreak())

  const BEGIN_PUNCT = new Set("“‘《〈（『「【〖〔［｛");
  const END_PUNCT = new Set("”’，．。、：；》〉）』」】〗〕］｝？！");
  const LEFT_ALIGNED = new Set("，。．、：；》）』」】〗〕〉］｝？！”’"); // GB style
  const RIGHT_ALIGNED = new Set("《（『「【〖〔〈［｛“‘");
  const CENTER_ALIGNED = new Set("・·");

  const CJ_SCRIPT = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u;
  const LETTER_OR_NUMBER = /[\p{Script=Latin}\p{Script=Greek}\p{Script=Cyrillic}\p{Nd}#$%&]/u;

  const EPS = 1e-4; // Typst Abs::fits tolerance (pt)

  const EA_OPEN = new Set("（【《「『〔〖〈［｛“");

  // UAX #14 classes around an inline box (see breakOpportunities).
  const IN_CLASS = 15, PO_CLASS = 10, PR_CLASS = 9, BB_CLASS = 18;
  const BOX_BREAK_AFTER = new Set([BA, HY, NS, IN_CLASS, PO_CLASS]);
  const BOX_BREAK_BEFORE = new Set([PR_CLASS, BB_CLASS]);
  const CP_KEEPS = new Set([AL, HL, 11 /* NU */]);

  // Resolved class of the code point at UTF-16 index `index` (a low
  // surrogate resolves to its pair).
  function lineBreakClass(text, index) {
    let i = index;
    if (i > 0 && /[\uDC00-\uDFFF]/.test(text[i]) && /[\uD800-\uDBFF]/.test(text[i - 1])) i -= 1;
    return mapClass(rawClass(text.codePointAt(i)));
  }
  const LETTER_OR_DIGIT_BEFORE_OP = /[A-Za-z0-9À-ɏͰ-ϿЀ-ӿ]/;

  function isSpace(c) {
    return c === " " || c === "\t" || c === " " || c === "　";
  }

  // Typst link_prefix(): the longest URL-looking prefix, minus trailing
  // sentence punctuation.
  function linkPrefix(text) {
    let end = 0;
    const brackets = [];
    for (const c of text) {
      let ok = /[0-9a-zA-Z!#$%&*+,\-./:;=?@_~']/.test(c);
      if (c === "[" || c === "(") { brackets.push(c); ok = true; }
      else if (c === "]") ok = brackets.pop() === "[";
      else if (c === ")") ok = brackets.pop() === "(";
      if (!ok) break;
      end += c.length;
    }
    while (end > 0 && /[!,.:;?']/.test(text[end - 1])) end -= 1;
    return text.slice(0, end);
  }

  // Typst linebreak_link(): offsets (relative to the link) where it may break.
  function linkBreaks(link) {
    const classOf = c => /\p{Alphabetic}/u.test(c) ? 1 : /\p{N}/u.test(c) ? 2 : (c === "(" || c === "[") ? 3 : 0;
    const out = [];
    let offset = 0;
    let previous = 0;
    let end = 0;
    for (const c of link) {
      const cls = classOf(c);
      if (end > 0 && previous !== 3 && (cls === 0 ? previous === 0 : cls !== previous)) {
        const piece = link.slice(offset, end);
        if (piece.length < 16) { offset = end; out.push(offset); }
        else for (const ch of piece) { offset += ch.length; out.push(offset); }
      }
      previous = cls;
      end += c.length;
    }
    return out;
  }

  // `lead`: the paragraph starts with an indent spacing item (Typst text " ").
  function breakOpportunities(text, lead) {
    const n = text.length;
    const uax = [];
    const shift = lead ? 1 : 0;
    const analysed = text.replace(/[“”￼]/g, c => (c === "“" ? "（" : c === "”" ? "）" : "中"));
    for (const bk of uax14Breaks((lead ? " " : "") + analysed)) {
      const position = bk.position - shift;
      if (position > 0 || (lead && position === 0)) uax.push({ position, mandatory: Boolean(bk.required) });
    }
    // ” behaves like a non-East-Asian closing parenthesis: LB30
    // [CP-EA] × (AL | HL | NU) keeps a following Latin word or number on the
    // line, while ” may still break before “, an opening bracket or a dash.
    // (The analysed string maps ” to the East Asian ）, which LB30 exempts.)
    for (let i = uax.length - 1; i >= 0; i--) {
      const k = uax[i].position;
      if (uax[i].mandatory || k <= 0 || k >= n) continue;
      const before = text[k - 1];
      const after = text[k];
      // A break after a space (LB18) precedes LB19a and always stays.
      if (isSpace(before)) continue;
      if (before === "”" && CP_KEEPS.has(lineBreakClass(text, k))) uax.splice(i, 1);
    }
    // Current LB30: (AL | HL | NU) × OP applies only to non-East-Asian OP.
    const known = new Set(uax.map(b => b.position));
    const addBreak = position => {
      if (known.has(position)) return;
      known.add(position);
      uax.push({ position, mandatory: false });
    };
    for (let k = 1; k < n; k++) {
      if (EA_OPEN.has(text[k]) && LETTER_OR_DIGIT_BEFORE_OP.test(text[k - 1])) addBreak(k);
    }
    // An inline box is analysed as an ideograph above, but for ICU it is CB,
    // and LB20 (÷ CB, CB ÷) outranks the rules that keep an ideograph
    // together with its neighbour: LB21 (× BA, × HY, × NS, BB ×), LB22 (× IN)
    // and LB23a (PR × ID, ID × PO). Rules before LB20 (× CL/CP/EX/IS/SY,
    // OP ×, QU, GL, WJ, spaces) hold for both and need nothing here.
    for (let k = 0; k < n; k++) {
      if (text[k] !== OBJECT) continue;
      if (k + 1 < n && BOX_BREAK_AFTER.has(lineBreakClass(text, k + 1))) addBreak(k + 1);
      if (k > 0 && BOX_BREAK_BEFORE.has(lineBreakClass(text, k - 1))) addBreak(k);
    }
    uax.sort((a, b) => a.position - b.position);

    // Typst's breakpoints() loop with the link special case.
    const out = [];
    let last = 0;
    let index = 0;
    while (true) {
      const head = text.slice(0, last);
      const tail = text.slice(last);
      if (head.endsWith("://") || tail.startsWith("www.")) {
        const link = linkPrefix(tail);
        for (const offset of linkBreaks(link)) out.push({ position: last + offset, mandatory: false });
        const end = last + link.length;
        while (index < uax.length && uax[index].position < end) index += 1;
      }
      if (index >= uax.length) break;
      const point = uax[index++];
      out.push({ position: point.position, mandatory: point.mandatory || point.position === n });
      last = point.position;
    }
    // Link breaks can coincide with UAX #14 ones; keep order, drop duplicates.
    const seen = new Set();
    const result = out.filter(b => (b.position > 0 || (lead && b.position === 0)) && !seen.has(b.position) && seen.add(b.position));
    if (!result.length || result[result.length - 1].position !== n) result.push({ position: n, mandatory: true });
    return result;
  }

  // segments: [{ type: "text", value } | { type: "math", widthEm, heightEm, depthEm }]
  // Forced breaks are LINE_SEPARATOR characters inside text values.
  function prepare(segments, metrics) {
    let text = "";
    const boxes = new Map(); // unit index -> math segment
    for (const segment of segments) {
      if (segment.type === "math") {
        boxes.set(text.length, segment);
        text += OBJECT;
      }
      else text += segment.value;
    }
    const n = text.length;
    const adv = new Float64Array(n);
    const shrinkL = new Float64Array(n);
    const shrinkR = new Float64Array(n);
    const spaceL = new Float64Array(n); // CJK–Latin spacing on the left (x_offset)
    const spaceR = new Float64Array(n); // CJK–Latin spacing on the right
    const kernR = new Float64Array(n);  // pair delta toward the following glyph
    const glyph = new Uint8Array(n);    // 1 where a glyph starts
    const cj = new Uint8Array(n);
    const punct = new Uint8Array(n);    // 1 left-, 2 right-, 3 center-aligned CJK punctuation

    const shapeRunAdjustments = (start, end) => {
      const glyphs = [];
      for (let i = start; i < end;) {
        const cp = text.codePointAt(i);
        const ch = String.fromCodePoint(cp);
        const width = cp > 0xffff ? 2 : 1;
        const continuation = i > start && adv[i] === 0 && !isSpace(ch); // ligature tail
        if (!continuation) {
          glyph[i] = 1;
          glyphs.push(i);
          cj[i] = CJ_SCRIPT.test(ch) ? 1 : 0;
          if (LEFT_ALIGNED.has(ch)) { punct[i] = 1; shrinkR[i] = adv[i] / 2; }
          else if (RIGHT_ALIGNED.has(ch)) { punct[i] = 2; shrinkL[i] = adv[i] / 2; }
          else if (CENTER_ALIGNED.has(ch)) { punct[i] = 3; shrinkL[i] = shrinkR[i] = adv[i] / 4; }
        }
        i += width;
      }
      // CJK–Latin spacing.
      const letter = index => LETTER_OR_NUMBER.test(String.fromCodePoint(text.codePointAt(index)));
      for (let k = 0; k < glyphs.length; k++) {
        const i = glyphs[k];
        if (!cj[i]) continue;
        if (k + 1 < glyphs.length && letter(glyphs[k + 1])) { adv[i] += 0.25; spaceR[i] = 0.25; }
        if (k > 0 && letter(glyphs[k - 1])) { adv[i] += 0.25; spaceL[i] = 0.25; }
      }
      // Consecutive CJK punctuation compression.
      for (let k = 0; k + 1 < glyphs.length; k++) {
        const i = glyphs[k];
        const j = glyphs[k + 1];
        if (!punct[i] || !punct[j]) continue;
        const delta = adv[i] / 2;
        if (shrinkR[i] + shrinkL[j] >= delta) {
          const left = Math.min(shrinkR[i], delta);
          adv[i] -= left; shrinkR[i] -= left;
          adv[j] -= delta - left; shrinkL[j] -= delta - left;
        }
      }
    };
    // Shape text runs (split at boxes and forced breaks, like Typst items).
    let runStart = 0;
    const flushRun = end => {
      if (end <= runStart) return;
      const run = text.slice(runStart, end);
      const kern = new Float64Array(run.length);
      const shaped = metrics.shape(run, undefined, undefined, kern);
      for (let i = 0; i < shaped.length; i++) { adv[runStart + i] = shaped[i]; kernR[runStart + i] = kern[i]; }
      shapeRunAdjustments(runStart, end);
    };
    for (let i = 0; i < n; i++) {
      const c = text[i];
      if (c === OBJECT || c === LINE_SEPARATOR) {
        flushRun(i);
        if (c === OBJECT) { adv[i] = boxes.get(i).widthEm; glyph[i] = 1; }
        runStart = i + 1;
      }
    }
    flushRun(n);

    const prefix = new Float64Array(n + 1);
    for (let i = 0; i < n; i++) prefix[i + 1] = prefix[i] + adv[i];

    return {
      text, n, adv, prefix, shrinkL, shrinkR, spaceL, spaceR, kernR, glyph, cj, punct, boxes,
      ascender: metrics.ascender,
      descender: metrics.descender,
      // Break opportunities depend on whether an indent leads the paragraph;
      // both variants are computed on first use.
      breakSets: [null, null],
      hasText: [...text].some(c => c !== OBJECT && c !== LINE_SEPARATOR && !isSpace(c))
    };
  }

  function breaksFor(p, lead) {
    const slot = lead ? 1 : 0;
    if (!p.breakSets[slot]) p.breakSets[slot] = breakOpportunities(p.text, lead);
    return p.breakSets[slot];
  }

  // Typst Breakpoint::trim: a normal break trims trailing whitespace; a
  // mandatory one (paragraph end, linebreak()) trims only the separator, so
  // trailing spaces before it still take width.
  function trimmedEnd(p, start, end, mandatory = false) {
    let e = end;
    while (e > start && (p.text[e - 1] === LINE_SEPARATOR || p.text[e - 1] === "\n")) e -= 1;
    if (!mandatory) while (e > start && isSpace(p.text[e - 1])) e -= 1;
    return e;
  }

  function lastGlyph(p, start, end) {
    for (let i = end - 1; i >= start; i--) if (p.glyph[i]) return i;
    return -1;
  }

  // endsInCjk(p)[e]: the character ending at e is closing CJK punctuation or
  // a CJ glyph (computed once per paragraph; breaking asks for every line).
  function endsInCjk(p) {
    if (p.endsInCjk) return p.endsInCjk;
    const out = new Uint8Array(p.n + 1);
    for (let e = 1; e <= p.n; e++) {
      const low = e >= 2 && /[\uDC00-\uDFFF]/.test(p.text[e - 1]);
      const lastChar = String.fromCodePoint(p.text.codePointAt(e - 1 - (low ? 1 : 0)));
      out[e] = END_PUNCT.has(lastChar) || CJ_SCRIPT.test(lastChar) ? 1 : 0;
    }
    return (p.endsInCjk = out);
  }

  // adjust_cj_at_line_end: closing CJK punctuation at the (trimmed) line end
  // loses its blank half; trailing CJK–Latin spacing is removed. Typst tests
  // the line text after trailing whitespace is trimmed.
  function lineEndAdjustEm(p, start, e) {
    if (e <= start) return 0;
    if (!endsInCjk(p)[e]) return 0;
    const g = lastGlyph(p, start, e);
    if (g < 0) return 0;
    if (p.punct[g] === 1) return p.shrinkR[g];
    if (p.cj[g] && p.spaceR[g] > 0) return p.spaceR[g];
    return 0;
  }

  // Natural width (em) of text[start, end) as one Typst line.
  function lineWidthEm(p, start, end, mandatory, lead) {
    const e = trimmedEnd(p, start, end, mandatory);
    if (e <= start) return 0;
    let width = p.prefix[e] - p.prefix[start];
    const first = p.text[start];
    if (!(lead && start === 0) && (BEGIN_PUNCT.has(first) || p.cj[start])) {
      if (p.punct[start] === 2) width -= p.shrinkL[start];
      else if (p.cj[start] && p.spaceL[start] > 0) width -= p.spaceL[start];
    }
    // The run is reshaped at the break: no pair delta toward the next line.
    if (e < p.n) {
      const g = lastGlyph(p, start, e);
      if (g >= 0) width -= p.kernR[g];
    }
    return width - lineEndAdjustEm(p, start, e);
  }

  // Justifiable gaps of a line the way Typst stretches a justified line:
  // after every space and CJK character except the last glyph (Latin letters
  // and formula boxes are not stretched).
  const CJK_JUSTIFIABLE = /[　-〿㐀-鿿豈-﫿＀-￯]/;
  function justifiableGaps(p, start, end) {
    const e = trimmedEnd(p, start, end);
    let gaps = 0;
    for (let i = start; i < e - 1; i++) {
      const c = p.text[i];
      if (isSpace(c) || CJK_JUSTIFIABLE.test(c)) gaps += 1;
    }
    return gaps;
  }

  // How much a line may stretch and shrink when justified, and how many of its
  // glyphs may take extra space (Typst ShapedGlyph::base_adjustability with
  // the default justification limits — spaces 2/3 .. 150% of their width,
  // tracking 0 — plus CJK punctuation halves/quarters, the shrinkable half of
  // CJK–Latin spacing, and the line-start/-end adjustments of line.rs).
  // In em. lead: the paragraph starts with an indent (no line-start trim).
  function glyphAdjustability(p, i) {
    const c = p.text[i];
    if (c === OBJECT || c === LINE_SEPARATOR) return [0, 0, 0];
    if (isSpace(c)) return [p.adv[i] * 0.5, Math.min(p.adv[i] / 3, p.adv[i] * 0.75), 1];
    const shrink = leftShrink(p, i) + p.shrinkR[i] + (p.spaceR[i] > 0 ? 0.125 : 0);
    const justifiable = p.cj[i] || p.punct[i] > 0
      // A Latin letter or digit followed by a CJ glyph (CJK–Latin spacing).
      || (i + 1 < p.n && p.spaceL[i + 1] > 0 && LETTER_OR_NUMBER.test(c));
    return [0, shrink, justifiable ? 1 : 0];
  }
  const leftShrink = (p, i) => p.shrinkL[i] + (p.spaceL[i] > 0 ? 0.125 : 0);

  // Prefix sums of glyphAdjustability, built on first use.
  function adjustabilitySums(p) {
    if (p.adjustSums) return p.adjustSums;
    const stretch = new Float64Array(p.n + 1);
    const shrink = new Float64Array(p.n + 1);
    const justifiables = new Int32Array(p.n + 1);
    for (let i = 0; i < p.n; i++) {
      const [a, b, c] = p.glyph[i] ? glyphAdjustability(p, i) : [0, 0, 0];
      stretch[i + 1] = stretch[i] + a;
      shrink[i + 1] = shrink[i] + b;
      justifiables[i + 1] = justifiables[i] + c;
    }
    return (p.adjustSums = { stretch, shrink, justifiables });
  }

  function lineAdjustability(p, start, end, mandatory, lead) {
    const e = trimmedEnd(p, start, end, mandatory);
    if (e <= start) return { stretch: 0, shrink: 0, justifiables: 0 };
    const sums = adjustabilitySums(p);
    const stretch = sums.stretch[e] - sums.stretch[start];
    let shrink = sums.shrink[e] - sums.shrink[start];
    let justifiables = sums.justifiables[e] - sums.justifiables[start];
    // adjust_cj_at_line_start: a right-aligned punctuation mark is shrunk
    // already; a CJ glyph's leading CJK–Latin spacing is removed.
    if (p.glyph[start] && !(lead && start === 0) && !isSpace(p.text[start])
      && (p.punct[start] === 2 || (p.cj[start] && p.spaceL[start] > 0))) shrink -= leftShrink(p, start);
    // adjust_cj_at_line_end: the closing punctuation's blank half or the
    // trailing CJK–Latin spacing is gone, and with it its shrinkability.
    const g = lastGlyph(p, start, e);
    if (g >= 0) {
      if (lineEndAdjustEm(p, start, e) > 0) {
        if (p.punct[g] === 1) shrink -= p.shrinkR[g];
        else if (p.cj[g] && p.spaceR[g] > 0) shrink -= 0.125;
      }
      // A CJ glyph or CJK punctuation at the line end takes no extra space.
      if (p.cj[g] || p.punct[g] > 0) justifiables -= 1;
    }
    return { stretch: Math.max(0, stretch), shrink: Math.max(0, shrink), justifiables: Math.max(0, justifiables) };
  }

  // Typst's optimized (Knuth–Plass) breaking (linebreak.rs
  // linebreak_optimized_bounded): for every breakpoint, the predecessor
  // minimising the total cost (1 + 100|ratio|^3 + penalties)^2, where ratio is
  // the stretch or shrink a line needs relative to its adjustability. Ties go
  // to the later start, as in Typst (`best.total >= total`).
  //
  // Pruning, as in Typst: `bound` is the exact cost of a known layout (Typst
  // gets one from an approximate pass; here the greedy layout serves), so no
  // optimal prefix costs more. Once a line from some start is underfull, lines
  // from later starts are shorter and cost at least as much, so starts whose
  // total plus that cost exceed the bound are skipped without measuring.
  const MIN_RATIO = -1;
  const RUNT_COST = 100;
  const BOUND_EPS = 1e-3;
  function lineCost(p, lineWidth, available, size, justify, lead, start, end, mandatory, unbreakable) {
    const first = start === 0;
    const width = lineWidth(start, end, first, mandatory);
    let delta = available(first) - width;
    if (Math.abs(delta) < 1e-9) delta = 0;
    const adj = lineAdjustability(p, start, end, mandatory, lead);
    const adjustability = (delta >= 0 ? adj.stretch : adj.shrink) * size;
    let ratio = adjustability > 0 ? delta / adjustability : (delta === 0 ? 0 : (delta > 0 ? Infinity : -Infinity));
    if (ratio > 1) {
      const extra = (delta - adjustability) / Math.max(1, adj.justifiables);
      ratio = 1 + extra / (size / 2);
    }
    ratio = Math.min(10, Math.max(MIN_RATIO - 1, ratio));
    const minRatio = justify ? MIN_RATIO : 0;
    let badness;
    if (ratio < minRatio) badness = 1e6;
    // Every line but a paragraph's last pays for its ratio; the last line
    // only when it has to shrink.
    else if (!mandatory || ratio < 0) badness = 100 * Math.abs(ratio) ** 3;
    else badness = 0;
    const penalty = unbreakable && mandatory ? RUNT_COST : 0;
    return { width, ratio, overfull: ratio < minRatio, cost: (1 + badness + penalty) ** 2 };
  }

  function optimizedBreaks(p, breaks, lineWidth, available, size, justify, lead, greedy) {
    const cost = (start, end, mandatory, unbreakable) => lineCost(p, lineWidth, available, size, justify, lead, start, end, mandatory, unbreakable);
    // Upper bound: the greedy layout's exact cost. A greedy line is
    // unbreakable when no breakpoint lies strictly inside it.
    let bound = 0; if (globalThis.KPDEBUG) globalThis.KPDEBUG.length = 0;
    let k = 0;
    for (const line of greedy) {
      while (k < breaks.length && breaks[k].position <= line.start) k += 1;
      const unbreakable = !(k < breaks.length && breaks[k].position < line.end);
      bound += cost(line.start, line.end, line.mandatory, unbreakable).cost;
    }
    if (globalThis.KPDEBUG) globalThis.KPBOUND = bound;
    const table = [{ pred: 0, total: 0, end: 0, mandatory: false, width: 0 }];
    let active = 0;
    let prevEnd = 0;
    for (const bk of breaks) {
      let best = null;
      let lower = null;
      for (let index = active; index < table.length; index++) {
        const pred = table[index];
        if (lower !== null && pred.total + lower > bound + BOUND_EPS) continue;
        const line = cost(pred.end, bk.position, bk.mandatory, prevEnd === pred.end);
        if (globalThis.KPDEBUG) globalThis.KPDEBUG.push({ start: pred.end, end: bk.position, total: pred.total + line.cost, predTotal: pred.total, ...line });
        if (line.overfull && active === index) active += 1;
        const total = pred.total + line.cost;
        // Formula boxes never have negative width here, so an underfull
        // line bounds every shorter one from below.
        if (line.ratio > 0 && lower === null) lower = line.cost;
        if (total > bound + BOUND_EPS) continue;
        if (!best || best.total >= total) best = { pred: index, total, end: bk.position, mandatory: bk.mandatory, width: line.width };
      }
      if (bk.mandatory) active = table.length;
      if (best) table.push(best);
      prevEnd = bk.position;
    }
    const lines = [];
    let index = table.length - 1;
    // Only a faulty bound leaves the table short of the paragraph end.
    if (table[index].end !== p.n && breaks.length && table[index].end !== breaks[breaks.length - 1].position) throw new Error("optimized line breaking: incomplete layout");
    while (index > 0) {
      const entry = table[index];
      lines.unshift({ start: table[entry.pred].end, end: entry.end, width: entry.width, mandatory: entry.mandatory });
      index = entry.pred;
    }
    return lines;
  }

  // Opt-in balanced breaking (options.balance = { trigger, maxStretch }).
  // Greedy first-fit leaves all the slack on the line before a wide unbreakable
  // item (an inline formula, a URL, a long number run), which justification
  // then spreads as visible letter-spacing. For every run of lines between
  // forced breaks that greedy left with a justified line stretched beyond
  // `trigger` em per gap, choose the breaks that minimise the sum of squared
  // per-gap stretch over the non-final lines, using exactly the greedy number
  // of lines so the paragraph's height and fitted size do not change. The
  // emitter paints the chosen lines explicitly, so Typst parity is not needed.
  function balanceLines(p, lines, breaks, lineWidth, available, size, settings) {
    const trigger = Number.isFinite(settings.trigger) ? settings.trigger : 0.08;
    const stretchEm = (start, end, width, first) => {
      const gaps = justifiableGaps(p, start, end);
      const slack = (available(first) - width) / size;
      return gaps > 0 ? slack / gaps : (slack > 1e-3 ? Infinity : 0);
    };
    let segmentStart = 0;
    for (let index = 0; index < lines.length; index++) {
      if (!lines[index].mandatory && index < lines.length - 1) continue;
      const segment = lines.slice(segmentStart, index + 1);
      const count = segment.length;
      const worst = Math.max(0, ...segment.slice(0, -1).map((line, k) =>
        stretchEm(line.start, line.end, line.width, segmentStart + k === 0)));
      if (count >= 2 && worst > trigger) {
        const from = segment[0].start;
        const to = segment[count - 1].end;
        const endMandatory = segment[count - 1].mandatory;
        // Candidate break positions strictly inside the segment.
        const points = [from, ...breaks.filter(bk => !bk.mandatory && bk.position > from && bk.position < to).map(bk => bk.position), to];
        const n = points.length;
        // best[m][j]: least cost to end line m (0-based) at points[j].
        const best = Array.from({ length: count }, () => new Array(n).fill(Infinity));
        const back = Array.from({ length: count }, () => new Array(n).fill(-1));
        for (let m = 0; m < count; m++) {
          const first = segmentStart + m === 0;
          const lastLine = m === count - 1;
          for (let j = 1; j < n; j++) {
            if (lastLine !== (j === n - 1)) continue;
            for (let i = j - 1; i >= 0; i--) {
              const prev = m === 0 ? (i === 0 ? 0 : Infinity) : best[m - 1][i];
              if (!Number.isFinite(prev)) continue;
              const mandatory = lastLine && endMandatory;
              const width = lineWidth(points[i], points[j], first, mandatory);
              if (width > available(first) + EPS) break; // wider for every smaller i
              const s = lastLine ? 0 : stretchEm(points[i], points[j], width, first);
              const cost = prev + (Number.isFinite(s) ? s * s : 1e6);
              if (cost < best[m][j]) { best[m][j] = cost; back[m][j] = i; }
            }
          }
        }
        const greedyCost = segment.slice(0, -1).reduce((sum, line, k) => {
          const s = stretchEm(line.start, line.end, line.width, segmentStart + k === 0);
          return sum + (Number.isFinite(s) ? s * s : 1e6);
        }, 0);
        if (best[count - 1][n - 1] < greedyCost - 1e-9) {
          const chosen = [];
          let j = n - 1;
          for (let m = count - 1; m >= 0; m--) {
            const i = back[m][j];
            const mandatory = m === count - 1 && endMandatory;
            chosen.unshift({ start: points[i], end: points[j], width: lineWidth(points[i], points[j], segmentStart + m === 0, mandatory), mandatory });
            j = i;
          }
          lines.splice(segmentStart, count, ...chosen);
        }
      }
      segmentStart = index + 1;
    }
  }

  // Greedy layout at `size` in a region `width` wide.
  // options: { indent = 0 (first line, absolute), hang = 0 (later lines, absolute) }
  // Returns { lines: [{ start, end, width, mandatory, top, bottom }], height }
  // where top/bottom are the line's extent above/below its baseline and
  // height is the stacked extent at leading 0.
  function layout(p, size, width, options = {}) {
    const indent = Number(options.indent) || 0;
    const hang = Number(options.hang) || 0;
    const lead = indent > 0 || hang > 0;
    const breaks = breaksFor(p, lead);
    let lines = [];
    const lineWidth = (start, end, first, mandatory) => lineWidthEm(p, start, end, mandatory, lead) * size + (first ? indent : 0);
    const available = first => first ? width : width - hang;
    let start = 0;
    let last = null; // { end, width, mandatory }
    for (const bk of breaks) {
      const first = lines.length === 0;
      let current = lineWidth(start, bk.position, first, bk.mandatory);
      if (current > available(first) + EPS && last) {
        lines.push({ start, end: last.end, width: last.width, mandatory: false });
        start = last.end;
        last = null;
        current = lineWidth(start, bk.position, lines.length === 0, bk.mandatory);
      }
      if (bk.mandatory || current > available(lines.length === 0) + EPS) {
        lines.push({ start, end: bk.position, width: current, mandatory: bk.mandatory });
        start = bk.position;
        last = null;
      }
      else last = { end: bk.position, width: current };
    }
    if (last) lines.push({ start, end: last.end, width: last.width, mandatory: false });
    // options.optimized: Typst `linebreaks: "optimized"` (justify:
    // options.justify), bounded by the greedy layout just computed.
    if (options.optimized) lines = optimizedBreaks(p, breaks, lineWidth, available, size, options.justify !== false, lead, lines);
    else if (options.balance) balanceLines(p, lines, breaks, lineWidth, available, size, options.balance);

    let height = 0;
    for (const line of lines) {
      let top = 0;
      let bottom = 0;
      let text = false;
      for (let i = line.start; i < line.end; i++) {
        const box = p.boxes.get(i);
        if (box) {
          top = Math.max(top, (box.heightEm - box.depthEm) * size);
          bottom = Math.max(bottom, box.depthEm * size);
        }
        else if (!isSpace(p.text[i]) && p.text[i] !== LINE_SEPARATOR) text = true;
      }
      if (text || !top) { top = Math.max(top, p.ascender * size); bottom = Math.max(bottom, p.descender * size); }
      line.top = top;
      line.bottom = bottom;
      height += top + bottom;
    }
    return { lines, height };
  }

  // Width of the whole paragraph laid out unwrapped (Typst `box(body)`).
  function naturalWidth(p, size, options = {}) {
    const indent = Number(options.indent) || 0;
    const lead = indent > 0 || Number(options.hang) > 0;
    let max = 0;
    let start = 0;
    for (const bk of breaksFor(p, lead)) {
      if (!bk.mandatory) continue;
      max = Math.max(max, lineWidthEm(p, start, bk.position, true, lead) * size + (start === 0 ? indent : 0));
      start = bk.position;
    }
    return max;
  }

  return {
    prepare, layout, naturalWidth, lineWidthEm, lineEndAdjustEm, breakOpportunities, uax14Breaks,
    justifiableGaps, isSpace, OBJECT, LINE_SEPARATOR
  };
});

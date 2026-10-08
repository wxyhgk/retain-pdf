// retain-pdf-rendering/text/metrics
// Host-agnostic: never reference the host application or plugin globals here.
//
// Font metrics for the pure-JS line layout, in em units (1 em = 1 font size),
// built from the compact advance table that scripts/build-advance-table.js
// extracts from the font (data/fonts/*.json). No font parser runs here, so
// the same code works in Node, a browser and Zotero.
//
// Shaping model (mirrors how Typst shapes a run with rustybuzz, language
// "zh" and the run's script guessed as harfbuzz does — the first character
// with a concrete script). Source Han Serif registers its ZHS language
// system under every concrete script and none under DFLT, so there are
// exactly two shaping modes:
//   "zh"   — the run contains a Latin/Han/Greek/Cyrillic/kana/Hangul
//            character: `locl` ZHS applies (— and ― become 1 em, —— 2 em,
//            no kerning around …)
//   "dflt" — the run has only Common characters (punctuation, digits,
//            symbols): default glyphs
// Per mode the table stores per-code-point advances, pair deltas among
// "Latin-side" characters (< U+2E80; GPOS kerning and contextual
// substitutions captured as the pair's width delta) and ligatures (a pair or
// triple shaping to one glyph). CJK ideographs, kana and CJK punctuation
// never kern or ligate in this font.
//
// Vertical metrics follow Typst's top-edge "ascender" / bottom-edge
// "descender", read from OS/2 typo metrics (880 / -120 for Source Han Serif:
// a line of text is exactly 1 em tall).
(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module && module.exports) module.exports = api;
  else {
    const namespace = root.RetainPdfRendering = root.RetainPdfRendering || {};
    namespace.TextMetrics = api;
  }
})(typeof this === "object" && this ? this : globalThis, function () {
  "use strict";

  const PAIR_LIMIT = 0x2e80;
  const STRONG_SCRIPT = /[\p{Script=Latin}\p{Script=Han}\p{Script=Greek}\p{Script=Cyrillic}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;

  function emptyMode() {
    return { advances: new Map(), pairs: new Map(), triples: new Map() };
  }

  class FontMetrics {
    constructor({ unitsPerEm, ascender, descender, capHeight, xHeight, defaultAdvance, modes, font = "", kernAs = new Map(), aliases = new Map() }) {
      this.font = font;
      this.unitsPerEm = unitsPerEm;
      this.ascender = ascender / unitsPerEm;
      this.descender = -descender / unitsPerEm; // positive, below baseline
      this.capHeight = Number.isFinite(capHeight) ? capHeight / unitsPerEm : this.ascender;
      this.xHeight = Number.isFinite(xHeight) ? xHeight / unitsPerEm : this.ascender / 2;
      this.defaultAdvance = defaultAdvance;
      this.modes = modes;
      // Letters the font draws as base + combining mark, and characters drawn
      // as a canonically equivalent one (see shape()).
      this.kernAs = kernAs;
      this.aliases = aliases;
    }

    // harfbuzz guess_segment_properties: the first character with a concrete
    // script decides; with only Common characters the run is shaped as DFLT.
    static modeOf(text) {
      return STRONG_SCRIPT.test(text) ? "zh" : "dflt";
    }

    advanceUnits(cp, mode = "zh") {
      const value = this.modes[mode].advances.get(cp);
      return value === undefined ? this.defaultAdvance : value;
    }

    // { lig } | { kern } | null for two adjacent Latin-side code points.
    pair(a, b, mode = "zh") {
      return this.modes[mode].pairs.get(`${a},${b}`) || null;
    }

    triple(a, b, c, mode = "zh") {
      const value = this.modes[mode].triples.get(`${a},${b},${c}`);
      return value === undefined ? null : value;
    }

    // Advances (em) for every UTF-16 code unit of `text`, as Typst shapes one
    // run: a ligature's width sits on its first unit (the rest get 0), a pair
    // delta is added to the left glyph and also recorded in `kernOut` (Typst
    // reshapes a run split by a line break, which drops that pair delta at
    // the end of the line). Low surrogates get 0.
    shape(text, out = new Float64Array(text.length), mode = FontMetrics.modeOf(text), kernOut = null) {
      const unit = this.unitsPerEm;
      const applyPair = (left, leftIndex, right) => {
        // A letter drawn as base + mark kerns with the glyph before it (as
        // its base); the mark after the base blocks kerning with the next.
        left = this.aliases.get(left) ?? left;
        right = this.aliases.get(right) ?? right;
        if (this.kernAs.has(left)) return;
        right = this.kernAs.get(right) ?? right;
        if (left >= PAIR_LIMIT || right >= PAIR_LIMIT) return;
        const pair = this.pair(left, right, mode);
        if (pair && pair.kern) {
          out[leftIndex] += pair.kern / unit;
          if (kernOut) kernOut[leftIndex] = pair.kern / unit;
        }
      };
      let previous = -1;      // last code point of the previous glyph
      let previousIndex = -1; // unit index of the previous glyph
      for (let i = 0; i < text.length;) {
        const cp = text.codePointAt(i);
        const length = cp > 0xffff ? 2 : 1;
        if (cp < PAIR_LIMIT && i + length < text.length) {
          const next = text.codePointAt(i + length);
          if (next < PAIR_LIMIT) {
            const pair = this.pair(cp, next, mode);
            if (pair && pair.lig !== undefined) {
              let span = length + (next > 0xffff ? 2 : 1);
              let units = pair.lig;
              let last = next;
              if (i + span < text.length) {
                const third = text.codePointAt(i + span);
                const triple = third < PAIR_LIMIT ? this.triple(cp, next, third, mode) : null;
                if (triple != null) { units = triple; span += third > 0xffff ? 2 : 1; last = third; }
              }
              if (previous >= 0) applyPair(previous, previousIndex, cp);
              out[i] = units / unit;
              for (let k = 1; k < span; k++) out[i + k] = 0;
              previous = last;
              previousIndex = i;
              i += span;
              continue;
            }
          }
        }
        out[i] = this.advanceUnits(cp, mode) / unit;
        if (length === 2) out[i + 1] = 0;
        if (previous >= 0) applyPair(previous, previousIndex, cp);
        previous = cp;
        previousIndex = i;
        i += length;
      }
      return out;
    }
  }

  // Table layout (see scripts/build-advance-table.js): advances are shared
  // ranges plus per-mode overrides; kerning and ligatures are per mode.
  // Anything absent has no effect.
  function createMetrics(table) {
    if (!table || !Array.isArray(table.ranges) || !table.modes) {
      throw new TypeError("createMetrics expects an advance table built by scripts/build-advance-table.js");
    }
    const base = new Map();
    for (const [first, count, advance] of table.ranges) for (let i = 0; i < count; i++) base.set(first + i, advance);
    // Characters the font lacks, as Typst sets them with its fallback font
    // (scripts/build-fallback-table.js); anything else keeps defaultAdvance.
    for (const [first, count, advance] of (table.fallback && table.fallback.ranges) || []) {
      for (let i = 0; i < count; i++) if (!base.has(first + i)) base.set(first + i, advance);
    }
    const modes = { zh: emptyMode(), dflt: emptyMode() };
    for (const name of ["zh", "dflt"]) {
      const mode = modes[name];
      const source = table.modes[name] || {};
      mode.advances = new Map(base);
      for (const [cp, advance] of Object.entries(source.advances || {})) mode.advances.set(Number(cp), advance);
      for (const [left, entries] of Object.entries(source.kern || {})) {
        for (let i = 0; i < entries.length; i += 2) mode.pairs.set(`${left},${entries[i]}`, { kern: entries[i + 1] });
      }
      for (const [key, units] of Object.entries(source.ligatures || {})) {
        if (key.split(",").length === 2) mode.pairs.set(key, { lig: units });
        else mode.triples.set(key, units);
      }
    }
    return new FontMetrics({
      font: table.font || "",
      unitsPerEm: table.unitsPerEm,
      ascender: table.ascender,
      descender: table.descender,
      capHeight: table.capHeight,
      xHeight: table.xHeight,
      defaultAdvance: table.defaultAdvance,
      modes,
      kernAs: new Map((table.fallback && table.fallback.decompose) || []),
      aliases: new Map((table.fallback && table.fallback.alias) || [])
    });
  }

  return { createMetrics, FontMetrics, PAIR_LIMIT };
});

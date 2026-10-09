"use strict";

// retain-pdf-rendering/output/pdf/shaping
// Host-agnostic: never reference the host application or plugin globals here.
//
// Node-only. Which font and glyphs draw one cluster of the measured text
// (a measurer glyph start plus its zero-advance continuation units, e.g. a
// ligature). The measurer already decided the clusters and their advances
// (the advance table mirrors HarfBuzz's shaping), so every cluster is shaped
// on its own, in this order:
//   1. a singleton canonical equivalent (U+037E -> ;) is that character;
//   2. the primary face (regular / bold) when it has every character;
//   3. else a canonical decomposition it has in full (č -> c + U+030C),
//      HarfBuzz-style: pairwise, recursive, all pieces present;
//   4. else the first fallback face, by priority, that has the character
//      (or its decomposition): same weight before the other, serif before
//      monospace, the order the caller gave (Typst's embedded fonts:
//      Libertinus Serif, New Computer Modern, New Computer Modern Math,
//      DejaVu Sans Mono);
//   5. else the primary face's .notdef.
// Shaping uses the OpenType language ZHS (Typst's lang: "zh"), so locl picks
// the Chinese forms (a full-width em dash).

const LANGUAGE = "ZHS";
// One character that no OpenType feature of these faces substitutes or
// positions on its own (checked against fontkit layout in test/pdf-output).
const PLAIN = /^(?:[\p{Script=Han}]|[A-Za-z0-9 ])$/u;
// The measurer's shaping modes (text/metrics.js FontMetrics.modeOf): a run
// with a strong script is shaped as zh, punctuation / digits alone as dflt.
const STRONG_SCRIPT = /[\p{Script=Latin}\p{Script=Han}\p{Script=Greek}\p{Script=Cyrillic}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;

function has(font, cp) {
  return font.hasGlyphForCodePoint(cp);
}

// HarfBuzz's decomposition for a character `font` lacks: pairwise and
// recursive (Ǟ -> Ä + U+0304, Ä kept if the font has it), used only if the
// font has all pieces. -> code points, or null. Mirrors
// scripts/build-fallback-table.js.
function pieces(font, cp) {
  if (has(font, cp)) return [cp];
  const parts = [...String.fromCodePoint(cp).normalize("NFD")].map(ch => ch.codePointAt(0));
  if (parts.length === 1) return parts[0] !== cp && has(font, parts[0]) ? [parts[0]] : null;
  const first = [...String.fromCodePoint(...parts.slice(0, -1)).normalize("NFC")];
  if (first.length !== 1) return null;
  const head = pieces(font, first[0].codePointAt(0));
  const mark = parts[parts.length - 1];
  return head && has(font, mark) ? [...head, mark] : null;
}

// Every code point of `text` drawn by `font`, decomposed where needed; null
// if some character cannot be.
function textFor(font, text) {
  const out = [];
  for (const ch of text) {
    const drawn = pieces(font, ch.codePointAt(0));
    if (!drawn) return null;
    out.push(...drawn);
  }
  return String.fromCodePoint(...out);
}

class FontChain {
  // faces: { regular, bold } fontkit fonts (bold optional);
  // fallbacks: [{ font, weight, mono }] in priority order.
  constructor(faces, fallbacks = []) {
    this.faces = faces;
    this.fallbacks = fallbacks;
    this.cache = new Map();
    this.stats = { clusters: 0, decomposed: 0, fallback: 0, notdef: 0 };
  }

  primary(bold) {
    return (bold && this.faces.bold) || this.faces.regular;
  }

  // Fallback faces for a weight: the same weight first, serif before mono.
  order(bold) {
    if (!this.ordered) this.ordered = {};
    const key = bold ? "bold" : "regular";
    if (!this.ordered[key]) {
      const wantBold = Boolean(bold);
      this.ordered[key] = this.fallbacks
        .map((face, index) => ({ face, index }))
        .sort((a, b) => (Number(a.face.mono) - Number(b.face.mono))
          || (Number((a.face.weight >= 600) !== wantBold) - Number((b.face.weight >= 600) !== wantBold))
          || (a.index - b.index))
        .map(item => item.face.font);
    }
    return this.ordered[key];
  }

  // -> { font, glyphs: [{ glyph, x, y, advance }] } with positions in font
  // units from the cluster's origin (marks keep the shaper's offsets).
  // mode: the measurer's shaping mode of the run the cluster sits in. In a
  // zh run, punctuation and digits take the run's script (HarfBuzz shapes a
  // run as one script), so locl gives them their Chinese forms (a full-width
  // em dash), as the advance table expects.
  shape(text, bold = false, mode = "zh") {
    const script = mode === "zh" && !STRONG_SCRIPT.test(text) ? "hani" : undefined;
    const key = `${bold ? "B" : "R"}${script || ""}:${text}`;
    let shaped = this.cache.get(key);
    if (shaped) return shaped;
    this.stats.clusters += 1;
    const primary = this.primary(bold);
    let font = primary;
    let drawn = textFor(primary, text);
    if (drawn !== null && drawn !== text && [...drawn].length > [...text].length) this.stats.decomposed += 1;
    if (drawn === null) {
      for (const candidate of this.order(bold)) {
        // A cluster goes to the face that has its first character (Typst
        // picks a fallback by the text's first non-space character).
        drawn = textFor(candidate, text);
        if (drawn !== null) { font = candidate; this.stats.fallback += 1; break; }
      }
    }
    if (drawn === null) {
      this.stats.notdef += 1;
      const notdef = primary.getGlyph(0);
      // .notdef stands for nothing in particular: no ToUnicode entry, or
      // every missing character would extract as the first one seen.
      shaped = { font: primary, glyphs: [{ glyph: notdef, x: 0, y: 0, advance: notdef.advanceWidth, codePoints: [] }] };
      this.cache.set(key, shaped);
      return shaped;
    }
    const glyphs = [];
    if (PLAIN.test(drawn)) {
      // A Han ideograph, an ASCII letter / digit or a space: no feature of
      // the face changes it, so the cmap glyph is the shaped glyph (and
      // shaping, which parses GSUB / GPOS, is skipped for most clusters).
      const glyph = font.glyphForCodePoint(drawn.codePointAt(0));
      glyphs.push({ glyph, x: 0, y: 0, advance: glyph.advanceWidth });
    }
    else {
      const run = font.layout(drawn, [], script, LANGUAGE);
      let pen = 0;
      run.glyphs.forEach((glyph, index) => {
        const position = run.positions[index];
        glyphs.push({ glyph, x: pen + position.xOffset, y: position.yOffset, advance: position.xAdvance });
        pen += position.xAdvance;
      });
    }
    // ToUnicode is per glyph, so a glyph must always stand for the same
    // text: one glyph (a character or a ligature) stands for the cluster; a
    // decomposed cluster's glyphs for their own pieces (c + U+030C, which
    // extracts as the NFD form of č); otherwise the first glyph takes all.
    const original = [...text].map(c => c.codePointAt(0));
    const drawnPoints = [...drawn].map(c => c.codePointAt(0));
    if (glyphs.length === 1) glyphs[0].codePoints = original;
    else if (glyphs.length === drawnPoints.length) glyphs.forEach((glyph, i) => { glyph.codePoints = [drawnPoints[i]]; });
    else glyphs.forEach((glyph, i) => { glyph.codePoints = i ? [] : original; });
    shaped = { font, glyphs };
    this.cache.set(key, shaped);
    return shaped;
  }
}

module.exports = { FontChain, pieces, textFor, LANGUAGE, STRONG_SCRIPT, PLAIN };

"use strict";

// retain-pdf-rendering/output/typst-source
// Host-agnostic: never reference the host application or plugin globals here.
//
// Pieces of Typst source shared by every output document: number and string
// literals, colours, and the preamble that defines how a formula is drawn.

const DEFAULT_FONT_FAMILY = "Source Han Serif SC";

function fmt(value) {
  return Number(value).toFixed(3).replace(/\.?0+$/, "") || "0";
}

// Typst string literal: content emitted as #"..." is never parsed as markup.
function typstString(value) {
  return `"${String(value)
    .replace(/\\/g, "\\\\")
    .replace(/"/g, "\\\"")
    .replace(/\r?\n/g, " ")
    .replace(/[\u0000-\u0008\u000b-\u001f]/g, "")}"`;
}

// [r, g, b] in 0..1 -> rgb(R, G, B).
function rgb(values) {
  const [r, g, b] = (values || [1, 1, 1]).map(value => Math.round(Math.max(0, Math.min(1, Number(value) || 0)) * 255));
  return `rgb(${r}, ${g}, ${b})`;
}

// rpr-math: the visible formula is the MathJax SVG (src: a file path), or the
// same outlines as reusable PDF stamps (src: (stamps: file, items: ...), see
// math-stamps.js); on top of it, inside the same fixed-size box, the LaTeX
// source is set as fully transparent text scaled to the SVG's width. PDF text
// extraction / copy / search therefore yield the LaTeX, while the box (not
// the text) decides layout.
const PREAMBLE = `// Each item: (page, x, y, w, h) as fractions of the formula box; page 0 is a
// filled rule (fraction bar, vinculum), page n > 0 is outline n of the stamps PDF.
// The stamps are decorative (the transparent LaTeX above them is the content),
// so they are PDF artifacts: no structure element per glyph in tagged output.
#let rpr-draw(src, w, h) = if type(src) == str { image(src, width: w, height: h) } else if "svg" in src {
  // A formula SVG padded so text glyphs taller than MathJax's guess are not
  // clipped: drawn larger by the pad and shifted back, so the box is unchanged.
  place(top + left, dx: -w * src.px, dy: -h * src.py, image(src.svg, width: w * (1 + 2 * src.px), height: h * (1 + 2 * src.py)))
} else { pdf.artifact({
  for (page, x, y, sw, sh) in src.items {
    place(top + left, dx: w * x, dy: h * y, if page > 0 {
      image(src.stamps, page: page, width: w * sw, height: h * sh, fit: "stretch")
    } else { context rect(width: w * sw, height: h * sh, fill: text.fill, stroke: none) })
  }
}) }
#let rpr-math(src, w, h, depth, tex) = box(baseline: depth, width: w, height: h, {
  // Only placed children: the box has no text line of its own, so its
  // baseline is its bottom edge and baseline: depth lowers it by the
  // formula's depth below the surrounding baseline.
  place(top + left, rpr-draw(src, w, h))
  place(bottom + left, dy: -depth, context {
    let (wa, ha) = (w.to-absolute(), h.to-absolute())
    let natural = measure(text(size: 10pt, tex)).width
    let size = if natural > 0pt { calc.min(10pt * (wa / natural), ha) } else { ha }
    text(fill: rgb(0, 0, 0, 0), size: size, top-edge: "ascender", bottom-edge: "baseline", tex)
  })
})
// MathJax failure: the raw LaTeX in red, as one unbreakable box (Typst raw
// text is DejaVu Sans Mono at 0.8 em: 0.4816 em per character).
#let rpr-tex-fallback(tex) = box(text(fill: rgb("#8a1c1c"), raw(tex)))
`;

module.exports = { DEFAULT_FONT_FAMILY, PREAMBLE, fmt, typstString, rgb };

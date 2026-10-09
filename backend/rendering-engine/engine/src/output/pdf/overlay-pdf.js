"use strict";

// retain-pdf-rendering/output/pdf/overlay-pdf
// Host-agnostic: never reference the host application or plugin globals here.
//
// Node-only. The overlay of a typeset document written as a PDF directly --
// the same pages, covers, lines and formulas as output/overlay.js, without
// Typst. Every cluster sits where the measured layout put it
// (measurer.placeLine); which font and glyphs draw it is shaping.js
// (primary face, canonical decomposition, fallback faces). Formulas are
// MathJax outlines (svg-pdf.js) with their LaTeX on top as invisible text
// (text render mode 3), so extraction / copy / search yield the LaTeX.
//
//   const { pdf, painted, stats } = overlayPdf(result, paint, maths, {
//     fonts: { regular, bold, fallbacks: [{ font, weight, mono }] },  // fontkit fonts
//     measurers: { regular, bold }
//   });
//   result / paint: as for overlayDocument (output/overlay.js).
//   maths: a MathStore (output/math-store.js); its entries carry the SVG.

const { PdfFile, name, num } = require("./pdf-file");
const { PdfFont, hex4 } = require("./pdf-font");
const { SvgPainter } = require("./svg-pdf");
const { FontChain, STRONG_SCRIPT } = require("./shaping");
// The measurer's unit for a formula box and for a forced break (U+2028).
const { OBJECT, LINE_SEPARATOR } = require("../../text/linebreak");

// Typst's raw-text fallback for a formula MathJax could not render.
const FALLBACK_COLOR = [0x8a / 255, 0x1c / 255, 0x1c / 255];
const FALLBACK_SIZE_EM = 0.8;

function rgb(values, stroke = false) {
  const [r, g, b] = (values || [0, 0, 0]).map(v => Math.max(0, Math.min(1, Number(v) || 0)));
  return `${num(r)} ${num(g)} ${num(b)} ${stroke ? "RG" : "rg"}`;
}

// Glyphs at absolute positions as text objects: one per run of glyphs that
// share a font and a baseline, the gaps between glyphs as TJ adjustments.
// items: [{ pdfFont, code, x, y }] (pt, PDF page space, y = baseline).
function showGlyphs(items, size, ops, { invisible = false, hscale = 100 } = {}) {
  let start = 0;
  while (start < items.length) {
    let end = start + 1;
    while (end < items.length && items[end].pdfFont === items[start].pdfFont && Math.abs(items[end].y - items[start].y) < 1e-6) end += 1;
    const run = items.slice(start, end);
    const font = run[0].pdfFont;
    const scale = hscale / 100;
    const parts = [];
    let pen = run[0].x;
    let codes = "";
    for (const { code, x } of run) {
      const shift = x - pen;
      if (Math.abs(shift) > 1e-4) {
        if (codes) parts.push(`<${codes}>`);
        codes = "";
        parts.push(num(-shift * 1000 / size / scale));
      }
      codes += hex4(code);
      pen = x + font.advance(code) * size / 1000 * scale;
    }
    if (codes) parts.push(`<${codes}>`);
    // Render mode and horizontal scaling belong to the graphics state and
    // outlive ET: keep them inside q / Q so later text is drawn normally.
    const scoped = invisible || hscale !== 100;
    if (scoped) ops.push("q");
    ops.push("BT", `/${font.resource} ${num(size)} Tf`);
    if (invisible) ops.push("3 Tr");
    if (hscale !== 100) ops.push(`${num(hscale)} Tz`);
    ops.push(`1 0 0 1 ${num(run[0].x)} ${num(run[0].y)} Tm`, `[${parts.join(" ")}] TJ`, "ET");
    if (scoped) ops.push("Q");
    start = end;
  }
}

class OverlayPdfWriter {
  constructor(options) {
    if (!options || !options.fonts || !options.fonts.regular) throw new Error("overlayPdf needs fonts.regular (a fontkit font)");
    if (!options.measurers || !options.measurers.regular) throw new Error("overlayPdf needs measurers.regular");
    this.pdf = new PdfFile();
    this.chain = new FontChain({ regular: options.fonts.regular, bold: options.fonts.bold || null }, options.fonts.fallbacks || []);
    this.pdfFonts = new Map(); // fontkit font -> PdfFont
    this.measurers = options.measurers;
    this.painter = new SvgPainter(this.pdf, (text, size) => this.textGlyphs(text, size, false));
    this.stats = { pages: 0, lines: 0, clusters: 0, formulas: 0, fallbackFormulas: 0 };
  }

  pdfFont(font) {
    let pdfFont = this.pdfFonts.get(font);
    if (!pdfFont) {
      pdfFont = new PdfFont(font, `F${this.pdfFonts.size + 1}`);
      this.pdfFonts.set(font, pdfFont);
    }
    return pdfFont;
  }

  // One cluster's glyphs, positioned from (x, y) at `size`; returns its width.
  // mode: the shaping mode of the run it belongs to (shaping.js).
  clusterItems(text, x, y, size, bold, items, mode = "zh") {
    const shaped = this.chain.shape(text, bold, mode);
    const pdfFont = this.pdfFont(shaped.font);
    const unit = size / shaped.font.unitsPerEm;
    let width = 0;
    for (const glyph of shaped.glyphs) {
      items.push({ pdfFont, code: pdfFont.code(glyph.glyph, glyph.codePoints), x: x + glyph.x * unit, y: y + glyph.y * unit });
      width = Math.max(width, (glyph.x + glyph.advance) * unit);
    }
    this.stats.clusters += 1;
    return width;
  }

  // A plain string laid out at its own advances (formula LaTeX, fallback
  // text, SVG <text>): one cluster per character. -> { items, width } with
  // items relative to x = 0, y = 0.
  textGlyphs(text, size, bold) {
    const items = [];
    let pen = 0;
    for (const ch of String(text)) pen += this.clusterItems(ch, pen, 0, size, bold, items);
    return { items, width: pen };
  }

  // A formula box: MathJax outlines plus its LaTeX as invisible text, or the
  // raw LaTeX in red when MathJax failed.
  formula(run, x, baseline, size, color, maths, ops) {
    const tex = String(run.tex || "");
    const source = run.display ? `$$${tex}$$` : `$${tex}$`;
    const entry = maths ? maths.get(tex, false) : { ok: false };
    if (!entry.ok || !entry.svg) {
      this.stats.fallbackFormulas += 1;
      const fallbackSize = size * FALLBACK_SIZE_EM;
      const laid = this.textGlyphs(source, fallbackSize, false);
      const width = Number(run.widthEm) * size;
      const hscale = laid.width > 0 && width > 0 ? Math.min(100, width / laid.width * 100) : 100;
      const items = laid.items.map(item => ({ ...item, x: x + item.x * hscale / 100, y: baseline + item.y }));
      ops.push(rgb(FALLBACK_COLOR));
      showGlyphs(items, fallbackSize, ops, { hscale });
      ops.push(rgb(color));
      return;
    }
    const width = entry.widthEm * size, height = entry.heightEm * size, depth = entry.depthEm * size;
    // PDF space is y-up: the box's lower edge is depth below the baseline.
    this.painter.draw(entry.svg, { x, y: baseline - depth, width, height }, color, ops);
    this.stats.formulas += 1;
    // The LaTeX, invisible, scaled to the box width (at most the box height).
    const at10 = this.textGlyphs(source, 10, false);
    const textSize = at10.width > 0 ? Math.min(10 * width / at10.width, height) : height;
    if (textSize > 0) {
      const laid = this.textGlyphs(source, textSize, false);
      showGlyphs(laid.items.map(item => ({ ...item, x: x + item.x, y: baseline + item.y })), textSize, ops, { invisible: true });
    }
  }

  node(node, paint, pageHeight, maths, ops) {
    const bold = node.fontWeight === "bold";
    const measurer = (bold && this.measurers.bold) || this.measurers.regular;
    const size = Number(node.fontSize);
    const color = paint.text || [0, 0, 0];
    const prepared = (node.paragraphs || []).map(paragraph => measurer.prepare(paragraph.runs));
    // Shaping mode per unit: as prepare() shapes, run by run between formula
    // boxes and forced breaks.
    const modes = prepared.map(p => {
      const out = new Array(p.n);
      let start = 0;
      for (let i = 0; i <= p.n; i++) {
        if (i < p.n && p.text[i] !== OBJECT && p.text[i] !== LINE_SEPARATOR) continue;
        const mode = STRONG_SCRIPT.test(p.text.slice(start, i)) ? "zh" : "dflt";
        for (let k = start; k < i; k++) out[k] = mode;
        start = i + 1;
      }
      return out;
    });
    ops.push(rgb(color), rgb(color, true));
    for (const line of node.lines || []) {
      if (line.toc) continue;
      const p = prepared[line.paragraph];
      if (!p || line.end <= line.start) continue;
      const placed = measurer.placeLine(p, line, {
        fontSize: size,
        target: line.justified ? line.width : undefined,
        justify: Boolean(line.justified)
      });
      if (line.justified && Math.abs(placed.width - line.width) > 0.05) {
        // A justified line that does not end at its width (nothing to stretch,
        // or a hanging final mark): diagnostics only.
        this.stats.justifyMismatches = (this.stats.justifyMismatches || 0) + 1;
        if (!this.stats.justifyExamples) this.stats.justifyExamples = [];
        if (this.stats.justifyExamples.length < 5) {
          this.stats.justifyExamples.push({ node: node.id, text: p.text.slice(line.start, line.end), target: line.width, placed: placed.width });
        }
      }
      const baseline = pageHeight - line.baseline;
      let items = [];
      const flush = () => { showGlyphs(items, size, ops); items = []; };
      for (const glyph of placed.glyphs) {
        const x = line.x + glyph.x;
        const unit = p.text[glyph.index];
        if (unit === OBJECT) {
          flush();
          this.formula(p.boxes.get(glyph.index).run, x, baseline, size, color, maths, ops);
          continue;
        }
        if (unit === LINE_SEPARATOR) continue;
        // The cluster: this glyph start and its zero-advance continuations.
        let end = glyph.index + 1;
        while (end < p.n && !p.glyph[end] && p.text[end] !== OBJECT && p.text[end] !== LINE_SEPARATOR) end += 1;
        this.clusterItems(p.text.slice(glyph.index, end), x, baseline, size, bold, items, modes[line.paragraph][glyph.index]);
      }
      flush();
      this.stats.lines += 1;
    }
  }

  page(page, paint, maths) {
    const ops = [];
    const height = Number(page.height);
    const nodes = (page.nodes || []).filter(node => paint[node.id]);
    let painted = 0;
    // Covers first, then text, so no cover hides another node's overflow.
    for (const node of nodes) {
      const { cover, fill } = paint[node.id];
      if (!cover || !fill || !(cover[2] > cover[0]) || !(cover[3] > cover[1])) continue;
      ops.push(rgb(fill), `${num(cover[0])} ${num(height - cover[3])} ${num(cover[2] - cover[0])} ${num(cover[3] - cover[1])} re`, "f");
    }
    for (const node of nodes) {
      if (!node.lines || !node.lines.length) continue;
      this.node(node, paint[node.id], height, maths, ops);
      painted += 1;
    }
    this.stats.pages += 1;
    return { ops: ops.join("\n"), painted };
  }

  write(result, paint, maths) {
    const pagesRef = this.pdf.reserve();
    const resourcesRef = this.pdf.reserve();
    const kids = [];
    let painted = 0;
    for (const page of result.pages) {
      const drawn = this.page(page, paint, maths);
      painted += drawn.painted;
      const contents = this.pdf.add({}, drawn.ops);
      kids.push(this.pdf.add({
        Type: name("Page"), Parent: pagesRef,
        MediaBox: [0, 0, Number(num(page.width)), Number(num(page.height))],
        Resources: resourcesRef, Contents: contents
      }));
    }
    const fonts = {};
    for (const pdfFont of this.pdfFonts.values()) fonts[pdfFont.resource] = pdfFont.write(this.pdf);
    this.pdf.set(resourcesRef, { Font: fonts, XObject: this.painter.xobjects() });
    this.pdf.set(pagesRef, { Type: name("Pages"), Kids: kids, Count: kids.length });
    const catalog = this.pdf.add({ Type: name("Catalog"), Pages: pagesRef });
    const info = this.pdf.add({ Producer: "retain-pdf-rendering" });
    return {
      pdf: this.pdf.toBuffer(catalog, info),
      painted,
      stats: {
        ...this.stats,
        shaping: this.chain.stats,
        math: this.painter.stats,
        fonts: [...this.pdfFonts.values()].map(f => ({ font: f.font.postscriptName, glyphs: f.stats.glyphs }))
      }
    };
  }
}

function overlayPdf(result, paint, maths, options) {
  return new OverlayPdfWriter(options).write(result, paint, maths);
}

module.exports = { overlayPdf, OverlayPdfWriter, showGlyphs };

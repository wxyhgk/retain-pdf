"use strict";

// retain-pdf-rendering/output/pdf/pdf-font
// Host-agnostic: never reference the host application or plugin globals here.
//
// Node-only. A font embedded as a subset: Type0 / CIDFontType0 (CFF outlines,
// FontFile3 /CIDFontType0C) or CIDFontType2 (TrueType outlines), Identity-H,
// the subset's glyph ids as character codes, a W array with every used
// glyph's advance and a ToUnicode CMap so text extraction / copy / search
// yield the original characters (a ligature maps back to all of them).
//
// Which glyphs to draw is shaping.js; their positions never come from the
// font -- the caller places every glyph where the measured layout put it.

const crypto = require("node:crypto");
const { name } = require("./pdf-file");

class PdfFont {
  // font: a fontkit font; resource: the resource name (e.g. "F1").
  constructor(font, resource) {
    this.font = font;
    this.resource = resource;
    this.subset = font.createSubset();
    this.codes = new Map();     // original glyph id -> subset glyph id
    this.unicode = new Map();   // subset glyph id -> code points
    this.advances = new Map();  // subset glyph id -> advance in 1/1000 em
    this.scale = 1000 / font.unitsPerEm;
    this.stats = { glyphs: 0 };
    this.code(font.getGlyph(0), []); // .notdef stays glyph 0
  }

  // Subset code (2-byte CID) of a glyph; codePoints: what it stands for.
  code(glyph, codePoints = glyph.codePoints || []) {
    let code = this.codes.get(glyph.id);
    if (code === undefined) {
      code = this.subset.includeGlyph(glyph);
      this.codes.set(glyph.id, code);
      this.advances.set(code, glyph.advanceWidth * this.scale);
      this.stats.glyphs += 1;
    }
    if (codePoints.length && !this.unicode.has(code)) this.unicode.set(code, codePoints);
    return code;
  }

  // Advance of a subset glyph in 1/1000 em (what the PDF viewer moves by).
  advance(code) {
    return this.advances.get(code) || 0;
  }

  // Writes the font objects; returns the Type0 font reference.
  write(pdf) {
    const font = this.font;
    const cff = Boolean(font["CFF "] || font.CFF2);
    const data = Buffer.from(this.subset.encode());
    const ids = [...this.advances.keys()].sort((a, b) => a - b);
    const tag = subsetTag(ids.map(id => this.unicode.get(id) || []).flat().join(","));
    const baseName = `${tag}+${String(font.postscriptName || "Font").replace(/[^!-~]|[()<>[\]{}/%]/g, "")}`;
    const fontFile = pdf.add(cff ? { Subtype: name("CIDFontType0C") } : { Length1: data.length }, data);
    const bbox = font.bbox || { minX: 0, minY: 0, maxX: 1000, maxY: 1000 };
    const descriptor = pdf.add({
      Type: name("FontDescriptor"),
      FontName: name(baseName),
      Flags: 4,
      FontBBox: [bbox.minX, bbox.minY, bbox.maxX, bbox.maxY].map(v => Math.round(v * this.scale)),
      ItalicAngle: font.italicAngle || 0,
      Ascent: Math.round((font.ascent || 0) * this.scale),
      Descent: Math.round((font.descent || 0) * this.scale),
      CapHeight: Math.round((font.capHeight || font.ascent || 0) * this.scale),
      StemV: 80,
      [cff ? "FontFile3" : "FontFile2"]: fontFile
    });
    const widths = [];
    for (const id of ids) widths.push(id, [Math.round(this.advance(id) * 1000) / 1000]);
    const descendant = pdf.add({
      Type: name("Font"),
      Subtype: name(cff ? "CIDFontType0" : "CIDFontType2"),
      BaseFont: name(baseName),
      CIDSystemInfo: { Registry: "Adobe", Ordering: "Identity", Supplement: 0 },
      FontDescriptor: descriptor,
      W: widths,
      CIDToGIDMap: cff ? undefined : name("Identity")
    });
    const toUnicode = pdf.add({}, toUnicodeCMap(this.unicode));
    return pdf.add({
      Type: name("Font"),
      Subtype: name("Type0"),
      BaseFont: name(baseName),
      Encoding: name("Identity-H"),
      DescendantFonts: [descendant],
      ToUnicode: toUnicode
    });
  }
}

// Six capital letters naming the subset (PDF 9.6.4).
function subsetTag(seed) {
  const digest = crypto.createHash("sha1").update(seed).digest();
  let tag = "";
  for (let i = 0; i < 6; i++) tag += String.fromCharCode(65 + digest[i] % 26);
  return tag;
}

function hex4(value) {
  return value.toString(16).padStart(4, "0");
}

function utf16Hex(codePoints) {
  return Buffer.from(String.fromCodePoint(...codePoints), "utf16le").swap16().toString("hex");
}

function toUnicodeCMap(unicode) {
  const entries = [...unicode.entries()].filter(([, cps]) => cps && cps.length).sort((a, b) => a[0] - b[0]);
  const lines = [
    "/CIDInit /ProcSet findresource begin",
    "12 dict begin",
    "begincmap",
    "/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def",
    "/CMapName /Adobe-Identity-UCS def",
    "/CMapType 2 def",
    "1 begincodespacerange",
    "<0000> <ffff>",
    "endcodespacerange"
  ];
  for (let i = 0; i < entries.length; i += 100) {
    const block = entries.slice(i, i + 100);
    lines.push(`${block.length} beginbfchar`);
    for (const [code, cps] of block) lines.push(`<${hex4(code)}> <${utf16Hex(cps)}>`);
    lines.push("endbfchar");
  }
  lines.push("endcmap", "CMapName currentdict /CMap defineresource pop", "end", "end");
  return lines.join("\n");
}

module.exports = { PdfFont, toUnicodeCMap, hex4 };

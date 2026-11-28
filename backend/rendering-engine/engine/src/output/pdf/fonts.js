"use strict";

// retain-pdf-rendering/output/pdf/fonts
// Host-agnostic: never reference the host application or plugin globals here.
//
// Node-only. Finds a font family's regular and bold faces in the given
// directories (searched recursively, like Typst's --font-path), by the
// family name the font itself declares.

const fs = require("node:fs");
const path = require("node:path");

const FONT_FILE = /\.(otf|ttf|otc|ttc)$/i;
// The fonts this package ships (data/fonts/README.md), searched after any
// directory the caller gives.
const BUNDLED_FONT_DIRS = [
  path.resolve(__dirname, "../../../data/fonts/source-han-serif"),
  path.resolve(__dirname, "../../../data/fonts/fallback")
];
const withBundled = fontPaths => [...(fontPaths || []), ...BUNDLED_FONT_DIRS.filter(dir => !(fontPaths || []).includes(dir))];
const normalize = value => String(value || "").replace(/[\s_-]+/g, "").toLowerCase();

function fontFiles(dir, out = []) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
  catch { return out; }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) fontFiles(full, out);
    else if (FONT_FILE.test(entry.name)) out.push(full);
  }
  return out;
}

function weightOf(font) {
  const os2 = font["OS/2"];
  if (os2 && Number.isFinite(os2.usWeightClass)) return os2.usWeightClass;
  return /bold/i.test(font.subfamilyName || "") ? 700 : 400;
}

// Static instances of a family's variable font, made for --pdf-font-weight
// (scripts/instance-source-han-serif.py). They carry another family name: the
// OFL reserves "Source" for Adobe's own fonts, so a modified version (an
// instance) may not be called Source Han Serif.
const LIGHT_FAMILIES = { "Source Han Serif SC": "RetainPDF Serif SC" };

// -> { regular, bold } fontkit fonts (bold may be null); throws when the
// family has no regular face in the directories. regularWeight: the weight
// the body text is drawn with (default 400); other than 400 it must be a face
// of exactly that weight -- the family's own, or a static instance of its
// variable font (LIGHT_FAMILIES, e.g. RetainPDFSerifSC-W300) -- never the
// nearest one: the layout was measured with that face's widths.
function findFamily(fontPaths, family, { regularWeight = 400 } = {}) {
  const fontkit = require("fontkit");
  const wanted = normalize(family);
  const light = regularWeight !== 400 && LIGHT_FAMILIES[family] ? normalize(LIGHT_FAMILIES[family]) : null;
  const faces = [];
  const lightFaces = [];
  // Opening a font reads the whole file (Source Han Serif: 23 MB), so only
  // files whose name could be the family are opened.
  const nameLike = file => {
    const base = normalize(path.basename(file));
    return base.startsWith(wanted.slice(0, 8)) || Boolean(light && base.startsWith(light.slice(0, 8)));
  };
  for (const dir of withBundled(fontPaths)) {
    for (const file of fontFiles(dir).filter(nameLike)) {
      let opened;
      try { opened = fontkit.openSync(file); }
      catch { continue; }
      for (const font of opened.fonts || [opened]) {
        if (/italic|oblique/i.test(font.subfamilyName || "")) continue;
        if (normalize(font.familyName) === wanted || normalize(font.postscriptName).startsWith(wanted)) faces.push({ font, weight: weightOf(font), file });
        else if (light && normalize(font.familyName) === light) lightFaces.push({ font, weight: weightOf(font), file });
      }
    }
  }
  const nearest = target => faces.slice().sort((a, b) => Math.abs(a.weight - target) - Math.abs(b.weight - target))[0];
  if (!faces.length) throw new Error(`font family ${JSON.stringify(family)} not found in ${JSON.stringify(withBundled(fontPaths))} (pass --font-path)`);
  const regular = regularWeight === 400 ? nearest(400) : [...faces, ...lightFaces].find(face => face.weight === regularWeight);
  if (!regular) {
    throw new Error(`font family ${JSON.stringify(family)} has no face of weight ${regularWeight} in ${JSON.stringify(withBundled(fontPaths))} (pass --font-path)`);
  }
  const bold = nearest(700);
  return { regular: regular.font, bold: bold && bold.weight >= 600 ? bold.font : null, files: { regular: regular.file, bold: bold && bold.weight >= 600 ? bold.file : null } };
}

// Typst's embedded fonts, upright regular and bold, in fallback priority
// (shaping.js): what Typst falls back to for characters Source Han Serif
// lacks, so the advance tables (data/fonts, fallback) describe these faces.
const FALLBACK_FACES = [
  { postscript: "LibertinusSerif-Regular", weight: 400, mono: false },
  { postscript: "LibertinusSerif-Bold", weight: 700, mono: false },
  { postscript: "NewCM10-Regular", weight: 400, mono: false },
  { postscript: "NewCM10-Bold", weight: 700, mono: false },
  { postscript: "NewCMMath-Regular", weight: 400, mono: false },
  { postscript: "NewCMMath-Bold", weight: 700, mono: false },
  { postscript: "DejaVuSansMono", weight: 400, mono: true },
  { postscript: "DejaVuSansMono-Bold", weight: 700, mono: true }
];

// -> [{ font, weight, mono, file }] for the fallback faces found in the
// directories, in priority order (missing ones are skipped).
function findFallbacks(fontPaths) {
  const fontkit = require("fontkit");
  const byName = new Map();
  for (const dir of withBundled(fontPaths)) {
    for (const file of fontFiles(dir)) {
      if (!/libertinus|newcm|dejavu/i.test(path.basename(file))) continue;
      let opened;
      try { opened = fontkit.openSync(file); }
      catch { continue; }
      for (const font of opened.fonts || [opened]) {
        if (!byName.has(font.postscriptName)) byName.set(font.postscriptName, { font, file });
      }
    }
  }
  return FALLBACK_FACES.filter(face => byName.has(face.postscript))
    .map(face => ({ ...byName.get(face.postscript), weight: face.weight, mono: face.mono }));
}

module.exports = { findFamily, findFallbacks, FALLBACK_FACES, BUNDLED_FONT_DIRS, LIGHT_FAMILIES };

"use strict";

// retain-pdf-rendering/retain/vector-obstacles
// Pure geometry; the drawings themselves are read from the source PDF by the
// host (retain-pdf: render/output/rpr_fit/source_scan.py; experiments:
// experiments/overlay/vector-obstacles.js, PyMuPDF get_drawings).

// Vector graphics of the source page that have no OCR block: rules, frames,
// table lines, coloured panels, logos and glyphs drawn as paths. They stay on
// the base PDF (only text is stripped), so translated text that runs past its
// own box must not cross them.
//
// Semantics (geometry is the drawing's real path, flattened to segments):
// - strokes (rules, frames, table lines, curves)  -> thin strips along every
//                                                    segment; a frame's interior
//                                                    stays free, so text inside
//                                                    it stays inside
// - fills that enclose a repainted text box       -> background panel: strips
//   (coloured abstract panels)                       along its outline only
// - other visible fills (bars, logos, path glyphs) -> obstacle rectangle; small
//                                                    same-coloured fills merged
// - white / transparent fills (masks), fills over half the page -> ignored
// Everything fully inside an OCR obstacle (figure, formula, table) is already
// covered by that obstacle. Whatever lies inside a repainted text box is cut
// away: the cover fill paints over it, so vectors only constrain text that
// leaves its own box.

const BACKGROUND_PAGE_AREA = 0.5;
const THIN = 2.5;
const MIN_EDGE = 0.5;
const MERGE_GAP = 1.5;
const MERGE_MAX_AREA = 600;     // pt^2: logo pieces / path glyphs, not panels
const MAX_STRIP = 6;           // pt: diagonal segments are split this fine
const INVISIBLE = 0.97;        // fill channels at or above: white mask
const CLIP_EPS = 0.01;

const area = r => Math.max(0, r[2] - r[0]) * Math.max(0, r[3] - r[1]);
const contains = (outer, inner, tol = 0) => inner[0] >= outer[0] - tol && inner[1] >= outer[1] - tol && inner[2] <= outer[2] + tol && inner[3] <= outer[3] + tol;
const intersects = (a, b, eps = CLIP_EPS) => Math.min(a[2], b[2]) - Math.max(a[0], b[0]) > eps && Math.min(a[3], b[3]) - Math.max(a[1], b[1]) > eps;

// A degenerate stroke rect (a horizontal / vertical line) widened to the
// stroke width, at least MIN_EDGE on each side (retain-pdf's
// _expand_thin_drawing_rect does the same for its cleanup plans).
function widen(rect, width) {
  const pad = Math.max(width / 2, MIN_EDGE);
  const r = rect.slice();
  if (r[2] - r[0] < 2 * pad) { const cx = (r[0] + r[2]) / 2; r[0] = Math.min(r[0], cx - pad); r[2] = Math.max(r[2], cx + pad); }
  if (r[3] - r[1] < 2 * pad) { const cy = (r[1] + r[3]) / 2; r[1] = Math.min(r[1], cy - pad); r[3] = Math.max(r[3], cy + pad); }
  return r;
}

// rect minus hole: up to four rectangles.
function subtract(rect, hole) {
  if (!intersects(rect, hole)) return [rect];
  const out = [];
  const [x0, y0, x1, y1] = rect;
  const hx0 = Math.max(x0, hole[0]), hy0 = Math.max(y0, hole[1]), hx1 = Math.min(x1, hole[2]), hy1 = Math.min(y1, hole[3]);
  if (hy0 > y0) out.push([x0, y0, x1, hy0]);
  if (hy1 < y1) out.push([x0, hy1, x1, y1]);
  if (hx0 > x0) out.push([x0, hy0, hx0, hy1]);
  if (hx1 < x1) out.push([hx1, hy0, x1, hy1]);
  return out.filter(r => r[2] - r[0] > CLIP_EPS && r[3] - r[1] > CLIP_EPS);
}

function clipRect(rect, clip) {
  const r = [Math.max(rect[0], clip[0]), Math.max(rect[1], clip[1]), Math.min(rect[2], clip[2]), Math.min(rect[3], clip[3])];
  return r[2] - r[0] > CLIP_EPS && r[3] - r[1] > CLIP_EPS ? r : null;
}

const sameColour = (a, b) => a && b && a.length === b.length && a.every((v, i) => Math.abs(v - b[i]) < 0.05);

// Merge small same-coloured fills that touch or nearly touch (logo pieces,
// glyphs drawn as paths). Large fills are never merged.
function mergeFills(fills) {
  const items = fills.map(fill => ({ rect: fill.rect.slice(), colour: fill.colour, small: area(fill.rect) < MERGE_MAX_AREA }));
  let merged = true;
  while (merged) {
    merged = false;
    for (let i = 0; i < items.length && !merged; i++) {
      if (!items[i].small) continue;
      for (let j = i + 1; j < items.length; j++) {
        const a = items[i].rect, b = items[j].rect;
        if (!items[j].small || !sameColour(items[i].colour, items[j].colour)) continue;
        const gapX = Math.max(a[0], b[0]) - Math.min(a[2], b[2]);
        const gapY = Math.max(a[1], b[1]) - Math.min(a[3], b[3]);
        if (gapX <= MERGE_GAP && gapY <= MERGE_GAP) {
          items[i].rect = [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])];
          items[i].small = area(items[i].rect) < MERGE_MAX_AREA;
          items.splice(j, 1);
          merged = true;
          break;
        }
      }
    }
  }
  return items.map(item => item.rect);
}

// Thin strips along a polyline: one axis-aligned rectangle per (sub)segment,
// padded by half the stroke width (at least MIN_EDGE).
function strips(polyline, width) {
  const pad = Math.max(width / 2, MIN_EDGE);
  const out = [];
  for (let k = 1; k < polyline.length; k++) {
    const [x0, y0] = polyline[k - 1];
    const [x1, y1] = polyline[k];
    const length = Math.hypot(x1 - x0, y1 - y0);
    const diagonal = Math.abs(x1 - x0) > 0.5 && Math.abs(y1 - y0) > 0.5;
    const parts = diagonal ? Math.max(1, Math.ceil(length / MAX_STRIP)) : 1;
    for (let p = 0; p < parts; p++) {
      const ax = x0 + (x1 - x0) * p / parts, ay = y0 + (y1 - y0) * p / parts;
      const bx = x0 + (x1 - x0) * (p + 1) / parts, by = y0 + (y1 - y0) * (p + 1) / parts;
      out.push([Math.min(ax, bx) - pad, Math.min(ay, by) - pad, Math.max(ax, bx) + pad, Math.max(ay, by) + pad]);
    }
  }
  return out;
}

const isStraightRule = (polyline, rect) => polyline.length === 2 && (rect[2] - rect[0] < THIN || rect[3] - rect[1] < THIN);
const invisible = (colour, opacity) => opacity === 0 || (Array.isArray(colour) && colour.length && colour.every(v => v >= INVISIBLE));

// page: { width, height, drawings }; textBoxes: repainted boxes (block bbox
// and cover bbox); obstacleBoxes: OCR obstacles already in the model.
function vectorObstacles(page, textBoxes, obstacleBoxes) {
  const pageArea = page.width * page.height;
  const counts = { drawings: page.drawings.length, background: 0, masks: 0, insideObstacle: 0, strokes: 0, panels: 0, fills: 0 };
  const pieces = [];
  const fills = [];
  for (const d of page.drawings) {
    if (d.clip && (d.clip[2] - d.clip[0] <= CLIP_EPS || d.clip[3] - d.clip[1] <= CLIP_EPS)) { counts.clippedAway = (counts.clippedAway || 0) + 1; continue; }
    // A straight rule's rect has zero height (or width): test what the clip
    // keeps of it at its stroke width, as obstacleInkBoxes does; clipping the
    // bare rect dropped every hairline drawn under a clip path (PDFs usually
    // put one page-sized clip around everything).
    const stroked = Boolean(d.stroke) && !invisible(d.stroke);
    const visible = stroked ? widen(d.rect.slice(), Math.max(0.5, Number(d.width) || 1)) : d.rect;
    const rect = d.clip ? clipRect(visible, d.clip) : visible;
    if (!rect) { counts.clippedAway = (counts.clippedAway || 0) + 1; continue; }
    const before = pieces.length;
    const polylines = d.polylines || [];
    if (obstacleBoxes.some(box => contains(box, widen(rect, Number(d.width) || 1), 0.5))) { counts.insideObstacle += 1; continue; }
    if (d.fill) {
      if (area(rect) >= BACKGROUND_PAGE_AREA * pageArea) counts.background += 1;
      else if (invisible(d.fill, d.fillOpacity)) {
        // A white fill painted over earlier drawings hides them (knockout
        // masks behind titles): cut it out of everything drawn before it.
        counts.masks += 1;
        if (d.fillOpacity == null || d.fillOpacity >= 0.99) {
          const occluded = pieces.splice(0).flatMap(piece => subtract(piece.rect, rect).map(r => ({ ...piece, rect: r })));
          pieces.push(...occluded);
          for (let k = fills.length - 1; k >= 0; k--) {
            const rest = subtract(fills[k].rect, rect);
            if (!rest.length) fills.splice(k, 1);
            else if (rest.length === 1) fills[k].rect = rest[0];
          }
        }
      }
      else if (textBoxes.some(box => contains(rect, box, 1))) {
        counts.panels += 1;
        for (const line of polylines) pieces.push(...strips(line, 0.5).map(r => ({ rect: r, kind: "panel-edge" })));
      }
      else {
        counts.fills += 1;
        fills.push({ rect, colour: d.fill });
      }
    }
    if (d.stroke && !invisible(d.stroke)) {
      counts.strokes += 1;
      const width = Math.max(0.5, Number(d.width) || 1);
      for (const line of polylines) {
        const kind = isStraightRule(line, d.rect) ? "rule" : "stroke";
        pieces.push(...strips(line, width).map(r => ({ rect: r, kind })));
      }
    }
    // Only what survives the clip path is visible.
    if (d.clip) {
      const kept = pieces.splice(before).map(piece => ({ ...piece, rect: clipRect(piece.rect, d.clip) })).filter(piece => piece.rect);
      pieces.push(...kept);
    }
  }
  for (const rect of mergeFills(fills)) pieces.push({ rect, kind: "fill" });
  // Cut away what repainted text boxes cover; drop what OCR obstacles cover
  // and what lies off the page.
  let clipped = pieces;
  for (const box of textBoxes) {
    clipped = clipped.flatMap(piece => subtract(piece.rect, box).map(rect => ({ ...piece, rect })));
  }
  const pageRect = [0, 0, page.width, page.height];
  clipped = clipped
    .filter(piece => intersects(piece.rect, pageRect))
    .filter(piece => !obstacleBoxes.some(box => contains(box, piece.rect, 0.5)));
  const seen = new Set();
  const out = [];
  for (const piece of clipped) {
    const key = piece.rect.map(v => v.toFixed(2)).join(",");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ bbox: piece.rect.map(v => Number(v.toFixed(3))), kind: piece.kind });
  }
  return { obstacles: out, counts };
}

// Painted text rects that touch vector obstacles, split by whether the line
// is still inside its own source box (cannot be avoided by the fitter: the
// vector crosses the box itself, which the clip above rules out) or has
// overflowed.
// The ink extent of each OCR obstacle (figure, table, formula, untranslated
// text kept from the source): the union, clipped to the OCR box, of the
// visible drawings, raster images and words inside it. Words inside a
// repainted text box belong to that text, not to the obstacle; page-sized
// images and fills are backgrounds. OCR boxes are only ever tightened; a box
// with no ink found inside keeps its OCR extent. -> [{ bbox, tightened }].
function obstacleInkBoxes(page, obstacleBoxes, textBoxes) {
  const pageArea = page.width * page.height;
  const ink = [];
  for (const d of page.drawings || []) {
    let rect = widen(d.rect.slice(), Number(d.width) || 0);
    if (d.clip) rect = clipRect(rect, d.clip);
    if (!rect || area(rect) > BACKGROUND_PAGE_AREA * pageArea) continue;
    const stroked = Array.isArray(d.stroke) && d.stroke.length && !invisible(d.stroke, 1) && (d.type || "").includes("s");
    const filled = Array.isArray(d.fill) && d.fill.length && !invisible(d.fill, d.fillOpacity);
    if (stroked || filled) ink.push(rect);
  }
  for (const image of page.images || []) {
    if (area(image) > BACKGROUND_PAGE_AREA * pageArea) continue;
    ink.push(image);
  }
  const center = r => [(r[0] + r[2]) / 2, (r[1] + r[3]) / 2];
  const inBox = (point, box) => point[0] >= box[0] && point[0] <= box[2] && point[1] >= box[1] && point[1] <= box[3];
  for (const word of page.words || []) {
    const c = center(word);
    if (textBoxes.some(box => inBox(c, box))) continue;
    ink.push(word);
  }
  return obstacleBoxes.map(box => {
    let union = null;
    for (const rect of ink) {
      const part = clipRect(rect, box);
      if (!part) continue;
      union = union ? [Math.min(union[0], part[0]), Math.min(union[1], part[1]), Math.max(union[2], part[2]), Math.max(union[3], part[3])] : part;
    }
    if (!union) return { bbox: box.slice(), tightened: false };
    const pad = MIN_EDGE;
    const bbox = [Math.max(box[0], union[0] - pad), Math.max(box[1], union[1] - pad), Math.min(box[2], union[2] + pad), Math.min(box[3], union[3] + pad)];
    return { bbox, tightened: area(bbox) < area(box) - 1e-6 };
  });
}

function vectorHits(fitted, vectorsByPage, paint) {
  const hits = [];
  for (const page of fitted.pages) {
    const vectors = vectorsByPage.get(page.index) || [];
    if (!vectors.length) continue;
    for (const node of page.nodes.filter(node => paint[node.id] && node.textRects.length)) {
      const own = node.bbox;
      for (const rect of node.textRects) {
        const r = [rect.left, rect.top, rect.right, rect.bottom];
        for (const vector of vectors) {
          if (!intersects(r, vector.bbox)) continue;
          hits.push({ page: page.index + 1, node: node.label, kind: vector.kind, overflowLine: !contains(own, r, 0.5), vector: vector.bbox });
          break;
        }
      }
    }
  }
  return hits;
}

module.exports = { vectorObstacles, vectorHits, subtract, obstacleInkBoxes };

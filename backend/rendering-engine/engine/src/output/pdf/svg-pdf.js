"use strict";

// retain-pdf-rendering/output/pdf/svg-pdf
// Host-agnostic: never reference the host application or plugin globals here.
//
// Node-only. MathJax SVG (fontCache "none") drawn straight into PDF content:
// every distinct glyph outline is one Form XObject, drawn wherever it is used
// with its placement matrix (the colour comes from the drawing state, so the
// same form serves every text colour); rules are filled rectangles, <line>s
// stroked, and the few characters MathJax's fonts lack (SVG <text>, e.g. Å)
// are set in the document's own font, upright, at the size MathJax gives.
//
// Handled: svg (nested too), g, path (every SVG path command; quadratic
// curves and arcs become cubic Béziers), rect, line, text, with any affine
// transform and fill / stroke colours. Anything else is skipped and counted
// in stats.unsupported, so a corpus run shows what is missing.

const { name, num } = require("./pdf-file");

const IDENTITY = [1, 0, 0, 1, 0, 0];

// [a b c d e f]: x' = a x + c y + e, y' = b x + d y + f.
function multiply(m, n) {
  return [
    m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]
  ];
}

function parseTransform(value) {
  let m = IDENTITY;
  for (const match of String(value || "").matchAll(/([a-zA-Z]+)\s*\(([^)]*)\)/g)) {
    const a = match[2].split(/[\s,]+/).filter(Boolean).map(Number);
    let t;
    switch (match[1]) {
      case "translate": t = [1, 0, 0, 1, a[0] || 0, a[1] || 0]; break;
      case "scale": t = [a[0], 0, 0, a.length > 1 ? a[1] : a[0], 0, 0]; break;
      case "matrix": t = a.length === 6 ? a : IDENTITY; break;
      case "rotate": {
        const r = (a[0] || 0) * Math.PI / 180;
        const [cx, cy] = [a[1] || 0, a[2] || 0];
        t = multiply(multiply([1, 0, 0, 1, cx, cy], [Math.cos(r), Math.sin(r), -Math.sin(r), Math.cos(r), 0, 0]), [1, 0, 0, 1, -cx, -cy]);
        break;
      }
      case "skewX": t = [1, 0, Math.tan((a[0] || 0) * Math.PI / 180), 1, 0, 0]; break;
      case "skewY": t = [1, Math.tan((a[0] || 0) * Math.PI / 180), 0, 1, 0, 0]; break;
      default: t = IDENTITY;
    }
    if (t.every(Number.isFinite)) m = multiply(m, t);
  }
  return m;
}

const NAMED = {
  black: [0, 0, 0], white: [1, 1, 1], red: [1, 0, 0], green: [0, 0.5, 0], blue: [0, 0, 1],
  yellow: [1, 1, 0], cyan: [0, 1, 1], magenta: [1, 0, 1], gray: [0.5, 0.5, 0.5], grey: [0.5, 0.5, 0.5],
  orange: [1, 0.647, 0], purple: [0.5, 0, 0.5], brown: [0.647, 0.165, 0.165]
};

// SVG paint -> [r, g, b] (0..1), "inherit" (currentColor / unset) or "none".
function parsePaint(value) {
  const text = String(value ?? "").trim().toLowerCase();
  if (!text || text === "currentcolor" || text === "inherit") return "inherit";
  if (text === "none" || text === "transparent") return "none";
  let match = /^#([0-9a-f]{3})$/.exec(text);
  if (match) return [...match[1]].map(c => parseInt(c + c, 16) / 255);
  match = /^#([0-9a-f]{6})$/.exec(text);
  if (match) return [0, 2, 4].map(i => parseInt(match[1].slice(i, i + 2), 16) / 255);
  match = /^rgb\(\s*([\d.]+)%?\s*,\s*([\d.]+)%?\s*,\s*([\d.]+)%?\s*\)$/.exec(text);
  if (match) return match.slice(1).map(v => Math.max(0, Math.min(1, Number(v) / (text.includes("%") ? 100 : 255))));
  return NAMED[text] || "inherit";
}

// ----- path data -> PDF path operators (cubic only) -----

function pathOps(d) {
  const tokens = String(d || "").match(/[a-zA-Z]|[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g) || [];
  const ops = [];
  let i = 0, command = "", x = 0, y = 0, sx = 0, sy = 0;
  let lastCubic = null, lastQuad = null;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const box = (px, py) => { x0 = Math.min(x0, px); y0 = Math.min(y0, py); x1 = Math.max(x1, px); y1 = Math.max(y1, py); };
  const isCommand = t => /^[a-zA-Z]$/.test(t);
  const n = () => Number(tokens[i++]);
  const moveTo = (px, py) => { ops.push(`${num(px)} ${num(py)} m`); x = sx = px; y = sy = py; box(px, py); };
  const lineTo = (px, py) => { ops.push(`${num(px)} ${num(py)} l`); x = px; y = py; box(px, py); };
  const cubicTo = (c1x, c1y, c2x, c2y, px, py) => {
    ops.push(`${num(c1x)} ${num(c1y)} ${num(c2x)} ${num(c2y)} ${num(px)} ${num(py)} c`);
    box(c1x, c1y); box(c2x, c2y); box(px, py);
    x = px; y = py;
  };
  const quadTo = (qx, qy, px, py) => {
    cubicTo(x + 2 / 3 * (qx - x), y + 2 / 3 * (qy - y), px + 2 / 3 * (qx - px), py + 2 / 3 * (qy - py), px, py);
  };
  while (i < tokens.length) {
    if (isCommand(tokens[i])) command = tokens[i++];
    else if (!command) return null;
    const rel = command === command.toLowerCase();
    const ox = rel ? x : 0, oy = rel ? y : 0;
    let cubic = null, quad = null;
    switch (command.toUpperCase()) {
      case "M": moveTo(ox + n(), oy + n()); command = rel ? "l" : "L"; break;
      case "L": lineTo(ox + n(), oy + n()); break;
      case "H": lineTo((rel ? x : 0) + n(), y); break;
      case "V": lineTo(x, (rel ? y : 0) + n()); break;
      case "C": {
        const c = [ox + n(), oy + n(), ox + n(), oy + n(), ox + n(), oy + n()];
        cubicTo(...c); cubic = [c[2], c[3]]; break;
      }
      case "S": {
        const r = lastCubic ? [2 * x - lastCubic[0], 2 * y - lastCubic[1]] : [x, y];
        const c = [ox + n(), oy + n(), ox + n(), oy + n()];
        cubicTo(r[0], r[1], ...c); cubic = [c[0], c[1]]; break;
      }
      case "Q": {
        const q = [ox + n(), oy + n()]; const p = [ox + n(), oy + n()];
        quadTo(q[0], q[1], p[0], p[1]); quad = q; break;
      }
      case "T": {
        const q = lastQuad ? [2 * x - lastQuad[0], 2 * y - lastQuad[1]] : [x, y];
        quadTo(q[0], q[1], ox + n(), oy + n()); quad = q; break;
      }
      case "A": {
        const [rx, ry, rot, large, sweep] = [n(), n(), n(), n(), n()];
        const px = ox + n(), py = oy + n();
        for (const c of arcToCubics(x, y, rx, ry, rot, large, sweep, px, py)) cubicTo(...c);
        break;
      }
      case "Z": ops.push("h"); x = sx; y = sy; break;
      default: return null;
    }
    if (i > tokens.length || [x, y].some(v => !Number.isFinite(v))) return null;
    lastCubic = cubic; lastQuad = quad;
  }
  if (!ops.length || !Number.isFinite(x0)) return null;
  return { ops: ops.join("\n"), bbox: [x0, y0, x1, y1] };
}

// SVG elliptical arc (endpoint form) -> cubic Bézier segments.
function arcToCubics(x1, y1, rx, ry, angle, largeArc, sweep, x2, y2) {
  if (!rx || !ry || (x1 === x2 && y1 === y2)) return [[x1, y1, x2, y2, x2, y2]];
  rx = Math.abs(rx); ry = Math.abs(ry);
  const phi = angle * Math.PI / 180, cos = Math.cos(phi), sin = Math.sin(phi);
  const dx = (x1 - x2) / 2, dy = (y1 - y2) / 2;
  const xp = cos * dx + sin * dy, yp = -sin * dx + cos * dy;
  const lambda = (xp * xp) / (rx * rx) + (yp * yp) / (ry * ry);
  if (lambda > 1) { rx *= Math.sqrt(lambda); ry *= Math.sqrt(lambda); }
  const sign = Boolean(largeArc) === Boolean(sweep) ? -1 : 1;
  const num2 = rx * rx * ry * ry - rx * rx * yp * yp - ry * ry * xp * xp;
  const coef = sign * Math.sqrt(Math.max(0, num2 / (rx * rx * yp * yp + ry * ry * xp * xp)));
  const cxp = coef * (rx * yp / ry), cyp = coef * -(ry * xp / rx);
  const cx = cos * cxp - sin * cyp + (x1 + x2) / 2, cy = sin * cxp + cos * cyp + (y1 + y2) / 2;
  const angleOf = (ux, uy, vx, vy) => {
    const a = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
    return a;
  };
  const theta1 = angleOf(1, 0, (xp - cxp) / rx, (yp - cyp) / ry);
  let delta = angleOf((xp - cxp) / rx, (yp - cyp) / ry, (-xp - cxp) / rx, (-yp - cyp) / ry);
  if (!sweep && delta > 0) delta -= 2 * Math.PI;
  if (sweep && delta < 0) delta += 2 * Math.PI;
  const segments = Math.max(1, Math.ceil(Math.abs(delta) / (Math.PI / 2)));
  const step = delta / segments;
  const t = 4 / 3 * Math.tan(step / 4);
  const point = a => [cx + rx * Math.cos(a) * cos - ry * Math.sin(a) * sin, cy + rx * Math.cos(a) * sin + ry * Math.sin(a) * cos];
  const deriv = a => [-rx * Math.sin(a) * cos - ry * Math.cos(a) * sin, -rx * Math.sin(a) * sin + ry * Math.cos(a) * cos];
  const out = [];
  let a = theta1;
  for (let k = 0; k < segments; k++) {
    const b = a + step;
    const [p0x, p0y] = point(a), [p3x, p3y] = point(b);
    const [d0x, d0y] = deriv(a), [d3x, d3y] = deriv(b);
    out.push([p0x + t * d0x, p0y + t * d0y, p3x - t * d3x, p3y - t * d3y, p3x, p3y]);
    a = b;
  }
  return out;
}

// ----- the SVG tree -----

function decodeEntities(text) {
  return String(text)
    .replace(/&#x([0-9a-f]+);/gi, (m, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (m, d) => String.fromCodePoint(Number(d)))
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&apos;/g, "'").replace(/&amp;/g, "&");
}

function attributes(source) {
  const out = {};
  for (const match of String(source).matchAll(/([\w:-]+)\s*=\s*"([^"]*)"/g)) out[match[1]] = decodeEntities(match[2]);
  return out;
}

// -> root element { tag, attrs, children: [element | { text }] }
function parseSVG(svg) {
  const root = { tag: "#root", attrs: {}, children: [] };
  const stack = [root];
  const pattern = /<(\/?)([a-zA-Z][\w:-]*)([^>]*?)(\/?)>|([^<]+)/g;
  for (const match of String(svg).matchAll(pattern)) {
    const [, closing, tag, rest, selfClosing, text] = match;
    const parent = stack[stack.length - 1];
    if (text !== undefined) {
      if (text.trim()) parent.children.push({ text: decodeEntities(text) });
      continue;
    }
    if (closing) {
      if (stack.length > 1 && stack[stack.length - 1].tag === tag) stack.pop();
      continue;
    }
    const element = { tag, attrs: attributes(rest), children: [] };
    parent.children.push(element);
    if (!selfClosing) stack.push(element);
  }
  return root.children.find(child => child.tag === "svg") || null;
}

function numberAttr(attrs, key, fallback = 0) {
  const value = parseFloat(attrs[key]);
  return Number.isFinite(value) ? value : fallback;
}

function viewBoxOf(attrs) {
  const box = String(attrs.viewBox || "").split(/[\s,]+/).map(Number);
  return box.length === 4 && box.every(Number.isFinite) && box[2] > 0 && box[3] > 0 ? box : null;
}

function rgbOp(color, stroke = false) {
  return `${color.map(v => num(Math.max(0, Math.min(1, v)))).join(" ")} ${stroke ? "RG" : "rg"}`;
}

const SKIPPED = new Set(["title", "desc", "metadata", "style"]);

// Draws MathJax SVGs into PDF content. One instance per output document:
// the glyph forms are shared by every page.
class SvgPainter {
  // pdf: PdfFile; textGlyphs(text, size) -> { items: [{ pdfFont, code, x, y }],
  // width }: the document's own text setting, for SVG <text>.
  constructor(pdf, textGlyphs = null) {
    this.pdf = pdf;
    this.textGlyphs = textGlyphs;
    this.forms = new Map(); // path d -> { resource, ref }
    this.stats = { formulas: 0, forms: 0, draws: 0, rects: 0, lines: 0, texts: 0, unsupported: {} };
  }

  formFor(d) {
    let form = this.forms.get(d);
    if (form) return form;
    const path = pathOps(d);
    if (!path) return null;
    const [x0, y0, x1, y1] = path.bbox;
    const resource = `G${this.forms.size + 1}`;
    const ref = this.pdf.add({
      Type: name("XObject"), Subtype: name("Form"),
      BBox: [x0 - 1, y0 - 1, x1 + 1, y1 + 1].map(v => Number(num(v)))
    }, `${path.ops}\nf\n`);
    form = { resource, ref };
    this.forms.set(d, form);
    this.stats.forms += 1;
    return form;
  }

  // Resources every page needs for the forms drawn so far.
  xobjects() {
    const out = {};
    for (const { resource, ref } of this.forms.values()) out[resource] = ref;
    return out;
  }

  // Appends the operators drawing `svg` into the box (PDF user space: x
  // left, y bottom = the box's lower edge) to `ops`. color: [r, g, b] for
  // currentColor. Returns false when the SVG has no root.
  draw(svg, box, color, ops) {
    const root = parseSVG(svg);
    if (!root) return false;
    const viewBox = viewBoxOf(root.attrs);
    if (!viewBox) return false;
    const [vx, vy, vw, vh] = viewBox;
    // viewBox (y down) -> the box (PDF, y up).
    const base = [box.width / vw, 0, 0, -box.height / vh, box.x - vx * box.width / vw, box.y + box.height + vy * box.height / vh];
    this.stats.formulas += 1;
    ops.push("q", `${base.map(num).join(" ")} cm`, rgbOp(color), rgbOp(color, true));
    this.children(root, IDENTITY, { fill: color, stroke: color, strokeWidth: 1 }, ops);
    ops.push("Q");
    return true;
  }

  children(element, matrix, style, ops) {
    for (const child of element.children) {
      if (child.text !== undefined) continue;
      this.element(child, matrix, style, ops);
    }
  }

  element(el, matrix, inherited, ops) {
    const a = el.attrs;
    const style = { ...inherited };
    const fill = parsePaint(a.fill);
    if (fill !== "inherit") style.fill = fill;
    const stroke = parsePaint(a.stroke);
    if (stroke !== "inherit" && a.stroke !== undefined) style.stroke = stroke;
    if (a["stroke-width"] !== undefined) style.strokeWidth = numberAttr(a, "stroke-width", style.strokeWidth);
    let m = a.transform ? multiply(matrix, parseTransform(a.transform)) : matrix;
    switch (el.tag) {
      case "g":
        this.children(el, m, style, ops);
        return;
      case "svg": {
        // Nested viewport: x / y offset, and a viewBox scaled into width x height.
        m = multiply(m, [1, 0, 0, 1, numberAttr(a, "x"), numberAttr(a, "y")]);
        const box = viewBoxOf(a);
        const w = parseFloat(a.width), h = parseFloat(a.height);
        if (box && w > 0 && h > 0) m = multiply(m, [w / box[2], 0, 0, h / box[3], -box[0] * w / box[2], -box[1] * h / box[3]]);
        this.children(el, m, style, ops);
        return;
      }
      case "path": {
        if (!String(a.d || "").trim()) return; // MathJax's spaces / invisible operators
        const filled = style.fill !== "none";
        const stroked = style.stroke !== "none" && a.stroke !== undefined && style.stroke !== undefined;
        if (filled && !stroked) {
          const form = this.formFor(a.d);
          if (!form) { this.unsupported("path data"); return; }
          ops.push("q", `${m.map(num).join(" ")} cm`);
          if (Array.isArray(style.fill)) ops.push(rgbOp(style.fill));
          ops.push(`/${form.resource} Do`, "Q");
          this.stats.draws += 1;
          return;
        }
        const path = pathOps(a.d);
        if (!path) { this.unsupported("path data"); return; }
        ops.push("q", `${m.map(num).join(" ")} cm`);
        if (Array.isArray(style.fill)) ops.push(rgbOp(style.fill));
        if (Array.isArray(style.stroke)) ops.push(rgbOp(style.stroke, true));
        ops.push(`${num(style.strokeWidth)} w`, path.ops, filled ? "B" : "S", "Q");
        this.stats.draws += 1;
        return;
      }
      case "rect": {
        const [x, y, w, h] = ["x", "y", "width", "height"].map(key => numberAttr(a, key));
        if (!(w > 0 && h > 0) || style.fill === "none") return;
        ops.push("q", `${m.map(num).join(" ")} cm`);
        if (Array.isArray(style.fill)) ops.push(rgbOp(style.fill));
        ops.push(`${num(x)} ${num(y)} ${num(w)} ${num(h)} re`, "f", "Q");
        this.stats.rects += 1;
        return;
      }
      case "line": {
        if (style.stroke === "none") return;
        const [x1, y1, x2, y2] = ["x1", "y1", "x2", "y2"].map(key => numberAttr(a, key));
        ops.push("q", `${m.map(num).join(" ")} cm`);
        if (Array.isArray(style.stroke)) ops.push(rgbOp(style.stroke, true));
        ops.push(`${num(style.strokeWidth)} w`, `${num(x1)} ${num(y1)} m ${num(x2)} ${num(y2)} l`, "S", "Q");
        this.stats.lines += 1;
        return;
      }
      case "text":
        this.text(el, m, style, ops);
        return;
      default:
        if (!SKIPPED.has(el.tag)) this.unsupported(el.tag);
    }
  }

  // An SVG <text> (a character MathJax's fonts lack) in the document font.
  // SVG draws glyphs upright in its y-down space; PDF text space is y-up,
  // hence the -size in the text matrix.
  text(el, m, style, ops) {
    const content = el.children.filter(child => child.text !== undefined).map(child => child.text).join("");
    if (!content.trim() || !this.textGlyphs || style.fill === "none") return;
    const size = parseFloat(el.attrs["font-size"]) || 1000;
    const x = numberAttr(el.attrs, "x"), y = numberAttr(el.attrs, "y");
    const anchor = el.attrs["text-anchor"];
    const laid = this.textGlyphs(content, size);
    const dx = anchor === "middle" ? -laid.width / 2 : anchor === "end" ? -laid.width : 0;
    ops.push("q", `${m.map(num).join(" ")} cm`);
    if (Array.isArray(style.fill)) ops.push(rgbOp(style.fill));
    // One text object per glyph (a formula's <text> is a character or two):
    // the -size flips the y-up glyph into the SVG's y-down space.
    for (const item of laid.items) {
      ops.push("BT", `/${item.pdfFont.resource} 1 Tf`, `${num(size)} 0 0 ${num(-size)} ${num(x + dx + item.x)} ${num(y - item.y)} Tm`,
        `<${item.code.toString(16).padStart(4, "0")}> Tj`, "ET");
    }
    ops.push("Q");
    this.stats.texts += 1;
  }

  unsupported(what) {
    this.stats.unsupported[what] = (this.stats.unsupported[what] || 0) + 1;
  }
}

module.exports = { SvgPainter, parseSVG, pathOps, parseTransform, parsePaint, multiply, arcToCubics };

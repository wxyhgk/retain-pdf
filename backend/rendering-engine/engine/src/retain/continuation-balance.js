"use strict";

// retain-pdf-rendering/retain/continuation-balance
//
// One paragraph the source set across two or more boxes (a column or page
// break in the middle): the host translates it as one text and used to cut
// the translation back by source length, preferring sentence ends -- which
// left one box half empty and the next one overflowing. Here the cut is made
// by laying the translation out at each box's own width and size, and the
// cuts fall at line ends found by the line breaker: a formula (one inline box
// to the breaker) is never split, and no part starts with closing punctuation.
// Two modes (params.mode):
//   "flow" (default, user 11-22: 按容量顺流): box after box, each takes up to
//     its capacity (its source line count), the rest flows on -- as threaded
//     text frames do. A translation shorter than its source can leave the
//     later boxes empty. When the rest does not fit the last box, the boxes
//     share the excess instead ("balance"): the last box alone would shrink
//     or overflow (14e352: 16 of 111 groups).
//   "balance": every box gets the same share of its own capacity, so no box
//     is emptied; the rest is left to the fill policy.
//
//   const out = balanceGroup(text, members, { measurer, contentFor, params });
//   // members: [{ width, fontSize, capacity, indent }] in reading order
//   // -> { texts: [...], lines: [...], fills: [...] } or null (cannot balance)
//
// `contentFor(text)` turns text into measurer runs ("$...$" -> formula
// boxes); the pieces are written back as text with the formulas as "$tex$".
// null when the text has a display formula ("$$") or unbalanced dollars (the
// formula boundaries are not known), or ("balance") is too short to give
// every box a line.

const DEFAULTS = Object.freeze({ mode: "flow", step: 0.02, maxFill: 2 });

function runsToText(runs) {
  return runs.map(run => {
    if (run.type === "math") return `$${run.tex}$`;
    if (run.type === "break") return "\n";
    // a literal dollar is "\\$" in the input format (scanMath unescapes it)
    return String(run.text || "").replace(/\$/g, "\\$");
  }).join("");
}

function trimLeadingSpace(runs) {
  const out = runs.slice();
  while (out.length && out[0].type === "text" && !out[0].text.trim()) out.shift();
  if (out.length && out[0].type === "text") out[0] = { ...out[0], text: out[0].text.replace(/^\s+/, "") };
  return out;
}

function unbalancedDollars(text) {
  let count = 0;
  for (let i = 0; i < text.length; i++) if (text[i] === "$" && text[i - 1] !== "\\") count += 1;
  return count % 2 === 1;
}

// Lay the runs out box by box: box i takes at most caps[i] lines; the last
// box takes the rest. -> { pieces: [runs], lines: [count] }
function flow(runs, members, caps, measurer) {
  const pieces = [];
  const lines = [];
  let rest = runs;
  for (let i = 0; i < members.length; i++) {
    const member = members[i];
    if (!rest.length) { pieces.push([]); lines.push(0); continue; }
    const prepared = measurer.prepare(rest);
    const laid = measurer.layout(prepared, {
      fontSize: member.fontSize, width: member.width, align: "justify", lineHeight: 1,
      firstLineIndent: i === 0 ? member.indent || 0 : 0
    });
    const last = i === members.length - 1;
    if (last || laid.lines.length <= caps[i]) {
      pieces.push(rest);
      lines.push(laid.lines.length);
      rest = [];
      continue;
    }
    const cut = laid.lines[caps[i] - 1].end;
    pieces.push(measurer.lineRuns(prepared, 0, cut));
    lines.push(caps[i]);
    rest = trimLeadingSpace(measurer.lineRuns(prepared, cut, prepared.n));
  }
  return { pieces, lines };
}

function balanceGroup(text, members, { measurer, contentFor, params = DEFAULTS } = {}) {
  const source = String(text || "");
  if (members.length < 2 || !source.trim() || source.includes("$$") || unbalancedDollars(source)) return null;
  if (members.some(m => !(m.width > 0) || !(m.fontSize > 0) || !(m.capacity >= 1))) return null;
  const runs = contentFor(source);
  if ((params.mode || DEFAULTS.mode) === "flow") {
    const caps = members.map(m => Math.max(1, Math.round(m.capacity)));
    const { pieces, lines } = flow(runs, members, caps, measurer);
    if (lines[lines.length - 1] <= caps[caps.length - 1]) {
      return {
        texts: pieces.map(piece => runsToText(piece).trim()),
        lines,
        fills: lines.map((count, i) => Math.round(count / members[i].capacity * 1000) / 1000),
        mode: "flow"
      };
    }
  }
  let best = null;
  for (let fill = params.step; fill <= params.maxFill + 1e-9; fill += params.step) {
    const caps = members.map(m => Math.max(1, Math.round(fill * m.capacity)));
    const { pieces, lines } = flow(runs, members, caps, measurer);
    if (pieces.some(piece => !runsToText(piece).trim())) continue;
    const fills = lines.map((count, i) => count / members[i].capacity);
    const worst = Math.max(...fills);
    // The most even split: the smallest largest fill, then the smallest spread.
    const spread = worst - Math.min(...fills);
    if (!best || worst < best.worst - 1e-9 || (Math.abs(worst - best.worst) < 1e-9 && spread < best.spread - 1e-9)) {
      best = { worst, spread, pieces, lines, fills };
    }
  }
  if (!best) return null;
  return {
    texts: best.pieces.map(piece => runsToText(piece).trim()),
    lines: best.lines,
    fills: best.fills.map(value => Math.round(value * 1000) / 1000),
    mode: "balance"
  };
}

module.exports = { DEFAULTS, balanceGroup, runsToText };

"use strict";

// retain-pdf-rendering/retain/list-groups
//
// Two passes over the retain model (job-model.js buildModel), so text that belongs
// together is sized together:
//
// 1. separateSourceSizes: a body paragraph whose source text-layer size is well
//    off the body's (a 9 pt example box in a 10 pt book) leaves the shared body
//    group and is set on its own, where it follows its own source size
//    (fit-model/passes/retain-body.js followSourceSizes). In the body group it
//    was pushed to the body size and then shrunk box by box: 14e352's 139
//    9 pt paragraphs came out at 19 sizes from 7.9 to 11.2 pt.
//
// 2. groupLists: OCR cuts a list into one box per item. Consecutive items on a
//    page (each starting with a list marker, left edges aligned, one under the
//    other, nothing else in between) become one body stream: one box (the
//    union), one paragraph per item, the source's gap between items. One size
//    for the whole list, and a long item can use the room a short one leaves.
//
// Pure: works on the model's plain objects.

const MARKER = /^\s*(?:\(?(?:[a-zA-Z]|[ivxIVX]{1,4}|\d{1,2})[).]|[-•·–▪◦●∙*]|\d{1,2}\.)\s/;
// A source size this far off the body's source size is a different size in the book
// (text-layer sizes of one font differ by rounding).
const SOURCE_SIZE_APART_PT = 0.4;
const SOURCE_SIZE_APART_RATIO = 0.04;
// List items: left edges within max(LEFT_PT, LEFT_EM x font); the gap to the
// next item between GAP_MIN_EM and GAP_MAX_EM x font; columns overlapping by
// half the narrower width.
const LEFT_PT = 6;
const LEFT_EM = 1;
const GAP_MIN_EM = -0.5;
const GAP_MAX_EM = 1.6;
const OVERLAP_MIN = 0.5;
// paragraphs of one source size (text-layer sizes differ by rounding)
const SAME_SIZE_PT = 0.3;
// paragraphGap (em) between merged items: the source's median gap, clamped.
const ITEM_GAP_MIN_EM = 0.16;
const ITEM_GAP_MAX_EM = 1.0;

function median(values, fallback = 0) {
  const sorted = values.filter(value => Number.isFinite(value)).sort((a, b) => a - b);
  if (!sorted.length) return fallback;
  const middle = sorted.length >> 1;
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function sourceSizeApart(size, bodySize) {
  return size > 0 && bodySize > 0 && Math.abs(size - bodySize) > Math.max(SOURCE_SIZE_APART_PT, bodySize * SOURCE_SIZE_APART_RATIO);
}

function union(boxes) {
  return [
    Math.min(...boxes.map(box => box[0])), Math.min(...boxes.map(box => box[1])),
    Math.max(...boxes.map(box => box[2])), Math.max(...boxes.map(box => box[3]))
  ];
}

function overlaps(a, b, tolerance = 0.5) {
  return Math.min(a[2], b[2]) - Math.max(a[0], b[0]) > tolerance && Math.min(a[3], b[3]) - Math.max(a[1], b[1]) > tolerance;
}

// Body streams whose source size is apart from the body's -> { detached } (ids).
// detach(id) moves one out of the body group (job-model detachBody) and returns
// false to keep it (a paragraph continued across boxes).
function separateSourceSizes(model, bodySourceSize, detach) {
  const detached = [];
  if (!(bodySourceSize > 0)) return { detached };
  for (const page of model.pages) {
    for (const stream of page.restoration.streams.slice()) {
      if (stream.styleKind !== "body_text" || !(stream.items || []).length) continue;
      if (!sourceSizeApart(Number(stream.sourceTextSize) || 0, bodySourceSize)) continue;
      if (detach(stream.items[0].id)) detached.push(stream.items[0].id);
    }
  }
  return { detached };
}

// One page: entries = the page's translated text in block order,
// [{ id, flow, bodyLike }] (bodyLike: OCR body text, set as a body stream or,
// too short for the body group, as a text block). paint: the model's paint map
// (covers are merged). options: { bodySourceSize, bodyLineHeight }.
// -> [{ id, members }] groups made. Run before separateSourceSizes.
function groupLists(page, entries, paint, options = {}) {
  const streams = page.restoration.streams;
  const blocks = page.restoration.absoluteBlocks;
  const entityOf = id => {
    const stream = streams.find(candidate => (candidate.items || []).length === 1 && String(candidate.items[0].id) === id);
    if (stream) return { kind: "stream", stream, bbox: stream.bbox, font: Number(stream.fontSize) || 0, item: stream.items[0] };
    const block = blocks.find(candidate => String(candidate.id) === id && candidate.kind === "text" && candidate.type === "text" && !candidate.sourceOnly);
    if (block) {
      return {
        kind: "block", block, bbox: block.bbox, font: Number(block.fontSize) || 0,
        item: { id: block.id, text: block.text, translatedText: block.translatedText, originalLineCount: Number(block.lineCount) || 1, indent: block.indent || 0 }
      };
    }
    return null;
  };
  // Which run an entry can join: "list" (a list item at the body's size) or
  // "size" (a paragraph whose source size is apart from the body's: consecutive
  // ones of one size -- an example box, a list inside it -- become one stream,
  // which separateSourceSizes then sets apart as a whole).
  const candidate = entry => {
    if (!entry.bodyLike || entry.flow) return null;
    const entity = entityOf(String(entry.id));
    if (!entity) return null;
    if (entity.kind === "stream" && entity.stream.styleKind !== "body_text") return null;
    entity.size = Number(entity.kind === "stream" ? entity.stream.sourceTextSize : entity.block.sourceFontSize) || 0;
    if (sourceSizeApart(entity.size, Number(options.bodySourceSize) || 0)) entity.cls = "size";
    else if (MARKER.test(String(entity.item.text || ""))) entity.cls = "list";
    else return null;
    return entity;
  };
  const follows = (prev, next) => {
    if (prev.cls !== next.cls || (next.cls === "size" && Math.abs(prev.size - next.size) > SAME_SIZE_PT)) return false;
    const font = Math.max(prev.font, next.font, 1);
    const gap = next.bbox[1] - prev.bbox[3];
    const overlap = Math.min(prev.bbox[2], next.bbox[2]) - Math.max(prev.bbox[0], next.bbox[0]);
    const narrower = Math.min(prev.bbox[2] - prev.bbox[0], next.bbox[2] - next.bbox[0]);
    return Math.abs(next.bbox[0] - prev.bbox[0]) <= Math.max(LEFT_PT, LEFT_EM * font) &&
      gap >= GAP_MIN_EM * font && gap <= GAP_MAX_EM * font &&
      overlap >= OVERLAP_MIN * narrower;
  };
  // Nothing but the members inside their union (a figure or formula between items).
  const clear = (members, box) => {
    const ids = new Set(members.map(member => String(member.item.id)));
    const others = [
      ...streams.filter(stream => !(stream.items || []).some(item => ids.has(String(item.id)))).map(stream => stream.bbox),
      ...blocks.filter(block => !ids.has(String(block.id)) && !block.cutAway).map(block => block.bbox)
    ];
    return others.every(bbox => !overlaps(bbox, box));
  };

  const runs = [];
  let run = [];
  for (const entry of entries) {
    const entity = candidate(entry);
    if (entity && run.length && follows(run[run.length - 1], entity) && clear([...run, entity], union([...run, entity].map(member => member.bbox)))) {
      run.push(entity);
      continue;
    }
    if (run.length >= 2) runs.push(run);
    run = entity ? [entity] : [];
  }
  if (run.length >= 2) runs.push(run);

  const groups = [];
  for (const members of runs) {
    const first = members[0];
    const bbox = union(members.map(member => member.bbox));
    const font = median(members.map(member => member.font).filter(size => size > 0), first.font);
    const gaps = members.slice(1).map((member, index) => (member.bbox[1] - members[index].bbox[3]) / Math.max(1, font));
    const pitches = members.map(member => Number(member.kind === "stream" ? member.stream.sourceLinePitch : member.block.sourceLinePitch) || 0).filter(value => value > 0);
    const sizes = members.map(member => Number(member.kind === "stream" ? member.stream.sourceTextSize : member.block.sourceFontSize) || 0).filter(value => value > 0);
    const stream = {
      pageIndex: page.index,
      bbox,
      fontSize: font,
      lineHeight: first.kind === "stream" ? first.stream.lineHeight : (options.bodyLineHeight ?? 1.25),
      paragraphGap: Math.min(ITEM_GAP_MAX_EM, Math.max(ITEM_GAP_MIN_EM, median(gaps, ITEM_GAP_MIN_EM))),
      styleKind: "body_text",
      debugRole: "body_candidate",
      columnKey: first.kind === "stream" ? first.stream.columnKey : "",
      listGroup: members.length,
      groupKind: first.cls,
      items: members.map(member => member.item)
    };
    if (pitches.length) stream.sourceLinePitch = median(pitches);
    if (sizes.length) stream.sourceTextSize = median(sizes);
    // Replace the first member, drop the others.
    const memberIds = new Set(members.map(member => String(member.item.id)));
    const at = first.kind === "stream" ? streams.indexOf(first.stream) : streams.length;
    for (let i = streams.length - 1; i >= 0; i--) if ((streams[i].items || []).some(item => memberIds.has(String(item.id)))) streams.splice(i, 1);
    for (let i = blocks.length - 1; i >= 0; i--) if (memberIds.has(String(blocks[i].id))) blocks.splice(i, 1);
    streams.splice(Math.min(at, streams.length), 0, stream);
    // One cover over all the items (their source text is erased together).
    const covers = members.map(member => paint[member.item.id] && paint[member.item.id].cover).filter(Array.isArray);
    const id = String(first.item.id);
    if (paint[id] && covers.length) paint[id] = { ...paint[id], cover: union(covers) };
    for (const member of members.slice(1)) delete paint[member.item.id];
    groups.push({ id, members: members.map(member => String(member.item.id)) });
  }
  return groups;
}

module.exports = { MARKER, separateSourceSizes, groupLists, sourceSizeApart };

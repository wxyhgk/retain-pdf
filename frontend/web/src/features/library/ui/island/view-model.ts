// 库检索岛的纯逻辑层:不碰 DOM/React,便于 node 单测

// 后端 snippet 用 [ ] 包裹命中词,拆成分段供展示层渲染 <mark>
export function highlightSegments(snippet = "") {
  const text = `${snippet || ""}`;
  const segments = [];
  const pattern = /\[([^\][]+)\]/g;
  let cursor = 0;
  let match = pattern.exec(text);
  while (match) {
    if (match.index > cursor) {
      segments.push({ text: text.slice(cursor, match.index), hit: false });
    }
    segments.push({ text: match[1], hit: true });
    cursor = match.index + match[0].length;
    match = pattern.exec(text);
  }
  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor), hit: false });
  }
  return segments;
}

export const READING_STATUS_META = Object.freeze({
  unread: { label: "未读", order: 0 },
  reading: { label: "在读", order: 1 },
  done: { label: "读完", order: 2 },
});

const READING_STATUS_CYCLE = ["unread", "reading", "done"];

export function nextReadingStatus(status) {
  const index = READING_STATUS_CYCLE.indexOf(`${status || ""}`.trim());
  return READING_STATUS_CYCLE[(index + 1) % READING_STATUS_CYCLE.length];
}

export function filterDocuments(documents = [], { query = "", readingStatus = "" } = {}) {
  const normalizedQuery = `${query || ""}`.trim().toLowerCase();
  const normalizedStatus = `${readingStatus || ""}`.trim();
  return (Array.isArray(documents) ? documents : []).filter((doc) => {
    if (normalizedStatus && doc.reading_status !== normalizedStatus) {
      return false;
    }
    if (!normalizedQuery) {
      return true;
    }
    const haystack = [
      doc.title,
      doc.source_filename,
      ...(Array.isArray(doc.tags) ? doc.tags : []),
    ].join("\n").toLowerCase();
    return haystack.includes(normalizedQuery);
  });
}

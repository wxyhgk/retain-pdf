const t = /^p0*(\d+)-b0*(\d+)$/i;
function n(r) {
  const e = t.exec(`${r || ""}`.trim());
  return e ? `p${Number(e[1])}-b${Number(e[2])}` : `${r || ""}`.trim();
}
export {
  n
};
//# sourceMappingURL=block-key-BTxcG28S.js.map

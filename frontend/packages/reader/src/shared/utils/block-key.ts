// 从 src/js/reader/region-interactions.ts 抽离的纯函数，供 anchor-block-key 等共享
const BLOCK_KEY_RE = /^p0*(\d+)-b0*(\d+)$/i;
export function normalizeBlockKey(blockId: string | null | undefined): string {
  const match = BLOCK_KEY_RE.exec(`${blockId || ""}`.trim());
  return match ? `p${Number(match[1])}-b${Number(match[2])}` : `${blockId || ""}`.trim();
}

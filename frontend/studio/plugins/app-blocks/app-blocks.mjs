/**
 * The blocks the author's apps give the articles (apps/<id>/app.json's `blocks`: docs/apps-design.md): a fence of their
 * own (```structura), its state the fence's body. In the Studio an app's page shows and changes it; on the blog it is the
 * picture the page kept for it, in the article's assets/, named by what the block holds (so a block changed has another
 * picture, and one the same has the same).
 */

/** A short name for a block's state (FNV-1a), its picture's. */
export function stateHash(state) {
	const text = String(state ?? '').trim();
	let hash = 0x811c9dc5;
	for (let index = 0; index < text.length; index += 1) hash = Math.imul(hash ^ text.charCodeAt(index), 0x01000193);
	return (hash >>> 0).toString(36);
}

/** Where a block's picture is kept in its article: `assets/<fence>-<hash>.svg` (or `.png`). */
export function picturePath(fence, state, type = 'image/svg+xml') {
	return `assets/${fence}-${stateHash(state)}.${type === 'image/png' ? 'png' : 'svg'}`;
}

/** The pictures a block may have, the SVG first. */
export function picturePaths(fence, state) {
	return [picturePath(fence, state, 'image/svg+xml'), picturePath(fence, state, 'image/png')];
}

/** The height a block asks for in its info string (`height=420`), or `fallback`. */
export function blockHeight(meta, fallback) {
	const asked = Number(/(?:^|\s)height=(\d+)/u.exec(String(meta ?? ''))?.[1]);
	return Number.isFinite(asked) && asked > 0 ? Math.max(120, Math.min(1600, asked)) : fallback;
}

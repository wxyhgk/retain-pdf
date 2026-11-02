/**
 * The key a saved 3D view is stored under in `article.views.json`: a hash of
 * the format and what identifies the molecule, its source text or, for an
 * `@file` block, the path as written. The browser saves views under it and
 * the Studio server moves them when a file is renamed, so both use this one.
 * @param {string} format
 * @param {string} identity
 * @returns {string}
 */
export function moleculeViewKey(format, identity) {
	const value = `${format}\0${identity}`;
	let hash = 0x811c9dc5;
	for (let index = 0; index < value.length; index += 1) {
		hash ^= value.charCodeAt(index);
		hash = Math.imul(hash, 0x01000193);
	}
	return (hash >>> 0).toString(36);
}

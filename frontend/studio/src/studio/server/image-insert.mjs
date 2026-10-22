/**
 * Markdown put right under a picture of an article (what was read from it, 识别): after the paragraph
 * the picture is in, a blank line either side. `src` is the picture's address as the article writes
 * it (`./img/a.png`; `img/a.png` is the same picture). The first place it is shown is the one.
 * @returns {string | null} the new source, or null when the picture is not in it
 */
export function insertBelowImage(source, src, markdown) {
	const bare = src.replace(/^\.\//u, '');
	const addresses = [...new Set([src, bare, `./${bare}`])];
	const lines = source.split('\n');
	const shows = (line) => addresses.some((address) => line.includes(`](${address})`) || line.includes(`](${address} `) || line.includes(`src="${address}"`));
	const at = lines.findIndex(shows);
	if (at < 0) return null;
	let end = at + 1;
	while (end < lines.length && lines[end].trim() !== '') end += 1;
	const before = lines.slice(0, end);
	const after = lines.slice(end);
	while (after.length && after[0].trim() === '') after.shift();
	const block = markdown.replace(/^\s*\n|\s*$/gu, '');
	return [...before, '', block, ...(after.length ? ['', ...after] : [''])].join('\n');
}

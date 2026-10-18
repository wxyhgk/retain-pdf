/**
 * Pictures as figures, the same on the blog and in the Studio: an image
 * alone in its paragraph is a figure; its alt text is the caption, numbered
 * 图 1, 图 2…; `{width=60%}` right after it sets its width (Pandoc's way).
 */

/** `{…}` right after an image: its attributes, as written. */
const ATTRIBUTES = /^\{([^{}\n]*)\}/;

const WIDTH = /(^|\s)width\s*=\s*("[^"]*"|'[^']*'|[^\s"']+)/;

/** Alt texts that only say "a picture", as exports and uploads write them. */
const GENERIC_ALT = /^(?:image|img|picture|photo|图片|图像)$/i;

/**
 * The attribute block at the start of `text` (`{width=60%} …`): what it holds,
 * and how long it is. Null when `text` does not start with one.
 */
export function leadingAttributes(text) {
	const match = ATTRIBUTES.exec(text);
	return match ? { attributes: match[1].trim(), length: match[0].length } : null;
}

/** The attributes when `text` is nothing but an attribute block (spaces aside). */
export function onlyAttributes(text) {
	const found = leadingAttributes(text.trimStart());
	return found && !text.trimStart().slice(found.length).trim() ? found.attributes : null;
}

/**
 * The image a paragraph holds alone (blank text aside), and the attributes
 * written after it: such a paragraph is a figure. Null otherwise.
 */
export function standaloneImage(paragraph) {
	const children = (paragraph.children ?? []).filter((child, index, all) => {
		const edge = index === 0 || index === all.length - 1;
		return !(edge && child.type === 'text' && !child.value.trim());
	});
	const [image, after] = children;
	if (image?.type !== 'image' || children.length > 2) return null;
	if (!after) return { image, attributes: '' };
	const attributes = after.type === 'text' ? onlyAttributes(after.value) : null;
	return attributes === null ? null : { image, attributes };
}

/** `width=60%` → `60%`, `width=300` → `300px`; null when missing or not a length. */
export function figureWidth(attributes) {
	const value = WIDTH.exec(attributes ?? '')?.[2].replace(/^["']|["']$/g, '');
	if (!value) return null;
	if (/^\d+(?:\.\d+)?$/.test(value)) return `${value}px`;
	return /^\d+(?:\.\d+)?(?:%|px|em|rem)$/.test(value) ? value : null;
}

/** The attributes with this width (`60%`), or without one (null); the rest kept as written. */
export function withWidth(attributes, width) {
	const rest = (attributes ?? '').replace(WIDTH, '$1').replace(/\s+/g, ' ').trim();
	return width ? [`width=${width}`, rest].filter(Boolean).join(' ') : rest;
}

function fileName(src) {
	const path = String(src ?? '').split(/[?#]/)[0];
	let name = path.slice(path.lastIndexOf('/') + 1);
	try {
		name = decodeURIComponent(name);
	} catch {
		// Kept as written.
	}
	return name;
}

/**
 * The caption of a figure: its alt text, unless that only names the file
 * or says "image", as uploads and exports write it.
 */
export function figureCaption(alt, src) {
	const caption = String(alt ?? '').trim();
	if (!caption || GENERIC_ALT.test(caption)) return '';
	const name = fileName(src);
	if (caption === name || caption === name.replace(/\.[^.]+$/, '')) return '';
	return caption;
}

/** What a figure's number says. */
export function figureLabel(number) {
	return `图 ${number}`;
}

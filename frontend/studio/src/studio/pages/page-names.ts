import { pinyin } from 'pinyin-pro';

// Folder names of pages, which the author never has to think of (as in Notion): a new page gets one made
// up from the moment it is made; when it is published, one read from its title, its address on the blog.

/** The name a new page's folder gets: `note-YYYYMMDD-HHMMSS`. */
export function autoSlug(now = new Date()): string {
	const two = (value: number) => String(value).padStart(2, '0');
	const date = `${now.getFullYear()}${two(now.getMonth() + 1)}${two(now.getDate())}`;
	return `note-${date}-${two(now.getHours())}${two(now.getMinutes())}${two(now.getSeconds())}`;
}

/** Whether a folder name is one made up so (autoSlug, or the minute-long one of before), maybe numbered to be free. */
export function isAutoSlug(slug: string): boolean {
	return /^note-\d{8}-\d{4}(?:\d{2})?(?:-\d+)?$/u.test(slug);
}

/**
 * A folder name read from a title: its words in lowercase ASCII, Chinese in
 * pinyin (`基组的选择` → `ji-zu-de-xuan-ze`), at most about 60 letters; empty
 * when nothing of it reads so (an emoji).
 */
export function readableSlug(title: string): string {
	const syllables = pinyin(title, { toneType: 'none', type: 'array', nonZh: 'consecutive' }) as string[];
	const slug = syllables
		.join('-')
		.normalize('NFKD')
		.toLowerCase()
		.replace(/[^a-z0-9]+/gu, '-')
		.replace(/^-+|-+$/gu, '');
	if (slug.length <= 60) return slug;
	return slug.slice(0, 61).replace(/-[^-]*$/u, '');
}

/** A free folder name near `wanted`: `note-copy`, `note-copy-2`, … */
export function freeSlug(wanted: string, taken: Iterable<string>): string {
	const names = new Set(taken);
	if (!names.has(wanted)) return wanted;
	let number = 2;
	while (names.has(`${wanted}-${number}`)) number += 1;
	return `${wanted}-${number}`;
}

/** What is left of a typed folder name: lowercase letters, digits and hyphens. */
export function cleanSlug(typed: string): string {
	return typed.toLowerCase().replace(/[^a-z0-9-]/gu, '');
}

import { comparePages } from './page-order.mjs';

/**
 * Where a page is in the tree of pages (`parent:`): the pages above it, the
 * nearest last, and those right under it, in their order (page-order.mjs). Of `entries` only (the
 * blog gives it the published ones): a page above that is not among them, a
 * draft, ends the line there; a loop is cut.
 *
 * @template {{ id: string, data: { title: string, parent?: string, order?: number } }} Entry
 * @param {Entry[]} entries
 * @param {Entry} current
 * @returns {{ ancestors: Entry[], children: Entry[] }}
 */
export function pageFamily(entries, current) {
	const byId = new Map(entries.map((entry) => [entry.id, entry]));
	const ancestors = [];
	const seen = new Set([current.id]);
	for (let at = current.data.parent ? byId.get(current.data.parent) : undefined; at && !seen.has(at.id); at = at.data.parent ? byId.get(at.data.parent) : undefined) {
		seen.add(at.id);
		ancestors.unshift(at);
	}
	const children = entries
		.filter((entry) => entry.data.parent === current.id && entry.id !== current.id)
		.sort((left, right) => comparePages(left.data, right.data));
	return { ancestors, children };
}

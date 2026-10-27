import type { Node as ProseNode } from '@milkdown/prose/model';

/**
 * Where an edit changed a document: from `from` to `toBefore` in the
 * document before it, to `toAfter` in the one after; null when nothing
 * changed. Plugins that look the document over at each edit look only
 * here: in a long article, the rest is thousands of blocks no edit touched.
 */
export type ChangedRange = { from: number; toBefore: number; toAfter: number };

export function changedRange(before: ProseNode, after: ProseNode): ChangedRange | null {
	const from = before.content.findDiffStart(after.content);
	if (from === null || from === undefined) return null;
	let { a: toBefore, b: toAfter } = before.content.findDiffEnd(after.content) ?? { a: before.content.size, b: after.content.size };
	// The same text on both sides of the change (a letter typed beside the same letter): the ends found
	// from the back fall before the start found from the front; they are moved past it.
	const overlap = from - Math.min(toBefore, toAfter);
	if (overlap > 0) {
		toBefore += overlap;
		toAfter += overlap;
	}
	return { from, toBefore, toAfter };
}

/** Whether a node in `doc` between `from` and `to` (or one holding that stretch) is one `test` looks for. */
export function touches(doc: ProseNode, from: number, to: number, test: (node: ProseNode) => boolean): boolean {
	let found = false;
	doc.nodesBetween(from, Math.min(to, doc.content.size), (node) => {
		if (found) return false;
		if (test(node)) found = true;
		return !found;
	});
	return found;
}

/** Whether an edit from `before` to `after` changed, made or took away a node `test` looks for. */
export function editTouches(before: ProseNode, after: ProseNode, test: (node: ProseNode) => boolean): boolean {
	const range = changedRange(before, after);
	if (!range) return false;
	return touches(before, range.from, range.toBefore, test) || touches(after, range.from, range.toAfter, test);
}

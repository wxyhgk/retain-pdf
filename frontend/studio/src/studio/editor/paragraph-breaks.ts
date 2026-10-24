import type { Node as ProseNode } from '@milkdown/prose/model';
import { Plugin, type EditorState, type Transaction } from '@milkdown/prose/state';
import { canSplit } from '@milkdown/prose/transform';
import type { EditorView } from '@milkdown/prose/view';
import { $prose } from '@milkdown/utils';

import { changedRange } from './changed-range.ts';

/** Where to look: the whole document, or (after an edit) the stretch it changed. */
type Stretch = { from: number; to: number } | null;

function eachNode(doc: ProseNode, stretch: Stretch, visit: (node: ProseNode, pos: number) => boolean | void): void {
	if (stretch) doc.nodesBetween(stretch.from, Math.min(stretch.to, doc.content.size), visit);
	else doc.descendants(visit);
}

function isSoftBreak(node: ProseNode): boolean {
	return node.type.name === 'hardbreak' && node.attrs.isInline === true;
}

/** A newline stored inside a paragraph becomes a space after save. Turn it into its own paragraph. */
function expandNewlineText(tr: Transaction, stretch: Stretch): Transaction {
	const hardbreak = tr.doc.type.schema.nodes.hardbreak;
	if (!hardbreak) return tr;
	const hits: { pos: number; node: ProseNode }[] = [];
	eachNode(tr.doc, stretch, (node, pos) => {
		if (node.type.spec.code) return false;
		if (!node.isText || !node.text?.includes('\n')) return;
		const parent = tr.doc.resolve(pos).parent;
		if (parent.type.name !== 'paragraph') return;
		hits.push({ pos, node });
	});
	for (const hit of hits.reverse()) {
		const from = tr.mapping.map(hit.pos);
		const chunks = hit.node.text!.split('\n');
		const parts: ProseNode[] = [];
		chunks.forEach((chunk, index) => {
			if (chunk) parts.push(tr.doc.type.schema.text(chunk, hit.node.marks));
			if (index < chunks.length - 1) parts.push(hardbreak.create({ isInline: true }));
		});
		if (parts.length) tr = tr.replaceWith(from, from + hit.node.nodeSize, parts);
	}
	return tr;
}

function splitInlineBreaks(tr: Transaction, stretch: Stretch): Transaction {
	const positions: number[] = [];
	// What the newlines made of the stretch, if any: it is that much longer now.
	const looked = stretch && { from: stretch.from, to: tr.mapping.map(stretch.to) };
	eachNode(tr.doc, looked, (node, pos) => {
		if (node.type.spec.code) return false;
		if (!isSoftBreak(node)) return;
		if (tr.doc.resolve(pos).parent.type.name !== 'paragraph') return;
		positions.push(pos);
	});
	const mapFrom = tr.steps.length;
	for (const pos of positions.reverse()) {
		const mapped = tr.mapping.slice(mapFrom).map(pos);
		const current = tr.doc.nodeAt(mapped);
		if (!current || !isSoftBreak(current)) continue;
		const $pos = tr.doc.resolve(mapped);
		const atEdge = $pos.parentOffset === 0 || $pos.parentOffset + current.nodeSize === $pos.parent.content.size;
		if (atEdge) {
			tr = tr.delete(mapped, mapped + current.nodeSize);
			continue;
		}
		const after = mapped + current.nodeSize;
		if ($pos.parent.type.name === 'paragraph' && canSplit(tr.doc, after)) {
			tr = tr.split(after).delete(mapped, mapped + current.nodeSize);
			continue;
		}
		tr = tr.setNodeMarkup(mapped, undefined, { ...current.attrs, isInline: false });
	}
	return tr;
}

/**
 * Returns a transaction that lifts soft breaks out of paragraphs, or null when the document is unchanged. Only
 * between `from` and `to` when given (what an edit changed); the whole document otherwise.
 */
export function softBreakTransaction(state: EditorState, stretch: Stretch = null): Transaction | null {
	let tr = expandNewlineText(state.tr, stretch);
	tr = splitInlineBreaks(tr, stretch);
	return tr.docChanged ? tr : null;
}

/** The stretch of `after` an edit from `before` changed; null for none. */
function edited(before: ProseNode, after: ProseNode): { from: number; to: number } | null {
	const range = changedRange(before, after);
	return range && { from: range.from, to: range.toAfter };
}

export const paragraphBreakPlugin = $prose(
	() => {
		let applying = false;
		/** The document as last looked over: the next look is at what changed since. */
		let looked: ProseNode | null = null;
		const normalize = (view: EditorView) => {
			if (applying || view.isDestroyed || view.composing) return;
			const before = looked;
			looked = view.state.doc;
			if (before === view.state.doc) return;
			const stretch = before ? edited(before, view.state.doc) : null;
			if (before && !stretch) return;
			const extra = softBreakTransaction(view.state, stretch);
			if (!extra) return;
			applying = true;
			view.dispatch(extra);
			applying = false;
		};
		return new Plugin({
			appendTransaction(transactions, oldState, newState) {
				if (applying || !transactions.some((transaction) => transaction.docChanged)) return null;
				if (transactions.some((transaction) => transaction.getMeta('composition'))) return null;
				const stretch = edited(oldState.doc, newState.doc);
				return stretch && softBreakTransaction(newState, stretch);
			},
			view(editorView) {
				queueMicrotask(() => normalize(editorView));
				return { update: (view) => normalize(view) };
			},
		});
	},
);

import type { Node as ProseNode } from '@milkdown/prose/model';
import { Plugin, type EditorState, type Transaction } from '@milkdown/prose/state';
import { canSplit } from '@milkdown/prose/transform';
import type { EditorView } from '@milkdown/prose/view';
import { $prose } from '@milkdown/utils';

function isSoftBreak(node: ProseNode): boolean {
	return node.type.name === 'hardbreak' && node.attrs.isInline === true;
}

/** A newline stored inside a paragraph becomes a space after save. Turn it into its own paragraph. */
function expandNewlineText(tr: Transaction): Transaction {
	const hardbreak = tr.doc.type.schema.nodes.hardbreak;
	if (!hardbreak) return tr;
	const hits: { pos: number; node: ProseNode }[] = [];
	tr.doc.descendants((node, pos) => {
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

function splitInlineBreaks(tr: Transaction): Transaction {
	const positions: number[] = [];
	tr.doc.descendants((node, pos) => {
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

/** Returns a transaction that lifts soft breaks out of paragraphs, or null when the document is unchanged. */
export function softBreakTransaction(state: EditorState): Transaction | null {
	let tr = expandNewlineText(state.tr);
	tr = splitInlineBreaks(tr);
	return tr.docChanged ? tr : null;
}

export const paragraphBreakPlugin = $prose(
	() => {
		let applying = false;
		const normalize = (view: EditorView) => {
			if (applying || view.isDestroyed || view.composing) return;
			const extra = softBreakTransaction(view.state);
			if (!extra) return;
			applying = true;
			view.dispatch(extra);
			applying = false;
		};
		return new Plugin({
			appendTransaction(transactions, _oldState, newState) {
				if (applying || !transactions.some((transaction) => transaction.docChanged)) return null;
				if (transactions.some((transaction) => transaction.getMeta('composition'))) return null;
				return softBreakTransaction(newState);
			},
			view(editorView) {
				queueMicrotask(() => normalize(editorView));
				return { update: (view) => normalize(view) };
			},
		});
	},
);

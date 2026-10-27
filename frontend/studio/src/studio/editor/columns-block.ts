import type { MilkdownPlugin } from '@milkdown/ctx';
import type { Fragment, Node as ProseNode, ResolvedPos, Slice } from '@milkdown/prose/model';
import { Plugin, PluginKey, Selection, TextSelection, type EditorState, type Transaction } from '@milkdown/prose/state';
import type { EditorView, NodeView, ViewMutationRecord } from '@milkdown/prose/view';
import { $nodeSchema, $prose, $remark, $view } from '@milkdown/utils';
import { t } from '@blog/i18n/index.mjs';

/**
 * Columns, as Notion has them, written as HTML around Markdown (as toggles
 * are), which the blog draws side by side and other places one after another:
 *
 *     <div class="columns">
 *     <div>
 *
 *     左栏……
 *
 *     </div>
 *     <div>
 *
 *     右栏……
 *
 *     </div>
 *     </div>
 *
 * A column made wider or narrower says how much, as a share (one each when
 * they are equal), in a style the blog's flexbox takes as it is:
 * `<div style="flex: 1.5">`.
 *
 * In the editor: `columns` holds two or more `column`s, each holding blocks,
 * and their shares (`widths`, null when equal). A block dropped on the left or
 * right edge of another goes beside it: two columns, or one more column where
 * there are columns already. The gap between two columns is dragged to share
 * their width otherwise; ＋ at the right adds a column. A column left with
 * nothing in it (its blocks dragged away, or ⌫ at its start) goes; with one
 * column left, its blocks are put back in the article.
 */

export const COLUMNS_TYPE = 'columns';
export const COLUMN_TYPE = 'column';

type MdastNode = { type: string; value?: string; width?: number | null; widths?: number[] | null; children?: MdastNode[] };
type RemarkPlugin = ReturnType<Parameters<typeof $remark>[1]>;
type MarkdownState = { containerFlow(node: unknown, info: unknown): string };
type Tag = { kind: 'columns' | 'end' } | { kind: 'column'; width: number | null };

/** The HTML a block is: an `html` node, or a paragraph holding only one (Milkdown wraps HTML in a paragraph). */
function htmlOf(node: MdastNode): string | null {
	if (node.type === 'html') return node.value ?? '';
	if (node.type === 'paragraph' && node.children?.length === 1 && node.children[0].type === 'html') return node.children[0].value ?? '';
	return null;
}

/** The tags of a block that is only `<div class="columns">`, `<div>` (or `<div style="flex: 2">`) and `</div>` lines (several share a block when no blank line parts them); null for any other. */
export function columnTags(node: MdastNode): Tag[] | null {
	const html = htmlOf(node);
	if (html === null) return null;
	const tags: Tag[] = [];
	for (const line of html.split('\n')) {
		const text = line.trim();
		if (!text) continue;
		const share = /^<div\s+style=(["'])\s*flex:\s*(\d+(?:\.\d+)?)\s*;?\s*\1\s*>$/iu.exec(text);
		if (/^<div\s+class=(["'])columns\1\s*>$/iu.test(text)) tags.push({ kind: 'columns' });
		else if (/^<div\s*>$/iu.test(text)) tags.push({ kind: 'column', width: null });
		else if (share && Number(share[2]) > 0) tags.push({ kind: 'column', width: Number(share[2]) });
		else if (/^<\/div\s*>$/iu.test(text)) tags.push({ kind: 'end' });
		else return null;
	}
	return tags.length ? tags : null;
}

/**
 * The blocks from `<div class="columns">` to its last `</div>`, made one
 * `columns` with a `column` for each `<div>…</div>` in it; inner ones too.
 * What does not close as it opened is left as the HTML it is.
 */
export function groupColumns(node: MdastNode): void {
	const children = node.children;
	if (!children) return;
	for (let index = 0; index < children.length; index += 1) {
		const first = columnTags(children[index]);
		if (first?.[0]!.kind !== 'columns') continue;
		const grouped = readColumns(children, index);
		if (!grouped) continue;
		children.splice(index, grouped.end - index + 1, grouped.node);
	}
	children.forEach(groupColumns);
}

/**
 * The columns opened at `children[start]`, and the index of the block that
 * closes them; null if they do not close as they should. Columns in a column
 * are read the same way.
 */
function readColumns(children: MdastNode[], start: number): { node: MdastNode; end: number } | null {
	const columns: MdastNode[] = [];
	let column: MdastNode[] | null = null;
	let width: number | null = null;
	// Before the opening, between columns, or inside one.
	let place: 'outside' | 'between' | 'inside' = 'outside';
	for (let index = start; index < children.length; index += 1) {
		const tags = columnTags(children[index]);
		if (place === 'inside' && (!tags || tags[0]!.kind === 'columns')) {
			const inner = tags ? readColumns(children, index) : null;
			if (tags && !inner) return null;
			column!.push(inner ? inner.node : children[index]);
			if (inner) index = inner.end;
			continue;
		}
		if (!tags) return null;
		for (let at = 0; at < tags.length; at += 1) {
			const tag = tags[at]!;
			if (place === 'outside' && tag.kind === 'columns') place = 'between';
			else if (place === 'between' && tag.kind === 'column') {
				column = [];
				width = tag.width;
				place = 'inside';
			} else if (place === 'inside' && tag.kind === 'end') {
				columns.push({ type: COLUMN_TYPE, width, children: column!.length ? column! : [{ type: 'paragraph', children: [] }] });
				column = null;
				place = 'between';
			} else if (place === 'between' && tag.kind === 'end' && at === tags.length - 1 && columns.length >= 2) {
				const widths = columns.map((each) => each.width ?? 1);
				return { node: { type: COLUMNS_TYPE, widths: widths.every((share) => share === 1) ? null : widths, children: columns }, end: index };
			} else return null;
		}
	}
	return null;
}

export function writeColumns(node: MdastNode, _parent: unknown, state: MarkdownState, info: unknown): string {
	const widths = node.widths?.length === node.children?.length ? node.widths : null;
	const columns = (node.children ?? []).map((column, index) => {
		const inner = state.containerFlow(column, info);
		const share = widths?.[index] ?? 1;
		const open = share === 1 ? '<div>' : `<div style="flex: ${share}">`;
		return inner ? `${open}\n\n${inner}\n\n</div>` : `${open}\n\n</div>`;
	});
	return `<div class="columns">\n${columns.join('\n')}\n</div>`;
}

export const columnsRemark = $remark('article-columns', () => function (this: { data(): Record<string, unknown> }) {
	const data = this.data();
	const extensions = (data.toMarkdownExtensions ??= []) as unknown[];
	extensions.push({ handlers: { [COLUMNS_TYPE]: writeColumns } });
	return groupColumns;
} as unknown as RemarkPlugin);

export const columnsSchema = $nodeSchema(COLUMNS_TYPE, () => ({
	group: 'block',
	content: `${COLUMN_TYPE}{2,}`,
	defining: true,
	attrs: { widths: { default: null } },
	parseDOM: [{ tag: 'div.columns' }],
	toDOM: (node) => ['div', { class: 'columns', style: gridStyle(node) }, 0],
	parseMarkdown: {
		match: (node) => node.type === COLUMNS_TYPE,
		runner: (state, node, type) => {
			state.openNode(type, { widths: (node as MdastNode).widths ?? null });
			state.next(node.children);
			state.closeNode();
		},
	},
	toMarkdown: {
		match: (node) => node.type.name === COLUMNS_TYPE,
		runner: (state, node) => {
			state.openNode(COLUMNS_TYPE, undefined, { widths: node.attrs.widths });
			state.next(node.content);
			state.closeNode();
		},
	},
}));

export const columnSchema = $nodeSchema(COLUMN_TYPE, () => ({
	content: 'block+',
	// The caret does not leave a column by ⌫ or Delete at its edges, nor do blocks join across.
	isolating: true,
	parseDOM: [{ tag: 'div.columns > div' }],
	toDOM: () => ['div', { class: 'column' }, 0],
	parseMarkdown: {
		match: (node) => node.type === COLUMN_TYPE,
		runner: (state, node, type) => {
			state.openNode(type);
			state.next(node.children);
			state.closeNode();
		},
	},
	toMarkdown: {
		match: (node) => node.type.name === COLUMN_TYPE,
		runner: (state, node) => {
			state.openNode(COLUMN_TYPE);
			state.next(node.content);
			state.closeNode();
		},
	},
}));

const isEmpty = (node: ProseNode) => node.childCount === 1 && node.firstChild!.isTextblock && node.firstChild!.content.size === 0;

const columnsKey = new PluginKey('article-columns');

/** Each column's share of the width, one per column (one each when none are kept, or they do not fit). */
export function columnWidths(columns: ProseNode): number[] {
	const kept = columns.attrs.widths as unknown;
	if (Array.isArray(kept) && kept.length === columns.childCount && kept.every((share) => typeof share === 'number' && share > 0)) return [...kept];
	return Array.from({ length: columns.childCount }, () => 1);
}

/** Shares as kept: scaled to a mean of one, to two decimals; null when they are all one. */
export function keptWidths(widths: number[]): number[] | null {
	const mean = widths.reduce((sum, share) => sum + share, 0) / widths.length;
	const scaled = widths.map((share) => Math.round((share / mean) * 100) / 100);
	return scaled.every((share) => share === 1) ? null : scaled;
}

/** The grid the columns are drawn in, each as wide as its share. */
function gridStyle(columns: ProseNode): string {
	return `grid-template-columns: ${columnWidths(columns).map((share) => `minmax(0, ${share}fr)`).join(' ')}`;
}

/** Where the column at `index` of the columns at `columnsPos` starts (the columns' end for one past the last). */
function columnStart(columns: ProseNode, columnsPos: number, index: number): number {
	let at = columnsPos + 1;
	for (let child = 0; child < index; child += 1) at += columns.child(child).nodeSize;
	return at;
}

/** Takes away the column at `index` of the columns at `columnsPos`; with one left, the columns are its blocks. */
export function removeColumn(tr: Transaction, columnsPos: number, index: number): Transaction {
	const columns = tr.doc.nodeAt(columnsPos)!;
	if (columns.childCount <= 2) {
		const kept = columns.child(index === 0 ? 1 : 0);
		return tr.replaceWith(columnsPos, columnsPos + columns.nodeSize, kept.content);
	}
	const widths = columnWidths(columns);
	widths.splice(index, 1);
	const start = columnStart(columns, columnsPos, index);
	return tr.delete(start, start + columns.child(index).nodeSize).setNodeMarkup(columnsPos, undefined, { ...columns.attrs, widths: keptWidths(widths) });
}

/** A column holding `content` put in at `index` of the columns at `columnsPos`, as wide as the columns are on average. */
export function addColumn(tr: Transaction, columnsPos: number, index: number, content: Fragment | ProseNode): Transaction {
	const columns = tr.doc.nodeAt(columnsPos)!;
	const widths = columnWidths(columns);
	widths.splice(index, 0, widths.reduce((sum, share) => sum + share, 0) / widths.length);
	tr.insert(columnStart(columns, columnsPos, index), tr.doc.type.schema.nodes[COLUMN_TYPE]!.create(null, content));
	return tr.setNodeMarkup(columnsPos, undefined, { ...columns.attrs, widths: keptWidths(widths) });
}

/** Takes away the blocks from `from` to `to`; where they were all a column held, the column goes too. */
export function removeBlocks(tr: Transaction, from: number, to: number): Transaction {
	const $from = tr.doc.resolve(from);
	if ($from.parent.type.name === COLUMN_TYPE && from === $from.start() && to === $from.end() && $from.depth >= 2) {
		return removeColumn(tr, $from.before($from.depth - 1), $from.index($from.depth - 1));
	}
	return tr.delete(from, to);
}

/** The block a place is in, as the side of which another can be dropped: one at the top of the article or of a column. */
export function blockBeside($pos: ResolvedPos): { pos: number; node: ProseNode; inColumn: boolean } | null {
	if ($pos.depth === 0) {
		const node = $pos.nodeAfter;
		return node && node.type.name !== COLUMNS_TYPE ? { pos: $pos.pos, node, inColumn: false } : null;
	}
	let depth = 1;
	while ($pos.node(depth).type.name === COLUMNS_TYPE && $pos.depth >= depth + 2) depth += 2;
	const node = $pos.node(depth);
	if (node.type.name === COLUMNS_TYPE) {
		// Between a column's blocks: the one after.
		const after = $pos.depth === depth + 1 ? $pos.nodeAfter : null;
		return after ? { pos: $pos.pos, node: after, inColumn: true } : null;
	}
	return { pos: $pos.before(depth), node, inColumn: depth > 1 };
}

/** The most columns side by side a drop makes. */
export const MOST_COLUMNS = 5;

export type SideDrop = { pos: number; side: 'left' | 'right' };

const holdsColumns = (content: Fragment) => {
	let found = false;
	content.descendants((node) => {
		if (node.type.name === COLUMNS_TYPE) found = true;
		return !found;
	});
	return found;
};

/**
 * Blocks dragged (`slice`, from where `source` selects) dropped on a side of
 * the block at `target.pos`: beside it in a column of their own. Null where
 * that cannot be: blocks dropped beside themselves, part of a block, columns
 * (columns are not put in columns by dragging), or columns full already.
 */
export function dropBeside(state: EditorState, target: SideDrop, slice: Slice, source: { from: number; to: number }, copy = false): Transaction | null {
	const { content } = slice;
	if (slice.openStart || slice.openEnd || !content.childCount || holdsColumns(content)) return null;
	let blocks = true;
	content.forEach((node) => (blocks &&= node.isBlock));
	if (!blocks) return null;
	const node = state.doc.nodeAt(target.pos);
	if (!node || !node.isBlock) return null;
	const end = target.pos + node.nodeSize;
	// Onto itself, or into what is dragged, or around it (a copy may go beside what it is a copy of).
	if (!copy && source.from < end && source.to > target.pos) return null;
	const $target = state.doc.resolve(target.pos);
	const schema = state.schema;
	const tr = state.tr;
	let landed: number;
	if ($target.parent.type.name === COLUMN_TYPE) {
		const columnsPos = $target.before($target.depth - 1);
		const columns = state.doc.nodeAt(columnsPos)!;
		if (columns.childCount >= MOST_COLUMNS) return null;
		const index = $target.index($target.depth - 1) + (target.side === 'right' ? 1 : 0);
		addColumn(tr, columnsPos, index, content);
		landed = columnStart(tr.doc.nodeAt(columnsPos)!, columnsPos, index) + 1;
	} else if ($target.depth === 0) {
		const moved = schema.nodes[COLUMN_TYPE]!.create(null, content);
		const there = schema.nodes[COLUMN_TYPE]!.create(null, node);
		tr.replaceWith(target.pos, end, schema.nodes[COLUMNS_TYPE]!.create(null, target.side === 'left' ? [moved, there] : [there, moved]));
		landed = target.pos + 2 + (target.side === 'left' ? 0 : there.nodeSize);
	} else return null;
	const steps = tr.steps.length;
	if (!copy) removeBlocks(tr, tr.mapping.map(source.from, 1), tr.mapping.map(source.to, -1));
	landed = tr.mapping.slice(steps).map(landed, 1);
	// The caret at the end of what was moved, as after any drop (block-key-plugins.ts, dropCaret).
	const caret = Selection.findFrom(tr.doc.resolve(landed + content.size), -1, true) ?? TextSelection.near(tr.doc.resolve(landed));
	return tr.setSelection(caret).setMeta('uiEvent', 'drop').setMeta(columnsKey, 'beside').scrollIntoView();
}

/**
 * After a drop that took a column's blocks away (dragged out of it as
 * usual): the column left holding an empty line goes, as in Notion.
 */
export function emptiedColumn(transactions: readonly Transaction[], before: EditorState, after: EditorState): Transaction | null {
	if (!transactions.some((tr) => tr.getMeta('uiEvent') === 'drop' && !tr.getMeta(columnsKey))) return null;
	const { $from } = before.selection;
	if ($from.parent.type.name !== COLUMN_TYPE || isEmpty($from.parent)) return null;
	let pos = $from.before();
	for (const tr of transactions) pos = tr.mapping.map(pos, 1);
	const column = after.doc.nodeAt(pos);
	if (column?.type.name !== COLUMN_TYPE || !isEmpty(column)) return null;
	const $column = after.doc.resolve(pos);
	return removeColumn(after.tr, $column.before(), $column.index());
}

/** `count` empty columns in place of the caret's (empty) block; the caret goes into the first. */
export function insertColumns(view: EditorView, count = 2): boolean {
	const { state } = view;
	const columns = state.schema.nodes[COLUMNS_TYPE];
	const column = state.schema.nodes[COLUMN_TYPE];
	const paragraph = state.schema.nodes.paragraph;
	if (!columns || !column || !paragraph) return false;
	const { $from } = state.selection;
	const block = columns.create(null, Array.from({ length: count }, () => column.create(null, paragraph.create())));
	const from = $from.depth > 0 ? $from.before() : $from.pos;
	const to = $from.depth > 0 ? $from.after() : $from.pos;
	const tr = state.tr.replaceWith(from, to, block);
	view.dispatch(tr.setSelection(TextSelection.near(tr.doc.resolve(from + 3))).scrollIntoView());
	view.focus();
	return true;
}

/**
 * ⌫ at the start of a column with nothing in it: the column goes, the caret
 * to the end of the one before (or the start of the next). With one column
 * left, the columns are its blocks again.
 */
export function removeEmptyColumn(state: EditorState, dispatch?: (tr: Transaction) => void): boolean {
	const { selection } = state;
	if (!(selection instanceof TextSelection) || !selection.empty) return false;
	const { $from } = selection;
	if ($from.parentOffset !== 0 || $from.depth < 3) return false;
	const column = $from.node(-1);
	const columns = $from.node(-2);
	if (column.type.name !== COLUMN_TYPE || columns.type.name !== COLUMNS_TYPE || !isEmpty(column)) return false;
	if (!dispatch) return true;
	const columnsPos = $from.before(-2);
	const index = $from.index(-2);
	const tr = removeColumn(state.tr, columnsPos, index);
	const was = columns.childCount;
	// The caret: at the end of the column before, or the start of the one after (or of the blocks left).
	const near = was <= 2
		? (index === 0 ? tr.doc.resolve(columnsPos) : tr.doc.resolve(columnsPos + columns.child(0).content.size))
		: tr.doc.resolve(index === 0 ? columnStart(tr.doc.nodeAt(columnsPos)!, columnsPos, 0) + 1 : columnStart(tr.doc.nodeAt(columnsPos)!, columnsPos, index) - 1);
	dispatch(tr.setSelection(TextSelection.near(near, index === 0 ? 1 : -1)).scrollIntoView());
	return true;
}

const columnKeys = $prose(
	() =>
		new Plugin({
			props: {
				handleKeyDown(view, event) {
					if (event.key !== 'Backspace' || event.isComposing || event.shiftKey || event.altKey || event.metaKey || event.ctrlKey) return false;
					return removeEmptyColumn(view.state, (tr) => view.dispatch(tr));
				},
			},
		}),
);

/** How near a block's right edge a drop puts the blocks beside it; and its left edge. */
const EDGE_PX = 48;
const LEFT_EDGE_PX = 24;

/** The side of a block a drag at (x, y) is over, if near enough to one of its edges. */
function sideAt(view: EditorView, x: number, y: number): (SideDrop & { line: DOMRect }) | null {
	const box = view.dom.getBoundingClientRect();
	const found = view.posAtCoords({ left: Math.min(Math.max(x, box.left + 1), box.right - 1), top: y });
	if (!found) return null;
	const { doc } = view.state;
	const inside = found.inside >= 0 ? doc.nodeAt(found.inside) : null;
	const $inside = found.inside >= 0 ? doc.resolve(found.inside) : null;
	const target = inside?.isBlock && $inside && ($inside.depth === 0 || $inside.parent.type.name === COLUMN_TYPE)
		? { pos: found.inside, node: inside, inColumn: $inside.depth > 0 }
		: blockBeside(doc.resolve(found.pos));
	if (!target) return null;
	const dom = view.nodeDOM(target.pos);
	if (!(dom instanceof HTMLElement)) return null;
	const rect = dom.getBoundingClientRect();
	const edge = Math.min(EDGE_PX, rect.width * 0.2);
	let side: SideDrop['side'] | null = null;
	// The left edge from inside the block, and narrower: a drag from the handle goes up and down just left of
	// the blocks, and drifting in a little is not meant as beside.
	if (x >= rect.left + 4 && x < rect.left + LEFT_EDGE_PX) side = 'left';
	else if (x > rect.right - edge && x < rect.right + 80) side = 'right';
	if (!side) return null;
	// The line: at the edge of the column the block is in, or of the block.
	const where = target.inColumn && dom.parentElement?.classList.contains('column') ? dom.parentElement.getBoundingClientRect() : rect;
	return { pos: target.pos, side, line: where };
}

/** What dropping what is dragged at `at` does, if it goes beside the block there. */
function besideDrop(view: EditorView, at: SideDrop, copy = false): Transaction | null {
	const { dragging } = view;
	if (!dragging) return null;
	const dragged = (dragging as { node?: Selection }).node ?? view.state.selection;
	if (dragged.empty) return null;
	return dropBeside(view.state, at, dragging.slice, dragged, copy);
}

/** ⌥ held (Ctrl elsewhere) as the drop is made: a copy goes there, as the editor's other drops do. */
const copying = (event: DragEvent) => (navigator.platform.includes('Mac') ? event.altKey : event.ctrlKey);

/** Dropping beside a block (dropBeside), shown by an upright line; and the column a drop emptied taken away. */
const columnsDrop = $prose(() => {
	let line: HTMLElement | null = null;
	let over: (SideDrop & { line: DOMRect }) | null = null;
	// besideDrop's answer, for as long as the drag stays on that side of that block.
	let last: { doc: EditorState['doc']; pos: number; side: SideDrop['side']; copy: boolean; can: boolean } | null = null;
	const canDropBeside = (view: EditorView, at: SideDrop, copy: boolean): boolean => {
		const { doc } = view.state;
		if (last?.doc === doc && last.pos === at.pos && last.side === at.side && last.copy === copy) return last.can;
		last = { doc, pos: at.pos, side: at.side, copy, can: besideDrop(view, at, copy) != null };
		return last.can;
	};
	const hide = (view: EditorView) => {
		over = null;
		line?.remove();
		line = null;
		view.dom.closest('.milkdown')?.classList.remove('columns-side-drop');
	};
	const show = (view: EditorView, at: SideDrop & { line: DOMRect }) => {
		over = at;
		line ??= Object.assign(document.createElement('div'), { className: 'columns-drop-line' });
		if (!line.isConnected) document.body.append(line);
		const x = at.side === 'left' ? at.line.left - 6 : at.line.right + 4;
		Object.assign(line.style, { left: `${x}px`, top: `${at.line.top}px`, height: `${at.line.height}px` });
		// The usual line, between blocks, is not where these go.
		view.dom.closest('.milkdown')?.classList.add('columns-side-drop');
	};
	// The upright line only where the drop would go beside (dropBeside): not beside the blocks dragged, nor beside full
	// columns, where it would go between blocks after all.
	const dragover = (view: EditorView, event: DragEvent) => {
		const at = view.dragging ? sideAt(view, event.clientX, event.clientY) : null;
		if (at && canDropBeside(view, at, copying(event))) {
			show(view, at);
			// Over a block that takes its own events (code, a chemistry block): a drop is let happen here.
			event.preventDefault();
		} else if (over) hide(view);
	};
	// Before the usual drop (the drop indicator's, a `handleDrop`), which would put the blocks between others; and
	// before a block's own (code takes a drop as text).
	const drop = (view: EditorView, event: DragEvent) => {
		const dragging = view.dragging;
		const at = over ?? (dragging ? sideAt(view, event.clientX, event.clientY) : null);
		hide(view);
		if (!at) return;
		const tr = besideDrop(view, at, copying(event));
		if (!tr) return;
		event.preventDefault();
		event.stopPropagation();
		// As the editor does once a drop is done.
		view.dragging = null;
		view.dispatch(tr);
		view.focus();
	};
	return new Plugin({
		key: columnsKey,
		props: {
			handleDOMEvents: {
				dragleave(view, event) {
					const into = event.relatedTarget;
					if (!(into instanceof Node) || !view.dom.contains(into)) hide(view);
					return false;
				},
				dragend(view) {
					hide(view);
					return false;
				},
			},
		},
		appendTransaction: (transactions, before, after) => emptiedColumn(transactions, before, after),
		// Listened to on the editor itself, first (capture): a drag over a block that takes its own events (code, a
		// chemistry block) never reaches ProseMirror's own handlers. Frames in the blocks (a widget's) are not let take
		// the drag meanwhile (the CSS): it would go into them.
		view: (editorView) => {
			const dom = editorView.dom;
			const onOver = (event: DragEvent) => {
				// A block of the editor dragged (from its handle, outside the editor): marked from the first move over it.
				if (editorView.dragging) dom.classList.add('pm-dragging');
				dragover(editorView, event);
			};
			const onDrop = (event: DragEvent) => drop(editorView, event);
			const onEnd = () => dom.classList.remove('pm-dragging');
			dom.addEventListener('dragover', onOver, true);
			dom.addEventListener('drop', onDrop, true);
			document.addEventListener('dragend', onEnd, true);
			document.addEventListener('drop', onEnd, true);
			return {
				destroy: () => {
					hide(editorView);
					dom.removeEventListener('dragover', onOver, true);
					dom.removeEventListener('drop', onDrop, true);
					document.removeEventListener('dragend', onEnd, true);
					document.removeEventListener('drop', onEnd, true);
				},
			};
		},
	});
});

/** How wide the strip of a gap that resizes is (from the column on its left). */
const RESIZE_STRIP_PX = 8;

/** The narrowest a column is made by dragging the gap beside it. */
const NARROWEST_PX = 80;

/**
 * Columns in the editor: drawn as a grid of their shares; ＋ at the right
 * adds an empty column; the gap between two is dragged to share their width
 * otherwise (kept when let go). While the pointer is in a gap, block handles
 * are hidden (CSS, `is-over-gap`): the gap is for the width there, as in
 * Notion; a block's handle shows when the pointer is over the block.
 */
class ColumnsView implements NodeView {
	readonly dom: HTMLElement;
	readonly contentDOM: HTMLElement;
	private node: ProseNode;
	private readonly view: EditorView;
	private readonly getPos: () => number | undefined;
	private readonly line: HTMLElement;
	private resizing: { index: number; widths: number[] } | null = null;

	constructor(node: ProseNode, view: EditorView, getPos: () => number | undefined) {
		this.node = node;
		this.view = view;
		this.getPos = getPos;
		this.dom = document.createElement('div');
		this.dom.className = 'columns-block';
		this.contentDOM = document.createElement('div');
		this.contentDOM.className = 'columns';
		const add = document.createElement('button');
		add.type = 'button';
		add.className = 'columns-add';
		add.contentEditable = 'false';
		add.textContent = '+';
		add.title = t('加一栏');
		add.setAttribute('aria-label', t('加一栏'));
		add.addEventListener('mousedown', (event) => event.preventDefault());
		add.addEventListener('click', () => this.addColumn());
		this.line = document.createElement('div');
		this.line.className = 'columns-resize-line';
		this.line.contentEditable = 'false';
		this.dom.append(this.contentDOM, add, this.line);
		// Heard on the whole editor: the handle of a block in the column on the right sits over the gap.
		this.root = (view.dom.parentElement ?? view.dom) as HTMLElement;
		this.root.addEventListener('mousemove', this.onHover);
		this.root.addEventListener('mousedown', this.onPress, true);
		this.draw();
	}

	private readonly root: HTMLElement;

	update(node: ProseNode): boolean {
		if (node.type !== this.node.type) return false;
		this.node = node;
		if (!this.resizing) this.draw();
		return true;
	}

	stopEvent(event: Event): boolean {
		const target = event.target as Element | null;
		if (target?.closest?.('.columns-add')) return true;
		return event.type.startsWith('mouse') && this.resizing !== null;
	}

	ignoreMutation(mutation: ViewMutationRecord): boolean {
		if (mutation.type === 'selection') return false;
		if (mutation.target === this.contentDOM && mutation.type === 'attributes') return true;
		return !this.contentDOM.contains(mutation.target);
	}

	destroy(): void {
		this.endResize();
		this.root.removeEventListener('mousemove', this.onHover);
		this.root.removeEventListener('mousedown', this.onPress, true);
	}

	private draw(widths = columnWidths(this.node)): void {
		this.contentDOM.style.gridTemplateColumns = widths.map((share) => `minmax(0, ${share}fr)`).join(' ');
	}

	private columnElements(): HTMLElement[] {
		return [...this.contentDOM.children].filter((child): child is HTMLElement => child instanceof HTMLElement && child.classList.contains('column'));
	}

	/**
	 * The strip of a gap that resizes, at (x, y): the index of the column left
	 * of it. Only a strip at the gap's left: the rest is the way from a block
	 * in the column on the right to its handle, which is there.
	 */
	private gapAt(x: number, y: number): number | null {
		const box = this.contentDOM.getBoundingClientRect();
		if (y < box.top || y > box.bottom) return null;
		const columns = this.columnElements();
		for (let index = 0; index < columns.length - 1; index += 1) {
			const left = columns[index]!.getBoundingClientRect().right;
			if (x >= left - 2 && x <= left + RESIZE_STRIP_PX) return index;
		}
		return null;
	}

	private placeLine(index: number): void {
		const box = this.dom.getBoundingClientRect();
		const left = this.columnElements()[index]!.getBoundingClientRect().right;
		this.line.style.left = `${left + RESIZE_STRIP_PX / 2 - 1 - box.left}px`;
	}

	private onHover = (event: MouseEvent): void => {
		if (this.resizing) return;
		// On a block's handle (shown in the gap for a block on its right): that handle, to drag the block.
		const onHandle = Boolean((event.target as Element | null)?.closest?.('.milkdown-block-handle'));
		const gap = onHandle ? null : this.gapAt(event.clientX, event.clientY);
		this.dom.classList.toggle('is-over-gap', gap !== null);
		if (gap !== null) this.placeLine(gap);
	};

	private onPress = (event: MouseEvent): void => {
		if (event.button !== 0 || !this.view.editable) return;
		// A block's handle over the gap is pressed for its block.
		if ((event.target as Element | null)?.closest?.('.milkdown-block-handle')) return;
		const index = this.gapAt(event.clientX, event.clientY);
		if (index === null) return;
		event.preventDefault();
		event.stopPropagation();
		const columns = this.columnElements();
		const a = columns[index]!.getBoundingClientRect().width;
		const b = columns[index + 1]!.getBoundingClientRect().width;
		const startX = event.clientX;
		const start = columnWidths(this.node);
		const pair = start[index]! + start[index + 1]!;
		this.resizing = { index, widths: start };
		this.dom.classList.add('is-resizing', 'is-over-gap');
		const move = (moving: MouseEvent) => {
			const least = Math.min(NARROWEST_PX, (a + b) / 3);
			const left = Math.min(Math.max(a + moving.clientX - startX, least), a + b - least);
			const widths = [...start];
			widths[index] = (pair * left) / (a + b);
			widths[index + 1] = pair - widths[index]!;
			this.resizing = { index, widths };
			this.draw(widths);
			this.placeLine(index);
		};
		const up = () => {
			const done = this.resizing;
			this.endResize();
			const pos = this.getPos();
			if (!done || pos === undefined) return;
			const widths = keptWidths(done.widths);
			if (JSON.stringify(widths) === JSON.stringify(this.node.attrs.widths ?? null)) return;
			this.view.dispatch(this.view.state.tr.setNodeMarkup(pos, undefined, { ...this.node.attrs, widths }));
		};
		this.stopResizing = () => {
			window.removeEventListener('mousemove', move);
			window.removeEventListener('mouseup', up);
		};
		window.addEventListener('mousemove', move);
		window.addEventListener('mouseup', up);
	};

	private stopResizing: (() => void) | null = null;

	private endResize(): void {
		this.stopResizing?.();
		this.stopResizing = null;
		this.resizing = null;
		this.dom.classList.remove('is-resizing', 'is-over-gap');
		this.draw();
	}

	private addColumn(): void {
		const pos = this.getPos();
		const paragraph = this.view.state.schema.nodes.paragraph;
		if (pos === undefined || !paragraph) return;
		const index = this.node.childCount;
		const tr = addColumn(this.view.state.tr, pos, index, paragraph.create());
		const start = columnStart(tr.doc.nodeAt(pos)!, pos, index);
		this.view.dispatch(tr.setSelection(TextSelection.near(tr.doc.resolve(start + 1))).scrollIntoView());
		this.view.focus();
	}
}

const columnsView = $view(columnsSchema.node, () => (node, view, getPos) => new ColumnsView(node, view, getPos));

export function columnsPlugins(): MilkdownPlugin[] {
	return [columnsRemark, ...columnsSchema, ...columnSchema, columnsView, columnKeys, columnsDrop].flat();
}

import type { MilkdownPlugin } from '@milkdown/ctx';
import type { Node as ProseNode } from '@milkdown/prose/model';
import { Plugin, TextSelection, type EditorState, type Transaction } from '@milkdown/prose/state';
import type { EditorView } from '@milkdown/prose/view';
import { $nodeSchema, $prose, $remark } from '@milkdown/utils';

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
 * In the editor: `columns` holds two or more `column`s, each holding blocks.
 * ⌫ at the start of an empty column takes it away; with one column left, its
 * blocks are put back in the article.
 */

export const COLUMNS_TYPE = 'columns';
export const COLUMN_TYPE = 'column';

type MdastNode = { type: string; value?: string; children?: MdastNode[] };
type RemarkPlugin = ReturnType<Parameters<typeof $remark>[1]>;
type MarkdownState = { containerFlow(node: unknown, info: unknown): string };
type Tag = 'columns' | 'column' | 'end';

/** The HTML a block is: an `html` node, or a paragraph holding only one (Milkdown wraps HTML in a paragraph). */
function htmlOf(node: MdastNode): string | null {
	if (node.type === 'html') return node.value ?? '';
	if (node.type === 'paragraph' && node.children?.length === 1 && node.children[0].type === 'html') return node.children[0].value ?? '';
	return null;
}

/** The tags of a block that is only `<div class="columns">`, `<div>` and `</div>` lines (several share a block when no blank line parts them); null for any other. */
export function columnTags(node: MdastNode): Tag[] | null {
	const html = htmlOf(node);
	if (html === null) return null;
	const tags: Tag[] = [];
	for (const line of html.split('\n')) {
		const text = line.trim();
		if (!text) continue;
		if (/^<div\s+class=(["'])columns\1\s*>$/iu.test(text)) tags.push('columns');
		else if (/^<div\s*>$/iu.test(text)) tags.push('column');
		else if (/^<\/div\s*>$/iu.test(text)) tags.push('end');
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
		if (first?.[0] !== 'columns') continue;
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
	// Before the opening, between columns, or inside one.
	let place: 'outside' | 'between' | 'inside' = 'outside';
	for (let index = start; index < children.length; index += 1) {
		const tags = columnTags(children[index]);
		if (place === 'inside' && (!tags || tags[0] === 'columns')) {
			const inner = tags ? readColumns(children, index) : null;
			if (tags && !inner) return null;
			column!.push(inner ? inner.node : children[index]);
			if (inner) index = inner.end;
			continue;
		}
		if (!tags) return null;
		for (let at = 0; at < tags.length; at += 1) {
			const tag = tags[at];
			if (place === 'outside' && tag === 'columns') place = 'between';
			else if (place === 'between' && tag === 'column') {
				column = [];
				place = 'inside';
			} else if (place === 'inside' && tag === 'end') {
				columns.push({ type: COLUMN_TYPE, children: column!.length ? column! : [{ type: 'paragraph', children: [] }] });
				column = null;
				place = 'between';
			} else if (place === 'between' && tag === 'end' && at === tags.length - 1 && columns.length >= 2) {
				return { node: { type: COLUMNS_TYPE, children: columns }, end: index };
			} else return null;
		}
	}
	return null;
}

export function writeColumns(node: MdastNode, _parent: unknown, state: MarkdownState, info: unknown): string {
	const columns = (node.children ?? []).map((column) => {
		const inner = state.containerFlow(column, info);
		return inner ? `<div>\n\n${inner}\n\n</div>` : '<div>\n\n</div>';
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
	parseDOM: [{ tag: 'div.columns' }],
	toDOM: (node) => ['div', { class: 'columns', style: `--columns: ${node.childCount}` }, 0],
	parseMarkdown: {
		match: (node) => node.type === COLUMNS_TYPE,
		runner: (state, node, type) => {
			state.openNode(type);
			state.next(node.children);
			state.closeNode();
		},
	},
	toMarkdown: {
		match: (node) => node.type.name === COLUMNS_TYPE,
		runner: (state, node) => {
			state.openNode(COLUMNS_TYPE);
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

const isEmpty = (node: ProseNode) => node.childCount === 1 && node.firstChild!.isTextblock && node.firstChild!.content.size === 0;

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
	if (columns.childCount <= 2) {
		// One column left: its blocks, in place of the columns.
		const kept = columns.child(index === 0 ? 1 : 0);
		const tr = state.tr.replaceWith(columnsPos, columnsPos + columns.nodeSize, kept.content);
		const caret = index === 0 ? columnsPos : columnsPos + kept.content.size;
		dispatch(tr.setSelection(TextSelection.near(tr.doc.resolve(Math.min(caret, tr.doc.content.size)), index === 0 ? 1 : -1)).scrollIntoView());
		return true;
	}
	const columnPos = $from.before(-1);
	const tr = state.tr.delete(columnPos, columnPos + column.nodeSize);
	const near = index === 0 ? tr.doc.resolve(columnPos + 1) : tr.doc.resolve(columnPos - 1);
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

export function columnsPlugins(): MilkdownPlugin[] {
	return [columnsRemark, ...columnsSchema, ...columnSchema, columnKeys].flat();
}

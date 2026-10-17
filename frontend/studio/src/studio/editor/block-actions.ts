import { Fragment, Slice, type Node as ProseNode } from 'prosemirror-model';
import { TextSelection, type EditorState } from 'prosemirror-state';

export type BlockTurn =
	| 'paragraph'
	| 'h1'
	| 'h2'
	| 'h3'
	| 'bullet'
	| 'ordered'
	| 'task'
	| 'quote'
	| 'code'
	| 'callout'
	| 'toggle';

export type BlockAction =
	| { type: 'duplicate' }
	| { type: 'delete' }
	| { type: 'move'; direction: -1 | 1 }
	| { type: 'turn'; kind: BlockTurn };

export type BlockMenuItem = {
	section: '操作' | '转换成';
	id: string;
	label: string;
	current: boolean;
	danger: boolean;
	action: BlockAction;
	/** The key that does the same, as a keymap names it: `Mod-d`. */
	shortcut?: string;
};

export type BlockEdit = {
	from: number;
	to: number;
	nodes: ProseNode[];
	cursor: number;
};

const TURNS: { kind: BlockTurn; label: string }[] = [
	{ kind: 'paragraph', label: '正文' },
	{ kind: 'h1', label: '标题 1' },
	{ kind: 'h2', label: '标题 2' },
	{ kind: 'h3', label: '标题 3' },
	{ kind: 'bullet', label: '无序列表' },
	{ kind: 'ordered', label: '有序列表' },
	{ kind: 'task', label: '待办' },
	{ kind: 'quote', label: '引用' },
	{ kind: 'code', label: '代码' },
	{ kind: 'callout', label: '提示块' },
	{ kind: 'toggle', label: '折叠块' },
];

/** What a block becomes wrapped in, for the kinds that hold blocks as they are. */
const WRAPPERS: Partial<Record<BlockTurn, Record<string, unknown>>> = {
	callout: { kind: 'tip' },
	toggle: { summary: '', open: false },
};

const KEY_GLYPHS: Record<string, string> = { ArrowUp: '↑', ArrowDown: '↓', Backspace: '⌫' };

/** A keymap's name for keys (`Mod-Shift-ArrowUp`) as a menu shows it: `⇧⌘↑` on a Mac (its order, as the toolbar has it), `Ctrl+Shift+↑` elsewhere. */
export function keyHint(shortcut: string, mac = /Mac/u.test(globalThis.navigator?.platform ?? '')): string {
	const parts = shortcut.split('-');
	const key = parts.pop() ?? '';
	const shown = KEY_GLYPHS[key] ?? key.toUpperCase();
	const names: Record<string, [string, string]> = { Mod: ['⌘', 'Ctrl'], Shift: ['⇧', 'Shift'], Alt: ['⌥', 'Alt'] };
	const macOrder = ['Alt', 'Shift', 'Mod'];
	if (mac) return [...parts].sort((left, right) => macOrder.indexOf(left) - macOrder.indexOf(right)).map((part) => names[part]?.[0] ?? part).join('') + shown;
	return [...parts.map((part) => names[part]?.[1] ?? part), shown].join('+');
}

type KindSource = {
	type: { name: string };
	attrs: Record<string, unknown>;
	firstChild: { attrs: Record<string, unknown> } | null;
};

/** The writing kind shown as current in the block menu. */
export function blockKind(node: KindSource): string {
	if (node.type.name === 'heading') return `h${node.attrs.level ?? 1}`;
	if (node.type.name === 'bullet_list') return node.firstChild?.attrs.checked == null ? 'bullet' : 'task';
	if (node.type.name === 'ordered_list') return 'ordered';
	if (node.type.name === 'blockquote') return 'quote';
	if (node.type.name === 'code_block') return 'code';
	if (node.type.name === 'paragraph') return 'paragraph';
	return node.type.name;
}

/** Click the drag handle: duplicate or move it, turn it into another block, or delete it. */
export function blockActionItems(node: KindSource): BlockMenuItem[] {
	const current = blockKind(node);
	const items: BlockMenuItem[] = [
		{
			section: '操作',
			id: 'duplicate',
			label: '创建副本',
			current: false,
			danger: false,
			action: { type: 'duplicate' },
			shortcut: 'Mod-d',
		},
		{ section: '操作', id: 'move-up', label: '上移', current: false, danger: false, action: { type: 'move', direction: -1 }, shortcut: 'Mod-Shift-ArrowUp' },
		{ section: '操作', id: 'move-down', label: '下移', current: false, danger: false, action: { type: 'move', direction: 1 }, shortcut: 'Mod-Shift-ArrowDown' },
	];
	for (const turn of TURNS) {
		items.push({
			section: '转换成',
			id: `turn-${turn.kind}`,
			label: turn.label,
			current: current === turn.kind,
			danger: false,
			action: { type: 'turn', kind: turn.kind },
		});
	}
	items.push({
		section: '操作',
		id: 'delete',
		label: '删除',
		current: false,
		danger: true,
		action: { type: 'delete' },
		shortcut: 'Backspace',
	});
	return items;
}

function asParagraphs(node: ProseNode): ProseNode[] {
	const schema = node.type.schema;
	const paragraph = (content: Fragment) => schema.nodes.paragraph.create(null, content);
	const name = node.type.name;
	if (name === 'paragraph') return [node.copy(node.content)];
	if (name === 'heading') return [paragraph(node.content)];
	if (name === 'code_block' || name === 'science-block') {
		const text = node.textContent;
		return [paragraph(text ? Fragment.from(schema.text(text)) : Fragment.empty)];
	}
	if (name === 'blockquote' || name === 'bullet_list' || name === 'ordered_list' || name === 'callout' || name === 'toggle') {
		const blocks: ProseNode[] = [];
		const visit = (child: ProseNode) => {
			if (['list_item', 'blockquote', 'bullet_list', 'ordered_list', 'callout', 'toggle'].includes(child.type.name)) {
				child.forEach(visit);
				return;
			}
			blocks.push(...asParagraphs(child));
		};
		node.forEach(visit);
		return blocks.length ? blocks : [paragraph(Fragment.empty)];
	}
	return [];
}

function nodesFor(paragraphs: ProseNode[], kind: BlockTurn): ProseNode[] {
	const schema = paragraphs[0]?.type.schema;
	if (!schema) return [];
	if (kind === 'paragraph') return paragraphs;
	if (kind === 'h1' || kind === 'h2' || kind === 'h3') {
		const level = Number(kind.slice(1));
		return paragraphs.map((paragraph) => schema.nodes.heading.create({ level }, paragraph.content));
	}
	if (kind === 'quote') return [schema.nodes.blockquote.create(null, paragraphs)];
	if (kind === 'code') {
		const text = paragraphs.map((paragraph) => paragraph.textContent).join('\n');
		return [schema.nodes.code_block.create({ language: '' }, text ? schema.text(text) : null)];
	}
	const ordered = kind === 'ordered';
	const items = paragraphs.map((paragraph, index) =>
		schema.nodes.list_item.create(
			{
				label: ordered ? `${index + 1}.` : '•',
				listType: ordered ? 'ordered' : 'bullet',
				spread: false,
				checked: kind === 'task' ? false : null,
			},
			paragraph,
		),
	);
	if (ordered) return [schema.nodes.ordered_list.create({ order: 1, spread: false }, items)];
	return [schema.nodes.bullet_list.create({ spread: false }, items)];
}

/**
 * A local edit for one block. `null` means the block is already that kind.
 * Callers replace only `from`–`to`, so the surrounding blocks stay put.
 */
export function planBlockEdit(doc: ProseNode, pos: number, action: BlockAction): BlockEdit | null {
	const node = doc.nodeAt(pos);
	if (!node?.isBlock || doc.resolve(pos).nodeAfter !== node) return null;
	const from = pos;
	const to = pos + node.nodeSize;
	if (action.type === 'duplicate') {
		return { from: to, to, nodes: [node.copy(node.content)], cursor: to + 1 };
	}
	if (action.type === 'delete') {
		if (doc.childCount === 1) {
			const paragraph = doc.type.schema.nodes.paragraph?.createAndFill();
			if (!paragraph) return null;
			return { from, to, nodes: [paragraph], cursor: from + 1 };
		}
		return { from, to, nodes: [], cursor: from };
	}
	if (action.type !== 'turn' || blockKind(node) === action.kind) return null;
	const wrapper = WRAPPERS[action.kind];
	if (wrapper) {
		// A callout or a toggle holds the block as it is; from the other one, what that held.
		const type = node.type.schema.nodes[action.kind];
		if (!type) return null;
		const content = WRAPPERS[blockKind(node) as BlockTurn] ? node.content : Fragment.from(node);
		return { from, to, nodes: [type.create(wrapper, content)], cursor: from + 2 };
	}
	const paragraphs = asParagraphs(node);
	if (!paragraphs.length) return null;
	const nodes = nodesFor(paragraphs, action.kind);
	if (!nodes.length) return null;
	return { from, to, nodes, cursor: from + 1 };
}

/** Blocks whose writing turns into another kind; formulas, figures, chemistry, tables and the like stay as they are. */
const TURNABLE = new Set(['paragraph', 'heading', 'blockquote', 'bullet_list', 'ordered_list', 'code_block', 'callout', 'toggle']);
const LISTS = new Set(['bullet_list', 'ordered_list']);

/** `nodes` as `kind`: wrapped as they are in a callout or toggle; else their writing, one list or quote or code block for them all. */
function turned(nodes: ProseNode[], kind: BlockTurn): ProseNode[] | null {
	const schema = nodes[0]?.type.schema;
	if (!schema) return null;
	const wrapper = WRAPPERS[kind];
	if (wrapper) {
		const type = schema.nodes[kind];
		if (!type) return null;
		// From the other wrapper, what it held.
		const content = nodes.flatMap((node) => (WRAPPERS[blockKind(node) as BlockTurn] ? [...asChildren(node)] : [node]));
		return [type.create(wrapper, content)];
	}
	const paragraphs = nodes.flatMap(asParagraphs);
	return paragraphs.length ? nodesFor(paragraphs, kind) : null;
}

function asChildren(node: ProseNode): ProseNode[] {
	const children: ProseNode[] = [];
	node.forEach((child) => children.push(child));
	return children;
}

/** Lists of one type side by side as one list, as the selection's items were before they turned. */
function joinLists(nodes: ProseNode[]): ProseNode[] {
	const joined: ProseNode[] = [];
	for (const node of nodes) {
		const last = joined[joined.length - 1];
		if (last && LISTS.has(node.type.name) && last.type === node.type) joined[joined.length - 1] = last.copy(last.content.append(node.content));
		else joined.push(node);
	}
	return joined;
}

/**
 * 转换成 for what is selected, `from`–`to`, as Notion turns it:
 * - inside one list, the items the selection is in, the list split around
 *   them (the rest of it stays a list);
 * - else every block the selection is in: each heading on its own, one
 *   list, quote or code block for blocks side by side, a callout or toggle
 *   around them all; blocks with nothing to turn (a formula, a figure, a
 *   chemistry block) stay as they are between those that turn.
 * Null when nothing would change.
 */
export function planTurn(doc: ProseNode, from: number, to: number, kind: BlockTurn): BlockEdit | null {
	const $from = doc.resolve(from);
	const $to = doc.resolve(Math.max(from, to));
	// Items of one list, not all of it.
	for (let depth = Math.min($from.depth, $to.depth); depth >= 1; depth -= 1) {
		const list = $from.node(depth);
		if (!LISTS.has(list.type.name) || $to.node(depth) !== list) continue;
		const first = $from.index(depth);
		// Inside an item, that item; on the boundary after items (blocks picked whole), the one before.
		const last = Math.max(first, $to.depth > depth ? $to.index(depth) : $to.index(depth) - 1);
		if (first === 0 && last === list.childCount - 1 && depth === 1) break;
		const items = asChildren(list).slice(first, last + 1);
		const made = turned(items.map((item) => list.type.create(list.attrs, item)), kind);
		if (!made) return null;
		const before = first > 0 ? [list.copy(Fragment.from(asChildren(list).slice(0, first)))] : [];
		const after = last < list.childCount - 1 ? [list.copy(Fragment.from(asChildren(list).slice(last + 1)))] : [];
		const start = $from.before(depth);
		return { from: start, to: start + list.nodeSize, nodes: joinLists([...before, ...made, ...after]), cursor: start + 1 };
	}
	// Whole blocks at the top.
	const start = $from.depth ? $from.before(1) : from;
	const end = $to.depth ? $to.after(1) : Math.max(to, start + (doc.nodeAt(start)?.nodeSize ?? 0));
	const blocks: ProseNode[] = [];
	doc.nodesBetween(start, end, (node, pos) => {
		if (pos >= start && pos + node.nodeSize <= end) blocks.push(node);
		return false;
	});
	if (!blocks.length || blocks.every((node) => blockKind(node) === kind)) return null;
	const wrapping = Boolean(WRAPPERS[kind]);
	const nodes: ProseNode[] = [];
	let run: ProseNode[] = [];
	const flush = () => {
		if (!run.length) return;
		nodes.push(...(turned(run, kind) ?? run));
		run = [];
	};
	for (const node of blocks) {
		if (wrapping || TURNABLE.has(node.type.name)) run.push(node);
		else {
			flush();
			nodes.push(node);
		}
	}
	flush();
	return { from: start, to: end, nodes, cursor: start + (wrapping ? 2 : 1) };
}

/** Apply a planned edit. Used by tests; the editor dispatches the same range. */
export function applyBlockEdit(doc: ProseNode, edit: BlockEdit): ProseNode {
	const slice = edit.nodes.length ? new Slice(Fragment.from(edit.nodes), 0, 0) : Slice.empty;
	return doc.replace(edit.from, edit.to, slice);
}

/**
 * Enter in a heading opens a paragraph above (caret at the start), below
 * (caret at the end), or by splitting the text in the middle.
 */
export function headingEnter(state: EditorState, dispatch?: (tr: EditorState['tr']) => void): boolean {
	const selection = state.selection;
	if (!(selection instanceof TextSelection) || !selection.empty) return false;
	const parent = selection.$from.parent;
	if (parent.type.name !== 'heading') return false;
	const paragraph = state.schema.nodes.paragraph;
	if (!paragraph) return false;
	if (!dispatch) return true;
	const $from = selection.$from;
	if ($from.parentOffset === 0 || $from.parentOffset === parent.content.size) {
		const atEnd = $from.parentOffset === parent.content.size;
		const at = atEnd ? $from.after() : $from.before();
		let tr = state.tr.insert(at, paragraph.create());
		tr = tr.setSelection(TextSelection.create(tr.doc, at + 1)).scrollIntoView();
		dispatch(tr);
		return true;
	}
	dispatch(state.tr.split($from.pos, 1, [{ type: paragraph }]).scrollIntoView());
	return true;
}

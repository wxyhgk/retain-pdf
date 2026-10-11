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
	| 'code';

export type BlockAction = { type: 'duplicate' } | { type: 'delete' } | { type: 'turn'; kind: BlockTurn };

export type BlockMenuItem = {
	section: '操作' | '转换成';
	id: string;
	label: string;
	current: boolean;
	danger: boolean;
	action: BlockAction;
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
];

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

/** Click the drag handle: duplicate, turn into another block, or delete. */
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
		},
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
	if (name === 'blockquote' || name === 'bullet_list' || name === 'ordered_list') {
		const blocks: ProseNode[] = [];
		const visit = (child: ProseNode) => {
			if (child.type.name === 'list_item' || child.type.name === 'blockquote' || child.type.name === 'bullet_list' || child.type.name === 'ordered_list') {
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
	if (blockKind(node) === action.kind) return null;
	const paragraphs = asParagraphs(node);
	if (!paragraphs.length) return null;
	const nodes = nodesFor(paragraphs, action.kind);
	if (!nodes.length) return null;
	return { from, to, nodes, cursor: from + 1 };
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

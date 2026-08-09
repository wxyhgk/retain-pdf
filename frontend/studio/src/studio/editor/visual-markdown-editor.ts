import { baseKeymap, setBlockType, toggleMark, wrapIn } from 'prosemirror-commands';
import { history, redo, undo } from 'prosemirror-history';
import {
	inputRules,
	textblockTypeInputRule,
	wrappingInputRule,
} from 'prosemirror-inputrules';
import { keymap } from 'prosemirror-keymap';
import type { NodeType } from 'prosemirror-model';
import { liftListItem, sinkListItem, splitListItem, wrapInList } from 'prosemirror-schema-list';
import { EditorState, NodeSelection, type Command } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';

import { MathNodeView } from './math-node-view.ts';
import {
	parseVisualMarkdownBody,
	serializeVisualMarkdownBody,
	visualMarkdownSchema as schema,
} from './prosemirror-markdown.ts';

type VisualMarkdownEditorOptions = {
	parent: HTMLElement;
	onChange: (body: string) => void;
	onSave: () => void;
};

type ToolbarItem = {
	label: string;
	title: string;
	command: Command;
};

function rulesForSchema() {
	const rules = [
		wrappingInputRule(/^\s*>\s$/u, schema.nodes.blockquote),
		wrappingInputRule(/^\s*([-+*])\s$/u, schema.nodes.bullet_list),
		wrappingInputRule(/^(\d+)\.\s$/u, schema.nodes.ordered_list, (match) => ({ order: Number(match[1]) })),
		textblockTypeInputRule(/^```$/u, schema.nodes.code_block),
	];
	for (let level = 1; level <= 6; level += 1) {
		rules.push(textblockTypeInputRule(new RegExp(`^(#{${level}})\\s$`, 'u'), schema.nodes.heading, { level }));
	}
	return rules;
}

const insertHorizontalRule: Command = (state, dispatch) => {
	if (dispatch) dispatch(state.tr.replaceSelectionWith(schema.nodes.horizontal_rule.create()).scrollIntoView());
	return true;
};

const insertInlineMath: Command = (state, dispatch) => {
		const node = schema.nodes.math_inline.create({ latex: '' });
		if (dispatch) {
			const position = state.selection.from;
			const transaction = state.tr.replaceSelectionWith(node);
			transaction.setSelection(NodeSelection.create(transaction.doc, position));
			dispatch(transaction.scrollIntoView());
		}
		return true;
};

const insertBlockMath: Command = (state, dispatch) => {
		const node = schema.nodes.math_block.create({ latex: '' });
		const { $from } = state.selection;
		if (dispatch) {
			let transaction;
			let position;
			if ($from.parent.type === schema.nodes.paragraph && $from.parent.content.size === 0) {
				position = $from.before();
				transaction = state.tr.replaceWith($from.before(), $from.after(), node);
			} else {
				position = $from.after(1);
				transaction = state.tr.insert(position, node);
			}
			transaction.setSelection(NodeSelection.create(transaction.doc, position));
			dispatch(transaction.scrollIntoView());
		}
		return true;
};

const editSelectedMath: Command = (state, _dispatch, view) => {
	if (!(state.selection instanceof NodeSelection) || !state.selection.node.type.name.startsWith('math_')) return false;
	const nodeDom = view?.nodeDOM(state.selection.from);
	if (nodeDom instanceof HTMLElement) nodeDom.dispatchEvent(new CustomEvent('studio-edit-math'));
	return true;
};

function createToolbarItems(): ToolbarItem[] {
	return [
		{ label: '正文', title: '正文', command: setBlockType(schema.nodes.paragraph) },
		{ label: 'H1', title: '一级标题', command: setBlockType(schema.nodes.heading, { level: 1 }) },
		{ label: 'H2', title: '二级标题', command: setBlockType(schema.nodes.heading, { level: 2 }) },
		{ label: '引用', title: '引用', command: wrapIn(schema.nodes.blockquote) },
		{ label: '• 列表', title: '无序列表', command: wrapInList(schema.nodes.bullet_list) },
		{ label: '1. 列表', title: '有序列表', command: wrapInList(schema.nodes.ordered_list) },
		{ label: '代码', title: '代码块', command: setBlockType(schema.nodes.code_block) },
		{ label: '分隔线', title: '分隔线', command: insertHorizontalRule },
		{ label: '$x$', title: '插入行内公式', command: insertInlineMath },
		{ label: '$$…$$', title: '插入块公式', command: insertBlockMath },
		{ label: 'B', title: '粗体', command: toggleMark(schema.marks.strong) },
		{ label: 'I', title: '斜体', command: toggleMark(schema.marks.em) },
	];
}

export class VisualMarkdownEditor {
	private readonly view: EditorView;
	private readonly toolbar: HTMLElement;
	private enabled = false;

	constructor({ parent, onChange, onSave }: VisualMarkdownEditorOptions) {
		parent.classList.add('visual-markdown-editor');
		this.toolbar = document.createElement('div');
		this.toolbar.className = 'visual-editor-toolbar';
		const content = document.createElement('div');
		content.className = 'visual-editor-content';
		parent.replaceChildren(this.toolbar, content);

		this.view = new EditorView(content, {
			state: this.createState('', onSave),
			editable: () => this.enabled,
			nodeViews: {
				math_inline: (node, view, getPos) => new MathNodeView(node, view, getPos),
				math_block: (node, view, getPos) => new MathNodeView(node, view, getPos),
			},
			dispatchTransaction: (transaction) => {
				const next = this.view.state.apply(transaction);
				this.view.updateState(next);
				if (transaction.docChanged) onChange(serializeVisualMarkdownBody(next.doc));
			},
		});

		for (const item of createToolbarItems()) {
			const button = document.createElement('button');
			button.type = 'button';
			button.textContent = item.label;
			button.title = item.title;
			button.addEventListener('mousedown', (event) => {
				event.preventDefault();
				if (this.enabled) item.command(this.view.state, this.view.dispatch, this.view);
				this.view.focus();
			});
			this.toolbar.append(button);
		}
	}

	private createState(body: string, onSave: () => void): EditorState {
		const listItem = schema.nodes.list_item as NodeType;
		return EditorState.create({
			doc: parseVisualMarkdownBody(body),
			plugins: [
				history(),
				inputRules({ rules: rulesForSchema() }),
				keymap({
					'Mod-s': () => { onSave(); return true; },
					'Mod-z': undo,
					'Mod-Shift-z': redo,
					Enter: (state, dispatch, view) => editSelectedMath(state, dispatch, view) || splitListItem(listItem)(state, dispatch, view),
					Tab: sinkListItem(listItem),
					'Shift-Tab': liftListItem(listItem),
				}),
				keymap(baseKeymap),
			],
		});
	}

	setValue(body: string, onSave: () => void): void {
		this.view.updateState(this.createState(body, onSave));
	}

	setEnabled(enabled: boolean): void {
		this.enabled = enabled;
		this.view.setProps({ editable: () => enabled });
		this.toolbar.toggleAttribute('inert', !enabled);
		if (enabled) this.view.focus();
	}
}

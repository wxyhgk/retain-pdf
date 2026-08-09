import { autocompletion, type CompletionContext, type CompletionResult } from '@codemirror/autocomplete';
import { indentWithTab } from '@codemirror/commands';
import { markdown } from '@codemirror/lang-markdown';
import { Compartment, EditorState } from '@codemirror/state';
import { keymap } from '@codemirror/view';
import { basicSetup, EditorView } from 'codemirror';

type MarkdownEditorOptions = {
	parent: HTMLElement;
	onChange: (content: string) => void;
	onSave: () => void;
};

type SlashCommand = {
	label: string;
	detail: string;
	insert: string;
	cursor: number;
};

const slashCommands: SlashCommand[] = [
	{ label: '/标题 1', detail: '一级标题', insert: '# ', cursor: 2 },
	{ label: '/标题 2', detail: '二级标题', insert: '## ', cursor: 3 },
	{ label: '/标题 3', detail: '三级标题', insert: '### ', cursor: 4 },
	{ label: '/公式', detail: '块级 LaTeX 公式', insert: '$$\n\n$$', cursor: 3 },
	{ label: '/化学方程', detail: 'mhchem 反应式', insert: '$$\n\\ce{}\n$$', cursor: 7 },
	{ label: '/SMILES', detail: '二维分子结构', insert: '```smiles\n\n```', cursor: 10 },
	{ label: '/SDF', detail: 'SDF/MOL 分子结构', insert: '```sdf\n\n```', cursor: 7 },
	{ label: '/XYZ', detail: '三维坐标或轨迹', insert: '```xyz\n\n```', cursor: 7 },
	{ label: '/GJF', detail: 'Gaussian 输入文件', insert: '```gjf\n\n```', cursor: 7 },
	{ label: '/代码', detail: '普通代码块', insert: '```\n\n```', cursor: 4 },
	{ label: '/引用', detail: '引用段落', insert: '> ', cursor: 2 },
	{ label: '/分隔线', detail: '内容分隔线', insert: '---\n', cursor: 4 },
];

function slashCompletion(context: CompletionContext): CompletionResult | null {
	const match = context.matchBefore(/\/[^\s/]*/u);
	if (!match) return null;
	const line = context.state.doc.lineAt(context.pos);
	if (match.from > line.from && !/\s/u.test(context.state.sliceDoc(match.from - 1, match.from))) return null;

	return {
		from: match.from,
		options: slashCommands.map((command) => ({
			label: command.label,
			detail: command.detail,
			type: 'keyword',
			apply(view: EditorView, _completion: unknown, from: number, to: number) {
				view.dispatch({
					changes: { from, to, insert: command.insert },
					selection: { anchor: from + command.cursor },
				});
			},
		})),
	};
}

const studioTheme = EditorView.theme({
	'&': {
		height: '100%',
		backgroundColor: 'var(--surface)',
		color: 'rgb(var(--gray-dark))',
	},
	'&.cm-focused': { outline: 'none' },
	'.cm-scroller': {
		fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, monospace',
		fontSize: '14px',
		lineHeight: '1.65',
		overflow: 'auto',
	},
	'.cm-content': { padding: '22px 8px 100px' },
	'.cm-line': { padding: '0 14px' },
	'.cm-gutters': {
		border: '0',
		backgroundColor: 'var(--surface)',
		color: 'rgb(var(--gray))',
	},
	'.cm-activeLine, .cm-activeLineGutter': { backgroundColor: 'var(--surface-soft)' },
	'.cm-cursor': { borderLeftColor: 'var(--accent)' },
	'.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
		backgroundColor: 'color-mix(in srgb, var(--accent) 18%, transparent)',
	},
	'.cm-tooltip': {
		border: '1px solid rgb(var(--gray-light))',
		borderRadius: '8px',
		backgroundColor: 'var(--surface)',
		boxShadow: '0 12px 30px rgba(0, 0, 0, 0.14)',
		overflow: 'hidden',
	},
	'.cm-tooltip-autocomplete > ul > li[aria-selected]': {
		backgroundColor: 'var(--surface-soft)',
		color: 'rgb(var(--black))',
	},
});

export class MarkdownEditor {
	private readonly editable = new Compartment();
	private readonly view: EditorView;
	private suppressChanges = false;

	constructor({ parent, onChange, onSave }: MarkdownEditorOptions) {
		this.view = new EditorView({
			parent,
			state: EditorState.create({
				doc: '',
				extensions: [
					basicSetup,
					markdown(),
					autocompletion({ override: [slashCompletion], activateOnTyping: true }),
					keymap.of([
						indentWithTab,
						{ key: 'Mod-s', preventDefault: true, run: () => { onSave(); return true; } },
					]),
					studioTheme,
					this.editable.of(EditorView.editable.of(false)),
					EditorView.updateListener.of((update) => {
						if (update.docChanged && !this.suppressChanges) onChange(update.state.doc.toString());
					}),
				],
			}),
		});
	}

	getValue(): string {
		return this.view.state.doc.toString();
	}

	setValue(content: string): void {
		this.suppressChanges = true;
		this.view.dispatch({ changes: { from: 0, to: this.view.state.doc.length, insert: content } });
		this.suppressChanges = false;
	}

	setEnabled(enabled: boolean): void {
		this.view.dispatch({ effects: this.editable.reconfigure(EditorView.editable.of(enabled)) });
		if (enabled) this.view.focus();
	}
}

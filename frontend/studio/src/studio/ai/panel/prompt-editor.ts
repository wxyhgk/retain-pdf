import { Crepe, CrepeFeature } from '@milkdown/crepe';
import { editorViewCtx, editorViewOptionsCtx, serializerCtx } from '@milkdown/kit/core';
import { remarkGFMPlugin } from '@milkdown/kit/preset/gfm';
import { Plugin, TextSelection } from '@milkdown/prose/state';
import type { EditorView } from '@milkdown/prose/view';
import { $prose, replaceAll } from '@milkdown/utils';
import { languages as codeMirrorLanguages } from '@codemirror/language-data';
import '@milkdown/crepe/theme/common/style.css';
import '@milkdown/crepe/theme/classic.css';
import 'katex/contrib/mhchem';

import { t } from '@blog/i18n/index.mjs';
import { gfmOptions } from '@blog/markdown/plugins/markdown-gfm.mjs';
import { displayMathPlugins } from '../../editor/display-math';
import { formulaTakesEnter, inlineMathPlugins } from '../../editor/inline-math';
import { mathBracketsRemark } from '../../editor/math-brackets';

/** Where the caret is, as the panel's menus need it: the words before it in its block; whether that is the first. */
export type PromptCaret = { before: string; first: boolean };

/** What the AI panel's input tells the panel. */
export type PromptEditorHost = {
	/** What is written changed (as Markdown), or where the caret is. */
	changed(markdown: string, caret: PromptCaret): void;
	/**
	 * A key, before the editor takes it: true when the panel took it (a menu's keys, Enter to send). `sends`: Enter
	 * here would send (not a formula's, not in code).
	 */
	key(event: KeyboardEvent, sends: boolean): boolean;
	/** Something pasted or dropped: true when the panel took it (pictures, words at length). */
	paste(event: ClipboardEvent): boolean;
	drop(event: DragEvent): boolean;
	focused(focus: boolean): void;
};

export type PromptEditor = {
	/** What is written replaced (the input emptied once said, words put back). */
	set(markdown: string): void;
	/** The `count` characters before the caret in its block replaced by `text` (an @ named, a command written). */
	replaceBefore(count: number, text: string): void;
	focus(): void;
	destroy(): void;
};

/** Where the caret is, as the panel's menus need it. */
function caretOf(view: EditorView): PromptCaret {
	const { $from } = view.state.selection;
	return { before: $from.parent.textBetween(0, $from.parentOffset, '\n', '￼'), first: $from.index(0) === 0 };
}

/**
 * The AI panel's input, written as articles are (formulas drawn as they are typed, with their completions; code;
 * lists): the article editor's own plugins, without what is for whole articles (blocks' handles, the / menu,
 * tables, pictures, the toolbar). What is written is Markdown. Enter is the panel's (to send) but in code, and where
 * a formula takes it.
 */
export async function createPromptEditor(root: HTMLElement, host: PromptEditorHost, value = ''): Promise<PromptEditor> {
	const crepe = new Crepe({
		root,
		defaultValue: value,
		features: {
			[CrepeFeature.TopBar]: false,
			[CrepeFeature.AI]: false,
			[CrepeFeature.BlockEdit]: false,
			[CrepeFeature.ImageBlock]: false,
			[CrepeFeature.Table]: false,
			[CrepeFeature.Toolbar]: false,
			[CrepeFeature.LinkTooltip]: false,
			[CrepeFeature.Placeholder]: false,
			// Nothing is dragged into it: no line showing where.
			[CrepeFeature.Cursor]: false,
		},
		featureConfigs: {
			[CrepeFeature.CodeMirror]: { languages: codeMirrorLanguages, copyText: t('复制'), searchPlaceholder: t('搜索语言'), noResultText: t('没有匹配的语言') },
			// Formulas are drawn by inline-math.ts and display-math.ts, as in articles.
			[CrepeFeature.Latex]: { blockPreview: false },
		},
	});
	let written = value;
	// What is written told as it changes (at once: Enter right after it sends it), and where the caret goes.
	const told = $prose((ctx) => new Plugin({
		view: () => ({
			update(view, before) {
				if (view.state.doc !== before.doc) written = ctx.get(serializerCtx)(view.state.doc);
				else if (view.state.selection.eq(before.selection)) return;
				host.changed(written, caretOf(view));
			},
		}),
	}));
	crepe.editor.use(inlineMathPlugins).use(displayMathPlugins).use(mathBracketsRemark).use(told);
	crepe.editor.config((ctx) => {
		ctx.set(remarkGFMPlugin.options.key, gfmOptions);
		ctx.update(editorViewOptionsCtx, (prev) => ({
			...prev,
			attributes: { ...(typeof prev.attributes === 'object' ? prev.attributes : {}), class: 'ai-input-doc', 'aria-label': t('对 AI 说'), role: 'textbox', 'aria-multiline': 'true' },
			// The panel first: its menus' keys, Enter to send (where it would not be a formula's, nor a line of code).
			handleKeyDown: (view, event) => {
				const { $from } = view.state.selection;
				const sends = !$from.parent.type.spec.code && !formulaTakesEnter(view.state);
				return host.key(event, sends);
			},
			handlePaste: (_view, event) => host.paste(event),
			handleDrop: (_view, event) => host.drop(event as DragEvent),
			handleDOMEvents: {
				focus: () => {
					host.focused(true);
					return false;
				},
				blur: () => {
					host.focused(false);
					return false;
				},
			},
		}));
	});
	await crepe.create();
	const view = crepe.editor.action((ctx) => ctx.get(editorViewCtx));
	return {
		set(markdown) {
			if (markdown.trim() === written.trim()) return;
			written = markdown;
			crepe.editor.action(replaceAll(markdown));
			view.dispatch(view.state.tr.setSelection(TextSelection.atEnd(view.state.doc)));
		},
		replaceBefore(count, text) {
			const { from, $from } = view.state.selection;
			view.dispatch(view.state.tr.insertText(text, Math.max($from.start(), from - count), from));
			view.focus();
		},
		focus: () => view.focus(),
		destroy: () => void crepe.destroy(),
	};
}

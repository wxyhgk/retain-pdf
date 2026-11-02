import { Crepe, CrepeFeature } from '@milkdown/crepe';
import { editorViewCtx, editorViewOptionsCtx, serializerCtx } from '@milkdown/kit/core';
import { remarkGFMPlugin } from '@milkdown/kit/preset/gfm';
import { Plugin, TextSelection } from '@milkdown/prose/state';
import type { Node as ProseNode } from '@milkdown/prose/model';
import type { EditorView } from '@milkdown/prose/view';
import { $prose, replaceAll } from '@milkdown/utils';
import { languages as codeMirrorLanguages } from '@codemirror/language-data';
import '@milkdown/crepe/theme/common/style.css';
import '@milkdown/crepe/theme/classic.css';
import 'katex/contrib/mhchem';

import { t } from '@blog/i18n/index.mjs';
import { ARTICLE_ADDRESS } from '@blog/markdown/articles/rules.mjs';
import { gfmOptions } from '@blog/markdown/plugins/markdown-gfm.mjs';
import { displayMathPlugins } from '@blog/editor-kit/math/display-math.ts';
import { formulaTakesEnter, inlineMathPlugins } from '@blog/editor-kit/math/inline-math.ts';
import { mathBracketsRemark } from '@blog/editor-kit/math/math-brackets.ts';

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
	/** The `count` characters before the caret in its block replaced by `text` (a command written). */
	replaceBefore(count: number, text: string): void;
	/** The `count` characters before the caret (an @ and what followed it) replaced by a link to an article, as its title. */
	mention(count: number, title: string, href: string): void;
	focus(): void;
	destroy(): void;
};

/** A link to one of the blog's articles (an @ named): `/blog/<slug>/`. */
const isArticleLink = (href: unknown) => typeof href === 'string' && ARTICLE_ADDRESS.test(href);

/**
 * The article named just before the caret (a link to one), from where to where: ⌫ there takes it whole, as Notion's
 * mentions are taken.
 */
function mentionBefore(view: EditorView): { from: number; to: number } | null {
	const { selection } = view.state;
	if (!selection.empty) return null;
	const { $from } = selection;
	const linked = (node: ProseNode | null | undefined) => node?.marks.find((mark) => mark.type.name === 'link' && isArticleLink(mark.attrs.href));
	const mark = linked($from.nodeBefore);
	if (!mark) return null;
	// The link's whole stretch in its block, around the caret.
	let from = $from.pos;
	let index = $from.index();
	while (index > 0 && mark.isInSet($from.parent.child(index - 1).marks)) {
		from -= $from.parent.child(index - 1).nodeSize;
		index -= 1;
	}
	return { from, to: $from.pos };
}

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
				const named = event.key === 'Backspace' && !event.altKey && !event.metaKey ? mentionBefore(view) : null;
				if (named) {
					view.dispatch(view.state.tr.delete(named.from, named.to));
					return true;
				}
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
		mention(count, title, href) {
			const { from, $from } = view.state.selection;
			const { schema } = view.state;
			const link = schema.marks.link!.create({ href, title: null });
			// A space after it, not part of it: what is typed next is not the link's.
			const tr = view.state.tr.replaceWith(Math.max($from.start(), from - count), from, [schema.text(title, [link]), schema.text(' ')]);
			view.dispatch(tr.setStoredMarks([]));
			view.focus();
		},
		focus: () => view.focus(),
		destroy: () => void crepe.destroy(),
	};
}

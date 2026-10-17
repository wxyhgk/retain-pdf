import { commandsCtx, editorViewCtx } from '@milkdown/kit/core';
import { clearTextInCurrentBlockCommand } from '@milkdown/kit/preset/commonmark';
import type { EditorView } from 'prosemirror-view';

import { linkArticleAt, type ArticleLinkHost } from './article-links.ts';
import { wrapInCallout } from './callout-block.ts';
import type { SlashMenuBuilder } from './science-slash-menu.ts';
import { wrapInToggle } from './toggle-block.ts';

const icon = (path: string) =>
	`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;

const ICONS = {
	callout: icon('<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M8 10h.01M11 10h5M8 14h8"/>'),
	toggle: icon('<path d="M6 8l4 4-4 4"/><path d="M13 12h7"/>'),
	link: icon('<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>'),
};

/** The editor, with the `/…` typed so far taken away. */
function emptiedBlock(ctx: never): EditorView {
	const context = ctx as { get: (slice: unknown) => never };
	const commands = context.get(commandsCtx) as { call: (key: unknown, payload?: unknown) => void };
	commands.call(clearTextInCurrentBlockCommand.key);
	return context.get(editorViewCtx) as EditorView;
}

/** Notion's blocks in the slash menu: a callout, a toggle, a link to another article. */
export function buildBlockSlashMenu(builder: SlashMenuBuilder, links: ArticleLinkHost): void {
	const group = builder.addGroup('notion', '块');
	group.addItem('callout', { label: '提示块', icon: ICONS.callout, keywords: ['callout', 'note', 'tip', 'admonition'], onRun: (ctx) => void wrapInCallout(emptiedBlock(ctx), 'tip') });
	group.addItem('toggle', { label: '折叠块', icon: ICONS.toggle, keywords: ['toggle', 'details', 'fold', 'collapse'], onRun: (ctx) => void wrapInToggle(emptiedBlock(ctx)) });
	group.addItem('article-link', {
		label: '链接到文章',
		icon: ICONS.link,
		keywords: ['link', 'page', 'article', 'mention'],
		onRun: (ctx) => {
			const view = emptiedBlock(ctx);
			void linkArticleAt(view, links, view.state.selection.from);
		},
	});
}

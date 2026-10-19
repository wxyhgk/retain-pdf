import { commandsCtx, editorViewCtx } from '@milkdown/kit/core';
import { clearTextInCurrentBlockCommand } from '@milkdown/kit/preset/commonmark';
import type { EditorView } from 'prosemirror-view';

import { linkArticleAt, type ArticleLinkHost } from './article-links.ts';
import { wrapInCallout } from './callout-block.ts';
import type { SlashMenuBuilder } from './science-slash-menu.ts';
import { wrapInToggle } from './toggle-block.ts';
import { insertJob } from './job-block.ts';
import { insertWidget } from './widget-block.ts';

const icon = (path: string) =>
	`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;

const ICONS = {
	callout: icon('<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M8 10h.01M11 10h5M8 14h8"/>'),
	toggle: icon('<path d="M6 8l4 4-4 4"/><path d="M13 12h7"/>'),
	widget: icon('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18"/><path d="M8 14l-2 2 2 2M16 14l2 2-2 2"/>'),
	job: icon('<path d="M9 3h6M10 3v5L4.5 18a2 2 0 0 0 1.8 3h11.4a2 2 0 0 0 1.8-3L14 8V3"/><path d="M10 15l2-2 2 2"/>'),
	link: icon('<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>'),
};

/** The editor, with the `/…` typed so far taken away. */
function emptiedBlock(ctx: never): EditorView {
	const context = ctx as { get: (slice: unknown) => never };
	const commands = context.get(commandsCtx) as { call: (key: unknown, payload?: unknown) => void };
	commands.call(clearTextInCurrentBlockCommand.key);
	return context.get(editorViewCtx) as EditorView;
}

/** Notion's blocks in the slash menu: a callout, a toggle, an interactive widget, a calculation, a link to another article. */
export function buildBlockSlashMenu(builder: SlashMenuBuilder, links: ArticleLinkHost): void {
	const group = builder.addGroup('notion', '块');
	group.addItem('callout', { label: '提示块', icon: ICONS.callout, keywords: ['callout', 'note', 'tip', 'admonition'], onRun: (ctx) => void wrapInCallout(emptiedBlock(ctx), 'tip') });
	group.addItem('toggle', { label: '折叠块', icon: ICONS.toggle, keywords: ['toggle', 'details', 'fold', 'collapse'], onRun: (ctx) => void wrapInToggle(emptiedBlock(ctx)) });
	group.addItem('widget', {
		label: '交互模块',
		icon: ICONS.widget,
		keywords: ['widget', 'html', 'interactive', 'embed', 'demo'],
		onRun: (ctx) => insertWidget(emptiedBlock(ctx)),
	});
	group.addItem('job', {
		label: '计算（xtb / CREST）',
		icon: ICONS.job,
		keywords: ['job', 'compute', 'calculation', 'xtb', 'crest', 'run', 'jisuan'],
		onRun: (ctx) => insertJob(emptiedBlock(ctx)),
	});
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

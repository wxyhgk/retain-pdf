import { commandsCtx, editorViewCtx } from '@milkdown/kit/core';
import { clearTextInCurrentBlockCommand } from '@milkdown/kit/preset/commonmark';
import type { EditorView } from 'prosemirror-view';

import { linkArticleAt, type ArticleLinkHost } from './article-links.ts';
import { wrapInCallout } from './callout-block.ts';
import { insertColumns } from './columns-block.ts';
import type { SlashMenuBuilder } from './science-slash-menu.ts';
import { wrapInToggle } from './toggle-block.ts';
import { insertWidget } from './widget-block.ts';
import type { StudioBlock } from '@blog/kernel/studio.ts';
import type { StudioCommand } from '@blog/kernel/ui.ts';

const icon = (path: string) =>
	`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;

const ICONS = {
	callout: icon('<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M8 10h.01M11 10h5M8 14h8"/>'),
	toggle: icon('<path d="M6 8l4 4-4 4"/><path d="M13 12h7"/>'),
	columns: icon('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M12 4v16"/>'),
	columns3: icon('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16M15 4v16"/>'),
	widget: icon('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18"/><path d="M8 14l-2 2 2 2M16 14l2 2-2 2"/>'),
	link: icon('<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>'),
	command: icon('<path d="M5 7l5 5-5 5"/><path d="M12 17h7"/>'),
};

/** The editor, with the `/…` typed so far taken away. */
function emptiedBlock(ctx: never): EditorView {
	const context = ctx as { get: (slice: unknown) => never };
	const commands = context.get(commandsCtx) as { call: (key: unknown, payload?: unknown) => void };
	commands.call(clearTextInCurrentBlockCommand.key);
	return context.get(editorViewCtx) as EditorView;
}

/** Notion's blocks in the slash menu: a callout, a toggle, columns, an interactive widget, the plugins' blocks (a calculation…), a link to another article. */
export function buildBlockSlashMenu(builder: SlashMenuBuilder, links: ArticleLinkHost, blocks: StudioBlock[] = []): void {
	const group = builder.addGroup('notion', '块');
	group.addItem('callout', { label: '提示块', icon: ICONS.callout, keywords: ['callout', 'note', 'tip', 'admonition'], onRun: (ctx) => void wrapInCallout(emptiedBlock(ctx), 'tip') });
	group.addItem('toggle', { label: '折叠块', icon: ICONS.toggle, keywords: ['toggle', 'details', 'fold', 'collapse'], onRun: (ctx) => void wrapInToggle(emptiedBlock(ctx)) });
	group.addItem('columns', { label: '两栏', icon: ICONS.columns, keywords: ['columns', 'column', 'split', 'side by side', '双栏', '分栏', '并排', 'shuanglan', 'fenlan', 'bingpai'], onRun: (ctx) => void insertColumns(emptiedBlock(ctx), 2) });
	group.addItem('columns-3', { label: '三栏', icon: ICONS.columns3, keywords: ['columns', 'three', '分栏', '多栏', '并排', 'fenlan', 'duolan'], onRun: (ctx) => void insertColumns(emptiedBlock(ctx), 3) });
	group.addItem('widget', {
		label: '交互模块',
		icon: ICONS.widget,
		keywords: ['widget', 'html', 'interactive', 'embed', 'demo'],
		onRun: (ctx) => insertWidget(emptiedBlock(ctx)),
	});
	for (const { menu } of blocks) {
		if (menu) group.addItem(menu.key, { label: menu.label, icon: menu.icon, keywords: menu.keywords ?? [], onRun: (ctx) => menu.insert(emptiedBlock(ctx)) });
	}
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

/** The plugins' commands shown in the slash menu (`ctx.commands`, `places: ['slash']`), as a group of their own; `run` runs one, the `/…` typed taken away. */
export function buildCommandSlashMenu(builder: SlashMenuBuilder, commands: StudioCommand[], run: (command: StudioCommand) => void): void {
	if (!commands.length) return;
	const group = builder.addGroup('plugin-commands', '插件');
	for (const command of commands) {
		group.addItem(`command:${command.id}`, {
			label: command.label,
			icon: command.icon ?? ICONS.command,
			keywords: [command.id, ...(command.keywords ?? [])],
			onRun: (ctx) => {
				emptiedBlock(ctx);
				run(command);
			},
		});
	}
}

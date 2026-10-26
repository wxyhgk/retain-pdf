import { commandsCtx, editorViewCtx } from '@milkdown/kit/core';
import { clearTextInCurrentBlockCommand } from '@milkdown/kit/preset/commonmark';
import type { EditorView } from 'prosemirror-view';

import { insertPage, linkArticleAt, type ArticleLinkHost } from './article-links.ts';
import { wrapInCallout } from './callout-block.ts';
import { insertColumns } from './columns-block.ts';
import { wrapInToggle } from './toggle-block.ts';
import type { StudioBlock } from '@blog/kernel/studio.ts';
import type { StudioCommand } from '@blog/kernel/ui.ts';
import { t } from '@blog/i18n/index.mjs';

/** Crepe's slash menu builder (BlockEdit's `buildMenu`), as much of it as is used here. */
export type SlashMenuBuilder = {
	addGroup: (
		key: string,
		label: string,
	) => {
		addItem: (key: string, item: { label: string; icon: string; keywords?: string[]; onRun: (ctx: never) => void }) => unknown;
	};
};

const icon = (path: string) =>
	`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;

const ICONS = {
	callout: icon('<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M8 10h.01M11 10h5M8 14h8"/>'),
	toggle: icon('<path d="M6 8l4 4-4 4"/><path d="M13 12h7"/>'),
	columns: icon('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M12 4v16"/>'),
	columns3: icon('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16M15 4v16"/>'),
	page: icon('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>'),
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

/** Notion's blocks in the slash menu: a page under the article, a callout, a toggle, columns, the plugins' blocks (a widget, a calculation…), a link to another article. */
export function buildBlockSlashMenu(builder: SlashMenuBuilder, links: ArticleLinkHost, blocks: StudioBlock[] = []): void {
	const add = (into: ReturnType<SlashMenuBuilder['addGroup']>, block: StudioBlock) => {
		for (const entry of [block.menu ?? []].flat()) {
			into.addItem(entry.key, { label: entry.label, icon: entry.icon, keywords: entry.keywords ?? [], onRun: (ctx) => entry.insert(emptiedBlock(ctx)) });
		}
	};
	// The plugins' blocks with a group of their own (化学) come first, each group once.
	const groups = new Map<string, ReturnType<SlashMenuBuilder['addGroup']>>();
	for (const block of blocks) {
		if (!block.menuGroup || !block.menu) continue;
		const { key, label } = block.menuGroup;
		if (!groups.has(key)) groups.set(key, builder.addGroup(key, label));
		add(groups.get(key)!, block);
	}
	const group = builder.addGroup('notion', t('块'));
	group.addItem('page', {
		label: t('页面'),
		icon: ICONS.page,
		keywords: ['page', 'subpage', 'new page', '子页面', '新页面', '新建页面', 'yemian', 'ziyemian'], // i18n-ignore: matched against what is typed
		onRun: (ctx) => void insertPage(emptiedBlock(ctx), links),
	});
	group.addItem('callout', { label: t('提示块'), icon: ICONS.callout, keywords: ['callout', 'note', 'tip', 'admonition'], onRun: (ctx) => void wrapInCallout(emptiedBlock(ctx), 'tip') });
	group.addItem('toggle', { label: t('折叠块'), icon: ICONS.toggle, keywords: ['toggle', 'details', 'fold', 'collapse'], onRun: (ctx) => void wrapInToggle(emptiedBlock(ctx)) });
	group.addItem('columns', { label: t('两栏'), icon: ICONS.columns, keywords: ['columns', 'column', 'split', 'side by side', '双栏', '分栏', '并排', 'shuanglan', 'fenlan', 'bingpai'], onRun: (ctx) => void insertColumns(emptiedBlock(ctx), 2) }); // i18n-ignore: keywords matched against what is typed
	group.addItem('columns-3', { label: t('三栏'), icon: ICONS.columns3, keywords: ['columns', 'three', '分栏', '多栏', '并排', 'fenlan', 'duolan'], onRun: (ctx) => void insertColumns(emptiedBlock(ctx), 3) }); // i18n-ignore: keywords matched against what is typed
	// The others (a widget, a calculation…) are among these.
	for (const block of blocks) if (!block.menuGroup) add(group, block);
	group.addItem('article-link', {
		label: t('链接到文章'),
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
	const group = builder.addGroup('plugin-commands', t('插件'));
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

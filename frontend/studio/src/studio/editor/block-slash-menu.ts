import { placePick, type MenuPlace } from '@milkdown/crepe/feature/block-edit';
import { editorViewCtx } from '@milkdown/kit/core';
import type { EditorView } from 'prosemirror-view';

import { insertInlineFormula } from '@blog/editor-kit/math/inline-math.ts';

import { insertPage, linkArticleAt, type ArticleLinkHost } from './article-links.ts';
import { wrapInCallout } from './callout-block.ts';
import { insertColumns } from './columns-block.ts';
import { wrapInToggle } from './toggle-block.ts';
import { insertDatabase } from './database/database-block.ts';
import type { StudioBlock } from '@blog/kernel/studio.ts';
import type { StudioCommand } from '@blog/kernel/ui.ts';
import { t } from '@blog/i18n/index.mjs';

/** Crepe's slash menu builder (BlockEdit's `buildMenu`), as much of it as is used here. */
export type SlashMenuBuilder = {
	addGroup: (
		key: string,
		label: string,
	) => {
		addItem: (key: string, item: { label: string; icon: string; keywords?: string[]; description?: string; hint?: string; onRun: (ctx: never) => void }) => unknown;
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
	database: icon('<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>'),
	template: icon('<rect x="3" y="3" width="18" height="7" rx="1"/><rect x="3" y="14" width="9" height="7" rx="1"/><rect x="16" y="14" width="5" height="7" rx="1"/>'),
	inlineMath: icon('<path d="M8 21s-4-3-4-9 4-9 4-9"/><path d="M16 3s4 3 4 9-4 9-4 9"/><path d="M15 9l-6 6M9 9l6 6"/>'),
};

/** The editor, the `/…` typed taken away and room made for what was picked (`how`: see `MenuPlace`). */
function placed(ctx: never, how: MenuPlace): EditorView {
	placePick(ctx, how);
	return (ctx as { get: (slice: unknown) => never }).get(editorViewCtx) as EditorView;
}

/** Notion's blocks in the slash menu: a page under the article, a callout, a toggle, columns, the plugins' blocks (a widget, a calculation…), a link to another article. */
export function buildBlockSlashMenu(builder: SlashMenuBuilder, links: ArticleLinkHost, blocks: StudioBlock[] = [], templates?: { pick(view: EditorView): void }): void {
	const add = (into: ReturnType<SlashMenuBuilder['addGroup']>, block: StudioBlock) => {
		for (const entry of [block.menu ?? []].flat()) {
			into.addItem(entry.key, { label: entry.label, icon: entry.icon, keywords: entry.keywords ?? [], description: entry.description, hint: entry.hint, onRun: (ctx) => entry.insert(placed(ctx, entry.place ?? 'below')) });
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
		description: t('在这篇下面新建一个子页面'),
		icon: ICONS.page,
		keywords: ['page', 'subpage', 'new page', '子页面', '新页面', '新建页面', 'yemian', 'ziyemian'], // i18n-ignore: matched against what is typed
		onRun: (ctx) => void insertPage(placed(ctx, 'below'), links),
	});
	if (templates) {
		group.addItem('template', {
			label: t('模板'),
			description: t('把一个模板的内容放在这里'),
			icon: ICONS.template,
			keywords: ['template', '模板', 'muban', 'mb'], // i18n-ignore: matched against what is typed
			onRun: (ctx) => templates.pick(placed(ctx, 'inline')),
		});
	}
	group.addItem('database', {
		label: t('数据库'),
		description: t('在这里放一个新数据库（它自己是一页，在这一页下面）'),
		icon: ICONS.database,
		keywords: ['database', 'table', 'board', 'kanban', '数据库', '表格', '看板', 'shujuku', 'sjk'], // i18n-ignore: matched against what is typed
		onRun: (ctx) => insertDatabase(placed(ctx, 'below')),
	});
	group.addItem('callout', { label: t('提示块'), description: t('让一段话醒目'), icon: ICONS.callout, keywords: ['callout', 'note', 'tip', 'admonition'], onRun: (ctx) => void wrapInCallout(placed(ctx, 'turn'), 'tip') });
	group.addItem('toggle', { label: t('折叠块'), description: t('把内容收起来，点开再看'), icon: ICONS.toggle, keywords: ['toggle', 'details', 'fold', 'collapse'], onRun: (ctx) => void wrapInToggle(placed(ctx, 'turn')) });
	group.addItem('columns', { label: t('两栏'), description: t('左右并排两块内容'), icon: ICONS.columns, keywords: ['columns', 'column', 'split', 'side by side', '双栏', '分栏', '并排', 'shuanglan', 'fenlan', 'bingpai'], onRun: (ctx) => void insertColumns(placed(ctx, 'below'), 2) }); // i18n-ignore: keywords matched against what is typed
	group.addItem('columns-3', { label: t('三栏'), description: t('并排三块内容'), icon: ICONS.columns3, keywords: ['columns', 'three', '分栏', '多栏', '并排', 'fenlan', 'duolan'], onRun: (ctx) => void insertColumns(placed(ctx, 'below'), 3) }); // i18n-ignore: keywords matched against what is typed
	// The others (a widget, a calculation…) are among these.
	for (const block of blocks) if (!block.menuGroup) add(group, block);
	group.addItem('article-link', {
		label: t('链接到文章'),
		description: t('在光标处链接另一篇'),
		hint: '[[',
		icon: ICONS.link,
		keywords: ['link', 'page', 'article', 'mention'],
		onRun: (ctx) => {
			const view = placed(ctx, 'inline');
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
				placed(ctx, 'inline');
				run(command);
			},
		});
	}
}

type ItemsOf = { getGroup(key: string): { group: { items: Array<{ key: string } & Record<string, unknown>> } } };

/**
 * 行内公式 in the menu's 插入, after 公式 (as thought-desk has Inline Math beside Math Equation): a formula in the
 * sentence where `/` was typed, being written; ⌘⇧E does the same.
 */
export function addInlineFormulaItem(builder: ItemsOf): void {
	const { items } = builder.getGroup('advanced').group;
	const at = items.findIndex((item) => item.key === 'math');
	items.splice(at < 0 ? items.length : at + 1, 0, {
		key: 'inline-math',
		label: t('行内公式'),
		description: t('句子里的公式，⌘⇧E'),
		hint: '$…$',
		icon: ICONS.inlineMath,
		// 行 read hang here (pinyin-pro reads it xing).
		keywords: ['inline math', 'inline', 'math', 'formula', 'equation', 'latex', 'tex', 'katex', '公式', 'hangnei', 'hangneigongshi', 'hngs', 'gongshi', 'gs'], // i18n-ignore: matched against what is typed
		onRun: (ctx: never) => void insertInlineFormula(placed(ctx, 'inline')),
	});
}

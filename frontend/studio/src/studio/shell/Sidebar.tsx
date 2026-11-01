import type { ComponentProps, ReactNode } from 'react';
import { Blocks, CalendarDays, ChevronDown, FolderUp, Upload, FileText, Globe, House, Languages, Library, MessageCircle, Plus, Search, Settings, SquarePen, StarOff, Table2, Trash2, type LucideIcon } from 'lucide-react';

import { t } from '@blog/i18n/index.mjs';
import { cn } from '@studio/lib/utils';
import { Button } from '@studio/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@studio/ui/dropdown-menu';
import { Kbd } from '@studio/ui/kbd';
import { showContextMenu } from '../common/context-menu';
import { ChatList } from './ChatList';
import { useActions, useShell } from './shell-state';

/** A line of the left column: an icon, what it does, how many there are (`count`); `href` makes it a link. */
function Item({ icon: Icon, href, count, children, className, ...props }: { icon: LucideIcon; href?: string; count?: number; children: ReactNode } & ComponentProps<'button'>) {
	const look = cn('h-8 w-full justify-start gap-2.5 rounded-lg px-2 has-[>svg]:px-2 text-[14px] font-normal text-foreground hover:bg-[var(--studio-fill)] aria-pressed:bg-[var(--studio-fill-2)]', className);
	const inside = (
		<>
			<Icon aria-hidden className="size-4 text-muted-foreground" />
			<span className="min-w-0 flex-1 truncate text-left">{children}</span>
			{count !== undefined && count > 0 && <span className="text-[12px] text-muted-foreground tabular-nums">{count}</span>}
		</>
	);
	if (href)
		return (
			<Button asChild variant="ghost" className={look}>
				<a href={href}>{inside}</a>
			</Button>
		);
	return (
		<Button type="button" variant="ghost" className={look} {...props}>
			{inside}
		</Button>
	);
}

/** A heading over a group of the left column (常用, the pages, the conversations); with ＋ to make one, where there is. */
function Heading({ title, add, label, onAdd, hidden }: { title: string; add?: string; label?: string; onAdd?(): void; hidden: boolean }) {
	return (
		<div className="flex min-h-8 items-center justify-between pt-2 pr-[11px] pl-[15px]" hidden={hidden}>
			<h2 className="text-[12px] font-medium text-muted-foreground">{title}</h2>
			{onAdd && (
				<Button id={add} type="button" variant="ghost" size="icon-xs" className="text-muted-foreground hover:text-foreground" title={label} aria-label={label} onClick={onAdd}>
					<Plus aria-hidden className="size-4" />
				</Button>
			)}
		</div>
	);
}

/** 常用: the pages starred, each opened with a click; its menu (the right button) to unstar it. */
function Favorites({ hidden }: { hidden: boolean }) {
	const { favorites } = useShell();
	const act = useActions();
	if (!favorites.length) return null;
	return (
		<>
			<Heading title={t('常用')} hidden={hidden} />
			<div id="favorites" className="grid gap-px px-[7px] pb-1" hidden={hidden}>
				{favorites.map((page) => (
					<Button
						key={page.slug}
						type="button"
						variant="ghost"
						data-slug={page.slug}
						className="h-8 w-full justify-start gap-2.5 rounded-lg px-2 has-[>svg]:px-2 text-[14px] font-normal text-foreground hover:bg-[var(--studio-fill)]"
						title={page.title}
						onClick={() => act.openPage(page.slug)}
						onContextMenu={(event) => {
							event.preventDefault();
							showContextMenu([{ label: t('移出常用'), icon: StarOff, action: () => act.toggleFavorite(page.slug) }], { x: event.clientX, y: event.clientY });
						}}
					>
						{page.icon ? <span className="grid size-4 place-items-center text-[15px] leading-none">{page.icon}</span> : <FileText aria-hidden className="size-4 text-muted-foreground" />}
						<span className="min-w-0 flex-1 truncate text-left">{page.title}</span>
					</Button>
				))}
			</div>
		</>
	);
}

/** 页面 or AI 问答, as Notion's icons under its search: what the column lists, and the middle shows. */
function Mode({ id, icon: Icon, label, selected, onClick }: { id: string; icon: LucideIcon; label: string; selected: boolean; onClick(): void }) {
	return (
		<button
			id={id}
			role="tab"
			type="button"
			aria-selected={selected}
			aria-label={label}
			title={label}
			className="grid size-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-[var(--studio-fill)] hover:text-foreground aria-selected:bg-[var(--studio-fill-2)] aria-selected:text-foreground"
			onClick={onClick}
		>
			<Icon aria-hidden className="size-4" />
		</button>
	);
}

/** The foot of the column, as Notion's workspace: the blog, the trash, the plugins and the settings, in a menu. */
function WorkspaceMenu({ siteTitle }: { siteTitle: string }) {
	const act = useActions();
	const item = 'gap-2.5 text-xs [&_svg]:size-[15px] [&_svg]:text-muted-foreground';
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button id="workspace-menu" type="button" variant="ghost" className="h-9 w-full justify-start gap-2 rounded-lg px-2 has-[>svg]:px-2 text-[14px] font-normal text-foreground hover:bg-[var(--studio-fill)]">
					<span className="grid size-5 flex-none place-items-center rounded-[5px] bg-primary text-[10px] font-extrabold text-primary-foreground">C</span>
					<strong className="min-w-0 truncate font-semibold">{siteTitle}</strong>
					<ChevronDown aria-hidden className="size-3.5 text-muted-foreground" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent side="top" align="start" className="w-56">
				<DropdownMenuItem asChild className={item}>
					<a href="/blog/">
						<Globe aria-hidden />
						{t('博客首页')}
					</a>
				</DropdownMenuItem>
				<DropdownMenuItem id="import-markdown-files" className={item} onSelect={() => act.importMarkdown('files')}>
					<Upload aria-hidden />
					{t('导入 Markdown 文件…')}
				</DropdownMenuItem>
				<DropdownMenuItem id="import-markdown-folder" className={item} onSelect={() => act.importMarkdown('folder')}>
					<FolderUp aria-hidden />
					{t('导入 Markdown 文件夹…')}
				</DropdownMenuItem>
				<DropdownMenuItem id="open-trash" className={item} onSelect={act.openTrash}>
					<Trash2 aria-hidden />
					{t('回收站')}
				</DropdownMenuItem>
				<DropdownMenuSeparator />
				<DropdownMenuItem id="open-settings" className={item} onSelect={act.openSettings}>
					<Settings aria-hidden />
					{t('设置')}
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

/**
 * The left column, as Notion's: search and the other views at the top; the pages (the tree, article-list.ts draws it)
 * or the conversations of AI 问答; the workspace's menu (the blog, the trash, the plugins, the settings) at the foot.
 */
export function Sidebar({ siteTitle }: { siteTitle: string }) {
	const { view, chats, chat, count } = useShell();
	const act = useActions();
	const chatting = view === 'chat';
	const toggle = (to: 'drive' | 'table' | 'translate') => () => act.showView(view === to ? 'editor' : to);
	return (
		<>
			<div className="flex items-center gap-1 px-[9px] pt-2.5 pb-1">
				{/* Looks like a search box, as Notion's: opens ⌘K. */}
				<button
					id="open-search"
					type="button"
					className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-lg bg-[var(--studio-fill-2)] px-2.5 text-[13px] text-muted-foreground transition-colors hover:bg-[var(--studio-fill-3)] hover:text-foreground"
					onClick={act.search}
				>
					<Search aria-hidden className="size-4" />
					<span className="flex-1 truncate text-left">{t('搜索')}</span>
					<Kbd className="h-[18px] rounded-[5px] bg-[var(--surface)] px-1.5 text-xs text-muted-foreground shadow-xs">⌘K</Kbd>
				</button>
				<Button id="new-article-secondary" type="button" variant="ghost" size="icon-sm" className="size-7 text-muted-foreground hover:text-foreground" title={t('新建文章')} aria-label={t('新建文章')} onClick={act.newPage}>
					<SquarePen aria-hidden className="size-4" />
				</Button>
			</div>
			<div className="flex items-center gap-0.5 px-[9px] pb-1.5" role="tablist" aria-label={t('侧边栏')}>
				<Mode id="sidebar-pages" icon={House} label={t('页面')} selected={!chatting} onClick={() => act.showView('editor')} />
				<Mode id="sidebar-chats" icon={MessageCircle} label={t('AI 问答')} selected={chatting} onClick={() => act.showView('chat')} />
			</div>
			<div className="grid gap-px px-[7px] pb-2">
				<Item id="open-table" icon={Table2} count={count} aria-pressed={view === 'table'} onClick={toggle('table')}>
					{t('全部文章')}
				</Item>
				<Item id="open-drive" icon={Library} aria-pressed={view === 'drive'} onClick={toggle('drive')}>
					{t('资料库')}
				</Item>
				{/* RetainPDF's own pages (the books, translating, reading) in the middle: wiring/retainpdf-view.ts. */}
				<Item id="open-translate" icon={Languages} aria-pressed={view === 'translate'} onClick={toggle('translate')}>
					{t('翻译')}
				</Item>
				{/* Today's page under 日志 (as SiYuan's daily note), made from templates/journal.md the first time today. */}
				<Item id="open-today" icon={CalendarDays} onClick={act.todayJournal}>
					{t('今天的日志')}
				</Item>
				{/* The 小程序 page: their list, or the one open there (mini-apps.ts). */}
				{/* Not a toggle: from elsewhere to the app left open there, and there to their list. */}
				<Item id="open-apps" icon={Blocks} aria-pressed={view === 'apps'} onClick={() => act.showView('apps')}>
					{t('小程序')}
				</Item>
				{/* The plugins' commands (ctx.commands, places: ['sidebar']): plugin-ui.ts draws them. */}
				<div id="plugin-commands" className="plugin-commands" data-host hidden />
			</div>
			<Favorites hidden={chatting} />
			<Heading title={t('页面')} add="new-article" label={t('新建文章')} onAdd={act.newPage} hidden={chatting} />
			{/* The pages, as a tree: article-list.ts draws it. */}
			<nav id="article-list" aria-label={t('页面列表')} data-host hidden={chatting} />
			<Heading title={t('对话')} add="new-chat" label={t('新建对话')} onAdd={act.newChat} hidden={!chatting} />
			<nav id="chat-list" aria-label={t('对话列表')} className="min-h-0 flex-1 overflow-y-auto px-[7px] pt-px pb-8" hidden={!chatting}>
				<ChatList chats={chats} chosen={chat} />
			</nav>
			<div className="px-[7px] py-1.5">
				<WorkspaceMenu siteTitle={siteTitle} />
			</div>
		</>
	);
}

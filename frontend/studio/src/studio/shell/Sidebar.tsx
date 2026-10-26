import type { ComponentProps, ReactNode } from 'react';
import { Blocks, FileText, Globe, House, Languages, Library, MessagesSquare, Plus, Puzzle, Search, Settings2, SquarePen, Table2, Trash2, type LucideIcon } from 'lucide-react';

import { t } from '@blog/i18n/index.mjs';
import { cn } from '@studio/lib/utils';
import { Button } from '@studio/ui/button';
import { Kbd } from '@studio/ui/kbd';
import { ChatList } from './ChatList';
import { useActions, useShell } from './shell-state';

/** A line of the left column: an icon, what it does; `href` makes it a link. */
function Item({ icon: Icon, href, children, className, ...props }: { icon: LucideIcon; href?: string; children: ReactNode } & ComponentProps<'button'>) {
	const look = cn('h-[31px] w-full justify-start gap-2.5 px-2 has-[>svg]:px-2 text-xs font-normal text-foreground aria-pressed:bg-accent', className);
	const inside = (
		<>
			<Icon aria-hidden className="size-[15px] text-muted-foreground" />
			{children}
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

/** A heading over the pages or the conversations, with ＋ to make one. */
function Heading({ title, add, label, onAdd, hidden }: { title: string; add: string; label: string; onAdd(): void; hidden: boolean }) {
	return (
		<div className="flex min-h-[31px] items-center justify-between pr-[11px] pl-[15px]" hidden={hidden}>
			<h2 className="text-[10px] font-bold tracking-[0.04em] text-muted-foreground">{title}</h2>
			<Button id={add} type="button" variant="ghost" size="icon-xs" className="text-muted-foreground hover:text-foreground" title={label} aria-label={label} onClick={onAdd}>
				<Plus aria-hidden className="size-4" />
			</Button>
		</div>
	);
}

/** 页面 or AI 问答, as Notion's: what the column lists, and the middle shows. */
function Mode({ id, icon: Icon, selected, onClick, children }: { id: string; icon: LucideIcon; selected: boolean; onClick(): void; children: ReactNode }) {
	return (
		<button
			id={id}
			role="tab"
			type="button"
			aria-selected={selected}
			className="flex h-[26px] items-center justify-center gap-1.5 rounded-[5px] text-xs text-muted-foreground transition-colors hover:text-foreground aria-selected:bg-background aria-selected:text-accent-foreground aria-selected:shadow-xs"
			onClick={onClick}
		>
			<Icon aria-hidden className="size-3.5" />
			{children}
		</button>
	);
}

/**
 * The left column, as Notion's: the way to the blog, search and the other views; the pages (the tree, article-list.ts
 * draws it) or the conversations of AI 问答; the trash, the plugins and the settings at the foot.
 */
export function Sidebar({ siteTitle }: { siteTitle: string }) {
	const { view, chats, chat } = useShell();
	const act = useActions();
	const chatting = view === 'chat';
	const toggle = (to: 'drive' | 'table') => () => act.showView(view === to ? 'editor' : to);
	return (
		<>
			<div className="flex min-h-12 items-center gap-2 px-[11px]">
				<a href="/" className="flex min-w-0 flex-1 items-center gap-2 text-foreground hover:text-foreground">
					<span className="grid size-[23px] flex-none place-items-center rounded-[5px] bg-primary text-[11px] font-extrabold text-primary-foreground">C</span>
					<strong className="truncate text-xs">{siteTitle}</strong>
				</a>
				<span className="rounded-sm bg-accent px-[5px] py-0.5 text-[8px] font-bold tracking-[0.08em] text-muted-foreground uppercase">Studio</span>
			</div>
			<div className="grid gap-0.5 px-[7px] pt-1 pb-[9px]">
				<Item icon={House} href="/">
					{t('首页')}
				</Item>
				<Item id="open-search" icon={Search} onClick={act.search}>
					{t('搜索')}
					<Kbd className="ml-auto h-4 bg-transparent px-0 text-[10px] text-muted-foreground">⌘K</Kbd>
				</Item>
				<Item id="open-table" icon={Table2} aria-pressed={view === 'table'} onClick={toggle('table')}>
					{t('全部文章')}
				</Item>
				<Item id="open-drive" icon={Library} aria-pressed={view === 'drive'} onClick={toggle('drive')}>
					{t('资料库')}
				</Item>
				{/* Its menu is mini-apps.ts's. */}
				<Item id="open-apps" icon={Blocks} aria-haspopup="menu">
					{t('小程序')}
				</Item>
			</div>
			{/* The plugins' commands (ctx.commands, places: ['sidebar']): plugin-ui.ts draws them. */}
			<div id="plugin-commands" className="plugin-commands" data-host hidden />
			<div className="mx-[7px] mb-1.5 grid grid-cols-2 gap-0.5 rounded-[7px] bg-accent p-0.5" role="tablist" aria-label={t('侧边栏')}>
				<Mode id="sidebar-pages" icon={FileText} selected={!chatting} onClick={() => act.showView('editor')}>
					{t('页面')}
				</Mode>
				<Mode id="sidebar-chats" icon={MessagesSquare} selected={chatting} onClick={() => act.showView('chat')}>
					{t('AI 问答')}
				</Mode>
			</div>
			<Heading title="Private" add="new-article" label={t('新建文章')} onAdd={act.newPage} hidden={chatting} />
			{/* The pages, as a tree: article-list.ts draws it. */}
			<nav id="article-list" aria-label={t('页面列表')} data-host hidden={chatting} />
			<Heading title={t('对话')} add="new-chat" label={t('新建对话')} onAdd={act.newChat} hidden={!chatting} />
			<nav id="chat-list" aria-label={t('对话列表')} className="min-h-0 flex-1 overflow-y-auto px-[7px] pt-px pb-8" hidden={!chatting}>
				<ChatList chats={chats} chosen={chat} />
			</nav>
			<div className="grid gap-0.5 border-t p-[7px]">
				<Item id="new-article-secondary" icon={SquarePen} onClick={act.newPage}>
					{t('新建文章')}
				</Item>
				<Item icon={Globe} href="/blog/">
					{t('博客首页')}
				</Item>
				<Item id="open-trash" icon={Trash2} onClick={act.openTrash}>
					{t('回收站')}
				</Item>
				<Item id="open-plugins" icon={Puzzle} onClick={act.openPlugins}>
					{t('插件')}
				</Item>
				<Item id="open-ai-settings" icon={Settings2} onClick={act.openAiSettings}>
					{t('AI 设置')}
				</Item>
				<Item id="open-locale" icon={Languages} onClick={act.openLocale}>
					{t('语言')}
				</Item>
			</div>
		</>
	);
}

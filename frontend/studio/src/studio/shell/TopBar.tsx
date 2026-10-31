import { useEffect, useState, type ComponentProps } from 'react';
import { ChevronLeft, ChevronRight, Ellipsis, ExternalLink, FileText, PanelLeft, PanelRight, Star } from 'lucide-react';

import { locale, t } from '@blog/i18n/index.mjs';
import { cn } from '@studio/lib/utils';
import { Button } from '@studio/ui/button';
import { showContextMenu } from '../common/context-menu';
import { timeAgo } from '../common/time-ago';
import { shell, useActions, useShell, type View } from './shell-state';

/** What the bar calls a view other than the article's. */
function viewName(view: Exclude<View, 'editor'>): string {
	const names: Record<Exclude<View, 'editor'>, string> = { drive: t('资料库'), table: t('全部文章'), chat: t('AI 问答'), apps: t('小程序') };
	return names[view];
}

function IconButton({ className, ...props }: ComponentProps<'button'>) {
	return <Button type="button" variant="ghost" size="icon-sm" className={cn('size-7 text-muted-foreground hover:text-foreground aria-pressed:text-foreground [&_svg]:size-4', className)} {...props} />;
}

/** A page's icon in the bar: its emoji, or a page drawn. */
function PageIcon({ icon }: { icon?: string }) {
	return icon ? <span className="grid size-4 flex-none place-items-center text-[14px] leading-none">{icon}</span> : <FileText aria-hidden className="size-4 flex-none text-muted-foreground" />;
}

/** Drawn again every `ms`, for what says how long ago something was. */
function useTicking(ms: number): void {
	const [, tick] = useState(0);
	useEffect(() => {
		const timer = window.setInterval(() => tick((count) => count + 1), ms);
		return () => window.clearInterval(timer);
	}, [ms]);
}

/** The bar above the middle: the sidebar's toggle, where one is, when the article was edited and saved, its menu, the right column's toggle. */
export function TopBar({ siteTitle }: { siteTitle: string }) {
	const { view, sidebarCollapsed, title, icon, status, edited, articleHref, panelOpen, nav, path, favorite } = useShell();
	const act = useActions();
	useTicking(30_000);
	const article = view === 'editor';
	return (
		<>
			<div className="flex min-w-0 items-center gap-[5px] text-[13px]">
				<IconButton
					id="toggle-sidebar"
					aria-label={sidebarCollapsed ? t('展开侧边栏') : t('收起侧边栏')}
					aria-pressed={sidebarCollapsed}
					onClick={() => shell.set({ sidebarCollapsed: !sidebarCollapsed })}
				>
					<PanelLeft aria-hidden />
				</IconButton>
				<IconButton id="go-back" aria-label={t('后退')} title={t('后退')} disabled={!nav.back} onClick={act.back}>
					<ChevronLeft aria-hidden />
				</IconButton>
				<IconButton id="go-forward" aria-label={t('前进')} title={t('前进')} disabled={!nav.forward} onClick={act.forward} className="mr-1">
					<ChevronRight aria-hidden />
				</IconButton>
				{/* The pages the open one is under, as Notion's path, each with its icon; the › after each, a menu of the pages under it (as SiYuan's). */}
				{article &&
					path.map((page) => [
						<button key={`${page.slug}:link`} type="button" className="page-path-link flex h-7 max-w-[180px] min-w-0 items-center gap-1.5 rounded-md px-1.5 text-muted-foreground hover:bg-[var(--studio-fill)] hover:text-foreground max-[720px]:hidden" onClick={() => act.openPage(page.slug)}>
							<PageIcon icon={page.icon} />
							<span className="truncate">{page.title}</span>
						</button>,
						<button
							key={`${page.slug}:under`}
							type="button"
							className="page-path-separator grid h-7 w-4 place-items-center rounded-md text-muted-foreground/70 hover:bg-[var(--studio-fill)] hover:text-foreground max-[720px]:hidden"
							aria-label={t('「{title}」下面的页面', { title: page.title })}
							onClick={(event) => showContextMenu(act.pagesUnder(page.slug).map((child) => ({ label: child.title, icon: FileText, action: () => act.openPage(child.slug) })), event.currentTarget)}
						>
							<ChevronRight aria-hidden className="size-3.5" />
						</button>,
					])}
				{article && (
					<span className="flex min-w-0 items-center gap-1.5 px-1">
						<PageIcon icon={icon} />
						<strong id="breadcrumb-title" className="max-w-[340px] truncate font-semibold max-[720px]:max-w-[150px]" title={title}>
							{title}
						</strong>
					</span>
				)}
				{!article && <strong className="truncate font-semibold">{viewName(view)}</strong>}
			</div>
			<div className="flex min-w-0 items-center gap-[7px]">
				<span id="edited-at" className="text-xs whitespace-nowrap text-muted-foreground opacity-85" title={edited === null ? '' : new Date(edited).toLocaleString(locale())} hidden={!article}>
					{edited === null ? '' : t('编辑于{time}', { time: timeAgo(edited) })}
				</span>
				{/* Saved, nothing is said (as in Notion): only what is waiting, under way or wrong. */}
				<span
					id="save-status"
					className="max-w-[230px] truncate text-xs text-muted-foreground data-[state=error]:text-destructive data-[state=saved]:sr-only max-[720px]:hidden"
					data-state={status.tone}
					title={t('改动会自动保存，⌘S 立即保存')}
					aria-live="polite"
					hidden={!article}
				>
					{status.text}
				</span>
				<Button asChild variant="ghost" size="icon-sm" className="size-7 text-muted-foreground hover:text-foreground max-[720px]:hidden [&_svg]:size-4">
					<a id="open-article" href={articleHref} target="_blank" hidden={!article} title={t('在博客上打开')} aria-label={t('在博客上打开')}>
						<ExternalLink aria-hidden />
					</a>
				</Button>
				<IconButton id="page-favorite" aria-pressed={favorite} aria-label={favorite ? t('移出常用') : t('加入常用')} title={favorite ? t('移出常用') : t('加入常用')} hidden={!article} onClick={() => act.toggleFavorite()}>
					<Star aria-hidden className={favorite ? 'fill-current' : ''} />
				</IconButton>
				<IconButton id="page-menu" aria-label={t('页面菜单')} title={t('页面菜单')} hidden={!article} onClick={(event) => act.pageMenu(event.currentTarget)}>
					<Ellipsis aria-hidden />
				</IconButton>
				<IconButton id="toggle-side-panel" aria-pressed={panelOpen} aria-label={panelOpen ? t('收起右侧面板') : t('展开右侧面板')} title={t('文件与终端')} onClick={act.togglePanel}>
					<PanelRight aria-hidden />
				</IconButton>
			</div>
		</>
	);
}

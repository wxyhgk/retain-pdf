import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { t } from '@blog/i18n/index.mjs';
import { uiLayer } from '@studio/lib/utils';
import type { PageInfo } from './panel-state';

/** How long the pointer rests on a link before its card shows, and is away from both before it goes. */
const SHOW_AFTER = 350;
const HIDE_AFTER = 150;
const GAP = 6;

/** An article's icon, as its links show it: its emoji, or a page drawn (CSS) when it has none. */
export function PageIcon({ page }: { page: Pick<PageInfo, 'icon'> | undefined }) {
	return (
		<span className="ai-page-icon" aria-hidden="true">
			{page?.icon ?? ''}
		</span>
	);
}

/** The pages above an article (its `parent:`, theirs…), outermost first. */
function above(page: PageInfo, pages: PageInfo[]): string[] {
	const titles: string[] = [];
	const seen = new Set([page.slug]);
	for (let parent = page.parent; parent && !seen.has(parent); ) {
		seen.add(parent);
		const found = pages.find((entry) => entry.slug === parent);
		if (!found) break;
		titles.unshift(found.title);
		parent = found.parent;
	}
	return titles;
}

/**
 * The articles the AI panel names (`[data-page]` in `root`: links in what the AI says, the chips of what was told),
 * as Notion's page mentions: clicked, the article is opened; with the pointer resting on one, a card of it (the pages
 * above it, its title, its 简介, date and tags), itself clicked to open it.
 */
export function PagePeek({ root, pages, open }: { root: HTMLElement; pages: () => PageInfo[]; open(slug: string): void }) {
	const [shown, setShown] = useState<{ page: PageInfo; anchor: DOMRect } | null>(null);
	const timer = useRef(0);
	const card = useRef<HTMLDivElement>(null);
	const later = (then: () => void, wait: number) => {
		window.clearTimeout(timer.current);
		timer.current = window.setTimeout(then, wait);
	};

	useEffect(() => {
		const linkOf = (target: EventTarget | null) => (target instanceof Element ? target.closest<HTMLElement>('[data-page]') : null);
		const click = (event: MouseEvent) => {
			const link = linkOf(event.target);
			if (!link || !root.contains(link)) return;
			event.preventDefault();
			window.clearTimeout(timer.current);
			setShown(null);
			open(link.dataset.page!);
		};
		const key = (event: KeyboardEvent) => {
			const link = linkOf(event.target);
			if (event.key !== 'Enter' || !link || link.tagName === 'BUTTON') return;
			event.preventDefault();
			open(link.dataset.page!);
		};
		const over = (event: PointerEvent) => {
			const link = linkOf(event.target);
			if (!link) return;
			const page = pages().find((entry) => entry.slug === link.dataset.page);
			if (page) later(() => setShown({ page, anchor: link.getBoundingClientRect() }), SHOW_AFTER);
		};
		const out = (event: PointerEvent) => {
			if (linkOf(event.target) && linkOf(event.target) !== linkOf(event.relatedTarget)) later(() => setShown(null), HIDE_AFTER);
		};
		const away = () => {
			window.clearTimeout(timer.current);
			setShown(null);
		};
		root.addEventListener('click', click);
		root.addEventListener('keydown', key);
		root.addEventListener('pointerover', over);
		root.addEventListener('pointerout', out);
		// Scrolled, the card would be left where the link was.
		root.addEventListener('scroll', away, true);
		return () => {
			window.clearTimeout(timer.current);
			root.removeEventListener('click', click);
			root.removeEventListener('keydown', key);
			root.removeEventListener('pointerover', over);
			root.removeEventListener('pointerout', out);
			root.removeEventListener('scroll', away, true);
		};
	}, [root]);

	// Under the link, or over it when there is no room below; kept within the window.
	useLayoutEffect(() => {
		const node = card.current;
		if (!node || !shown) return;
		const { anchor } = shown;
		const height = node.offsetHeight;
		const width = node.offsetWidth;
		const below = anchor.bottom + GAP + height <= window.innerHeight - 8;
		node.style.top = `${below ? anchor.bottom + GAP : Math.max(8, anchor.top - GAP - height)}px`;
		node.style.left = `${Math.max(8, Math.min(anchor.left, window.innerWidth - width - 8))}px`;
		node.style.visibility = 'visible';
	}, [shown]);

	if (!shown) return null;
	const { page } = shown;
	const path = above(page, pages());
	const facts = [page.draft ? t('草稿') : '', page.pubDate ?? '', ...(page.tags ?? []).map((tag) => `#${tag}`)].filter(Boolean);
	return createPortal(
		<div
			ref={card}
			className="page-peek"
			role="link"
			tabIndex={-1}
			aria-label={t('打开《{title}》', { title: page.title })}
			style={{ visibility: 'hidden' }}
			onPointerEnter={() => window.clearTimeout(timer.current)}
			onPointerLeave={() => later(() => setShown(null), HIDE_AFTER)}
			onClick={() => {
				setShown(null);
				open(page.slug);
			}}
		>
			<span className="page-peek-icon" aria-hidden="true">
				{page.icon ?? ''}
			</span>
			{path.length > 0 && <div className="page-peek-path">{path.join(' / ')}</div>}
			<div className="page-peek-title">{page.title}</div>
			{page.description && <div className="page-peek-description">{page.description}</div>}
			{facts.length > 0 && <div className="page-peek-facts">{facts.join(' · ')}</div>}
		</div>,
		uiLayer() ?? document.body,
	);
}

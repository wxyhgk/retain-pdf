import { useEffect, useRef, useState } from 'react';
import { Columns2, FileText, Languages, ListTree, MoreHorizontal, Search, type LucideIcon } from 'lucide-react';

import { t } from '@blog/i18n/index.mjs';
import { showContextMenu, type MenuItem } from '../common/context-menu';
import type { ReaderCommand, ReaderMode, ReaderState } from './retainpdf-view';

const MODES: Array<{ mode: ReaderMode; label: string; icon: LucideIcon }> = [
	{ mode: 'source', label: t('原文'), icon: FileText },
	{ mode: 'compare', label: t('对照'), icon: Columns2 },
	{ mode: 'translated', label: t('译文'), icon: Languages },
];

/** The page shown, of how many; clicked, a page typed to go to. */
function PageBox({ state, command }: { state: ReaderState; command(asked: ReaderCommand): void }) {
	const [typing, setTyping] = useState(false);
	const [typed, setTyped] = useState('');
	const input = useRef<HTMLInputElement>(null);
	useEffect(() => {
		if (typing) input.current?.select();
	}, [typing]);
	const page = state.page_idx === null ? null : state.page_idx + 1;
	if (typing) {
		const go = () => {
			const asked = Number(typed);
			if (Number.isInteger(asked) && asked >= 1 && (!state.page_count || asked <= state.page_count)) command({ command: 'page', page_idx: asked - 1 });
			setTyping(false);
		};
		return (
			<input
				ref={input}
				className="book-page-input"
				inputMode="numeric"
				value={typed}
				aria-label={t('跳到第几页')}
				onChange={(event) => setTyped(event.target.value.replace(/\D/gu, ''))}
				onBlur={() => setTyping(false)}
				onKeyDown={(event) => {
					if (event.key === 'Enter') go();
					else if (event.key === 'Escape') setTyping(false);
				}}
			/>
		);
	}
	return (
		<button
			type="button"
			className="book-page"
			title={t('跳到第几页')}
			disabled={!state.ready}
			onClick={() => {
				setTyped(page ? String(page) : '');
				setTyping(true);
			}}
		>
			{page ?? '–'}
			{state.page_count ? <span className="book-page-count">/{state.page_count}</span> : null}
		</button>
	);
}

/**
 * A book's reader's controls, in the row with the tabs (book-tabs.ts), the reader drawing none of its own: contents and
 * search, the original / both / the translation, the page, and ⋯ for the rest (how large, what else it offers).
 */
export function BookControls({ state, command }: { state: ReaderState; command(asked: ReaderCommand): void }) {
	const panel = (key: 'outline' | 'search', label: string, Icon: LucideIcon) =>
		state.panels.includes(key) ? (
			<button type="button" className="book-control" data-panel={key} aria-pressed={state.panel === key} title={label} disabled={!state.ready} onClick={() => command({ command: 'panel', panel: state.panel === key ? null : key })}>
				<Icon aria-hidden />
				<span className="book-control-label">{label}</span>
			</button>
		) : null;
	const modes = MODES.filter(({ mode }) => state.modes.includes(mode));
	function more(event: React.MouseEvent<HTMLButtonElement>): void {
		const percent = state.zoom.percent ? `${state.zoom.percent}%` : '';
		const items: MenuItem[] = [
			{ label: t('放大'), hint: percent, action: () => command({ command: 'zoom', zoom: 'in' }) },
			{ label: t('缩小'), action: () => command({ command: 'zoom', zoom: 'out' }) },
			{ label: state.zoom.fit ? t('适合栏宽 ✓') : t('适合栏宽'), action: () => command({ command: 'zoom', zoom: 'fit' }) },
		];
		// The texts too, for a row too narrow to show them (book-tabs' CSS hides them there).
		if (modes.length > 1) items.unshift(...modes.map(({ mode, label }) => ({ label: state.mode === mode ? `${label} ✓` : label, action: () => command({ command: 'mode', mode }) })), 'separator');
		if (state.actions.length) items.push('separator', ...state.actions.map(({ key, label }) => ({ label, action: () => command({ command: 'action', key }) })));
		showContextMenu(items, event.currentTarget);
	}
	return (
		<>
			{panel('outline', t('目录'), ListTree)}
			{panel('search', t('搜索'), Search)}
			{modes.length > 1 ? (
				<div className="book-modes" role="radiogroup" aria-label={t('显示原文还是译文')}>
					{modes.map(({ mode, label, icon: Icon }) => (
						<button key={mode} type="button" role="radio" className="book-mode" data-mode={mode} aria-checked={state.mode === mode} title={label} disabled={!state.ready} onClick={() => command({ command: 'mode', mode })}>
							<Icon aria-hidden />
							<span className="book-control-label">{label}</span>
						</button>
					))}
				</div>
			) : null}
			<PageBox state={state} command={command} />
			<button type="button" className="book-control book-more" title={t('更多')} aria-label={t('更多')} onClick={more}>
				<MoreHorizontal aria-hidden />
			</button>
		</>
	);
}

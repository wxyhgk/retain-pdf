import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode, type RefObject } from 'react';

import { Popover, PopoverAnchor, PopoverContent } from '@studio/ui/popover';
import { showContextMenu } from '../../common/context-menu';
import { useStore, type Store } from '../../shell/store';
import type { HeaderActions, HeaderState } from './header-state';
import { ICONS, parseTags } from './tags';

/**
 * A picker floating under `anchor` (the icon's or the cover's button): Escape or a click elsewhere closes it, the keys
 * back on the button.
 */
function Picker({ anchor, className, onClose, children }: { anchor: RefObject<HTMLElement | null>; className: string; onClose(): void; children: ReactNode }) {
	return (
		<Popover open onOpenChange={(open) => !open && onClose()}>
			<PopoverAnchor virtualRef={anchor as RefObject<HTMLElement>} />
			<PopoverContent
				role="dialog"
				align="start"
				className={`page-popover ${className} w-auto p-2`}
				onInteractOutside={(event) => {
					// Its own button again: that click closes it (or opens it again), not this.
					if (anchor.current?.contains(event.target as Node)) event.preventDefault();
				}}
				onCloseAutoFocus={(event) => {
					event.preventDefault();
					anchor.current?.focus();
				}}
			>
				{children}
			</PopoverContent>
		</Popover>
	);
}

function IconPicker({ current, onPick }: { current: string; onPick(icon: string): void }) {
	const [own, setOwn] = useState('');
	return (
		<>
			<div className="icon-picker-top">
				<input
					type="text"
					autoFocus
					placeholder="输入或粘贴一个 emoji，回车"
					aria-label="自己的图标"
					value={own}
					onChange={(event) => setOwn(event.target.value)}
					onKeyDown={(event) => {
						if (event.key !== 'Enter' || event.nativeEvent.isComposing || !own.trim()) return;
						event.preventDefault();
						onPick([...own.trim()].slice(0, 4).join(''));
					}}
				/>
				{current && (
					<button type="button" onClick={() => onPick('')}>
						移除
					</button>
				)}
			</div>
			<div className="icon-picker-grid">
				{ICONS.map((choice) => (
					<button key={choice} type="button" aria-label={`图标 ${choice}`} onClick={() => onPick(choice)}>
						{choice}
					</button>
				))}
			</div>
		</>
	);
}

function CoverPicker({ actions, onPick }: { actions: HeaderActions; onPick(cover: string): void }) {
	const [pictures, setPictures] = useState<string[] | null>(null);
	const [failed, setFailed] = useState(false);
	const [upload, setUpload] = useState<{ busy: boolean; error: string }>({ busy: false, error: '' });
	const file = useRef<HTMLInputElement>(null);
	useEffect(() => {
		actions.host.pictures().then(setPictures, () => setFailed(true));
	}, []);
	return (
		<>
			<button type="button" className="cover-picker-upload" disabled={upload.busy} onClick={() => file.current?.click()}>
				{upload.busy ? '正在上传…' : upload.error ? `上传失败：${upload.error}` : '上传图片…'}
			</button>
			<input
				ref={file}
				type="file"
				accept="image/*"
				hidden
				onChange={async (event) => {
					const picked = event.target.files?.[0];
					if (!picked) return;
					setUpload({ busy: true, error: '' });
					try {
						onPick(await actions.host.upload(picked));
					} catch (error) {
						setUpload({ busy: false, error: error instanceof Error ? error.message : '' });
					}
				}}
			/>
			<p className="cover-picker-note">{failed ? '读不到文章的图片' : pictures && !pictures.length ? '文章的 img/ 里还没有图片。' : '或者用文章 img/ 里的图片：'}</p>
			<div className="cover-picker-grid">
				{pictures?.map((picture) => (
					<button key={picture} type="button" title={picture} aria-label={`封面 ${picture}`} onClick={() => onPick(picture)}>
						<img src={actions.host.fileUrl(picture)} alt="" />
					</button>
				))}
			</div>
		</>
	);
}

/** The pages the open one is under, each a link; the › after each, a menu of the pages under it. */
function PathAbove({ state }: { state: HeaderState }) {
	const { pages, open, under } = state.path;
	return (
		<nav className="page-path" aria-label="上级页面" hidden={!pages.length}>
			{pages.map((page) => [
				<button key={`${page.slug}:link`} type="button" className="page-path-link" onClick={() => open(page.slug)}>
					{page.title}
				</button>,
				<button
					key={`${page.slug}:under`}
					type="button"
					className="page-path-separator"
					aria-label={`「${page.title}」下面的页面`}
					onClick={(event) => showContextMenu(under(page.slug).map((child) => ({ label: child.title, action: () => open(child.slug) })), event.currentTarget)}
				>
					›
				</button>,
			])}
		</nav>
	);
}

/** Tags as chips: Enter or a comma adds what is typed, Backspace in the empty field takes the last off. */
function TagField({ tags, known, disabled, onChange }: { tags: string[]; known: string[]; disabled: boolean; onChange(tags: string[]): void }) {
	const [typed, setTyped] = useState('');
	const input = useRef<HTMLInputElement>(null);
	function take(text: string): void {
		setTyped('');
		const added = parseTags(text).filter((tag) => !tags.includes(tag));
		if (added.length) onChange([...tags, ...added]);
	}
	return (
		<div
			id="article-tags"
			className="property-value tag-field"
			onClick={(event) => {
				if (event.target === event.currentTarget) input.current?.focus();
			}}
		>
			{tags.map((tag) => (
				<span key={tag} className="tag-chip">
					{tag}
					<button type="button" className="tag-chip-remove" aria-label={`去掉标签 ${tag}`} onClick={() => onChange(tags.filter((other) => other !== tag))}>
						×
					</button>
				</span>
			))}
			<input
				ref={input}
				id="article-tag-input"
				type="text"
				list="known-tags"
				aria-label="添加标签"
				placeholder={tags.length ? '' : '空'}
				disabled={disabled}
				value={typed}
				onChange={(event) => {
					const value = event.target.value;
					// A tag picked from the list of known ones comes in whole; one typed waits for Enter or a comma (DFT, then DFT-D3).
					const inputType = (event.nativeEvent as InputEvent).inputType;
					const picked = !inputType || inputType === 'insertReplacementText';
					if (/[,，]/u.test(value) || (picked && known.includes(value))) take(value);
					else setTyped(value);
				}}
				onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
					if (event.nativeEvent.isComposing) return;
					if (event.key === 'Enter' || event.key === ',' || event.key === '，') {
						event.preventDefault();
						take(typed);
					} else if (event.key === 'Backspace' && !typed && tags.length) {
						onChange(tags.slice(0, -1));
					}
				}}
				onBlur={() => take(typed)}
			/>
			<datalist id="known-tags">
				{known.map((tag) => (
					<option key={tag} value={tag} />
				))}
			</datalist>
		</div>
	);
}

/**
 * The top of the page, as Notion has it: the cover, the icon, the pages it is under, the title, and the properties as
 * rows under it, each changed where it is. `root` is the element it is drawn in (marked as having a cover, an icon).
 */
export function PageHeader({ store, actions, root }: { store: Store<HeaderState>; actions: HeaderActions; root?: HTMLElement }) {
	const state = useStore(store);
	const shown = state.properties;
	const disabled = !shown;
	const [picking, setPicking] = useState<'icon' | 'cover' | null>(null);
	const iconButton = useRef<HTMLButtonElement>(null);
	const addIcon = useRef<HTMLButtonElement>(null);
	const coverButton = useRef<HTMLButtonElement>(null);
	const addCover = useRef<HTMLButtonElement>(null);
	const description = useRef<HTMLTextAreaElement>(null);
	const icon = shown?.icon ?? '';
	const cover = shown?.cover ?? '';
	const [coverFrom, setCoverFrom] = useState<RefObject<HTMLButtonElement | null>>(addCover);

	useEffect(() => {
		root?.classList.toggle('has-cover', Boolean(cover));
		root?.classList.toggle('has-icon', Boolean(icon));
	}, [cover, icon]);
	// The description as tall as what it says.
	useLayoutEffect(() => {
		const node = description.current!;
		node.style.height = 'auto';
		node.style.height = `${node.scrollHeight}px`;
	}, [shown?.description]);

	const error = state.typedError ?? state.problems.join('；');
	return (
		<>
			<div id="page-cover" className="page-cover" hidden={!cover}>
				<img alt="" src={cover ? actions.host.fileUrl(cover) : undefined} />
				<div className="page-cover-actions">
					<button
						ref={coverButton}
						id="change-cover"
						type="button"
						onClick={() => {
							setCoverFrom(coverButton);
							setPicking(picking === 'cover' ? null : 'cover');
						}}
					>
						更换封面
					</button>
					<button id="remove-cover" type="button" onClick={() => actions.edit({ cover: '' })}>
						移除
					</button>
				</div>
			</div>
			<div className="page-head">
				<button ref={iconButton} id="page-icon" className="page-emoji" type="button" aria-label="更换图标" hidden={!icon} onClick={() => setPicking(picking === 'icon' ? null : 'icon')}>
					{icon}
				</button>
				<div className="page-head-actions">
					<button ref={addIcon} id="add-icon" type="button" disabled={disabled} hidden={Boolean(icon)} onClick={() => setPicking(picking === 'icon' ? null : 'icon')}>
						☺ 添加图标
					</button>
					<button
						ref={addCover}
						id="add-cover"
						type="button"
						disabled={disabled}
						hidden={Boolean(cover)}
						onClick={() => {
							setCoverFrom(addCover);
							setPicking(picking === 'cover' ? null : 'cover');
						}}
					>
						▨ 添加封面
					</button>
				</div>
				<PathAbove state={state} />
				<input
					id="article-title-input"
					className="article-title-input"
					type="text"
					aria-label="文章标题"
					placeholder="无标题"
					disabled={disabled}
					value={shown?.title ?? ''}
					onChange={(event) => actions.edit({ title: event.target.value })}
					onKeyDown={(event) => {
						if (event.nativeEvent.isComposing || disabled) return;
						if (event.key !== 'Enter' && event.key !== 'ArrowDown') return;
						if (event.shiftKey || event.metaKey || event.altKey || event.ctrlKey) return;
						event.preventDefault();
						actions.host.leaveTitle();
					}}
				/>
				<div className="page-properties" role="group" aria-label="属性">
					<span className="property-name">◷ 发布日期</span>
					<input id="article-pub-date" className="property-value" type="date" aria-label="发布日期" disabled={disabled} value={shown?.pubDate ?? ''} onChange={(event) => actions.edit({ pubDate: event.target.value })} />
					<span className="property-name">⌗ 标签</span>
					<TagField tags={shown?.tags ?? []} known={state.knownTags} disabled={disabled} onChange={(tags) => actions.edit({ tags })} />
					<span className="property-name">≡ 简介</span>
					<textarea
						ref={description}
						id="article-description"
						className="property-value"
						rows={1}
						aria-label="简介"
						placeholder="空"
						disabled={disabled}
						value={shown?.description ?? ''}
						onChange={(event) => actions.edit({ description: event.target.value })}
					/>
					<span className="property-name">◫ 类型</span>
					<select id="article-kind" className="property-value" aria-label="类型" disabled={disabled} value={shown?.kind ?? 'post'} onChange={(event) => actions.edit({ kind: event.target.value === 'wiki' ? 'wiki' : 'post' })}>
						<option value="post">博客</option>
						<option value="wiki">维基</option>
					</select>
					<span className="property-name">◌ 状态</span>
					<div className="property-value status-field">
						<span id="article-status" className={`status-pill${shown && !shown.draft ? ' is-published' : ''}`}>
							{!shown || shown.draft ? '草稿' : '已发布'}
						</span>
						<button id="publish-article" className="status-action" type="button" disabled={disabled || state.publishing} data-published={String(Boolean(shown && !shown.draft))} onClick={() => void actions.togglePublished()}>
							{!shown || shown.draft ? '发布' : '撤回'}
						</button>
					</div>
					{/* The articles that link here: backlinks.ts draws them. */}
					<div id="page-backlinks" className="page-backlinks" data-host hidden />
				</div>
				<p id="property-error" role="alert" hidden={!error}>
					{error}
				</p>
			</div>
			{picking === 'icon' && (
				<Picker anchor={icon ? iconButton : addIcon} className="icon-picker" onClose={() => setPicking(null)}>
					<IconPicker
						current={icon}
						onPick={(value) => {
							actions.edit({ icon: value.trim() });
							setPicking(null);
						}}
					/>
				</Picker>
			)}
			{picking === 'cover' && (
				<Picker anchor={coverFrom} className="cover-picker" onClose={() => setPicking(null)}>
					<CoverPicker
						actions={actions}
						onPick={(value) => {
							actions.edit({ cover: value });
							setPicking(null);
						}}
					/>
				</Picker>
			)}
		</>
	);
}

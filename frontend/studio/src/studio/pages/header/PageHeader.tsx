import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode, type RefObject } from 'react';

import { AlignLeft, Calendar, CircleDashed, Plus, Shapes, Tags } from 'lucide-react';

import { t } from '@blog/i18n/index.mjs';
import { Popover, PopoverAnchor, PopoverContent } from '@studio/ui/popover';
import { showContextMenu } from '../../common/context-menu';
import { useStore, type Store } from '../../shell/store';
import type { HeaderActions, HeaderState } from './header-state';
import { ICONS, parseTags } from './tags';
import { RowProperties } from './RowProperties';

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
					placeholder={t('输入或粘贴一个 emoji，回车')}
					aria-label={t('自己的图标')}
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
						{t('移除')}
					</button>
				)}
			</div>
			<div className="icon-picker-grid">
				{ICONS.map((choice) => (
					<button key={choice} type="button" aria-label={t('图标 {choice}', { choice })} onClick={() => onPick(choice)}>
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
				{upload.busy ? t('正在上传…') : upload.error ? t('上传失败：{error}', { error: upload.error }) : t('上传图片…')}
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
			<p className="cover-picker-note">{failed ? t('读不到文章的图片') : pictures && !pictures.length ? t('文章的 img/ 里还没有图片。') : t('或者用文章 img/ 里的图片：')}</p>
			<div className="cover-picker-grid">
				{pictures?.map((picture) => (
					<button key={picture} type="button" title={picture} aria-label={t('封面 {picture}', { picture })} onClick={() => onPick(picture)}>
						<img src={actions.host.fileUrl(picture)} alt="" />
					</button>
				))}
			</div>
		</>
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
					<button type="button" className="tag-chip-remove" aria-label={t('去掉标签 {tag}', { tag })} onClick={() => onChange(tags.filter((other) => other !== tag))}>
						×
					</button>
				</span>
			))}
			<input
				ref={input}
				id="article-tag-input"
				type="text"
				list="known-tags"
				aria-label={t('添加标签')}
				placeholder={tags.length ? '' : t('空')}
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
		const node = description.current;
		if (!node) return;
		node.style.height = 'auto';
		node.style.height = `${node.scrollHeight}px`;
	}, [shown?.description]);

	// 标签 and 简介 left empty are shown once added (for this article: let go when another is shown).
	const [added, setAdded] = useState<{ fields: ReadonlySet<'tags' | 'description'>; focus: 'tags' | 'description' | null }>({ fields: new Set(), focus: null });
	useEffect(() => setAdded({ fields: new Set(), focus: null }), [state.shownAt]);
	const showTags = Boolean(shown?.tags.length) || added.fields.has('tags');
	const showDescription = Boolean(shown?.description) || added.fields.has('description');
	const add = (field: 'tags' | 'description') => setAdded({ fields: new Set([...added.fields, field]), focus: field });
	useEffect(() => {
		if (added.focus === 'tags') document.querySelector<HTMLInputElement>('#article-tag-input')?.focus();
		if (added.focus === 'description') description.current?.focus();
	}, [added]);

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
						{t('更换封面')}
					</button>
					<button id="remove-cover" type="button" onClick={() => actions.edit({ cover: '' })}>
						{t('移除')}
					</button>
				</div>
			</div>
			<div className="page-head">
				<button ref={iconButton} id="page-icon" className="page-emoji" type="button" aria-label={t('更换图标')} hidden={!icon} onClick={() => setPicking(picking === 'icon' ? null : 'icon')}>
					{icon}
				</button>
				<div className="page-head-actions">
					<button ref={addIcon} id="add-icon" type="button" disabled={disabled} hidden={Boolean(icon)} onClick={() => setPicking(picking === 'icon' ? null : 'icon')}>
						{t('☺ 添加图标')}
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
						{t('▨ 添加封面')}
					</button>
				</div>
				<input
					id="article-title-input"
					className="article-title-input"
					type="text"
					aria-label={t('文章标题')}
					placeholder={t('无标题')}
					disabled={disabled}
					value={shown?.title ?? ''}
					onChange={(event) => actions.edit({ title: event.target.value })}
					onKeyDown={(event) => {
						if (event.nativeEvent.isComposing || disabled) return;
						if (event.key !== 'Enter' && event.key !== 'ArrowDown') return;
						if (event.shiftKey || event.metaKey || event.altKey || event.ctrlKey) return;
						event.preventDefault();
						if (event.key === 'ArrowDown') {
							actions.host.leaveTitle();
							return;
						}
						// Enter: a new block at the top; what is after the caret goes into it, out of the title.
						const input = event.currentTarget;
						const rest = input.value.slice(input.selectionEnd ?? input.value.length);
						if (rest) actions.edit({ title: input.value.slice(0, input.selectionStart ?? input.value.length) });
						actions.host.leaveTitle(true, rest);
					}}
				/>
				<div className="page-properties" role="group" aria-label={t('属性')}>
					{/* A database's row: its columns first, as Notion has them. */}
					{state.database && shown && <RowProperties config={state.database.config} props={shown.props} disabled={disabled} edit={(props) => actions.edit({ props })} addOption={actions.addOption} />}
					<span className="property-name">
						<Calendar aria-hidden />
						{t('发布日期')}
					</span>
					<input id="article-pub-date" className="property-value" type="date" aria-label={t('发布日期')} disabled={disabled} value={shown?.pubDate ?? ''} onChange={(event) => actions.edit({ pubDate: event.target.value })} />
					{showTags && (
						<>
							<span className="property-name">
								<Tags aria-hidden />
								{t('标签')}
							</span>
							<TagField tags={shown?.tags ?? []} known={state.knownTags} disabled={disabled} onChange={(tags) => actions.edit({ tags })} />
						</>
					)}
					{showDescription && (
						<>
							<span className="property-name">
								<AlignLeft aria-hidden />
								{t('简介')}
							</span>
							<textarea
								ref={description}
								id="article-description"
								className="property-value"
								rows={1}
								aria-label={t('简介')}
								placeholder={t('空')}
								disabled={disabled}
								value={shown?.description ?? ''}
								onChange={(event) => actions.edit({ description: event.target.value })}
							/>
						</>
					)}
					<span className="property-name">
						<Shapes aria-hidden />
						{t('类型')}
					</span>
					<select id="article-kind" className="property-value" aria-label={t('类型')} disabled={disabled} value={shown?.kind ?? 'post'} onChange={(event) => actions.edit({ kind: event.target.value === 'wiki' ? 'wiki' : 'post' })}>
						<option value="post">{t('博客')}</option>
						<option value="wiki">{t('维基')}</option>
					</select>
					<span className="property-name">
						<CircleDashed aria-hidden />
						{t('状态')}
					</span>
					<div className="property-value status-field">
						<span id="article-status" className={`status-pill${shown && !shown.draft ? ' is-published' : ''}`}>
							{!shown || shown.draft ? t('草稿') : t('已发布')}
						</span>
						<button id="publish-article" className="status-action" type="button" disabled={disabled || state.publishing} data-published={String(Boolean(shown && !shown.draft))} onClick={() => void actions.togglePublished()}>
							{!shown || shown.draft ? t('发布') : t('撤回')}
						</button>
					</div>
					{/* The properties left empty, as Notion keeps them: out of the way till added. */}
					{(!showTags || !showDescription) && (
						<button
							id="add-property"
							className="property-add"
							type="button"
							disabled={disabled}
							onClick={(event) =>
								showContextMenu(
									[
										...(showTags ? [] : [{ label: t('标签'), icon: Tags, action: () => add('tags') }]),
										...(showDescription ? [] : [{ label: t('简介'), icon: AlignLeft, action: () => add('description') }]),
									],
									event.currentTarget,
								)
							}
						>
							<Plus aria-hidden />
							{t('添加属性')}
						</button>
					)}
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

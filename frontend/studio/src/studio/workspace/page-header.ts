import type { ArticleProperties } from '../types.ts';

/** What the page header needs from the Studio around it. */
export type PageHeaderHost = {
	/** The properties as typed. Why they cannot be saved, or null. */
	changed(properties: ArticleProperties): string | null;
	/** 发布 was pressed: whether the article may be published (the check before it). */
	mayPublish(): Promise<boolean>;
	/** 发布 or 撤回 was pressed, and the new draft state taken: save it now. */
	publish(): void;
	/** Enter or ↓ in the title: on to the body. */
	leaveTitle(): void;
	/** Where to load a file the article names (`./img/cover.jpg`) from. */
	fileUrl(src: string): string;
	/** The article's pictures, as the article names them: `./img/plot.png`. */
	pictures(): Promise<string[]>;
	/** Puts a picture into the article's img/; how the article names it. */
	upload(file: File): Promise<string>;
};

/** Tags as typed, split at commas, half- or full-width. */
export function parseTags(text: string): string[] {
	return text.split(/[,，]/u).map((tag) => tag.trim()).filter(Boolean);
}

/** Icons to pick from; any other emoji can be typed or pasted. */
export const ICONS = [
	'🧪', '⚗️', '🔬', '🧬', '⚛️', '💊', '🧫', '🌡️', '🔭', '🧲', '💡', '🔥', '❄️', '💧', '🌊', '⚡',
	'🌀', '🌈', '☀️', '🌙', '⭐', '🪐', '🌍', '🌱', '🍀', '🌸', '☕', '🍵', '📘', '📗', '📙', '📕',
	'📓', '📚', '📖', '📝', '✏️', '📌', '📎', '📐', '📏', '🧮', '📊', '📈', '📉', '🗂️', '🗃️', '📁',
	'🔖', '🏷️', '💻', '🖥️', '⌨️', '🧠', '🤖', '🛠️', '⚙️', '🔧', '🧰', '🔍', '🔑', '🚀', '🎯', '🏁',
	'✅', '❓', '❗', '💬', '🎓', '🏛️', '🧭', '⏱️', '⏳', '📅', '🎨', '🎵',
];

/** A small panel under `anchor` that closes on Escape or a click elsewhere. */
function popover(anchor: HTMLElement, className: string, fill: (panel: HTMLElement, close: () => void) => void): void {
	document.querySelector('.page-popover')?.remove();
	const panel = document.createElement('div');
	panel.className = `page-popover ${className}`;
	panel.setAttribute('role', 'dialog');
	const close = () => {
		panel.remove();
		document.removeEventListener('pointerdown', outside, true);
		document.removeEventListener('keydown', escape, true);
	};
	const outside = (event: Event) => {
		if (!panel.contains(event.target as Node) && !anchor.contains(event.target as Node)) close();
	};
	const escape = (event: KeyboardEvent) => {
		if (event.key !== 'Escape') return;
		event.stopPropagation();
		close();
		anchor.focus();
	};
	fill(panel, close);
	document.body.append(panel);
	const at = anchor.getBoundingClientRect();
	const left = Math.max(8, Math.min(at.left, window.innerWidth - panel.offsetWidth - 8));
	panel.style.left = `${left}px`;
	panel.style.top = `${Math.min(at.bottom + 6, window.innerHeight - panel.offsetHeight - 8)}px`;
	document.addEventListener('pointerdown', outside, true);
	document.addEventListener('keydown', escape, true);
}

/**
 * The top of the page, as Notion has it: the cover, the icon, the title, and
 * the properties as rows under it, each changed where it is.
 */
export function createPageHeader(root: HTMLElement, host: PageHeaderHost) {
	const title = root.querySelector<HTMLInputElement>('#article-title-input')!;
	const cover = root.querySelector<HTMLElement>('#page-cover')!;
	const coverImage = cover.querySelector('img')!;
	const icon = root.querySelector<HTMLButtonElement>('#page-icon')!;
	const addIcon = root.querySelector<HTMLButtonElement>('#add-icon')!;
	const addCover = root.querySelector<HTMLButtonElement>('#add-cover')!;
	const changeCover = root.querySelector<HTMLButtonElement>('#change-cover')!;
	const removeCover = root.querySelector<HTMLButtonElement>('#remove-cover')!;
	const description = root.querySelector<HTMLTextAreaElement>('#article-description')!;
	const tagField = root.querySelector<HTMLElement>('#article-tags')!;
	const tagInput = root.querySelector<HTMLInputElement>('#article-tag-input')!;
	const knownTags = root.querySelector<HTMLDataListElement>('#known-tags')!;
	const pubDate = root.querySelector<HTMLInputElement>('#article-pub-date')!;
	const kind = root.querySelector<HTMLSelectElement>('#article-kind')!;
	const status = root.querySelector<HTMLElement>('#article-status')!;
	const publish = root.querySelector<HTMLButtonElement>('#publish-article')!;
	const error = root.querySelector<HTMLElement>('#property-error')!;

	let tags: string[] = [];
	let draft = true;
	let iconValue = '';
	let coverValue = '';
	/** Why the blog could not build the properties as saved, from the server. */
	let problems: string[] = [];
	/** Why the properties as typed cannot be saved. */
	let typedError: string | null = null;

	const typed = (): ArticleProperties => ({
		title: title.value.trim(),
		description: description.value.trim(),
		pubDate: pubDate.value,
		tags,
		draft,
		icon: iconValue,
		cover: coverValue,
		kind: kind.value === 'wiki' ? 'wiki' : 'post',
	});

	/** What is typed wrong comes first; then what the saved properties lack. */
	function showError(message: string | null): void {
		typedError = message;
		const shown = message ?? problems.join('；');
		error.textContent = shown;
		error.hidden = !shown;
	}

	function fitDescription(): void {
		description.style.height = 'auto';
		description.style.height = `${description.scrollHeight}px`;
	}

	function drawTags(): void {
		tagField.querySelectorAll('.tag-chip').forEach((chip) => chip.remove());
		for (const tag of tags) {
			const chip = document.createElement('span');
			chip.className = 'tag-chip';
			chip.textContent = tag;
			const remove = document.createElement('button');
			remove.type = 'button';
			remove.className = 'tag-chip-remove';
			remove.textContent = '×';
			remove.setAttribute('aria-label', `去掉标签 ${tag}`);
			remove.addEventListener('click', () => {
				tags = tags.filter((other) => other !== tag);
				drawTags();
				report();
			});
			chip.append(remove);
			tagField.insertBefore(chip, tagInput);
		}
		tagInput.placeholder = tags.length ? '' : '空';
	}

	function drawLooks(): void {
		icon.textContent = iconValue;
		icon.hidden = !iconValue;
		addIcon.hidden = Boolean(iconValue);
		cover.hidden = !coverValue;
		if (coverValue) coverImage.src = host.fileUrl(coverValue);
		else coverImage.removeAttribute('src');
		addCover.hidden = Boolean(coverValue);
		root.classList.toggle('has-cover', Boolean(coverValue));
		root.classList.toggle('has-icon', Boolean(iconValue));
	}

	function drawStatus(): void {
		status.textContent = draft ? '草稿' : '已发布';
		status.classList.toggle('is-published', !draft);
		publish.textContent = draft ? '发布' : '撤回';
		publish.dataset.published = String(!draft);
	}

	/** Hands the typed properties over; false when they cannot be saved. */
	function report(): boolean {
		const problem = host.changed(typed());
		showError(problem);
		return !problem;
	}

	/** Takes what is typed in the tag field as tags. */
	function takeTags(): void {
		const typedTags = parseTags(tagInput.value);
		tagInput.value = '';
		const added = typedTags.filter((tag) => !tags.includes(tag));
		if (!added.length) return;
		tags = [...tags, ...added];
		drawTags();
		report();
	}

	function chooseIcon(): void {
		popover(iconValue ? icon : addIcon, 'icon-picker', (panel, close) => {
			const pick = (value: string) => {
				iconValue = value.trim();
				drawLooks();
				report();
				close();
			};
			const top = document.createElement('div');
			top.className = 'icon-picker-top';
			const own = document.createElement('input');
			own.type = 'text';
			own.placeholder = '输入或粘贴一个 emoji，回车';
			own.setAttribute('aria-label', '自己的图标');
			own.addEventListener('keydown', (event) => {
				if (event.key !== 'Enter' || event.isComposing || !own.value.trim()) return;
				event.preventDefault();
				pick([...own.value.trim()].slice(0, 4).join(''));
			});
			top.append(own);
			if (iconValue) {
				const remove = document.createElement('button');
				remove.type = 'button';
				remove.textContent = '移除';
				remove.addEventListener('click', () => pick(''));
				top.append(remove);
			}
			const grid = document.createElement('div');
			grid.className = 'icon-picker-grid';
			for (const choice of ICONS) {
				const button = document.createElement('button');
				button.type = 'button';
				button.textContent = choice;
				button.setAttribute('aria-label', `图标 ${choice}`);
				button.addEventListener('click', () => pick(choice));
				grid.append(button);
			}
			panel.append(top, grid);
			queueMicrotask(() => own.focus());
		});
	}

	function setCover(value: string): void {
		coverValue = value;
		drawLooks();
		report();
	}

	function chooseCover(anchor: HTMLElement): void {
		popover(anchor, 'cover-picker', (panel, close) => {
			const upload = document.createElement('button');
			upload.type = 'button';
			upload.className = 'cover-picker-upload';
			upload.textContent = '上传图片…';
			const input = document.createElement('input');
			input.type = 'file';
			input.accept = 'image/*';
			input.hidden = true;
			input.addEventListener('change', async () => {
				const file = input.files?.[0];
				if (!file) return;
				upload.disabled = true;
				upload.textContent = '正在上传…';
				try {
					setCover(await host.upload(file));
					close();
				} catch (failure) {
					upload.disabled = false;
					upload.textContent = failure instanceof Error ? `上传失败：${failure.message}` : '上传失败';
				}
			});
			upload.addEventListener('click', () => input.click());
			const note = document.createElement('p');
			note.className = 'cover-picker-note';
			note.textContent = '或者用文章 img/ 里的图片：';
			const grid = document.createElement('div');
			grid.className = 'cover-picker-grid';
			panel.append(upload, input, note, grid);
			host.pictures().then((pictures) => {
				if (!pictures.length) note.textContent = '文章的 img/ 里还没有图片。';
				for (const picture of pictures) {
					const choice = document.createElement('button');
					choice.type = 'button';
					choice.title = picture;
					choice.setAttribute('aria-label', `封面 ${picture}`);
					const thumbnail = document.createElement('img');
					thumbnail.src = host.fileUrl(picture);
					thumbnail.alt = '';
					choice.append(thumbnail);
					choice.addEventListener('click', () => {
						setCover(picture);
						close();
					});
					grid.append(choice);
				}
			}, () => {
				note.textContent = '读不到文章的图片';
			});
		});
	}

	title.addEventListener('input', () => report());
	description.addEventListener('input', () => {
		fitDescription();
		report();
	});
	for (const input of [pubDate, kind]) input.addEventListener('change', () => report());
	tagInput.addEventListener('keydown', (event) => {
		if (event.isComposing) return;
		if (event.key === 'Enter' || event.key === ',' || event.key === '，') {
			event.preventDefault();
			takeTags();
		} else if (event.key === 'Backspace' && !tagInput.value && tags.length) {
			tags = tags.slice(0, -1);
			drawTags();
			report();
		}
	});
	// A tag picked from the list of known ones comes in whole; one typed waits for Enter or a comma (DFT, then DFT-D3).
	tagInput.addEventListener('input', (event) => {
		const picked = !(event as InputEvent).inputType || (event as InputEvent).inputType === 'insertReplacementText';
		if (/[,，]/u.test(tagInput.value) || (picked && [...knownTags.options].some((option) => option.value === tagInput.value))) takeTags();
	});
	tagInput.addEventListener('blur', takeTags);
	tagField.addEventListener('click', (event) => {
		if (event.target === tagField) tagInput.focus();
	});
	icon.addEventListener('click', chooseIcon);
	addIcon.addEventListener('click', chooseIcon);
	addCover.addEventListener('click', () => chooseCover(addCover));
	changeCover.addEventListener('click', () => chooseCover(changeCover));
	removeCover.addEventListener('click', () => setCover(''));
	publish.addEventListener('click', async () => {
		if (draft) {
			publish.disabled = true;
			try {
				if (!(await host.mayPublish())) return;
			} finally {
				publish.disabled = false;
			}
		}
		draft = !draft;
		if (!report()) {
			draft = !draft;
			return;
		}
		drawStatus();
		host.publish();
	});
	title.addEventListener('keydown', (event) => {
		if (event.isComposing || title.disabled) return;
		if (event.key !== 'Enter' && event.key !== 'ArrowDown') return;
		if (event.shiftKey || event.metaKey || event.altKey || event.ctrlKey) return;
		event.preventDefault();
		host.leaveTitle();
	});

	return {
		/** An article's properties, ready to edit, and what is wrong with them as saved. */
		show(properties: ArticleProperties, saved: string[] = []): void {
			problems = saved;
			title.value = properties.title;
			description.value = properties.description;
			tags = [...properties.tags];
			pubDate.value = properties.pubDate;
			kind.value = properties.kind ?? 'post';
			draft = properties.draft;
			iconValue = properties.icon ?? '';
			coverValue = properties.cover ?? '';
			for (const input of [title, description, tagInput, pubDate, kind, publish, addIcon, addCover]) input.disabled = false;
			drawTags();
			drawLooks();
			drawStatus();
			showError(null);
			requestAnimationFrame(fitDescription);
		},
		/** What is wrong with the properties now saved; an empty list when nothing is. */
		showProblems(saved: string[]): void {
			if (saved.join('\n') === problems.join('\n')) return;
			problems = saved;
			showError(typedError);
		},
		/** The tags other articles use, offered while typing one. */
		knowTags(all: string[]): void {
			knownTags.replaceChildren(...[...new Set(all)].sort((a, b) => a.localeCompare(b, 'zh-CN')).map((tag) => {
				const option = document.createElement('option');
				option.value = tag;
				return option;
			}));
		},
		/** The caret at the end of the title, from the start of the body. */
		focusTitle(): void {
			const end = title.value.length;
			title.focus();
			title.setSelectionRange(end, end);
		},
	};
}

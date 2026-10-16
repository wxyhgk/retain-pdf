import type { ArticleProperties } from '../types.ts';

/** What the properties panel needs from the Studio around it. */
export type PropertiesPanelHost = {
	/** The properties as typed. Why they cannot be saved, or null. */
	changed(properties: ArticleProperties): string | null;
	/** 发布 or 撤回 was pressed, and the new draft state taken: save it now. */
	publish(): void;
	/** Enter or ↓ in the title: on to the body. */
	leaveTitle(): void;
};

/** Tags as typed, split at commas, half- or full-width. */
export function parseTags(text: string): string[] {
	return text.split(/[,，]/u).map((tag) => tag.trim()).filter(Boolean);
}

/** The title above the editor, and the article's properties under it. */
export function createPropertiesPanel(root: HTMLElement, host: PropertiesPanelHost) {
	const title = root.querySelector<HTMLInputElement>('#article-title-input')!;
	const description = root.querySelector<HTMLTextAreaElement>('#article-description')!;
	const tags = root.querySelector<HTMLInputElement>('#article-tags')!;
	const pubDate = root.querySelector<HTMLInputElement>('#article-pub-date')!;
	const draft = root.querySelector<HTMLInputElement>('#article-draft')!;
	const panel = root.querySelector<HTMLElement>('#article-properties')!;
	const toggle = root.querySelector<HTMLButtonElement>('#toggle-properties')!;
	const summary = root.querySelector<HTMLElement>('#property-summary')!;
	const error = root.querySelector<HTMLElement>('#property-error')!;
	const publish = root.querySelector<HTMLButtonElement>('#publish-article')!;

	const typed = (): ArticleProperties => ({
		title: title.value.trim(),
		description: description.value.trim(),
		pubDate: pubDate.value,
		tags: parseTags(tags.value),
		draft: draft.checked,
	});

	/** Why the blog could not build the properties as saved, from the server. */
	let problems: string[] = [];
	/** Why the properties as typed cannot be saved. */
	let typedError: string | null = null;

	/** What is typed wrong comes first; then what the saved properties lack. */
	function showError(message: string | null): void {
		typedError = message;
		const shown = message ?? problems.join('；');
		error.textContent = shown;
		error.hidden = !shown;
	}

	function summarize(properties: ArticleProperties): void {
		const tagText = properties.tags.length ? properties.tags.join(' · ') : '无标签';
		summary.textContent = problems.length
			? `属性有 ${problems.length} 处问题，博客构建会失败`
			: `${properties.pubDate || '未设置日期'} · ${tagText}`;
		summary.classList.toggle('has-problems', problems.length > 0);
		publish.textContent = properties.draft ? '发布' : '撤回';
		publish.dataset.published = String(!properties.draft);
	}

	/** Hands the typed properties over; false when they cannot be saved. */
	function report(): boolean {
		const properties = typed();
		const problem = host.changed(properties);
		showError(problem);
		if (!problem) summarize(properties);
		return !problem;
	}

	for (const input of [title, description, tags]) input.addEventListener('input', report);
	for (const input of [pubDate, draft]) input.addEventListener('change', report);
	toggle.addEventListener('click', () => {
		const open = panel.hidden;
		panel.hidden = !open;
		toggle.setAttribute('aria-expanded', String(open));
	});
	publish.addEventListener('click', () => {
		draft.checked = !draft.checked;
		if (!report()) {
			draft.checked = !draft.checked;
			summarize(typed());
			return;
		}
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
			tags.value = properties.tags.join(', ');
			pubDate.value = properties.pubDate;
			draft.checked = properties.draft;
			for (const input of [title, description, tags, pubDate, draft, publish]) input.disabled = false;
			showError(null);
			summarize(properties);
		},
		/** What is wrong with the properties now saved; an empty list when nothing is. */
		showProblems(saved: string[]): void {
			if (saved.join('\n') === problems.join('\n')) return;
			problems = saved;
			showError(typedError);
			summarize(typed());
		},
		/** The caret at the end of the title, from the start of the body. */
		focusTitle(): void {
			const end = title.value.length;
			title.focus();
			title.setSelectionRange(end, end);
		},
	};
}

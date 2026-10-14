/**
 * A folder name for a new article: its title in lowercase ASCII words, or
 * `note-YYYYMMDD-HHMM` for a title with none (Chinese, say).
 */
export function suggestedSlug(title: string, now = new Date()): string {
	const ascii = title.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/gu, '-').replace(/^-+|-+$/gu, '');
	if (ascii) return ascii;
	const date = [now.getFullYear(), now.getMonth() + 1, now.getDate()]
		.map((value, index) => String(value).padStart(index === 0 ? 4 : 2, '0')).join('');
	const time = [now.getHours(), now.getMinutes()].map((value) => String(value).padStart(2, '0')).join('');
	return `note-${date}-${time}`;
}

/** What is left of a typed folder name: lowercase letters, digits and hyphens. */
export function cleanSlug(typed: string): string {
	return typed.toLowerCase().replace(/[^a-z0-9-]/gu, '');
}

/** What the dialog needs from the Studio around it. */
export type NewArticleHost = {
	/** Whether the open article may be left (saved, or its edits let go). */
	leave(): Promise<boolean>;
	/** Makes the article; what it throws is shown in the dialog. */
	create(slug: string, title: string): Promise<void>;
	/** Opens the article just made. */
	open(slug: string): Promise<void>;
};

/**
 * 新建文章: a title, and the folder it gets (suggested from the title until
 * the author types one).
 */
export function createNewArticleDialog(openers: HTMLElement[], host: NewArticleHost) {
	const dialog = document.querySelector<HTMLDialogElement>('#new-article-dialog')!;
	const form = dialog.querySelector<HTMLFormElement>('#new-article-form')!;
	const title = dialog.querySelector<HTMLInputElement>('#new-article-title')!;
	const slug = dialog.querySelector<HTMLInputElement>('#new-article-slug')!;
	const error = dialog.querySelector<HTMLElement>('#new-article-error')!;
	const submit = dialog.querySelector<HTMLButtonElement>('#create-article')!;
	const cancels = [...dialog.querySelectorAll<HTMLButtonElement>('#cancel-new-article, #cancel-new-article-secondary')];
	let slugTyped = false;

	function showError(message: string): void {
		error.textContent = message;
		error.hidden = message.length === 0;
	}

	function open(): void {
		form.reset();
		slugTyped = false;
		showError('');
		dialog.showModal();
		title.focus();
	}

	function close(): void {
		if (!submit.disabled) dialog.close();
	}

	for (const opener of openers) opener.addEventListener('click', open);
	for (const cancel of cancels) cancel.addEventListener('click', close);
	dialog.addEventListener('click', (event) => {
		if (event.target === dialog) close();
	});
	title.addEventListener('input', () => {
		if (!slugTyped) slug.value = suggestedSlug(title.value);
	});
	slug.addEventListener('input', () => {
		slugTyped = true;
		slug.value = cleanSlug(slug.value);
	});
	form.addEventListener('submit', async (event) => {
		event.preventDefault();
		if (!form.reportValidity() || !(await host.leave())) return;
		submit.disabled = true;
		showError('');
		try {
			const folder = slug.value.trim();
			await host.create(folder, title.value.trim());
			dialog.close();
			await host.open(folder);
		} catch (problem) {
			showError(problem instanceof Error ? problem.message : '新建失败');
		} finally {
			submit.disabled = false;
		}
	});
}

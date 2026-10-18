/**
 * What a code file's bar and fold do in the page: copy, download, unfold.
 * The figures come from render.mjs, at build time on the blog and in the
 * Studio's preview of an `@file` block.
 */

const ENHANCED = 'codeFileReady';

/** The block's text, without the line saying what was left out. */
function codeText(figure: HTMLElement): string {
	const code = figure.querySelector('pre code');
	if (!code) return '';
	const lines = code.querySelectorAll<HTMLElement>(':scope > .line');
	if (!lines.length) return code.textContent ?? '';
	return [...lines].filter((line) => !line.classList.contains('code-file-gap')).map((line) => line.textContent ?? '').join('\n');
}

function flash(button: HTMLElement, label: string): void {
	const original = button.dataset.label ?? button.textContent ?? '';
	button.dataset.label = original;
	button.textContent = label;
	window.setTimeout(() => {
		button.textContent = original;
	}, 1500);
}

async function copy(figure: HTMLElement, button: HTMLElement): Promise<void> {
	try {
		await navigator.clipboard.writeText(codeText(figure));
		flash(button, '已复制');
	} catch {
		flash(button, '复制失败');
	}
}

function download(figure: HTMLElement, name: string): void {
	const url = URL.createObjectURL(new Blob([`${codeText(figure)}\n`], { type: 'text/plain;charset=utf-8' }));
	const link = document.createElement('a');
	link.href = url;
	link.download = name;
	link.click();
	window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function fold(figure: HTMLElement): void {
	const shown = Number(figure.dataset.fold);
	const pre = figure.querySelector('pre');
	if (!shown || !pre) return;
	const lines = [...figure.querySelectorAll<HTMLElement>('pre code > .line')];
	const total = lines.filter((line) => !line.classList.contains('code-file-gap')).length || (pre.textContent ?? '').split('\n').length;
	figure.style.setProperty('--fold-lines', String(shown));
	figure.classList.add('is-folded');
	// Cut just above the first hidden line, whatever the page's font and padding.
	const firstHidden = lines[shown];
	if (firstHidden && pre.offsetParent) {
		const top = firstHidden.getBoundingClientRect().top - pre.getBoundingClientRect().top + pre.scrollTop;
		if (top > 0) figure.style.setProperty('--fold-height', `${Math.round(top)}px`);
	}
	const button = document.createElement('button');
	button.type = 'button';
	button.className = 'code-file-unfold';
	// A file shown in part says how much unfolds, not that it is all of it.
	const excerpt = lines.some((line) => line.classList.contains('code-file-gap'));
	const label = (): string => (figure.classList.contains('is-folded') ? (excerpt ? `展开（显示 ${total} 行）` : `展开全部 ${total} 行`) : '收起');
	button.textContent = label();
	button.addEventListener('click', () => {
		const folding = !figure.classList.contains('is-folded');
		figure.classList.toggle('is-folded', folding);
		button.textContent = label();
		if (folding && figure.getBoundingClientRect().top < 0) figure.scrollIntoView({ block: 'start' });
	});
	figure.append(button);
}

/** Wires the code files under `root` that are not wired yet. */
export function enhanceCodeFiles(root: ParentNode = document): void {
	for (const figure of root.querySelectorAll<HTMLElement>('figure.code-file')) {
		if (figure.dataset[ENHANCED]) continue;
		figure.dataset[ENHANCED] = '1';
		figure.addEventListener('click', (event) => {
			const button = (event.target as Element).closest<HTMLElement>('[data-code-action]');
			if (!button || !figure.contains(button)) return;
			if (button.dataset.codeAction === 'copy') void copy(figure, button);
			if (button.dataset.codeAction === 'download') download(figure, button.dataset.fileName || 'code.txt');
		});
		fold(figure);
	}
}

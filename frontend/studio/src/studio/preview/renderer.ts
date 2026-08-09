import { renderArticlePreview } from '../api/client';

export class PreviewRenderer {
	private timer: number | undefined;
	private version = 0;

	constructor(
		private readonly preview: HTMLElement,
		private readonly status: HTMLElement,
	) {}

	schedule(slug: string, content: string): void {
		window.clearTimeout(this.timer);
		this.timer = window.setTimeout(() => this.render(slug, content), 280);
	}

	async render(slug: string, content: string): Promise<void> {
		const version = ++this.version;
		this.status.textContent = 'RENDERING';
		try {
			const result = await renderArticlePreview(slug, content);
			if (version !== this.version) return;
			this.preview.innerHTML = result.html;
			document.dispatchEvent(new CustomEvent('chemistry:render', { detail: this.preview }));
			this.status.textContent = 'LIVE';
		} catch (error) {
			if (version !== this.version) return;
			this.preview.textContent = error instanceof Error ? error.message : '预览失败';
			this.status.textContent = 'ERROR';
		}
	}
}

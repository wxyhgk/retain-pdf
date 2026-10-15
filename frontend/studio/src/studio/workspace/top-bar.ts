import type { SaveState } from '../state/article-session.ts';

/** What the status line says, and the colour it says it in. */
export function saveStateText(state: SaveState): { text: string; tone: 'saved' | 'dirty' | 'saving' | 'error' | '' } {
	switch (state.kind) {
		case 'loading': return { text: '正在载入…', tone: '' };
		case 'loaded': return { text: '已载入', tone: 'saved' };
		case 'dirty': return { text: '未保存', tone: 'dirty' };
		case 'saving': return { text: '正在保存…', tone: 'saving' };
		case 'saved': return { text: '已保存', tone: 'saved' };
		case 'reviewing': return { text: '磁盘上的改动待审阅', tone: 'dirty' };
		case 'conflict': return { text: '文章在磁盘上被修改，暂停自动保存', tone: 'error' };
		case 'failed': return { text: `${state.message}，稍后自动重试`, tone: 'error' };
	}
}

/**
 * The bar above the editor (sidebar toggle, title, save status, 打开博客)
 * and the line over the body (the file, and whether its Markdown is kept as written).
 */
export function createTopBar(shell: HTMLElement) {
	const toggleSidebar = shell.querySelector<HTMLButtonElement>('#toggle-sidebar')!;
	const title = shell.querySelector<HTMLElement>('#breadcrumb-title')!;
	const status = shell.querySelector<HTMLElement>('#save-status')!;
	const openArticle = shell.querySelector<HTMLAnchorElement>('#open-article')!;
	const path = shell.querySelector<HTMLElement>('#editor-path')!;
	const roundtrip = shell.querySelector<HTMLElement>('#roundtrip-status')!;

	function setStatus(text: string, tone = ''): void {
		status.textContent = text;
		status.dataset.state = tone;
	}

	function setSidebarCollapsed(collapsed: boolean): void {
		shell.classList.toggle('sidebar-collapsed', collapsed);
		toggleSidebar.setAttribute('aria-pressed', String(collapsed));
		toggleSidebar.setAttribute('aria-label', collapsed ? '展开侧边栏' : '收起侧边栏');
	}

	toggleSidebar.addEventListener('click', () => setSidebarCollapsed(!shell.classList.contains('sidebar-collapsed')));
	if (window.matchMedia('(max-width: 720px)').matches) setSidebarCollapsed(true);

	return {
		/** The open article. */
		showArticle(slug: string, articleTitle: string): void {
			path.textContent = `blog/${slug}/index.md`;
			title.textContent = articleTitle;
			openArticle.href = `/blog/${slug}/`;
		},
		showTitle(articleTitle: string): void {
			title.textContent = articleTitle;
		},
		/** No article to open yet. */
		showEmpty(): void {
			setStatus('还没有文章');
			path.textContent = '创建第一篇文章后即可开始写作';
			title.textContent = '空工作区';
		},
		saveState(state: SaveState): void {
			const { text, tone } = saveStateText(state);
			setStatus(text, tone);
		},
		/** Something went wrong outside saving, such as reaching the Studio at all. */
		error(message: string): void {
			setStatus(message, 'error');
		},
		roundtrip(exact: boolean): void {
			roundtrip.textContent = exact ? 'Markdown 完整保留' : 'Markdown 已规范化';
			roundtrip.dataset.state = exact ? 'exact' : 'changed';
		},
	};
}

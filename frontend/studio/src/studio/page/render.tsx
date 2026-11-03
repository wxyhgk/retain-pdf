import { renderToString } from 'react-dom/server';
import { RotateCw } from 'lucide-react';
import type { ReactElement } from 'react';

import { SITE_TITLE } from '../../consts';
import { PAGES } from './page-styles.mjs';
import { ArticleRepository } from '../server/articles/article-repository.mjs';
import { pageVersion, studioBlogRoot } from '../server/articles/page-version.mjs';
import { LocaleSettings, studioSettingsFile } from '../server/locale-settings.mjs';
import { setLocale, t } from '@blog/i18n/index.mjs';
import { askedLocales } from '@blog/i18n/server.mjs';
import { SideTabs } from '../shell/SideTabs';
import { Sidebar } from '../shell/Sidebar';
import { TopBar } from '../shell/TopBar';
import { createHeaderState } from '../pages/header/header-state';
import { PageHeader } from '../pages/header/PageHeader';
import { createFilePanelState } from '../files/panel/file-panel-state';
import { FilePanel } from '../files/panel/FilePanel';
// KaTeX draws nothing until its fonts are in: the ones most formulas use, asked for with the page.
import katexMain from 'katex/dist/fonts/KaTeX_Main-Regular.woff2?url';
import katexMath from 'katex/dist/fonts/KaTeX_Math-Italic.woff2?url';
import katexSize1 from 'katex/dist/fonts/KaTeX_Size1-Regular.woff2?url';
import katexSize2 from 'katex/dist/fonts/KaTeX_Size2-Regular.woff2?url';
import katexAms from 'katex/dist/fonts/KaTeX_AMS-Regular.woff2?url';

/**
 * The Studio's pages, drawn on its own server (serve.mjs): /studio, and /studio/window (a 小程序 or the AI in a window
 * of its own). What React draws of the shell is drawn here first (its first picture), then by the page's script
 * (mount.tsx) from then on.
 */

const escape = (text: string) => text.replace(/[&<>"]/gu, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[character]!);
const html = (element: ReactElement) => renderToString(element);
/** Where the server puts the page's stylesheets (serve.mjs: each in the page, as Vite keeps it, its order kept). */
export const STYLES = '<!--studio:styles-->';
/** A page drawn: its HTML, and the stylesheets that go where it says STYLES, in order. */
export type DrawnPage = { html: string; styles: string[] };

/** The language the Studio speaks (its setting, or the browser's): what is drawn here is in it, and the page goes on in it. */
async function speak(root: string, acceptLanguage: string | null): Promise<string> {
	const spoken = await new LocaleSettings(studioSettingsFile(root)).spoken(askedLocales(acceptLanguage));
	setLocale(spoken);
	return spoken;
}

/** What every page of the Studio has in its head: as the blog's (BaseHead.astro), light or dark chosen before it draws. */
function head(title: string, description: string): string {
	return `<meta charset="utf-8" />
		<meta name="viewport" content="width=device-width,initial-scale=1" />
		<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
		<link rel="icon" href="/favicon.ico" />
		<meta name="color-scheme" content="light dark" />
		<title>${escape(title)}</title>
		<meta name="description" content="${escape(description)}" />
		<script>
			(() => {
				const saved = localStorage.getItem('theme');
				const theme = saved || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
				document.documentElement.dataset.theme = theme;
			})();
		</script>`;
}

export async function renderStudioPage({ root, acceptLanguage }: { root: string; acceptLanguage: string | null }): Promise<DrawnPage> {
	const spoken = await speak(root, acceptLanguage);
	const blogRoot = studioBlogRoot(root);
	const articles = await new ArticleRepository(blogRoot).list().catch(() => []);
	// The page header as it is before an article is shown (its fields waiting); the page's script draws it from then on.
	const header = createHeaderState({ changed: () => null, mayPublish: async () => false, publish() {}, leaveTitle() {}, fileUrl: (src) => src, pictures: async () => [], upload: async () => '' });
	// The 文件 tab as it is with no article open; the page's script draws it from then on.
	const files = createFilePanelState({ source: () => '', revision: () => '', settle: async () => {}, moved: async () => {}, insertMarkdown() {}, viewOffice() {}, editFile() {}, openFile() {}, fileHistory() {}, sheetRows: async () => [], ocr() {} });
	// The mark of what the page shows with each article open (page-snapshot.ts); the address, which picks the article, is the browser's to read.
	const pages = { first: articles[0]?.slug ?? null, versions: Object.fromEntries(await Promise.all(articles.map(async ({ slug }: { slug: string }) => [slug, await pageVersion(blogRoot, slug)]))) };
	const [current, dropFiles, instructing] = [t('当前'), t('拖入文件即可上传 · 右键查看更多操作'), t('AI 处理中…')].map((word) => JSON.stringify(word));
	const words = `--word-current: ${current}; --word-drop-files: ${dropFiles}; --word-instructing: ${instructing}`;
	const { styles } = PAGES.studio;
	// The page's words, in the language it speaks (escaped for the page).
	const say = Object.fromEntries(Object.entries({
		editor: t('页面编辑器'),
		chooseArticle: t('选择一个页面'),
		waiting: t('等待载入'),
		reviewHint: t('已经保存在磁盘上；拒绝的会改回去'),
		retry: t('重试'),
		rejectAll: t('全部拒绝'),
		acceptAll: t('全部接受'),
		outline: t('页面目录'),
		drive: t('资料库'),
		allArticles: t('全部页面'),
		apps: t('小程序'),
		translate: t('书库'),
		books: t('这篇笔记的书'),
		chats: t('AI 问答'),
		sidePanel: t('AI、文件与终端'),
		resize: t('调整面板宽度'),
		resizeHint: t('拖动调整宽度，双击恢复'),
		sideTabs: t('右侧面板'),
		terminalFolder: t('终端启动目录'),
		repoRoot: t('仓库根目录'),
		thisArticle: t('当前页面'),
		driveFirst: t('先在左侧「资料库」里选好文件夹'),
		restartTerminal: t('重新打开终端'),
		terminalAgents: t('在终端里启动 AI'),
		terminal: t('终端'),
	}).map(([key, text]) => [key, escape(text)])) as Record<string, string>;
	const title = t('本地页面工作台');
	const page = `<!doctype html>
<html lang="${escape(spoken)}" data-studio-locale="${escape(spoken)}">
	<head>
		${head(`Studio · ${SITE_TITLE}`, title)}
		${[katexMain, katexMath, katexSize1, katexSize2, katexAms].map((font) => `<link rel="preload" href="${escape(font)}" as="font" type="font/woff2" crossorigin />`).join('\n\t\t')}
		${STYLES}
	</head>
	<body class="studio-body" style="${escape(words)}">
		<main class="studio-shell">
			<!-- The shell, drawn by React (shell/): here as the server draws it, then by the page's script (mount.tsx). -->
			<aside class="article-sidebar" data-ui>${html(<Sidebar siteTitle={SITE_TITLE} />)}</aside>

			<section class="workspace-main">
				<header class="studio-bar" data-ui>${html(<TopBar siteTitle={SITE_TITLE} />)}</header>

				<section class="editor-panel" aria-label="${say.editor}">
					<div class="panel-label">
						<span id="editor-path">${say.chooseArticle}</span>
						<span id="roundtrip-status">${say.waiting}</span>
					</div>
					<div id="review-bar" class="review-bar" role="status" hidden>
						<span id="review-count"></span>
						<span id="review-hint" class="review-hint">${say.reviewHint}</span>
						<button id="review-retry" type="button" hidden>${say.retry}</button>
						<button id="review-reject-all" type="button">${say.rejectAll}</button>
						<button id="review-accept-all" type="button" class="review-accept">${say.acceptAll}</button>
					</div>
					<div class="editor-scroll">
					<!-- The cover, the icon, the title, the properties: drawn by React (pages/header/), here as the server draws it. -->
					<header class="document-header">${html(<PageHeader store={header.store} actions={header.actions} />)}</header>
					<div id="crepe-editor" class="crepe-host math-editor" aria-label="${say.editor}"></div>
					</div>
					<nav id="editor-outline" class="outline-rail" aria-label="${say.outline}" hidden>
						<div class="outline-pop"><ol></ol></div>
						<div class="outline-marks" aria-hidden="true"></div>
					</nav>
				</section>
				<!-- 书: the note's books beside it, a tab each over RetainPDF's reader (wiring/book-tabs.ts). -->
				<section id="books-view" class="books-page" aria-label="${say.books}" hidden></section>
				<section id="drive-view" class="drive-page" aria-label="${say.drive}" hidden></section>
				<section id="table-view" class="table-page" aria-label="${say.allArticles}" hidden></section>
				<!-- 小程序: their list, or the one open as the page (mini-apps.ts draws it). -->
				<section id="apps-view" class="apps-page" aria-label="${say.apps}" hidden></section>
				<!-- 翻译: RetainPDF's own pages in a frame (wiring/retainpdf-view.ts). -->
				<section id="translate-view" class="translate-page" aria-label="${say.translate}" hidden></section>
				<!-- AI 问答: the AI tab's panel, moved here whole (main.ts showChat). -->
				<section id="chat-view" class="chat-view" aria-label="${say.chats}" hidden></section>
			</section>

			<aside id="side-panel" class="side-panel" aria-label="${say.sidePanel}">
				<div class="side-panel-resizer" role="separator" aria-orientation="vertical" aria-label="${say.resize}" tabindex="0" title="${say.resizeHint}"></div>
				<div class="side-tabs" role="tablist" aria-label="${say.sideTabs}" data-ui>${html(<SideTabs />)}</div>
				<!-- The AI (ai-panel.ts draws it). -->
				<section id="side-ai" class="side-pane ai-pane" role="tabpanel" aria-labelledby="side-tab-ai" hidden></section>
				<!-- The article's files: drawn by React (files/panel/), here as the server draws it. -->
				<section id="side-files" class="side-pane" role="tabpanel" aria-labelledby="side-tab-files">${html(<FilePanel store={files.store} actions={files.actions} />)}</section>
				<section id="side-drive" class="side-pane" role="tabpanel" aria-labelledby="side-tab-drive" hidden></section>
				<section id="side-terminal" class="side-pane" role="tabpanel" aria-labelledby="side-tab-terminal" hidden>
					<header class="pane-toolbar">
						<div class="cwd-switch" role="radiogroup" aria-label="${say.terminalFolder}">
							<button type="button" role="radio" data-cwd="root" aria-checked="true">${say.repoRoot}</button>
							<button type="button" role="radio" data-cwd="article" aria-checked="false">${say.thisArticle}</button>
							<button type="button" role="radio" data-cwd="drive" aria-checked="false" title="${say.driveFirst}">${say.drive}</button>
						</div>
						<span id="terminal-cwd" class="pane-path"></span>
						<div class="pane-actions">
							<button id="restart-terminal" type="button" title="${say.restartTerminal}" aria-label="${say.restartTerminal}">${html(<RotateCw aria-hidden="true" />)}</button>
						</div>
					</header>
					<div id="terminal-agents" class="terminal-agents" role="group" aria-label="${say.terminalAgents}" hidden></div>
					<div id="terminal-screen" class="terminal-screen" aria-label="${say.terminal}"></div>
				</section>
			</aside>
			<!-- The background tasks: an AI doing what a line asks, a PDF being read (task-tray.ts). -->
			<div id="task-tray" class="task-tray" aria-live="polite" hidden></div>
			<!-- The AI panel floating (显示方式 › 悬浮): moved in here by ai-chat.ts, moved and sized by ai-float.ts. -->
			<section id="ai-float" class="ai-float" aria-label="AI" hidden></section>
			<!-- The 小程序's floating windows (mini-apps.ts). -->
			<div id="mini-app-layer" class="mini-app-layer"></div>
		</main>
		<script>
			// Before the editor loads: the right column as it was left, and the page as
			// it was left (page-snapshot.ts) over it while nothing it shows has changed.
			(() => {
				const pages = ${JSON.stringify(pages).replace(/</gu, '\\u003c')};
				try {
					const shell = document.querySelector('.studio-shell');
					const layout = JSON.parse(localStorage.getItem('studio.side-panel') ?? 'null');
					if (layout?.open === false) shell.classList.add('panel-collapsed');
					if (typeof layout?.width === 'number') shell.style.setProperty('--panel-width', \`\${Math.min(720, Math.max(260, Math.round(layout.width)))}px\`);
					// The article main.ts opens (wiring/pages.ts): the address's, the one open last, or the first.
					const address = new URLSearchParams(window.location.search);
					const last = localStorage.getItem('studio.lastArticle');
					const slug = Object.hasOwn(pages.versions, address.get('article')) ? address.get('article') : Object.hasOwn(pages.versions, last) ? last : pages.first;
					const kept = JSON.parse(localStorage.getItem('studio.snapshot') ?? 'null');
					if (slug && !address.has('drive') && !address.has('pages') && kept?.slug === slug && kept.version === pages.versions[slug] && kept.locale === document.documentElement.lang && !navigator.webdriver) {
						const template = document.createElement('template');
						template.innerHTML = kept.html;
						const picture = template.content.firstElementChild;
						picture.classList.add('studio-snapshot');
						picture.inert = true;
						picture.setAttribute('aria-hidden', 'true');
						shell.after(picture);
						// Should the editor never come, the page as it is.
						setTimeout(() => picture.remove(), 10000);
					}
				} catch {
					// Storage refused, or a picture from another version of the page (or in another language): it loads as it is.
				}
			})();
		</script>

		<!-- What the shell opens over the page: dialogs, menus, the message at the bottom (mount.tsx). -->
		<div id="ui-layer" data-ui></div>

		<script type="module" src="${PAGES.studio.entry}"></script>
	</body>
</html>
`;
	return { html: page, styles };
}

export async function renderStudioWindow({ root, acceptLanguage }: { root: string; acceptLanguage: string | null }): Promise<DrawnPage> {
	const spoken = await speak(root, acceptLanguage);
	const title = t('Studio 的窗口');
	const { styles } = PAGES.window;
	const page = `<!doctype html>
<html lang="${escape(spoken)}" data-studio-locale="${escape(spoken)}">
	<head>
		${head(`Studio · ${SITE_TITLE}`, title)}
		${STYLES}
	</head>
	<body class="studio-body studio-window">
		<main id="window-body" class="window-body"></main>
		<div id="ui-layer" data-ui></div>
		<script type="module" src="${PAGES.window.entry}"></script>
	</body>
</html>
`;
	return { html: page, styles };
}

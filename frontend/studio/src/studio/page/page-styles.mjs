/**
 * The page's stylesheets, by how they are imported (found as the page's scripts find them: Milkdown's from its source),
 * each in its head (not added by its scripts later): the first picture is drawn as the editor draws it. In this order:
 * the blog's own, the editor's, the Studio's, the page's last.
 */
const CSS = {
	globalCss: '../../styles/global.css',
	katexCss: 'katex/dist/katex.min.css',
	crepeCommonCss: '@milkdown/crepe/theme/common/style.css',
	crepeClassicCss: '@milkdown/crepe/theme/classic.css',
	mathCss: '@blog/editor-kit/math/math.css',
	calloutsCss: '@blog/markdown/callouts/callouts.css',
	codeFilesCss: '@blog/markdown/code-files/code-files.css',
	figuresCss: '@blog/markdown/figures/figures.css',
	referencesCss: '@blog/markdown/references/references.css',
	fileCardsCss: '@blog/markdown/files/file-cards.css',
	officeCss: '@blog/office/office.css',
	xtermCss: '@xterm/xterm/css/xterm.css',
	tokensCss: '../tokens.css',
	interCss: '@fontsource-variable/inter/opsz.css',
	designCss: '../design.css',
	shellCss: '../shell/shell.css',
	pageHeaderCss: '../pages/page-header.css',
	filePanelCss: '../files/file-panel.css',
	sidebarHostsCss: '../shell/sidebar-hosts.css',
	driveCss: '../files/drive.css',
	articleTableCss: '../pages/article-table.css',
	aiPanelCss: '../ai/ai-panel.css',
	blockSheetCss: '@blog/ui/block-sheet.css',
	studioPageCss: './studio-page.css',
	windowPageCss: './window-page.css',
};

/**
 * The Studio's pages (render.tsx): each its script, and its stylesheets in order. Served as they are on this machine;
 * built into one for other devices (client-build.mjs), in the same order.
 * @type {Record<'studio' | 'window', { entry: string, styles: string[] }>}
 */
export const PAGES = {
	studio: {
		entry: '/src/studio/main.ts',
		styles: [CSS.globalCss, CSS.katexCss, CSS.crepeCommonCss, CSS.crepeClassicCss, CSS.mathCss, CSS.calloutsCss, CSS.codeFilesCss, CSS.figuresCss, CSS.referencesCss, CSS.fileCardsCss, CSS.officeCss, CSS.xtermCss, CSS.tokensCss, CSS.interCss, CSS.designCss, CSS.shellCss, CSS.pageHeaderCss, CSS.filePanelCss, CSS.sidebarHostsCss, CSS.driveCss, CSS.articleTableCss, CSS.aiPanelCss, CSS.blockSheetCss, CSS.studioPageCss],
	},
	window: {
		entry: '/src/studio/windows/window-main.ts',
		styles: [CSS.globalCss, CSS.katexCss, CSS.mathCss, CSS.calloutsCss, CSS.codeFilesCss, CSS.tokensCss, CSS.interCss, CSS.designCss, CSS.shellCss, CSS.aiPanelCss, CSS.blockSheetCss, CSS.windowPageCss],
	},
};

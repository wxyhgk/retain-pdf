// The Studio's parts, as main.ts makes them, for the wiring of each feature (wiring/*.ts). Each feature takes what it
// needs from here when it is used, not when it is made: the parts are made in an order, the features' hosts in another.
import type { createArticleActions } from '../pages/article-actions';
import type { createArticleList } from '../pages/article-list';
import type { createPageHeader } from '../pages/page-header';
import type { StudioEditor } from '../editor/studio-editor';
import type { createFilePanel } from '../files/file-panel';
import type { createSidePanel } from '../panels/side-panel';
import type { createTerminalPane } from '../panels/terminal';
import type { createTopBar } from '../shell/top-bar';
import type { View } from '../shell/shell-state';
import type { ArticleSession } from '../state/article-session';

export type Studio = {
	/** The page's frame (.studio-shell); the editor's scroller in it. */
	shell: HTMLElement;
	editorScroll: HTMLElement;
	session: ArticleSession;
	editor: StudioEditor;
	articleList: ReturnType<typeof createArticleList>;
	articleActions: ReturnType<typeof createArticleActions>;
	properties: ReturnType<typeof createPageHeader>;
	topBar: ReturnType<typeof createTopBar>;
	sidePanel: ReturnType<typeof createSidePanel>;
	terminal: ReturnType<typeof createTerminalPane>;
	filePanel: ReturnType<typeof createFilePanel>;
	/** The open article's title as typed. */
	title(): string;
	/** The article, the drive, the table of all articles or AI 问答, in the middle. */
	showView(view: View, folder?: string): void;
};

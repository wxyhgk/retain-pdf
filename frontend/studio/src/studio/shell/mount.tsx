import type { ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';

import { SITE_TITLE } from '../../consts';
import { ContextMenu } from './ContextMenu';
import { Dialogs } from './dialogs/Dialogs';
import { ActionsContext, shell, type ShellActions } from './shell-state';
import { SideTabs } from './SideTabs';
import { Sidebar } from './Sidebar';
import { Toast } from './Toast';
import { TopBar } from './TopBar';

/**
 * The shell drawn by React from here on (page/render.tsx has the server's drawing of it until then): the left column,
 * the bar above the middle and the right column's tabs, each in its element of the page; and what it opens over the page: dialogs, menus, the message at the bottom. Drawn at once, so that what
 * the rest of the Studio finds in them by id (the page tree's element, 小程序's button…) is there when it looks.
 */
export function mountShell(root: HTMLElement, actions: ShellActions): void {
	const parts: Array<[string, ReactNode]> = [
		['.article-sidebar', <Sidebar siteTitle={SITE_TITLE} />],
		['.studio-bar', <TopBar siteTitle={SITE_TITLE} />],
		['.side-tabs', <SideTabs />],
		[
			'#ui-layer',
			<>
				<Dialogs />
				<ContextMenu />
				<Toast />
			</>,
		],
	];
	flushSync(() => {
		for (const [selector, part] of parts) createRoot(document.querySelector<HTMLElement>(selector)!).render(<ActionsContext value={actions}>{part}</ActionsContext>);
	});

	// The column folded, as the grid has it (page/studio-page.css); folded at first on a narrow window.
	shell.subscribe(() => root.classList.toggle('sidebar-collapsed', shell.get().sidebarCollapsed));
	if (window.matchMedia('(max-width: 720px)').matches) shell.set({ sidebarCollapsed: true });
}

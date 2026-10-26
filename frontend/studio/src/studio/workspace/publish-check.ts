import { openDialog } from '../shell/dialogs/Dialogs';
import type { ArticleIssue } from '../types.ts';

/**
 * Whether to publish with what the check before publishing found (shell/dialogs/AskDialogs.tsx): at once when it found
 * nothing.
 */
export function confirmPublish(issues: ArticleIssue[]): Promise<boolean> {
	if (!issues.length) return Promise.resolve(true);
	return new Promise((done) => openDialog('publishCheck', { issues, done }));
}

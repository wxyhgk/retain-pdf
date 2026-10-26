import { listAgents } from '../api/client';
import { openDialog } from '../shell/dialogs/Dialogs';
import { showToast } from './toast';

/** 「AI 助手」 (shell/dialogs/AgentsDialog.tsx) opened with the AIs as they are; `saved` once the list is saved. */
export async function openAgents(saved: () => void): Promise<void> {
	try {
		openDialog('agents', { shown: await listAgents(), saved });
	} catch (error) {
		showToast(error instanceof Error ? error.message : '读不到 AI 助手的设置', true);
	}
}

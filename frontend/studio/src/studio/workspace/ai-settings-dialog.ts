import { aiSettings, type AiSettingsShown } from '../api/client';
import { openDialog } from '../shell/dialogs/Dialogs';

/** Ready to ask: a key there and, for an OpenAI-compatible service, its address and model. */
export function aiReady(settings: AiSettingsShown): boolean {
	return settings.hasKey && (settings.provider === 'anthropic' || Boolean(settings.baseUrl && settings.model));
}

/**
 * 「AI 设置」 (shell/dialogs/AiSettingsDialog.tsx) opened as they are, saying `why` above (when it is opened for want of a
 * setting); resolves with the settings saved, or null.
 */
export async function openAiSettings(why = ''): Promise<AiSettingsShown | null> {
	const shown = await aiSettings();
	return new Promise((done) => openDialog('aiSettings', { shown, why, done }));
}

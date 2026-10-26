import { createStore, useStore } from '../store';
import { AgentsDialog, type AgentsAsk } from './AgentsDialog';
import { AiSettingsDialog, type AiSettingsAsk } from './AiSettingsDialog';
import { DeletePageDialog, PublishCheckDialog, type DeletePageAsk, type PublishCheckAsk } from './AskDialogs';
import { HistoryDialog, type HistoryHost } from './HistoryDialog';
import { PluginsDialog, type PluginsHost } from './PluginsDialog';
import { TrashDialog, type TrashHost } from './TrashDialog';

/** The Studio's dialogs, each with what it is opened with. */
type Asks = {
	trash: { host: TrashHost };
	history: { slug: string; host: HistoryHost };
	plugins: { host: PluginsHost };
	aiSettings: AiSettingsAsk;
	agents: AgentsAsk;
	publishCheck: PublishCheckAsk;
	deletePage: DeletePageAsk;
};

/** The dialogs open: one at a time of each kind. */
const open = createStore<{ [K in keyof Asks]?: Asks[K] }>({});

/** Opens a dialog (the workspace's modules do: trash-view.ts…), with what it shows and whom it tells. */
export function openDialog<K extends keyof Asks>(kind: K, ask: Asks[K]): void {
	open.set({ [kind]: ask });
}

const closer = (kind: keyof Asks) => () => open.set({ [kind]: undefined });

/** The dialogs open, drawn over the page (in #ui-layer, mount.tsx). */
export function Dialogs() {
	const asks = useStore(open);
	return (
		<>
			{asks.trash && <TrashDialog {...asks.trash} onClose={closer('trash')} />}
			{asks.history && <HistoryDialog {...asks.history} onClose={closer('history')} />}
			{asks.plugins && <PluginsDialog {...asks.plugins} onClose={closer('plugins')} />}
			{asks.aiSettings && <AiSettingsDialog {...asks.aiSettings} onClose={closer('aiSettings')} />}
			{asks.agents && <AgentsDialog {...asks.agents} onClose={closer('agents')} />}
			{asks.publishCheck && <PublishCheckDialog {...asks.publishCheck} onClose={closer('publishCheck')} />}
			{asks.deletePage && <DeletePageDialog {...asks.deletePage} onClose={closer('deletePage')} />}
		</>
	);
}

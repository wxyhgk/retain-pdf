import { createStore, useStore } from '../store';
import { AgentsDialog, type AgentsAsk } from './AgentsDialog';
import { CiteDialog, type CiteAsk } from './CiteDialog';
import { DeletePageDialog, PublishCheckDialog, type DeletePageAsk, type PublishCheckAsk } from './AskDialogs';
import { HistoryDialog, type HistoryHost } from './HistoryDialog';
import { NewAppDialog, type NewAppAsk } from './NewAppDialog';
import { QuickFindDialog, type QuickFindAsk } from './QuickFindDialog';
import { SettingsDialog, type SettingsAsk } from './SettingsDialog';
import { TrashDialog, type TrashHost } from './TrashDialog';

/** The Studio's dialogs, each with what it is opened with. */
type Asks = {
	trash: { host: TrashHost };
	history: { slug: string; host: HistoryHost };
	settings: SettingsAsk;
	agents: AgentsAsk;
	publishCheck: PublishCheckAsk;
	deletePage: DeletePageAsk;
	finder: QuickFindAsk;
	cite: CiteAsk;
	newApp: NewAppAsk;
};

/** The dialogs open: one at a time of each kind. */
const open = createStore<{ [K in keyof Asks]?: Asks[K] }>({});

/** Opens a dialog (shell/dialogs/ask.ts and the rest of the Studio do), with what it shows and whom it tells. */
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
			{/* Asked again while open (for another part): a new one, there. */}
			{asks.settings && <SettingsDialog key={`${asks.settings.section}-${asks.settings.why ?? ''}`} {...asks.settings} onClose={closer('settings')} />}
			{asks.agents && <AgentsDialog {...asks.agents} onClose={closer('agents')} />}
			{asks.publishCheck && <PublishCheckDialog {...asks.publishCheck} onClose={closer('publishCheck')} />}
			{asks.deletePage && <DeletePageDialog {...asks.deletePage} onClose={closer('deletePage')} />}
			{/* Asked again while open: a new one, empty. */}
			{asks.finder && <QuickFindDialog key={asks.finder.round} ask={asks.finder} onClose={closer('finder')} />}
			{asks.cite && <CiteDialog key={asks.cite.round} ask={asks.cite} onClose={closer('cite')} />}
			{asks.newApp && <NewAppDialog {...asks.newApp} onClose={closer('newApp')} />}
		</>
	);
}

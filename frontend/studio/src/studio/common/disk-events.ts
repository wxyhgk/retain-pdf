/** Something changed in this article's folder: `paths` relative to it, `''` for the folder itself. */
export type DiskChange = { slug: string; paths: string[] };

/**
 * The server's news, one line for the page (`/api/studio/events`; a browser keeps few lines open to one server): what
 * changed in `blog/` (its messages), a page app's files changed (`app-changed`). The browser reconnects by itself if
 * the server restarts.
 */
let line: EventSource | null = null;
const news = () => (line ??= new EventSource('/api/studio/events'));

/**
 * Listens to the server for changes in `blog/`, from the terminal, Finder
 * or anything else.
 */
export function watchDisk(onChange: (changes: DiskChange[]) => void): () => void {
	const heard = (event: MessageEvent) => {
		let changes: DiskChange[];
		try {
			changes = JSON.parse(event.data);
		} catch {
			return;
		}
		onChange(changes);
	};
	news().addEventListener('message', heard);
	return () => news().removeEventListener('message', heard);
}

/** Listens for a page app's files changed (its windows load it again), by the app's id. */
export function watchApps(onChange: (id: string) => void): () => void {
	const heard = (event: MessageEvent) => {
		try {
			const { id } = JSON.parse(event.data) as { id?: unknown };
			if (typeof id === 'string') onChange(id);
		} catch {
			// Not news of an app.
		}
	};
	news().addEventListener('app-changed', heard as EventListener);
	return () => news().removeEventListener('app-changed', heard as EventListener);
}

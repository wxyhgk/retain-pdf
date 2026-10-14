/** Something changed in this article's folder: `paths` relative to it, `''` for the folder itself. */
export type DiskChange = { slug: string; paths: string[] };

/**
 * Listens to the dev server for changes in `blog/`, from the terminal, Finder
 * or anything else. The browser reconnects by itself if the server restarts.
 */
export function watchDisk(onChange: (changes: DiskChange[]) => void): () => void {
	const source = new EventSource('/api/studio/events');
	source.addEventListener('message', (event) => {
		let changes: DiskChange[];
		try {
			changes = JSON.parse(event.data);
		} catch {
			return;
		}
		onChange(changes);
	});
	return () => source.close();
}

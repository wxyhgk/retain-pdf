/**
 * What one save attempt came to:
 * - `saved`: everything is on disk;
 * - `more`: saved, but newer edits came in meanwhile;
 * - `held`: the article cannot be saved as it is (a property is invalid) until it changes again;
 * - `failed`: something went wrong that may pass, so it is tried again later;
 * - `conflict`: the article changed on disk; saving waits for `resume()`.
 */
export type SaveOutcome = 'saved' | 'more' | 'held' | 'failed' | 'conflict';

export type AutosaveOptions = {
	save: () => Promise<SaveOutcome>;
	/** Quiet time after the last change before saving. */
	delay?: number;
	/** Longest an edit waits while changes keep coming. */
	maxWait?: number;
	/** Wait before trying again after a failed save. */
	retryDelay?: number;
	setTimer?: (run: () => void, ms: number) => unknown;
	clearTimer?: (timer: unknown) => void;
	now?: () => number;
};

/**
 * Saves the article by itself: shortly after the author stops typing, at
 * least every `maxWait` while they keep on, and at once when asked
 * (`flush`, before switching articles or moving files). One save runs at a
 * time; edits made during it are saved by the next one.
 */
export class Autosave {
	#timer: unknown = null;
	#since = 0;
	#running: Promise<boolean> | null = null;
	#paused = false;
	readonly #save: () => Promise<SaveOutcome>;
	readonly #delay: number;
	readonly #maxWait: number;
	readonly #retryDelay: number;
	readonly #setTimer: (run: () => void, ms: number) => unknown;
	readonly #clearTimer: (timer: unknown) => void;
	readonly #now: () => number;

	constructor(options: AutosaveOptions) {
		this.#save = options.save;
		this.#delay = options.delay ?? 800;
		this.#maxWait = options.maxWait ?? 8000;
		this.#retryDelay = options.retryDelay ?? 5000;
		this.#setTimer = options.setTimer ?? ((run, ms) => setTimeout(run, ms));
		this.#clearTimer = options.clearTimer ?? ((timer) => clearTimeout(timer as ReturnType<typeof setTimeout>));
		this.#now = options.now ?? (() => Date.now());
	}

	/** The article was edited. */
	changed(): void {
		if (this.#paused) return;
		const now = this.#now();
		if (this.#timer === null) this.#since = now;
		else this.#clearTimer(this.#timer);
		this.#schedule(Math.min(this.#delay, Math.max(0, this.#since + this.#maxWait - now)));
	}

	/** Saves now, after any save under way. Whether everything is saved. */
	async flush(): Promise<boolean> {
		this.#cancel();
		while (this.#running) await this.#running;
		// A save that just ended may have planned another: this one covers it.
		this.#cancel();
		if (this.#paused) return false;
		const running = this.#attempt();
		this.#running = running;
		try {
			return await running;
		} finally {
			this.#running = null;
		}
	}

	/** Saving may go on after a conflict was settled. */
	resume(): void {
		this.#paused = false;
		this.changed();
	}

	/** Nothing pending is saved: the edits were dropped, or another article opened. */
	cancel(): void {
		this.#cancel();
	}

	async #attempt(): Promise<boolean> {
		let outcome: SaveOutcome;
		try {
			outcome = await this.#save();
		} catch {
			outcome = 'failed';
		}
		if (outcome === 'more') this.changed();
		else if (outcome === 'failed') this.#schedule(this.#retryDelay);
		else if (outcome === 'conflict') this.#paused = true;
		return outcome === 'saved';
	}

	#schedule(ms: number): void {
		this.#timer = this.#setTimer(() => {
			this.#timer = null;
			void this.flush();
		}, ms);
	}

	#cancel(): void {
		if (this.#timer === null) return;
		this.#clearTimer(this.#timer);
		this.#timer = null;
	}
}

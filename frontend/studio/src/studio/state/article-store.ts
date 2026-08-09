import type { ArticlePayload, ArticleProperties } from '../types.ts';

export type ArticleSnapshot = {
	article: ArticlePayload | null;
	source: string;
	revision: string;
	dirty: boolean;
};

type Subscriber = (snapshot: ArticleSnapshot) => void;

export class ArticleStore {
	private snapshot: ArticleSnapshot = { article: null, source: '', revision: '', dirty: false };
	private readonly subscribers = new Set<Subscriber>();

	get current(): ArticleSnapshot {
		return this.snapshot;
	}

	load(article: ArticlePayload): void {
		this.snapshot = {
			article,
			source: article.source,
			revision: article.revision,
			dirty: false,
		};
		this.emit();
	}

	updateSource(source: string): void {
		if (!this.snapshot.article || source === this.snapshot.source) return;
		this.snapshot = { ...this.snapshot, source, dirty: source !== this.snapshot.article.source };
		this.emit();
	}

	markSaved(revision: string, properties?: ArticleProperties): void {
		if (!this.snapshot.article) return;
		const article = {
			...this.snapshot.article,
			source: this.snapshot.source,
			revision,
			properties: properties ?? this.snapshot.article.properties,
		};
		this.snapshot = { article, source: this.snapshot.source, revision, dirty: false };
		this.emit();
	}

	updateRevision(revision: string, chemistryViews?: ArticlePayload['chemistryViews']): void {
		if (!this.snapshot.article) return;
		const article = {
			...this.snapshot.article,
			revision,
			...(chemistryViews ? { chemistryViews } : {}),
		};
		this.snapshot = { ...this.snapshot, article, revision };
		this.emit();
	}

	subscribe(subscriber: Subscriber): () => void {
		this.subscribers.add(subscriber);
		return () => this.subscribers.delete(subscriber);
	}

	private emit(): void {
		for (const subscriber of this.subscribers) subscriber(this.snapshot);
	}
}

export declare function createSelector(inputs: Array<(...args: any[]) => any>, projector: (...args: any[]) => any): (...args: any[]) => any;
export declare function createStoreSelector(store: {
    getSnapshot: () => unknown;
}, selector: (snapshot: unknown) => unknown): () => unknown;

import { type ReaderFavorite } from "../shared/state/reader-favorites.js";
export declare function useReaderFavorites(scope: string): {
    favorites: ReaderFavorite[];
    add: (entry: {
        text: string;
        page: number;
        pane: "source" | "translated";
    }) => void;
    remove: (id: string) => void;
};
//# sourceMappingURL=use-reader-favorites.d.ts.map
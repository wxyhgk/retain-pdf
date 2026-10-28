export type FontInfo = {
    family: string;
    files: string[];
    available: boolean;
};
export declare function listFonts(apiPrefix?: string): Promise<FontInfo[]>;

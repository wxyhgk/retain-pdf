import type { ProgramField } from './programs.mjs';

export type Solvent = { model: 'alpb' | 'gbsa'; name: string };

/** What xtb and the programs built on it take alike. */
export type XtbCommon = { charge: number; uhf: number; solvent: Solvent | null };

export declare function solventNames(): Record<string, string>;
export declare function splitArgs(text: string): string[];
export declare function joinArgs(words: string[]): string;
export declare function readXtbCommon(words: string[], index: number, options: XtbCommon): number;
export declare function writeXtbCommon(options: XtbCommon): string[];
export declare function describeXtbCommon(options: XtbCommon): string[];
export declare const XTB_COMMON_FIELDS: ReadonlyArray<ProgramField<any>>;

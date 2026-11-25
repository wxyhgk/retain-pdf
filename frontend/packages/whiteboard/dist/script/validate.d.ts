import type { BoardScript } from "./types.js";
export declare const SCRIPT_LIMITS: {
    readonly steps: 100;
    readonly opsPerStep: 40;
    readonly text: 400;
    readonly tex: 1000;
    readonly say: 600;
    readonly levels: 12;
};
export type ValidatedScript = {
    script: BoardScript;
    issues: string[];
};
export declare function validateScript(input: unknown): ValidatedScript;

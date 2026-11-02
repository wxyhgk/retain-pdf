/**
 * `\(…\)` inline and `\[…\]` display formulas, as remark-math's `inlineMath` and `math` nodes.
 * Typed loosely on purpose: Astro and Milkdown each bring their own copy of unified's types.
 */
declare function remarkMathBrackets(this: any): (tree: any) => void;
export default remarkMathBrackets;
export function mathBracketSyntax(): unknown;
export function mathBracketFromMarkdown(): unknown;

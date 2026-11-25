// 尺寸：文字按字符估宽（不碰 DOM，同一份脚本在哪儿算都一样，测试也能算）；公式的尺寸由 MathJax 给。
export const FONT_SIZE = { s: 16, m: 22, l: 30 };
export const LINE_HEIGHT = 1.35;
/** 一个字符大约占几个 em。中日韩和全角按 1，拉丁字母按常见无衬线字体的平均宽度。 */
export function charEm(char) {
    const code = char.codePointAt(0) ?? 0;
    if ((code >= 0x2e80 && code <= 0x9fff)
        || (code >= 0xac00 && code <= 0xd7af)
        || (code >= 0xf900 && code <= 0xfaff)
        || (code >= 0xff00 && code <= 0xffef)
        || (code >= 0x3000 && code <= 0x303f))
        return 1;
    if (char === " ")
        return 0.3;
    if (/[il.,:;'|!]/.test(char))
        return 0.3;
    if (/[mwMW@]/.test(char))
        return 0.88;
    if (/[A-Z0-9]/.test(char))
        return 0.66;
    if (/[a-z]/.test(char))
        return 0.56;
    // 希腊字母、数学符号、上下标等：系统字体里普遍偏宽，宁可估大。
    return 0.68;
}
export function textWidth(value, fontSize) {
    let em = 0;
    for (const char of value)
        em += charEm(char);
    return Math.ceil(em * fontSize);
}
/** 按估出来的宽度折行（批注用）；英文按词折，中文按字折。 */
export function wrapText(value, fontSize, maxWidth) {
    const lines = [];
    for (const paragraph of value.split("\n")) {
        let line = "";
        const tokens = paragraph.match(/[A-Za-z0-9_'’.-]+\s*|\s+|./gu) ?? [];
        for (const token of tokens) {
            const candidate = line + token;
            if (line && textWidth(candidate.trimEnd(), fontSize) > maxWidth) {
                lines.push(line.trimEnd());
                line = token.trimStart();
            }
            else {
                line = candidate;
            }
        }
        lines.push(line.trimEnd());
    }
    return lines.length ? lines : [""];
}
/** MathJax 的尺寸单位是 ex；按当前字号换成像素（1ex ≈ 0.442em，MathJax 默认字体）。 */
export function exToPx(ex, fontSize) {
    return ex * fontSize * 0.442;
}

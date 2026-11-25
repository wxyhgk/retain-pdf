// 白板存在本机（localStorage，按 key）：演示页和第一版的阅读页用。存不了（隐私模式、满了）也照常能用，只是不记。
import { useEffect, useRef, useState } from "react";
import { emptyBoard, parseBoard } from "./board-state.js";
const SAVE_DELAY_MS = 400;
export function loadBoard(key) {
    try {
        const raw = globalThis.localStorage?.getItem(key);
        return raw ? parseBoard(JSON.parse(raw)) : emptyBoard();
    }
    catch {
        return emptyBoard();
    }
}
export function saveBoard(key, doc) {
    try {
        globalThis.localStorage?.setItem(key, JSON.stringify(doc));
    }
    catch {
        // 存不了就不存。
    }
}
/** [doc, setDoc]：换 key 时读那一份；改了以后停一会儿再存。 */
export function useBoardStorage(key) {
    const [state, setState] = useState(() => ({ key, doc: loadBoard(key) }));
    const current = state.key === key ? state.doc : loadBoard(key);
    if (state.key !== key)
        setState({ key, doc: current });
    const timer = useRef(null);
    const pending = useRef(null);
    const flush = () => {
        if (timer.current)
            clearTimeout(timer.current);
        timer.current = null;
        if (pending.current)
            saveBoard(pending.current.key, pending.current.doc);
        pending.current = null;
    };
    // 关掉（卸载）时把还没存的存上。
    useEffect(() => flush, []);
    const setDoc = (doc) => {
        setState({ key, doc });
        if (pending.current && pending.current.key !== key)
            flush();
        pending.current = { key, doc };
        if (timer.current)
            clearTimeout(timer.current);
        timer.current = setTimeout(flush, SAVE_DELAY_MS);
    };
    return [current, setDoc];
}

import { type ReactElement } from "react";
import type { VersionCompare } from "../../hooks/use-reader-version-compare.js";
/** 「11月18日 18:31」；读不出写空。 */
export declare function versionTimeText(iso: string): string;
/** 版本名拆成「方式」和「模型」：「精翻 · deepseek-v4-flash」→ 精翻 / deepseek-v4-flash；拆不开整个当模型。 */
export declare function splitVersionName(name: string): {
    engine: string;
    model: string;
};
/** 小球里「对比版本」点开的那张卡。 */
export declare function VersionCompareMenu({ compare, onDone }: {
    compare: VersionCompare;
    onDone: () => void;
}): ReactElement;
/** 对比时一栏书页上方淡淡的水印：RetainPDF 标记、模型名大字、「对比 / 正在读 · 方式 · 时间」小字。不接鼠标。 */
export declare function VersionWatermark({ role, name, createdAt }: {
    role: "compare" | "reading";
    name: string;
    createdAt: string;
}): ReactElement;
/**
 * 两栏的水印，固定在每栏正上方（书页区顶下 14px，横向对着栏的中线）。
 * 每栏自己是个 overflow:auto 的容器（从不滚），sticky 贴不住，所以量出栏的位置用 fixed 放；栏宽、窗口一变、横向滚动时重量。
 */
export declare function VersionWatermarks({ shellEl, left, right, }: {
    shellEl: HTMLElement | null | undefined;
    left: {
        name: string;
        createdAt: string;
    };
    right: {
        name: string;
        createdAt: string;
    };
}): ReactElement | null;
//# sourceMappingURL=ReaderVersionCompare.d.ts.map
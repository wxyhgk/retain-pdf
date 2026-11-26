/**
 * 思考强度的胶囊滑块：改自 zanwei/claude-model-selector（MIT，Copyright (c) 2026 Zanwei Guo，
 * https://github.com/zanwei/claude-model-selector ，仿 Claude 桌面版的 Effort 滑块）。
 *
 * 照搬的：轨道 + 刻度 + 滑块的样子；拖的时候靠近刻度被吸过去（_applyMagnet）；松手按拖动速度弹到最近一档（_springTo，
 * 刚度 920、阻尼 40）；档位名切换时上下错开淡入淡出；方向键 / Home / End / PageUp / PageDown；系统要求减少动画时不弹、不淡。
 * 改了的：原作是 Web Component、写死六档（Low…Ultracode）和紫色；这里是 React，档位由调用方给（agent 报几档就几档、名字照原样），
 * 颜色由调用方按档位算（colorAt），不再有最高档的像素动画、帮助气泡和自己的弹层（放在选模型的弹层里）。样式在 styles/ask.css。
 */
import { type ReactElement, type ReactNode } from "react";
export type EffortLevel = {
    id: string;
    name: string;
    description?: string;
};
export type EffortSliderProps = {
    levels: readonly EffortLevel[];
    value: string;
    onChange: (id: string) => void;
    /** 第几档（共几档）是什么颜色；拖的时候跟着变。 */
    colorAt?: (index: number, count: number) => string;
    /** 档位名前面那个图标或字。 */
    label?: ReactNode;
    /** 轨道上方左右两头（原作是 Faster / Smarter）。 */
    start?: ReactNode;
    end?: ReactNode;
    className?: string;
    "aria-label"?: string;
};
export declare function EffortSlider({ levels, value, onChange, colorAt, label, start, end, className, ...rest }: EffortSliderProps): ReactElement | null;

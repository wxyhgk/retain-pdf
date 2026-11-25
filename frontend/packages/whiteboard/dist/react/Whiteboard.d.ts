export type WhiteboardProps = {
    /** 讲解脚本（未校验的 JSON 也行，组件里校验）。 */
    script: unknown;
    /** 受控：第几步（从 0 开始）。不传就组件自己管。 */
    step?: number;
    onStepChange?: (step: number) => void;
    /** 打开就自动往下播。默认 false：画完这一步停住，等学生点「下一步」。 */
    autoPlay?: boolean;
    /** 不传时跟系统的「减少动态效果」。 */
    reducedMotion?: boolean;
    /** 不显示底部的控制条（宿主自己做按钮时）。 */
    hideControls?: boolean;
    /** 校验发现的问题（开发时看）。 */
    onIssues?: (issues: string[]) => void;
    className?: string;
};
export declare function Whiteboard({ script: rawScript, step: controlledStep, onStepChange, autoPlay, reducedMotion, hideControls, onIssues, className, }: WhiteboardProps): import("react").JSX.Element;

import type { ReactElement } from "react";
/** 一串文字（agent id、名字、模型名、服务商）→ 图标名；认不出是空串。 */
export declare function brandFor(...texts: readonly (string | undefined)[]): string;
export declare function BrandIcon({ brand, size, title }: {
    brand: string;
    size?: number;
    title?: string;
}): ReactElement;
/** agent 的图标：RetainPDF 自带的两个用我们自己的（书 / π），别的按名字认厂商。 */
export declare function AgentIcon({ id, name, size }: {
    id: string;
    name: string;
    size?: number;
}): ReactElement;

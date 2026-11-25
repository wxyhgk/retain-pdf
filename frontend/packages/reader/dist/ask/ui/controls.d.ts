import { type ComponentProps } from "react";
import { Button as UiButton } from "@retainpdf/ui";
type ShadcnVariant = "default" | "outline" | "secondary" | "ghost" | "destructive" | "link";
type ShadcnSize = "default" | "sm" | "lg" | "icon" | "icon-sm" | "icon-xs" | "xs";
export type ButtonProps = Omit<ComponentProps<typeof UiButton>, "variant" | "size"> & {
    variant?: ShadcnVariant;
    size?: ShadcnSize;
    asChild?: boolean;
};
export declare const Button: import("react").ForwardRefExoticComponent<Omit<ButtonProps, "ref"> & import("react").RefAttributes<HTMLButtonElement>>;
export declare const Textarea: import("react").ForwardRefExoticComponent<Omit<import("react").DetailedHTMLProps<import("react").TextareaHTMLAttributes<HTMLTextAreaElement>, HTMLTextAreaElement>, "ref"> & import("react").RefAttributes<HTMLTextAreaElement>>;
export {};
//# sourceMappingURL=controls.d.ts.map
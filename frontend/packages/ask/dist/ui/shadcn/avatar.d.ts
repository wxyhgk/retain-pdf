import * as React from "react";
import { Avatar as AvatarPrimitive } from "radix-ui";
declare function Avatar({ className, size, ...props }: React.ComponentProps<typeof AvatarPrimitive.Root> & {
    size?: "default" | "sm" | "lg";
}): React.JSX.Element;
declare function AvatarImage({ className, ...props }: React.ComponentProps<typeof AvatarPrimitive.Image>): React.JSX.Element;
declare function AvatarFallback({ className, ...props }: React.ComponentProps<typeof AvatarPrimitive.Fallback>): React.JSX.Element;
declare function AvatarBadge({ className, ...props }: React.ComponentProps<"span">): React.JSX.Element;
declare function AvatarGroup({ className, ...props }: React.ComponentProps<"div">): React.JSX.Element;
declare function AvatarGroupCount({ className, ...props }: React.ComponentProps<"div">): React.JSX.Element;
export { Avatar, AvatarImage, AvatarFallback, AvatarBadge, AvatarGroup, AvatarGroupCount, };

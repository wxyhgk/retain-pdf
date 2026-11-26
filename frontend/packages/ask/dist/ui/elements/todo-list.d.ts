import { type ComponentProps } from "react";
export type TodoStatus = "pending" | "active" | "done" | "failed" | "cancelled";
export interface TodoItem {
    id: string;
    text: string;
    status: TodoStatus;
    description?: string | undefined;
    reason?: string | undefined;
}
export declare function TodoList({ items, revision, title, description, maxVisible, className, ...props }: Omit<ComponentProps<"div">, "children" | "items" | "revision" | "title"> & {
    items: readonly TodoItem[];
    revision?: number | undefined;
    title?: string | undefined;
    description?: string | undefined;
    maxVisible?: number | undefined;
}): import("react").JSX.Element;

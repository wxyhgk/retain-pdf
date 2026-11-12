// 书籍详情自己几个页签的图标（概览、进度、文件）。质量、术语、历史用 lucide 的。
import type { SVGProps } from "react";

export function BookIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" width="13" height="13" aria-hidden="true" {...props}>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" strokeLinecap="round" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ProcessingIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" width="13" height="13" aria-hidden="true" {...props}>
      <path d="m5 8 6 6" strokeLinecap="round" />
      <path d="m4 14 6-6 2-3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2 5h12" strokeLinecap="round" />
      <path d="M7 2h1" strokeLinecap="round" />
      <path d="m22 22-5-10-5 10" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 18h6" strokeLinecap="round" />
    </svg>
  );
}

export function FileIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" width="13" height="13" aria-hidden="true" {...props}>
      <path d="M6 2h8l4 4v16H6z" strokeLinejoin="round" />
      <path d="M14 2v5h5M9 12h6M9 16h6" strokeLinecap="round" />
    </svg>
  );
}

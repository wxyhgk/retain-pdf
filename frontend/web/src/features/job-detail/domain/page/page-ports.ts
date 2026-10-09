// 详情页 DOM 写入端口的共享类型（由 app/detail 的 DetailApp 注入具体实现）。

/** 写入某个节点的文案 */
export type DetailSetText = (id: string, text: string) => void;

/** 写入某个动作链接的 href 与可用状态 */
export type DetailSetActionLink = (id: string, href: string | undefined, enabled: boolean) => void;

/** 带鉴权拉取受保护资源（如 markdown 图片） */
export type DetailFetchProtected = (url: string) => Promise<Response>;

/** /markdown 接口回包里详情页读取的字段 */
export interface MarkdownPayloadLike {
  raw_url?: string;
  raw_path?: string;
  json_url?: string;
  json_path?: string;
  images_base_url?: string;
  images_base_path?: string;
  content?: string;
  content_with_absolute_image_urls?: string;
  images?: Array<{ path?: string; url?: string }>;
  file_name?: string;
  size_bytes?: number | null;
}

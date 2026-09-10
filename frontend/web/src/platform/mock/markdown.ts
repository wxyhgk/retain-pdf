import {
  MOCK_JOB_ID,
  MOCK_MARKDOWN_CONTENT,
} from "./constants.js";

export function getMockJobMarkdown() {
  return {
    job_id: MOCK_JOB_ID,
    content: MOCK_MARKDOWN_CONTENT,
    content_with_absolute_image_urls: MOCK_MARKDOWN_CONTENT.replaceAll("page-1/imgs/mock-figure-1.png", "mock://markdown/images/page-1/imgs/mock-figure-1.png"),
    images: [
      {
        path: "page-1/imgs/mock-figure-1.png",
        url: "mock://markdown/images/page-1/imgs/mock-figure-1.png",
        content_type: "image/png",
        size_bytes: 1024,
      },
    ],
    raw_url: "mock://markdown.raw",
    raw_path: "mock://markdown.raw",
    images_base_url: "mock://markdown/images/",
    images_base_path: "mock://markdown/images/",
  };
}

import { currentMockScenario } from "./scenario.js";

export function buildMockManifest(scenario = currentMockScenario()) {
  if (scenario !== "done") {
    return { items: [] };
  }
  return {
    items: [
      { artifact_key: "source_pdf", ready: true, resource_url: "mock://source.pdf" },
      { artifact_key: "pdf", ready: true, resource_url: "mock://translated.pdf" },
      { artifact_key: "markdown_raw", ready: true, resource_url: "mock://markdown.raw" },
      { artifact_key: "markdown_images_dir", ready: true, resource_url: "mock://markdown/images/" },
      { artifact_key: "markdown_bundle_zip", ready: true, resource_url: "mock://bundle.zip" },
    ],
  };
}

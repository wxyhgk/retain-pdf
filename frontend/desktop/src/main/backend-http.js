const http = require("http");

function createBackendHttp(options = {}) {
  const desktopApiKey = options.desktopApiKey || "";
  const logger = options.logger || console;

  async function canReuseExistingBackend(apiPort) {
    const healthUrl = `http://127.0.0.1:${apiPort}/health`;
    const jobsUrl = `http://127.0.0.1:${apiPort}/api/v1/jobs?limit=1&offset=0`;
    try {
      const healthPayload = await requestJson(healthUrl, {}, 2000);
      if (!(healthPayload && healthPayload.data && healthPayload.data.status === "up")) {
        return false;
      }
      const jobsPayload = await requestJson(jobsUrl, {
        "x-api-key": desktopApiKey,
      }, 3000);
      return Array.isArray(jobsPayload?.data?.items);
    } catch (error) {
      logger.warn(
        `[desktop] existing backend on :${apiPort} is not reusable: ${error?.message || error}`,
      );
      return false;
    }
  }

  return {
    canReuseExistingBackend,
    requestJson,
  };
}

function requestJson(url, headers = {}, timeoutMs = 2000) {
  return new Promise((resolve, reject) => {
    const request = http.get(
      url,
      {
        headers,
        timeout: timeoutMs,
      },
      (response) => {
        let body = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          body += chunk;
        });
        response.on("end", () => {
          if (response.statusCode && response.statusCode >= 400) {
            reject(new Error(`http ${response.statusCode}`));
            return;
          }
          try {
            resolve(JSON.parse(body));
          } catch (error) {
            reject(error);
          }
        });
      },
    );
    request.on("timeout", () => {
      request.destroy(new Error("request timeout"));
    });
    request.on("error", reject);
  });
}

module.exports = {
  createBackendHttp,
  requestJson,
};

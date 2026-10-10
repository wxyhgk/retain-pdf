import { isMockMode } from "@/platform/config/runtime.js";
import { fetchMockProtected } from "@/platform/mock/index.js";
import {
  fetchProtected as _canonFetchProtected,
  submitJson as _canonSubmitJson,
  submitUploadRequest as _canonSubmitUploadRequest,
} from "@retainpdf/api/http";
import {
  submitJson as _mockSubmitJson,
  submitUploadRequest as _mockSubmitUploadRequest,
} from "../mocks/http.js";

export { buildApiEndpoint, buildJobDetailEndpoint, isPageQuotaError, PAGE_QUOTA_EXCEEDED, type PageQuotaError } from "@retainpdf/api/http";

// Wrap mock-aware http helpers so mock:// and mock job submissions still work in tests
export const fetchProtected = async (url: string, options: RequestInit = {}): Promise<Response> => {
  if (isMockMode() && `${url || ""}`.startsWith("mock://")) return fetchMockProtected(url);
  return _canonFetchProtected(url, options);
};
export const submitJson = async (url: string, payload: unknown): Promise<any> => {
  if (isMockMode()) return _mockSubmitJson(url, payload);
  return _canonSubmitJson(url, payload);
};
export const submitUploadRequest = (url: string, form: FormData, onProgress?: (a:number,b:number)=>void): Promise<any> => {
  if (isMockMode()) return _mockSubmitUploadRequest(url, form, onProgress);
  return _canonSubmitUploadRequest(url, form, onProgress);
};
export const submitUploadRequestHttp = submitUploadRequest;

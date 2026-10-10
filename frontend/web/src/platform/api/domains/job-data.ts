import * as MockJobData from "../mocks/job-data.js";
import {
  fetchJobData as _canonFetchJobData,
  fetchJobDataCatalog as _canonFetchJobDataCatalog,
} from "@retainpdf/api/job-data";
import { mockable } from "./_mockable.js";

export type { JobDataCatalogView, JobDataQuery, JobDataView } from "@retainpdf/api/job-data";

export const fetchJobData = mockable(_canonFetchJobData, MockJobData.fetchJobData);
export const fetchJobDataCatalog = mockable(_canonFetchJobDataCatalog, MockJobData.fetchJobDataCatalog);

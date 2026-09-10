import test from "node:test";
import assert from "node:assert/strict";

import { canReturnToReaderReferrer } from "../../../../frontend/packages/reader/src/components/react-pdf/ReaderCloseHome.tsx";

test("Reader close only walks history back to a real same-origin home route", () => {
  const current = "http://127.0.0.1:40001/reader.html?job_id=job-1";
  assert.equal(canReturnToReaderReferrer(
    "http://127.0.0.1:40001/index.html",
    current,
    2,
  ), true);
  assert.equal(canReturnToReaderReferrer("", current, 8), false);
  assert.equal(canReturnToReaderReferrer(
    "http://127.0.0.1:40001/reader.html?job_id=job-old",
    current,
    8,
  ), false);
  assert.equal(canReturnToReaderReferrer(
    "https://example.com/landing",
    current,
    8,
  ), false);
});

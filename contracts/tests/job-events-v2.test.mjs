import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = name => JSON.parse(readFileSync(new URL(`../${name}`, import.meta.url)));
const schema = read("job-events.v2.schema.json");

test("events v2 has the event feed and the editorial events, and no legacy offset operation", () => {
  // 旧地址 /jobs/:id/events、/ocr/jobs/:id/events 2026-10-18 删了。翻译 agent 的编辑部事件 2026-10-30 加在后面。
  assert.deepEqual(schema.endpoints.map(endpoint => endpoint.path), [
    "/api/v1/jobs/:job_id/progress/events",
    "/api/v1/jobs/:job_id/progress/editorial",
  ]);
  assert.equal(Object.hasOwn(schema.endpoints[0], "deprecated_aliases"), false);
  assert.ok(read("job-status.v1.schema.json").endpoints.every(endpoint => !endpoint.path.endsWith("/events")));
  const query = schema.definitions.ListJobEventsQuery;
  assert.equal(query.additionalProperties, false);
  assert.equal(Object.hasOwn(query.properties, "offset"), false);
  assert.deepEqual(query.not, { required: ["cursor", "start"] });
  assert.deepEqual(query.properties.start.enum, ["head", "tail"]);
});

test("events v2 requires stable identity and an explicit bounded cursor response", () => {
  const { JobEventRecord, JobEventListView } = schema.definitions;
  assert.ok(JobEventRecord.required.includes("event_id"));
  assert.equal(JobEventRecord.properties.seq.minimum, 1);
  assert.equal(JobEventListView.properties.protocol_version.const, 2);
  assert.deepEqual(JobEventListView.required, ["protocol_version", "items", "next_cursor", "has_more", "limit"]);
  assert.equal(JobEventListView.properties.items.maxItems, 500);
});

test("editorial events are read by count and passed through as editorial.v1 objects", () => {
  const { EditorialEventsQuery, EditorialEventListView, EditorialEvent } = schema.definitions;
  assert.equal(EditorialEventsQuery.additionalProperties, false);
  assert.deepEqual(Object.keys(EditorialEventsQuery.properties), ["after", "limit"]);
  assert.deepEqual(EditorialEventListView.required, ["events", "next_after", "has_more"]);
  assert.equal(EditorialEventListView.additionalProperties, false);
  assert.deepEqual(EditorialEvent.required, ["v", "ts", "type"]);
  assert.equal(EditorialEvent.properties.v.const, "editorial.v1");
  const endpoint = schema.endpoints.find(e => e.path === "/api/v1/jobs/:job_id/progress/editorial");
  assert.deepEqual([endpoint.method, endpoint.client_name, endpoint.transport], ["GET", "listEditorialEvents", "json"]);
});

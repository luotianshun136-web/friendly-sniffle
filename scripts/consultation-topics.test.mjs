import assert from "node:assert/strict";
import test from "node:test";
import { CONSULTATION_TOPICS, findConsultationTopic } from "../lib/consultation-topics.ts";

test("six distinct topics have complete consultation copy", () => {
  assert.equal(CONSULTATION_TOPICS.length, 6);
  assert.equal(new Set(CONSULTATION_TOPICS.map((topic) => topic.id)).size, 6);
  for (const topic of CONSULTATION_TOPICS) {
    assert.match(topic.id, /^[a-z-]+$/);
    for (const key of ["title", "empathy", "situation", "assessment", "direction"]) assert.ok(topic[key].trim());
    assert.equal(findConsultationTopic(topic.id)?.title, topic.title);
  }
});

test("unrecognized or prototype-like identifiers never resolve", () => {
  for (const id of ["", "__proto__", "constructor", "fake-topic", "<script>", "career-and-life/extra"]) {
    assert.equal(findConsultationTopic(id), undefined);
  }
});

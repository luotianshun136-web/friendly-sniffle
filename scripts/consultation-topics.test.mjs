import assert from "node:assert/strict";
import test from "node:test";
import { CONSULTATION_TOPICS, SECONDARY_CONSULTATION_TOPICS, LEGACY_CONSULTATION_TOPICS, findConsultationTopic } from "../lib/consultation-topics.ts";

test("eight distinct women's topics have complete consultation copy", () => {
  assert.equal(CONSULTATION_TOPICS.length, 8);
  assert.equal(new Set(CONSULTATION_TOPICS.map((topic) => topic.id)).size, 8);
  for (const topic of CONSULTATION_TOPICS) {
    assert.match(topic.id, /^[a-z-]+$/);
    for (const key of ["title", "empathy", "situation", "assessment", "direction"]) assert.ok(topic[key].trim());
    assert.equal(findConsultationTopic(topic.id)?.title, topic.title);
  }
});

test("secondary topics are separate and all old topic IDs still resolve",()=>{
  assert.equal(SECONDARY_CONSULTATION_TOPICS.length,7);
  const all=[...CONSULTATION_TOPICS,...SECONDARY_CONSULTATION_TOPICS,...LEGACY_CONSULTATION_TOPICS];
  assert.equal(new Set(all.map(t=>t.id)).size,all.length);
  for(const t of all)assert.equal(findConsultationTopic(t.id)?.title,t.title);
  assert.equal(findConsultationTopic("unequal-effort").title,"付出与回应失衡");
  assert.equal(findConsultationTopic("career-and-life").title,"事业与生活陷入停滞");
});

test("unrecognized or prototype-like identifiers never resolve", () => {
  for (const id of ["", "__proto__", "constructor", "fake-topic", "<script>", "career-and-life/extra"]) {
    assert.equal(findConsultationTopic(id), undefined);
  }
});

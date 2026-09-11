import { createRequire } from "node:module";
import { readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { CONSULTATION_TOPICS } from "../lib/consultation-topics.ts";

const { request } = createRequire(import.meta.url)("playwright");
const credentials = JSON.parse(await readFile("test-results/topics-qa/credentials.json", "utf8"));
const origin = "http://127.0.0.1:5174";
assert.equal(credentials.origin, origin, "Only the isolated local fixture is allowed.");
const context = () => request.newContext({ baseURL: origin, extraHTTPHeaders: { Origin: origin }, timeout: 30000 });
const owner = await context(), visitor = await context(), stranger = await context(), existing = await context(), external = await context();
const contexts = [owner, visitor, stranger, existing, external];
const checks = [];
const pass = (name) => { checks.push(name); console.log("PASS " + name); };
async function expect(response, status) {
  assert.equal(response.status(), status, `HTTP ${response.status()}: ${(await response.text()).slice(0,150)}`);
  return response;
}
const json = async (response, status = 200) => (await expect(response, status)).json();
const send = (client, extra = {}) => client.post("/api/chat", { data: { message: "Synthetic local topic test.", requestId: randomUUID(), ...extra } });

try {
  const html = await (await expect(await visitor.get("/"), 200)).text();
  for (const topic of CONSULTATION_TOPICS) for (const key of ["title", "situation", "assessment", "direction"]) assert.ok(html.includes(topic[key]));
  assert.ok(html.indexOf('id="concerns"') < html.indexOf('id="approach"'));
  pass("all six topics are server-rendered before the service process");

  await expect(await owner.post("/api/auth/sign-in/username", { data: { username: credentials.username, password: credentials.password } }), 200);
  await expect(await stranger.get("/api/admin/conversations"), 401);
  for (const client of [visitor, stranger, existing]) await expect(await client.get("/api/chat"), 200);
  assert.equal((await json(await visitor.get("/api/chat"))).conversation, null);
  pass("opening consultation does not create a conversation");

  for (const data of [{topicId:"unknown-topic"}, {topicId:"__proto__"}, {topicId:123}, {topicId:CONSULTATION_TOPICS[0].id,sourceId:"qa-topic-post"}]) {
    const response = await json(await send(stranger, data), 400);
    assert.ok(response.error);
  }
  assert.equal((await json(await stranger.get("/api/chat"))).messages.length, 0);
  pass("unknown, malformed and mixed sources are rejected without messages");

  const nickname = "topic-qa-" + randomUUID();
  const firstRequest = { message:"Topic source must be canonical.", requestId:randomUUID(), nickname, topicId:CONSULTATION_TOPICS[0].id, sourceTitle:"Untrusted fake title" };
  await json(await visitor.post("/api/chat", { data:firstRequest }));
  pass("first topic message is accepted");
  await json(await visitor.post("/api/chat", { data:firstRequest }));
  pass("identical request retry is accepted");
  for (const topic of CONSULTATION_TOPICS.slice(1)) await json(await send(visitor, { topicId:topic.id }));
  const conversation = await json(await visitor.get("/api/chat"));
  assert.equal(conversation.messages.filter((message) => message.role === "auto").length, 1);
  assert.equal(conversation.messages.filter((message) => message.role === "visitor").length, 6);
  for (const topic of CONSULTATION_TOPICS) assert.ok(conversation.messages.some((message) => message.sourceTitle === topic.title));
  const inbox = await json(await owner.get("/api/admin/conversations"));
  const row = inbox.conversations.find((item) => item.nickname === nickname);
  assert.equal(row.sourceTitle, CONSULTATION_TOPICS[0].title);
  const detail = await json(await owner.get("/api/admin/conversations/" + row.id));
  assert.equal(detail.messages.at(-1).sourceTitle, CONSULTATION_TOPICS.at(-1).title);
  pass("canonical topics persist per message, first source is retained, retry and auto-reply are deduplicated");

  await json(await owner.post("/api/admin/conversations/" + row.id, { data:{ message:"Synthetic administrator reply.",requestId:randomUUID() } }));
  assert.ok((await json(await visitor.get("/api/chat"))).messages.some((message) => message.body === "Synthetic administrator reply."));
  assert.equal((await json(await stranger.get("/api/chat"))).messages.length, 0);
  pass("administrator replies persist and other visitors cannot see the conversation");

  await json(await send(visitor, { sourceId:"qa-topic-post" }));
  assert.equal((await json(await visitor.get("/api/chat"))).messages.at(-1).sourceTitle, "Local QA published post");
  await json(await send(visitor));
  assert.equal((await json(await visitor.get("/api/chat"))).messages.at(-1).sourceTitle, null);
  await json(await send(stranger, { sourceId:"qa-topic-draft" }));
  assert.equal((await json(await stranger.get("/api/chat"))).messages.find((message) => message.role === "visitor").sourceTitle, null);
  await json(await send(existing, { nickname:"existing-direct-"+randomUUID() }));
  await json(await send(existing, { topicId:CONSULTATION_TOPICS[2].id }));
  const oldChat = await json(await existing.get("/api/chat"));
  assert.equal(oldChat.messages.filter((message) => message.role === "auto").length, 1);
  assert.equal(oldChat.messages.at(-1).sourceTitle, CONSULTATION_TOPICS[2].title);
  pass("post consultation, direct messages and existing conversations remain compatible; draft post titles stay private");

  await expect(await stranger.get("/api/admin/homepage"), 401);
  await expect(await stranger.post("/api/admin/homepage/tasks"), 401);
  const home = await json(await owner.get("/api/admin/homepage"));
  assert.equal(home.hasAudio, true);
  pass("homepage audio metadata and protected administration remain intact");
  await expect(await external.post("/api/chat", { headers: { Origin: "https://invalid.example" } }), 403);
  pass("cross-origin requests are rejected");
} catch (error) {
  console.error(String(error.message).split("Call log:")[0].slice(0,700));
  process.exitCode = 1;
} finally {
  await owner.post("/api/auth/sign-out", { data:{} }).catch(() => {});
  if ((await owner.get("/api/admin/me")).status() === 401) pass("test administrator logout invalidates access");
  await writeFile("test-results/topics-qa/api-report.json", JSON.stringify({checks, success: !process.exitCode, checkedAt:new Date().toISOString()}, null, 2));
  for (const client of contexts) await client.dispose();
}

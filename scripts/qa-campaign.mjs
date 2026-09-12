import {readFile,writeFile,mkdir} from "node:fs/promises";
import {spawnSync} from "node:child_process";
import {createRequire} from "node:module";
import {randomUUID} from "node:crypto";
import {tmpdir} from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import {CONSULTATION_TOPICS,SECONDARY_CONSULTATION_TOPICS,LEGACY_CONSULTATION_TOPICS} from "../lib/consultation-topics.ts";
const {request}=createRequire(import.meta.url)("playwright"),origin="http://127.0.0.1:5174";
const directory="test-results/campaign-qa",config="test-results/media-qa/wrangler.json",persist="test-results/media-qa/state";
const settings=JSON.parse(await readFile(config,"utf8"));assert.equal(settings.d1_databases[0].database_id,"00000000-0000-4000-8000-000000000018");
const credentials=JSON.parse(await readFile("test-results/media-qa/credentials.json","utf8"));assert.equal(credentials.origin,origin);
function sql(command){const r=spawnSync(process.execPath,["node_modules/wrangler/bin/wrangler.js","d1","execute","capone-media-local-qa","--local","--config",config,"--persist-to",persist,"--command",command,"--json"],{encoding:"utf8",windowsHide:true,env:{...process.env,WRANGLER_SEND_METRICS:"false",WRANGLER_LOG_PATH:path.join(tmpdir(),"capone-campaign-qa.log")}});if(r.status!==0)throw new Error(r.stderr);return JSON.parse(r.stdout)[0].results}
const context=()=>request.newContext({baseURL:origin,extraHTTPHeaders:{Origin:origin,Connection:"close"}});
const a=await context(),b=await context(),owner=await context(),checks=[];
async function json(response,status=200){assert.equal(response.status(),status,(await response.text()).slice(0,250));return response.json()}
const count=()=>sql("SELECT COUNT(*) AS count FROM conversations")[0].count;
const initial=sql("SELECT * FROM campaigns WHERE id='welfare-day-v1'")[0];assert.ok(initial);
const restore=()=>sql(`UPDATE campaigns SET startsAt=${initial.startsAt},endsAt=${initial.endsAt} WHERE id='welfare-day-v1'`);
try{
  const first=await json(await a.get("/api/campaign")),second=await json(await b.get("/api/campaign"));
  assert.equal(first.startsAt,second.startsAt);assert.equal(first.endsAt,second.endsAt);assert.equal(first.endsAt-first.startsAt,86400000);
  assert.equal((await a.get("/api/campaign")).headers()["cache-control"],"no-store");
  sql(await readFile("scripts/campaign-start.sql","utf8"));sql(await readFile("scripts/campaign-start.sql","utf8"));
  assert.deepEqual(sql("SELECT * FROM campaigns WHERE id='welfare-day-v1'")[0],initial);
  assert.equal((await a.post("/api/campaign",{maxRetries:2})).status(),404);
  checks.push("shared persisted 24-hour deadline; repeated activation does not reset; endpoint is read-only and no-store");
  const home=await a.get("/");assert.equal(home.status(),200);const html=await home.text();
  const anchors=['id="official-contact"','class="hero"','id="lineage"','id="concerns"','id="approach"','id="directions"','id="journal"','id="contact"'].map(s=>html.indexOf(s));
  assert.ok(anchors.every((n,i)=>n>=0&&(!i||n>anchors[i-1])),"Homepage order differs");
  for(const text of ["wasd562482","Jw512527","+86 198 0507 1031","福利日","替他的敷衍买单"])assert.ok(html.includes(text));
  const before=count();await json(await a.get("/api/chat"));await json(await b.get("/api/chat"));assert.equal(count(),before);
  checks.push("server-rendered contacts and reordered sections; opening chat alone creates no conversation");
  const sent=[];
  for(const topic of [...CONSULTATION_TOPICS,LEGACY_CONSULTATION_TOPICS[1]]){
    const body={message:"Local QA: "+topic.id,topicId:topic.id,requestId:randomUUID()};await json(await a.post("/api/chat",{data:body}));sent.push({body,topic});
  }
  await json(await a.post("/api/chat",{data:sent[0].body}));
  for(const topic of [...SECONDARY_CONSULTATION_TOPICS,LEGACY_CONSULTATION_TOPICS[5]])await json(await b.post("/api/chat",{data:{message:"Local secondary QA",topicId:topic.id,requestId:randomUUID()}}));
  await json(await b.post("/api/chat",{data:{message:"Invalid topic",topicId:"fake-topic",requestId:randomUUID()}}),400);
  await json(await b.post("/api/chat",{data:{message:"Conflicting sources",topicId:"women-investment",sourceId:"qa-topic-post",requestId:randomUUID()}}),400);
  const chat=await json(await a.get("/api/chat")),other=await json(await b.get("/api/chat"));
  assert.equal(chat.messages.filter(m=>m.role==="visitor").length,sent.length);assert.equal(chat.messages.filter(m=>m.role==="auto").length,1);
  for(const {topic} of sent)assert.ok(chat.messages.some(m=>m.sourceTitle===topic.title));
  assert.ok(!chat.messages.some(m=>other.messages.some(n=>n.id===m.id)));
  checks.push("8 main and 7 secondary topics plus legacy IDs route correctly; unknown/conflicting topics rejected; retry dedup and one auto reply; private sessions remain separate");
  await json(await owner.post("/api/auth/sign-in/username",{data:{username:credentials.username,password:credentials.password}}));
  const inbox=await json(await owner.get("/api/admin/conversations"));assert.ok(inbox.conversations.some(c=>c.sourceTitle===CONSULTATION_TOPICS[0].title));
  const posts=await json(await owner.get("/api/admin/posts"));assert.ok(posts.posts.some(p=>p.kind==="video"&&p.posterId&&typeof p.loop==="boolean"));
  assert.equal((await json(await owner.get("/api/admin/homepage"))).hasAudio,true);
  await owner.post("/api/auth/sign-out",{data:{}});assert.equal((await owner.get("/api/admin/me")).status(),401);
  checks.push("admin sees correct first source; media covers and homepage audio metadata retained; logout invalidates access");
  sql("UPDATE campaigns SET startsAt=(unixepoch('now')+3600)*1000,endsAt=(unixepoch('now')+90000)*1000 WHERE id='welfare-day-v1'");
  assert.equal((await json(await a.get("/api/campaign"))).status,"upcoming");
  sql("UPDATE campaigns SET startsAt=(unixepoch('now')-90000)*1000,endsAt=(unixepoch('now')-3600)*1000 WHERE id='welfare-day-v1'");
  assert.equal((await json(await a.get("/api/campaign"))).status,"ended");
  assert.ok((await(await a.get("/")).text()).includes("本次福利活动已结束"));
  sql("UPDATE campaigns SET endsAt=startsAt+1000 WHERE id='welfare-day-v1'");
  await json(await a.get("/api/campaign"),503);
  const unavailable=await(await a.get("/")).text();assert.ok(unavailable.includes("活动状态暂时无法确认"));assert.ok(!unavailable.includes("距离本次活动结束"));
  checks.push("upcoming, ended and invalid data fail closed without a fabricated countdown; homepage still renders");
  console.log(checks.map(c=>"PASS "+c).join("\n"));
}catch(error){console.error(error.message);process.exitCode=1}
finally{restore();await a.dispose();await b.dispose();await owner.dispose();await mkdir(directory,{recursive:true});await writeFile(directory+"/api-report.json",JSON.stringify({success:!process.exitCode,checks},null,2));}

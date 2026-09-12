import {readFile,writeFile,mkdir,access} from "node:fs/promises";
import {spawnSync} from "node:child_process";
import {tmpdir} from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import {CAMPAIGN_ID,CAMPAIGN_DURATION} from "../lib/campaign-state.ts";

const mode=process.argv[2],directory=".private/campaign-release",config="dist/server/wrangler.cloudflare.json";
assert.ok(["prepare","start","verify"].includes(mode));
const settings=JSON.parse(await readFile(".private/cloudflare-deployment.json","utf8")),target=JSON.parse(await readFile(config,"utf8"));
assert.equal(settings.accountId,"a5f1ad0774d30f1553e1a5fc3e2175ae");
assert.equal(settings.databaseId,"6f8b7880-4dd0-4947-8a03-9a28da3ae04c");
assert.equal(target.d1_databases[0].database_id,settings.databaseId);
assert.equal(target.name,"capone-private-studio");assert.equal(target.r2_buckets[0].bucket_name,"capone-private-studio-media");
function wrangler(args){
  const result=spawnSync(process.execPath,["node_modules/wrangler/bin/wrangler.js",...args,"--config",config,"--json"],{encoding:"utf8",windowsHide:true,maxBuffer:16*1024*1024,env:{...process.env,WRANGLER_SEND_METRICS:"false",WRANGLER_LOG_PATH:path.join(tmpdir(),"capone-campaign-release.log")}});
  if(result.status!==0)throw new Error((result.stderr||result.stdout).slice(-1600));return JSON.parse(result.stdout);
}
const query=command=>wrangler(["d1","execute",settings.databaseName,"--remote","--command",command]);
const snapshot=()=>query("SELECT * FROM homepage_settings ORDER BY id; SELECT * FROM posts ORDER BY id; SELECT * FROM media ORDER BY id; SELECT id,username,updatedAt,mustChangePassword FROM user ORDER BY id; SELECT (SELECT COUNT(*) FROM conversations) AS conversations,(SELECT COUNT(*) FROM messages) AS messages;").map(r=>r.results);
const deployments=()=>wrangler(["deployments","list"]);
await mkdir(directory,{recursive:true});
const baselinePath=directory+"/before.json";
if(mode==="prepare"){
  try{await access(baselinePath);throw new Error("A release baseline exists; reuse it rather than overwriting it.")}catch(e){if(e.code!=="ENOENT")throw e}
  const versions=deployments();
  const data={createdAt:Date.now(),versions,previousVersion:versions.at(-1).versions[0].version_id,snapshot:snapshot()};
  await writeFile(baselinePath,JSON.stringify(data,null,2));
  console.log("Recorded existing deployment and protected data. Campaign has not started.");
}else{
  const before=JSON.parse(await readFile(baselinePath,"utf8"));
  const current=snapshot();
  for(const index of [0,1,2,3]){
    for(const old of before.snapshot[index])assert.deepEqual(current[index].find(row=>row.id===old.id),old,"Existing data changed; review before continuing.");
  }
  for(const key of ["conversations","messages"])assert.ok(current[4][0][key]>=before.snapshot[4][0][key]);
  if(mode==="start"){
    assert.equal(JSON.parse(await readFile("test-results/campaign-qa/api-report.json","utf8")).success,true);
    assert.notEqual(deployments().at(-1).versions[0].version_id,before.previousVersion,"Deploy and verify the new website first.");
    query(await readFile("scripts/campaign-start.sql","utf8"));
  }
  const campaign=query("SELECT * FROM campaigns WHERE id='"+CAMPAIGN_ID+"'")[0].results[0];
  assert.ok(campaign);assert.equal(campaign.endsAt-campaign.startsAt,CAMPAIGN_DURATION);
  const result={verifiedAt:new Date().toISOString(),campaign,previousVersion:before.previousVersion,currentVersion:deployments().at(-1).versions[0].version_id,existingRecordsUnchanged:true,homepageUnchanged:true};
  await writeFile(directory+"/verification.json",JSON.stringify(result,null,2));
  console.log(JSON.stringify(result,null,2));
}

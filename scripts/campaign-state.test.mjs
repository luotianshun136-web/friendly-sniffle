import assert from "node:assert/strict";
import test from "node:test";
import {CAMPAIGN_DURATION,campaignSnapshot,advanceCampaign,countdownParts,unavailableCampaign} from "../lib/campaign-state.ts";
const start=1800000000000,row={startsAt:start,endsAt:start+CAMPAIGN_DURATION};
test("one shared 24-hour window has exact start and end boundaries",()=>{
  assert.equal(campaignSnapshot(row,start-1).status,"upcoming");
  assert.deepEqual(countdownParts(campaignSnapshot(row,start)),["24","00","00"]);
  assert.deepEqual(countdownParts(campaignSnapshot(row,start+1000)),["23","59","59"]);
  assert.equal(campaignSnapshot(row,row.endsAt-1).status,"active");
  assert.equal(campaignSnapshot(row,row.endsAt).status,"ended");
  assert.deepEqual(countdownParts(campaignSnapshot(row,row.endsAt+1000)),["00","00","00"]);
});
test("a monotonic elapsed clock does not depend on the visitor's timezone or clock",()=>{
  const s=campaignSnapshot(row,start+1000);
  assert.deepEqual(countdownParts(advanceCampaign(s,2000)),["23","59","57"]);
  assert.equal(advanceCampaign(s,CAMPAIGN_DURATION).status,"ended");
  assert.equal(advanceCampaign(s,-1000).serverNow,s.serverNow);
});
test("missing, unavailable or invalid timing never creates a fresh countdown",()=>{
  assert.equal(campaignSnapshot(null,start).status,"inactive");
  assert.equal(advanceCampaign(unavailableCampaign(),1000).status,"unavailable");
  for(const bad of [{startsAt:0,endsAt:CAMPAIGN_DURATION},{...row,endsAt:start+1000},{...row,startsAt:"1800000000000"},{...row,endsAt:NaN}])assert.throws(()=>campaignSnapshot(bad,start));
});

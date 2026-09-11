import test from "node:test";
import assert from "node:assert/strict";
import {matchingFrame,postOptions} from "../lib/post-validation.ts";

test("poster frame accepts proportional resizes but rejects cropping, swapped orientation and invalid numbers",()=>{
  assert.equal(matchingFrame(540,960,720,1280),true);
  assert.equal(matchingFrame(960,540,1920,1080),true);
  for(const values of [[960,540,720,1280],[640,480,720,1280],[0,960,720,1280],[NaN,960,720,1280]])assert.equal(matchingFrame(...values),false);
});
test("omitted cover and loop preserve existing media, replacement does not borrow an old cover",()=>{
  const previous={posterId:"previous-cover",loop:1};
  assert.deepEqual(postOptions({},true,previous),{posterId:"previous-cover",loop:true});
  assert.deepEqual(postOptions({},false,previous),{posterId:null,loop:false});
  assert.deepEqual(postOptions({posterId:"new-cover",loop:false},true,previous),{posterId:"new-cover",loop:false});
  assert.deepEqual(postOptions({posterId:null},true,previous),{posterId:null,loop:true});
});
test("invalid option types never reach storage",()=>{
  for(const body of [{posterId:123},{posterId:[]},{posterId:"x".repeat(81)},{loop:"true"},{loop:1}])assert.throws(()=>postOptions(body,false));
});

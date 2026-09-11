import {createRequire} from "node:module";
import {readFileSync,writeFileSync,mkdirSync} from "node:fs";
import {execFileSync} from "node:child_process";
import assert from "node:assert/strict";
const {chromium,request}=createRequire(import.meta.url)("playwright"),origin="http://127.0.0.1:5173";
const sql=q=>execFileSync(process.execPath,["--import","./scripts/sites-env.mjs","./node_modules/wrangler/bin/wrangler.js","d1","execute","DB","--local","--config","dist/server/wrangler.json","--persist-to",".wrangler/state","--command",q],{stdio:"pipe"});
const literal=v=>v===null?"NULL":"'"+String(v).replaceAll("'","''")+"'";
const owner=await request.newContext({baseURL:origin,extraHTTPHeaders:{Origin:origin}}),visitor=await request.newContext({baseURL:origin});
const browser=await chromium.launch({headless:true,executablePath:"C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"});
const checks=[],tasks=[],media=[];let previous;
const ok=s=>{checks.push(s);console.log("PASS "+s)};
const ensure=async r=>{assert.ok(r.ok(),await r.text());return r.json()};
const create=async body=>{const t=await ensure(await owner.post("/api/admin/homepage/tasks",{data:body||{}}));tasks.push(t.id);return t};
const upload=async(t,path,purpose,type)=>{const m=await ensure(await owner.post("/api/admin/homepage/media?purpose="+purpose+"&taskId="+t.id,{headers:{"Content-Type":type||"video/mp4"},data:readFileSync(path)}));media.push(m.id);return m.id};
try{
 sql("DELETE FROM rate_limits");await ensure(await owner.post("/api/auth/sign-in/username",{data:{username:"capone",password:JSON.parse(readFileSync(".private/qa-password.json","utf8")).password}}));
 previous=await ensure(await owner.get("/api/admin/homepage"));sql("DELETE FROM homepage_settings WHERE id='main'");
 const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,deviceScaleFactor:2}),page=await ctx.newPage();page.setDefaultTimeout(60000);
 const errors=[];page.on("pageerror",e=>errors.push(e.message));
 await page.goto(origin);await page.waitForFunction(()=>!document.querySelector(".hero-film video")?.paused);
 const rms=await page.evaluate(async()=>{const {Input,BlobSource,ALL_FORMATS,AudioBufferSink}=await import("/node_modules/mediabunny/dist/modules/src/index.js");const i=new Input({source:new BlobSource(await(await fetch("/media/hero-v3.mp4")).blob()),formats:ALL_FORMATS});try{const track=await i.getPrimaryAudioTrack();const sample=await new AudioBufferSink(track).getBuffer(2);const data=sample.buffer.getChannelData(0);return Math.sqrt(data.reduce((s,x)=>s+x*x,0)/data.length)}finally{i.dispose()}});
 assert.ok(rms>.00001);ok("default video retains non-silent decoded AAC audio");
 for(const [width,height] of [[390,844],[820,1180],[1440,900]]){
  await page.setViewportSize({width,height});await page.goto(origin);await page.waitForFunction(()=>!document.querySelector(".hero-film video")?.paused);
  await page.getByRole("button",{name:"开启首页视频声音",exact:true}).click();assert.equal(await page.locator(".hero-film video").evaluate(v=>v.muted),false);
  const time=await page.locator(".hero-film video").evaluate(v=>{window.detachedHero=v;return v.currentTime});
  await page.getByRole("button",{name:"私密咨询",exact:true}).click();await page.getByLabel("你的留言").waitFor();
  assert.equal(await page.locator(".hero-film video").count(),0);assert.ok(await page.evaluate(()=>window.detachedHero.paused&&!window.detachedHero.getAttribute("src")));
  await page.getByLabel("你的留言").fill("保留的测试草稿");
  if(width===390){await page.setViewportSize({width:390,height:530});const box=await page.getByLabel("你的留言").boundingBox();assert.ok(box.y+box.height<=531);await page.screenshot({path:"test-results/consult-fixed-mobile.png"});await page.setViewportSize({width,height})}
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.getByRole("button",{name:"Close",exact:true}).click();assert.equal(await page.locator(".hero-film video").count(),0);
  await page.waitForFunction(()=>{const v=document.querySelector(".hero-film video");return v&&!v.paused&&v.muted});
  assert.ok(await page.locator(".hero-film video").evaluate((v,t)=>v.currentTime>=t-.1,time));
  await page.getByRole("button",{name:"暂停首页视频",exact:true}).click();const paused=await page.locator(".hero-film video").evaluate(v=>v.currentTime);
  await page.getByRole("button",{name:"私密咨询",exact:true}).click();await page.getByLabel("你的留言").waitFor();assert.equal(await page.locator(".hero-film video").count(),0);assert.equal(await page.getByLabel("你的留言").inputValue(),"保留的测试草稿");
  await page.getByRole("button",{name:"Close",exact:true}).click();await page.waitForFunction(()=>document.querySelector(".hero-film video")?.readyState>=1);await page.waitForTimeout(300);
  assert.ok(await page.locator(".hero-film video").evaluate((v,t)=>v.paused&&Math.abs(v.currentTime-t)<.15,paused));
 }
 ok("consultation removes video through animations, retains position and manual pause, responsive composer fits");assert.deepEqual(errors,[]);
 const slow=await ctx.newPage();await slow.route("**/components/consultation.tsx",async route=>{await new Promise(r=>setTimeout(r,1200));await route.continue()});await slow.goto(origin);await slow.waitForFunction(()=>!document.querySelector(".hero-film video")?.paused);await slow.getByRole("button",{name:"私密咨询",exact:true}).click();assert.equal(await slow.locator(".hero-film video").count(),0);await slow.getByLabel("你的留言").waitFor();await slow.close();ok("lazy consultation loading never leaves a video surface");
 for(const path of ["/api/admin/homepage/tasks","/api/admin/homepage/tasks/missing"]){assert.equal((await visitor.post(path,{headers:{Origin:origin},data:{}})).status(),401)}
 assert.equal((await visitor.delete("/api/admin/homepage/tasks/missing",{headers:{Origin:origin}})).status(),401);ok("anonymous task operations blocked");
 let task=await create();const originalId=await upload(task,"public/hero.mp4","hero-original"),videoId=await upload(task,"public/media/hero-v3.mp4","hero-video"),posterId=await upload(task,"public/media/hero-v2.webp","hero-poster","image/webp");
 for(const id of [originalId,videoId,posterId])assert.equal((await visitor.get("/api/media/"+id)).status(),404);
 const duplicate=await upload(task,"public/hero.mp4","hero-original");assert.equal(duplicate,originalId);ok("private candidate uploads and idempotent completed-file retry");
 let current=await ensure(await owner.patch("/api/admin/homepage",{data:{taskId:task.id,originalId,videoId,posterId,updatedAt:0}}));assert.equal(current.hasAudio,true);
 assert.equal((await owner.delete("/api/admin/homepage/tasks/"+task.id)).status(),409);assert.equal((await owner.delete("/api/admin/media/"+originalId)).status(),409);
 assert.equal((await visitor.get("/api/media/"+originalId)).status(),404);assert.equal((await visitor.get("/api/media/"+videoId)).status(),200);ok("atomic confirmation preserves audio and protects current resources");
 task=await create({originalId});const silent=await upload(task,"public/media/hero-v2.mp4","hero-video"),cover=await upload(task,"public/media/hero-v2.webp","hero-poster","image/webp");
 assert.equal((await owner.patch("/api/admin/homepage",{data:{taskId:task.id,originalId,videoId:silent,posterId:cover,updatedAt:current.updatedAt}})).status(),400);await ensure(await owner.delete("/api/admin/homepage/tasks/"+task.id));assert.equal((await owner.get("/api/media/"+silent)).status(),404);assert.equal((await owner.get("/api/media/"+originalId)).status(),200);ok("lost audio rejected; cancelling restoration keeps the original");
 task=await create();const expired=await upload(task,"public/media/hero-v2.mp4","hero-original");sql("UPDATE homepage_upload_tasks SET expiresAt=0 WHERE id="+literal(task.id));await ensure(await owner.get("/api/admin/homepage"));assert.equal((await owner.get("/api/media/"+expired)).status(),404);ok("expired candidates cleaned without modifying current homepage");
 sql("DELETE FROM rate_limits");const ac=await browser.newContext({storageState:await owner.storageState(),viewport:{width:1280,height:900}}),admin=await ac.newPage();admin.setDefaultTimeout(90000);
 await admin.goto(origin+"/admin");await admin.getByRole("tab",{name:"首页视频",exact:true}).click();await admin.getByLabel("选择首页视频",{exact:true}).waitFor();
 const generated=await admin.evaluate(async()=>{const {Output,Mp4OutputFormat,BufferTarget,CanvasSource}=await import("/node_modules/mediabunny/dist/modules/src/index.js");const c=document.createElement("canvas");c.width=960;c.height=540;const ctx=c.getContext("2d"),target=new BufferTarget(),o=new Output({format:new Mp4OutputFormat({fastStart:"in-memory"}),target}),source=new CanvasSource(c,{codec:"avc",bitrate:500000});o.addVideoTrack(source);await o.start();for(let n=0;n<60;n++){ctx.fillStyle="#f4edf1";ctx.fillRect(0,0,960,540);ctx.fillStyle="#753d53";ctx.fillRect(n*8,100,220,260);await source.add(n/30,1/30)}source.close();await o.finalize();return Array.from(new Uint8Array(target.buffer))});
 const source=Buffer.from(generated);writeFileSync("test-results/upload-landscape.mp4",source);
 const counts={original:0,video:0};let interrupt=true;
 await admin.route("**/api/admin/homepage/media?*",async route=>{const p=new URL(route.request().url()).searchParams.get("purpose");if(p==="hero-original")counts.original++;if(p==="hero-video"){counts.video++;if(interrupt){interrupt=false;await route.abort();return}}await route.continue()});
 await admin.getByLabel("选择首页视频",{exact:true}).setInputFiles({name:"landscape.mp4",mimeType:"video/mp4",buffer:source});await admin.getByRole("button",{name:"重试未完成步骤",exact:true}).waitFor();
 assert.equal((await ensure(await owner.get("/api/admin/homepage"))).videoId,current.videoId);await admin.getByRole("button",{name:"重试未完成步骤",exact:true}).click();await admin.getByRole("button",{name:"确认替换",exact:true}).click();await admin.getByText("首页视频已更换，团队动态未改动。",{exact:true}).waitFor();assert.equal(counts.original,1);assert.equal(counts.video,2);
 current=await ensure(await owner.get("/api/admin/homepage"));media.push(current.originalId,current.videoId,current.posterId);assert.equal(current.hasAudio,false);assert.equal(current.width,960);ok("real browser transfer retries only missing video and confirms landscape");
 await admin.reload();await admin.getByRole("tab",{name:"首页视频",exact:true}).click();await admin.locator(".homepage-preview video").waitFor();assert.equal(await admin.locator(".homepage-preview video").getAttribute("src"),current.videoUrl);
 for(const [w,h] of [[390,844],[820,1180],[1440,900]]){await admin.setViewportSize({width:w,height:h});assert.ok(await admin.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await admin.screenshot({path:"test-results/upload-fixed-"+w+".png"})}
 // Legacy homepage rows had no audio flag and a silent processed version.
 sql("UPDATE homepage_settings SET originalId="+literal(originalId)+",videoId="+literal(videoId)+",posterId="+literal(posterId)+",updatedAt=123 WHERE id='main'");sql("UPDATE media SET hasAudio=0 WHERE id="+literal(videoId));
 await admin.reload();await admin.getByRole("tab",{name:"首页视频",exact:true}).click();let restoredOriginalUploads=0;admin.on("request",r=>{if(r.url().includes("homepage/media?purpose=hero-original"))restoredOriginalUploads++});
 await admin.getByRole("button",{name:"从已保存原片恢复声音",exact:true}).click();await admin.getByRole("button",{name:"确认替换",exact:true}).click();await admin.getByText("首页视频已更换，团队动态未改动。",{exact:true}).waitFor();current=await ensure(await owner.get("/api/admin/homepage"));media.push(current.videoId,current.posterId);assert.equal(current.originalId,originalId);assert.equal(current.hasAudio,true);assert.equal(restoredOriginalUploads,0);ok("saved-original restoration preserves sound without uploading original again");
 sql("DELETE FROM rate_limits");await admin.unroute("**/api/admin/homepage/media?*");let lostReply=true,savedCandidate;
 await admin.route("**/api/admin/homepage/media?*",async route=>{if(lostReply&&route.request().url().includes("purpose=hero-original")){lostReply=false;const response=await route.fetch();savedCandidate=(await response.json()).id;await route.abort();return}await route.continue()});
 await admin.getByLabel("选择首页视频",{exact:true}).setInputFiles({name:"landscape.mp4",mimeType:"video/mp4",buffer:source});
 await admin.waitForFunction(()=>[...document.querySelectorAll("button")].some(b=>b.textContent.includes("确认替换")&&!b.disabled));assert.equal((await ensure(await owner.get("/api/admin/homepage"))).videoId,current.videoId);
 await admin.getByRole("button",{name:"取消",exact:true}).click();await admin.getByText("已取消，首页视频未更改。",{exact:true}).waitFor();assert.equal((await owner.get("/api/media/"+savedCandidate)).status(),404);ok("lost successful upload response reconciles via task status; cancel removes candidate");
 await admin.unroute("**/api/admin/homepage/media?*");const created=admin.waitForResponse(r=>r.url().endsWith("/api/admin/homepage/tasks")&&r.request().method()==="POST");
 await admin.getByLabel("选择首页视频",{exact:true}).setInputFiles({name:"original.mp4",mimeType:"video/mp4",buffer:readFileSync("public/hero.mp4")});const interruptedTask=await(await created).json();tasks.push(interruptedTask.id);
 await admin.getByRole("button",{name:"取消",exact:true}).click();await admin.getByText("已取消，首页视频未更改。",{exact:true}).waitFor();await admin.waitForTimeout(1200);const cancelled=await ensure(await owner.get("/api/admin/homepage/tasks/"+interruptedTask.id));assert.equal(cancelled.status,"cancelled");assert.equal(cancelled.originalId,null);assert.equal(cancelled.videoId,null);assert.equal((await ensure(await owner.get("/api/admin/homepage"))).videoId,current.videoId);ok("cancellation during optimization/upload retains old homepage and cleans late arrivals");
 const fastContext=await browser.newContext();await fastContext.addInitScript(()=>Object.defineProperty(window,"VideoEncoder",{value:undefined}));const fast=await fastContext.newPage();await fast.route("**/qa-fast.mp4",r=>r.fulfill({contentType:"video/mp4",body:source}));await fast.goto(origin);
 const copied=await fast.evaluate(async()=>{const {inspectVideo,optimizeVideo}=await import("/lib/optimize-video.ts");const file=new File([await(await fetch("/qa-fast.mp4")).blob()],"fast.mp4",{type:"video/mp4"});const signal=new AbortController().signal,info=await inspectVideo(file,signal);const result=await optimizeVideo(file,()=>{},signal,info);return {copyVideo:info.copyVideo,bytes:result.video.size}});assert.equal(copied.copyVideo,true);assert.ok(copied.bytes>100);await fastContext.close();ok("compliant video remuxes without a VideoEncoder");
 await owner.post("/api/auth/sign-out",{data:{}});assert.equal((await owner.get("/api/admin/homepage")).status(),401);ok("logout revokes admin access");
 mkdirSync("test-results",{recursive:true});writeFileSync("test-results/consult-video-report.json",JSON.stringify({checks,androidPhysicalDevice:"Not available; Android vendor-native video layers require owner real-device retest."},null,2));console.log("CONSULT VIDEO CHECKS PASSED");
}finally{
 if(previous){sql(previous.videoId?"UPDATE homepage_settings SET originalId="+literal(previous.originalId)+",videoId="+literal(previous.videoId)+",posterId="+literal(previous.posterId)+",updatedAt="+previous.updatedAt+" WHERE id='main'":"DELETE FROM homepage_settings WHERE id='main'")}
 await owner.post("/api/auth/sign-in/username",{data:{username:"capone",password:JSON.parse(readFileSync(".private/qa-password.json","utf8")).password}}).catch(()=>{});
 for(const id of tasks)await owner.delete("/api/admin/homepage/tasks/"+id).catch(()=>{});for(const id of new Set(media))await owner.delete("/api/admin/media/"+id).catch(()=>{});
 await owner.dispose();await visitor.dispose();await browser.close();
}

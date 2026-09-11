import {createRequire} from "node:module";
import {readFileSync,writeFileSync,mkdirSync} from "node:fs";
import {execFileSync} from "node:child_process";
import assert from "node:assert/strict";
const {chromium,request}=createRequire(import.meta.url)("playwright");
const origin="http://127.0.0.1:5173",passwordPath=".private/qa-password.json";
let password=JSON.parse(readFileSync(passwordPath,"utf8")).password;
const owner=await request.newContext({baseURL:origin,extraHTTPHeaders:{Origin:origin}}),visitor=await request.newContext({baseURL:origin});
const browser=await chromium.launch({headless:true,executablePath:"C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"});
const ids=[],checks=[];let original;
const ok=s=>{checks.push(s);console.log("PASS "+s)};
const localSql=sql=>execFileSync(process.execPath,["--import","./scripts/sites-env.mjs","./node_modules/wrangler/bin/wrangler.js","d1","execute","DB","--local","--config","dist/server/wrangler.json","--persist-to",".wrangler/state","--command",sql],{stdio:"pipe"});
const literal=v=>v===null?"NULL":"'"+String(v).replaceAll("'","''")+"'";
try{
 localSql("DELETE FROM rate_limits");
 let r=await owner.post("/api/auth/sign-in/username",{data:{username:"capone",password}});assert.equal(r.status(),200,await r.text());
 original=await (await owner.get("/api/admin/homepage")).json();
 r=await owner.post("/api/admin/password",{data:{currentPassword:password,newPassword:"ab12"}});assert.equal(r.status(),400);
 const short="Q7x2!";r=await owner.post("/api/admin/password",{data:{currentPassword:password,newPassword:short}});assert.equal(r.status(),200,await r.text());
 const old=password;password=short;writeFileSync(passwordPath,JSON.stringify({password}));
 assert.equal((await owner.post("/api/auth/sign-in/username",{data:{username:"capone",password:old}})).status(),401);
 assert.equal((await owner.post("/api/auth/sign-in/username",{data:{username:"capone",password}})).status(),200);ok("4 characters rejected; 5 accepted; old password invalid");
 const restore=await owner.post("/api/admin/password",{data:{currentPassword:password,newPassword:old}});assert.equal(restore.status(),200);password=old;writeFileSync(passwordPath,JSON.stringify({password}));
 assert.equal((await visitor.get("/api/admin/homepage")).status(),401);
 assert.equal((await visitor.patch("/api/admin/homepage",{headers:{Origin:origin},data:{}})).status(),401);
 assert.equal((await visitor.post("/api/admin/homepage/media?purpose=hero-original",{headers:{Origin:origin,"Content-Type":"video/mp4"},data:readFileSync("public/hero.mp4")})).status(),401);ok("anonymous homepage management blocked");
 async function upload(file,purpose,type){const r=await owner.post("/api/admin/homepage/media?purpose="+purpose,{headers:{"Content-Type":type},data:file});assert.equal(r.status(),201,await r.text());const m=await r.json();ids.push(m.id);return m.id}
 const originalId=await upload(readFileSync("public/hero.mp4"),"hero-original","video/mp4"),videoId=await upload(readFileSync("public/media/hero-v3.mp4"),"hero-video","video/mp4"),posterId=await upload(readFileSync("public/media/hero-v2.webp"),"hero-poster","image/webp");
 for(const id of [originalId,videoId,posterId])assert.equal((await visitor.get("/api/media/"+id)).status(),404);
 r=await owner.patch("/api/admin/homepage",{data:{originalId,videoId,posterId,updatedAt:original.updatedAt}});assert.equal(r.status(),200,await r.text());const portrait=await r.json();
 assert.equal((await visitor.get("/api/media/"+originalId)).status(),404);assert.equal((await visitor.get("/api/media/"+videoId)).status(),200);
 assert.equal((await owner.delete("/api/admin/media/"+originalId)).status(),409);
 assert.equal((await owner.post("/api/admin/posts",{data:{title:"not public",body:"",mediaId:originalId,status:"published"}})).status(),400);
 r=await visitor.get("/api/media/"+videoId,{headers:{Range:"bytes=0-1023"}});assert.equal(r.status(),206);assert.equal((await r.body()).length,1024);
 r=await visitor.get("/api/media/"+videoId,{headers:{"If-None-Match":'"'+videoId+'"'}});assert.equal(r.status(),304);
 r=await owner.patch("/api/admin/homepage",{data:{originalId,videoId,posterId:"missing",updatedAt:portrait.updatedAt}});assert.equal(r.status(),400);assert.equal((await (await owner.get("/api/admin/homepage")).json()).videoId,videoId);ok("portrait persisted, private originals, protected references and conditional playback");
 const context=await browser.newContext({storageState:await owner.storageState(),viewport:{width:1280,height:900}}),page=await context.newPage();page.setDefaultTimeout(90000);
 await page.goto(origin+"/admin");await page.getByRole("tab",{name:"首页视频",exact:true}).click();await page.locator(".homepage-preview video").waitFor();
 const landscape=await page.evaluate(async()=>{
  const {Output,Mp4OutputFormat,BufferTarget,CanvasSource}=await import("/node_modules/mediabunny/dist/modules/src/index.js");
  const canvas=document.createElement("canvas");canvas.width=960;canvas.height=540;const ctx=canvas.getContext("2d"),target=new BufferTarget(),output=new Output({format:new Mp4OutputFormat({fastStart:"in-memory"}),target});
  const source=new CanvasSource(canvas,{codec:"avc",bitrate:1200000});output.addVideoTrack(source);await output.start();
  for(let i=0;i<60;i++){ctx.fillStyle="#f5e9ef";ctx.fillRect(0,0,960,540);ctx.fillStyle="#773c51";ctx.fillRect(i*10,100,280,300);await source.add(i/30,1/30)}await output.finalize();return Array.from(new Uint8Array(target.buffer));
 });
 await page.getByLabel("选择首页视频",{exact:true}).setInputFiles({name:"landscape.mp4",mimeType:"video/mp4",buffer:Buffer.from(landscape)});
 await page.getByRole("button",{name:"确认替换",exact:true}).waitFor();assert.equal((await (await owner.get("/api/admin/homepage")).json()).videoId,videoId);ok("browser optimization and preview do not publish before confirmation");
 await page.getByRole("button",{name:"确认替换",exact:true}).click();await page.getByText("首页视频已更换，团队动态未改动。",{exact:true}).waitFor();
 const current=await (await owner.get("/api/admin/homepage")).json();ids.push(current.originalId,current.videoId,current.posterId);assert.equal(current.width,960);assert.equal(current.height,540);
 await page.reload();await page.getByRole("tab",{name:"首页视频",exact:true}).click();assert.equal(await page.locator(".homepage-preview video").getAttribute("src"),current.videoUrl);
 r=await owner.patch("/api/admin/homepage",{data:{originalId,videoId,posterId,updatedAt:portrait.updatedAt}});assert.equal(r.status(),409);
 assert.equal((await visitor.get("/api/media/"+videoId,{headers:{"If-None-Match":'"'+videoId+'"'}})).status(),404);ok("landscape replacement, reload, stale edits and withdrawn-media access");
 mkdirSync("test-results",{recursive:true});for(const [w,h] of [[390,844],[820,1180],[1440,960]]){await page.setViewportSize({width:w,height:h});await page.screenshot({path:"test-results/homepage-admin-"+w+".png"});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1))}
 await page.getByLabel("选择首页视频",{exact:true}).setInputFiles({name:"landscape.mp4",mimeType:"video/mp4",buffer:Buffer.from(landscape)});await page.getByRole("button",{name:"确认替换",exact:true}).waitFor();await page.getByRole("button",{name:"取消",exact:true}).click();assert.equal((await (await owner.get("/api/admin/homepage")).json()).videoId,current.videoId);ok("cancel retains active video; responsive admin layouts");
 const publicContext=await browser.newContext({viewport:{width:390,height:844}}),publicPage=await publicContext.newPage(),requests=[];publicPage.on("request",r=>requests.push(r.url()));
 await publicPage.goto(origin,{waitUntil:"networkidle"});await publicPage.waitForFunction(()=>document.querySelector(".hero-film video")?.readyState>=2);assert.ok(!requests.some(u=>u.includes("/api/posts")||u.includes("consultation.tsx")));
 await publicPage.getByRole("button",{name:"暂停首页视频",exact:true}).click();assert.ok(await publicPage.locator(".hero-film video").evaluate(v=>v.paused));
 for(const [w,h] of [[360,640],[820,1180],[1440,900]]){await publicPage.setViewportSize({width:w,height:h});assert.ok(await publicPage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await publicPage.screenshot({path:"test-results/landscape-home-"+w+".png"})}
 await publicPage.locator("#journal").scrollIntoViewIfNeeded();await publicPage.locator(".journal-post").first().waitFor();assert.equal(await publicPage.locator(".journal-post video").first().getAttribute("preload"),"none");ok("home loads without journal video requests; pause and landscape layouts");
 const blocked=await browser.newContext({reducedMotion:"reduce",viewport:{width:390,height:844}}),blockedPage=await blocked.newPage();await blockedPage.goto(origin,{waitUntil:"networkidle"});assert.ok(await blockedPage.locator(".hero-film video").evaluate(v=>v.paused));await blockedPage.getByRole("button",{name:"播放首页视频",exact:true}).click();await blockedPage.waitForFunction(()=>!document.querySelector(".hero-film video").paused);ok("manual playback with autoplay disabled");
 const failPage=await publicContext.newPage();await failPage.route("**"+current.videoUrl,route=>route.abort());await failPage.goto(origin,{waitUntil:"networkidle"});assert.equal(await failPage.locator(".hero-cover").evaluate(i=>i.complete&&i.naturalWidth>0),true);assert.equal(await failPage.locator(".hero-film video").evaluate(v=>getComputedStyle(v).opacity),"0");ok("failed playback preserves cover and manual retry");
 const unsupported=await browser.newContext({storageState:await owner.storageState()});await unsupported.addInitScript(()=>{Object.defineProperty(window,"VideoEncoder",{value:undefined})});const up=await unsupported.newPage();await up.goto(origin+"/admin");await up.getByRole("tab",{name:"首页视频",exact:true}).click();await up.getByLabel("选择首页视频",{exact:true}).setInputFiles({name:"original.mp4",mimeType:"video/mp4",buffer:readFileSync("public/hero.mp4")});await up.getByRole("alert").filter({hasText:"不支持视频优化"}).waitFor();assert.equal((await (await owner.get("/api/admin/homepage")).json()).videoId,current.videoId);ok("unsupported encoder never replaces the active video");
 await owner.post("/api/auth/sign-out",{data:{}});assert.equal((await owner.get("/api/admin/homepage")).status(),401);ok("logout revokes homepage management");
 writeFileSync("test-results/upgrade-report.json",JSON.stringify({checks},null,2));console.log("UPGRADE CHECKS PASSED");
}finally{
 if(original){const sql=original.videoId?"UPDATE homepage_settings SET originalId="+literal(original.originalId)+",videoId="+literal(original.videoId)+",posterId="+literal(original.posterId)+",updatedAt="+original.updatedAt+" WHERE id='main'":"DELETE FROM homepage_settings WHERE id='main'";localSql(sql)}
 await owner.post("/api/auth/sign-in/username",{data:{username:"capone",password}}).catch(()=>{});for(const id of ids)await owner.delete("/api/admin/media/"+id).catch(()=>{});
 await owner.dispose();await visitor.dispose();await browser.close();
}

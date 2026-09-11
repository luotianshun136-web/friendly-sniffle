import {createRequire} from "node:module";
import {readFileSync,writeFileSync,existsSync,mkdirSync} from "node:fs";
import {randomBytes} from "node:crypto";
import assert from "node:assert/strict";
const require=createRequire(import.meta.url);
const {chromium,request}=require("playwright");
const origin=process.env.QA_URL||"http://127.0.0.1:5173";
if(!origin.startsWith("http://127.0.0.1:"))throw new Error("This test suite only writes to a local preview.");
const secret=JSON.parse(readFileSync(".private/secrets.json","utf8"));
const testPath=".private/qa-password.json";
let ownerPassword=existsSync(testPath)?JSON.parse(readFileSync(testPath,"utf8")).password:secret.password;
const checks=[];
const ok=(name)=>{checks.push(name);console.log("PASS "+name)};
const context=()=>request.newContext({baseURL:origin,extraHTTPHeaders:{Origin:origin}});
const owner=await context(),a=await context(),b=await context();
const browser=await chromium.launch({headless:true,executablePath:"C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"});
const postIds=[],mediaIds=[];
let conversationId;
try{
 const setup=await owner.post("/api/setup",{headers:{"x-setup-key":secret.BOOTSTRAP_TOKEN},data:{password:secret.password}});
 assert.ok([200,409].includes(setup.status()),"setup "+setup.status()+" "+await setup.text());
 let r=await owner.post("/api/auth/sign-in/username",{data:{username:"capone",password:ownerPassword}});
 assert.equal(r.status(),200,"login "+await r.text());
 const me=await (await owner.get("/api/admin/me")).json();
 if(me.mustChangePassword){r=await owner.get("/api/admin/posts");assert.equal(r.status(),403);ok("initial password gate");}
 const nextPassword=randomBytes(24).toString("base64url");
 r=await owner.post("/api/admin/password",{data:{currentPassword:ownerPassword,newPassword:nextPassword}});
 assert.equal(r.status(),200,"change password "+await r.text());ownerPassword=nextPassword;writeFileSync(testPath,JSON.stringify({password:ownerPassword}),{mode:0o600});
 assert.equal((await (await owner.get("/api/admin/me")).json()).mustChangePassword,false);ok("admin login and password change");
 assert.equal((await b.get("/api/admin/posts")).status(),401);assert.equal((await b.delete("/api/admin/posts/team-film")).status(),401);ok("anonymous admin access denied");
 await a.get("/api/chat");await b.get("/api/chat");
 const requestId=crypto.randomUUID(),content="QA private consultation "+randomBytes(4).toString("hex");
 const data={message:content,requestId,nickname:"QA 测试",contact:"",sourceId:"team-film"};
 assert.equal((await a.post("/api/chat",{data})).status(),200);
 assert.equal((await a.post("/api/chat",{data})).status(),200);
 const records=await (await a.get("/api/chat")).json();
 assert.equal(records.messages.filter(m=>m.role==="auto").length,1);assert.equal(records.messages.filter(m=>m.body===content).length,1);ok("message persistence, retry deduplication and single auto-reply");
 assert.equal((await (await b.get("/api/chat")).json()).messages.length,0);ok("anonymous conversation isolation");
 const list=await (await owner.get("/api/admin/conversations")).json();const found=list.conversations.find(c=>c.nickname==="QA 测试");assert.ok(found);conversationId=found.id;assert.equal(found.sourceTitle,"团队影像 · 女性吸睛私人定制");
 assert.equal((await b.get("/api/admin/conversations/"+conversationId)).status(),401);
 assert.equal((await owner.post("/api/admin/conversations/"+conversationId,{data:{message:"QA admin reply",requestId:crypto.randomUUID()}})).status(),200);
 assert.ok((await (await a.get("/api/chat")).json()).messages.some(m=>m.body==="QA admin reply"));ok("admin receives and replies with source context");
 assert.equal((await a.post("/api/chat",{headers:{Origin:"https://untrusted.example"},data})).status(),403);ok("cross-origin writes rejected");
 const canvasPage=await browser.newPage();
 async function png(w,h){return Buffer.from(await canvasPage.evaluate(([w,h])=>{const c=document.createElement("canvas");c.width=w;c.height=h;const x=c.getContext("2d");x.fillStyle="#773c51";x.fillRect(0,0,w,h);x.fillStyle="#fcfafb";x.fillRect(w*.15,h*.2,w*.7,h*.6);return c.toDataURL("image/png").split(",")[1]},[w,h]),"base64")}
 for(const [w,h] of [[1600,900],[900,1600]]){
  const file=await png(w,h);r=await owner.post("/api/admin/media",{headers:{"Content-Type":"image/png"},data:file});assert.equal(r.status(),201,"upload "+await r.text());const m=await r.json();mediaIds.push(m.id);
  r=await owner.post("/api/admin/posts",{data:{title:"QA image",body:"QA only",mediaId:m.id,status:"draft"}});assert.equal(r.status(),200);const p=await r.json();postIds.push(p.id);
  assert.equal((await b.get("/api/media/"+m.id)).status(),404);
  await owner.patch("/api/admin/posts/"+p.id,{data:{title:"QA image",body:"QA only",mediaId:m.id,status:"published"}});
  assert.equal((await b.get("/api/media/"+m.id)).status(),200);
  await owner.patch("/api/admin/posts/"+p.id,{data:{title:"QA image",body:"QA only",mediaId:m.id,status:"draft"}});
  assert.equal((await b.get("/api/media/"+m.id)).status(),404);
 }
 ok("landscape and portrait uploads, draft privacy, publish and unpublish");
 r=await owner.post("/api/admin/media",{headers:{"Content-Type":"image/png"},data:await png(600,600)});assert.equal(r.status(),400);
 r=await owner.post("/api/admin/media",{headers:{"Content-Type":"image/png"},data:Buffer.from("not a real image")});assert.equal(r.status(),400);ok("invalid aspect ratio and forged media rejected");
 r=await owner.post("/api/admin/media",{headers:{"Content-Type":"video/mp4"},data:readFileSync("public/hero.mp4")});assert.equal(r.status(),201,"video "+await r.text());const video=await r.json();mediaIds.push(video.id);assert.equal(video.width,720);assert.equal(video.height,1280);
 const range=await owner.get("/api/media/"+video.id,{headers:{Range:"bytes=0-1023"}});assert.equal(range.status(),206);assert.equal((await range.body()).length,1024);ok("MP4 validation and ranged playback");
 await owner.patch("/api/admin/conversations/"+conversationId,{data:{status:"archived"}});
 assert.ok((await (await owner.get("/api/admin/conversations?status=archived")).json()).conversations.some(c=>c.id===conversationId));ok("conversation archive");
 for(const id of postIds)await owner.delete("/api/admin/posts/"+id);postIds.length=0;
 for(const id of mediaIds)await owner.delete("/api/admin/media/"+id);mediaIds.length=0;
 mkdirSync("test-results",{recursive:true});
 const ctx=await browser.newContext({viewport:{width:1440,height:1000}});const page=await ctx.newPage();const browserErrors=[];page.on("pageerror",e=>browserErrors.push(e.message));
 for(const [name,width,height]of [["desktop",1440,1000],["tablet",820,1180],["mobile",390,844]]){
  await page.setViewportSize({width,height});await page.goto(origin,{waitUntil:"networkidle"});await page.locator(".hero-film video").waitFor();await page.locator("#journal").scrollIntoViewIfNeeded();await page.locator(".journal-post").first().waitFor();await page.evaluate(()=>scrollTo(0,0));
  await page.waitForFunction(()=>document.querySelector(".hero-film video").readyState>=2);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),name+" horizontal overflow");
  await page.screenshot({path:"test-results/"+name+".png",fullPage:true});await page.screenshot({path:"test-results/"+name+"-viewport.png"});
 }
 ok("desktop, tablet and mobile layouts without horizontal overflow");
 await page.getByRole("button",{name:"暂停首页视频",exact:true}).click();assert.ok(await page.locator(".hero-film video").evaluate(v=>v.paused));ok("hero video pause control");
 await page.getByRole("button",{name:"私密咨询",exact:true}).click();await page.getByLabel("你的留言").waitFor();
 await page.setViewportSize({width:390,height:530});await page.getByLabel("你的留言").fill("尚未发送的草稿");await page.screenshot({path:"test-results/mobile-chat.png"});
 const composer=await page.getByLabel("你的留言").boundingBox();assert.ok(composer.y+composer.height<=530,"composer fits small viewport");
 await page.route("**/api/chat",route=>route.request().method()==="POST"?route.abort():route.continue());
 await page.getByRole("button",{name:"发送留言",exact:true}).click();await page.getByRole("alert").waitFor();assert.equal(await page.getByLabel("你的留言").inputValue(),"尚未发送的草稿");ok("small-screen chat and failed-send draft preservation");
 await ctx.close();
 const adminContext=await browser.newContext({storageState:await owner.storageState(),viewport:{width:1440,height:960}});const adminPage=await adminContext.newPage();await adminPage.goto(origin+"/admin");await adminPage.getByRole("tab",{name:"咨询收件箱"}).waitFor();await adminPage.screenshot({path:"test-results/admin.png",fullPage:true});
 await adminPage.getByRole("tab",{name:"团队动态"}).click();await adminPage.getByRole("button",{name:"新建帖子",exact:true}).click();await adminPage.getByRole("textbox",{name:"标题",exact:true}).waitFor();ok("admin interface and post editor");
 assert.deepEqual(browserErrors,[]);ok("no browser runtime errors");
 assert.equal((await owner.post("/api/auth/sign-out",{data:{}})).status(),200);assert.equal((await owner.get("/api/admin/me")).status(),401);ok("logout invalidates session");
 writeFileSync("test-results/report.json",JSON.stringify({passed:checks,webmcp:"No native WebMCP context in test browser; feature detection only."},null,2));
 console.log("ALL CHECKS PASSED");
}finally{
 // Test records stay out of the customer-facing site.
 await owner.post("/api/auth/sign-in/username",{data:{username:"capone",password:ownerPassword}}).catch(()=>{});
 for(const id of postIds)await owner.delete("/api/admin/posts/"+id).catch(()=>{});
 for(const id of mediaIds)await owner.delete("/api/admin/media/"+id).catch(()=>{});
 if(conversationId)await owner.delete("/api/admin/conversations/"+conversationId).catch(()=>{});
 await owner.dispose();await a.dispose();await b.dispose();await browser.close();
}

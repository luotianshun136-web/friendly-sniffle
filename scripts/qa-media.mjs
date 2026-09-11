import {readFile,writeFile} from "node:fs/promises";
import {createRequire} from "node:module";
import {randomUUID} from "node:crypto";
import assert from "node:assert/strict";
const {request}=createRequire(import.meta.url)("playwright"),directory="test-results/media-qa",credentials=JSON.parse(await readFile(directory+"/credentials.json","utf8")),origin="http://127.0.0.1:5174";
assert.equal(credentials.origin,origin);
const owner=await request.newContext({baseURL:origin,extraHTTPHeaders:{Origin:origin}}),guest=await request.newContext({baseURL:origin,extraHTTPHeaders:{Origin:origin}});
const checks=[],pass=name=>{checks.push(name);console.log("PASS "+name)};
async function expect(r,status=200){assert.equal(r.status(),status,`HTTP ${r.status()}: ${(await r.text()).slice(0,200)}`);return r}
async function json(r,status=200){return (await expect(r,status)).json()}
const upload=async(file,type,purpose="post")=>json(await owner.post("/api/admin/media?purpose="+purpose,{headers:{"Content-Type":type},data:await readFile(file)}),201);
const readPosts=async()=> (await json(await owner.get("/api/admin/posts"))).posts;
const publish=async(id,body)=>json(await owner.patch("/api/admin/posts/"+id,{data:body}));
let savedPost;
try{
  await expect(await owner.post("/api/auth/sign-in/username",{data:{username:credentials.username,password:credentials.password}}));
  await expect(await guest.post("/api/admin/media?purpose=post-poster"),401);
  const video=await upload(".private/lineage-release/ritual-v1.mp4","video/mp4"),cover=await upload(".private/lineage-release/ritual-poster.webp","image/webp","post-poster");
  await expect(await guest.get("/api/media/"+cover.id),404);
  const data={title:"QA media cover",body:"Local test only",mediaId:video.id,posterId:cover.id,loop:true,status:"draft"};
  const created=await json(await owner.post("/api/admin/posts",{data}));savedPost=created.id;
  await expect(await guest.get("/api/media/"+cover.id),404);
  await publish(created.id,{...data,status:"published"});
  const row=(await readPosts()).find(p=>p.id===created.id);assert.equal(row.posterId,cover.id);assert.equal(row.posterUrl,"/api/media/"+cover.id);assert.equal(row.loop,true);
  const posterResponse=await expect(await guest.get(row.posterUrl));assert.equal(posterResponse.headers()["content-type"],"image/webp");
  await expect(await guest.get(row.posterUrl,{headers:{"If-None-Match":posterResponse.headers().etag}}),304);
  await expect(await guest.get("/api/media/"+video.id,{headers:{Range:"bytes=0-31"}}),206);
  pass("draft and unlinked posters are private; published poster and range video serve correctly");
  await expect(await owner.delete("/api/admin/media/"+cover.id),409);
  const invalid=await upload(directory+"/landscape.webp","image/webp","post-poster");
  await expect(await owner.patch("/api/admin/posts/"+created.id,{data:{...data,posterId:invalid.id,status:"published"}}),400);
  assert.equal((await readPosts()).find(p=>p.id===created.id).posterId,cover.id);
  await expect(await owner.patch("/api/admin/posts/"+created.id,{data:{...data,posterId:video.id,status:"published"}}),400);
  await expect(await owner.patch("/api/admin/posts/"+created.id,{data:{...data,loop:"true"}}),400);
  await expect(await owner.post("/api/admin/media?purpose=post-poster",{headers:{"Content-Type":"image/webp"},data:await readFile(directory+"/wrong-ratio.webp")}),400);
  await expect(await owner.post("/api/admin/media?purpose=hero-original"),400);
  pass("invalid cover ratio, purpose and option types are rejected; linked cover cannot be deleted");
  await publish(created.id,{title:data.title,body:"Updated text only",mediaId:video.id,status:"published"});
  let after=(await readPosts()).find(p=>p.id===created.id);assert.equal(after.posterId,cover.id);assert.equal(after.loop,true);
  const replacement=await upload(directory+"/portrait.webp","image/webp","post-poster");
  await publish(created.id,{...data,posterId:replacement.id,status:"published"});
  assert.equal((await readPosts()).find(p=>p.id===created.id).posterId,replacement.id);
  await expect(await guest.get("/api/media/"+cover.id),404);
  await publish(created.id,{...data,posterId:replacement.id,status:"draft"});
  await expect(await guest.get("/api/media/"+replacement.id,{headers:{"If-None-Match":'"'+replacement.id+'"'}}),404);
  await publish(created.id,{...data,posterId:replacement.id,status:"published"});
  pass("legacy updates preserve cover; replacement, unpublishing and revalidation respect visibility");
  const landscape=await upload(directory+"/landscape.mp4","video/mp4");
  await expect(await owner.post("/api/admin/posts",{data:{title:"Missing cover",mediaId:landscape.id,status:"published"}}),400);
  await json(await owner.post("/api/admin/posts",{data:{title:"QA landscape video",mediaId:landscape.id,posterId:invalid.id,status:"published"}}));
  const image=await upload(directory+"/portrait.webp","image/webp");
  await expect(await owner.post("/api/admin/posts",{data:{title:"Invalid image cover",mediaId:image.id,posterId:replacement.id,status:"published"}}),400);
  await json(await owner.post("/api/admin/posts",{data:{title:"QA still image",mediaId:image.id,status:"published"}}));
  const disposable=await upload(directory+"/portrait.webp","image/webp","post-poster");await expect(await owner.delete("/api/admin/media/"+disposable.id));await expect(await owner.get("/api/media/"+disposable.id),404);
  pass("landscape and portrait videos require matching covers; images stay compatible; cancelled media can be removed");
  await json(await guest.get("/api/chat"));const rid=randomUUID();const message={message:"Local media consultation test",sourceId:created.id,requestId:rid};
  await json(await guest.post("/api/chat",{data:message}));await json(await guest.post("/api/chat",{data:message}));
  const chat=await json(await guest.get("/api/chat"));assert.equal(chat.messages.filter(m=>m.role==="visitor").length,1);assert.equal(chat.messages.filter(m=>m.role==="auto").length,1);assert.equal(chat.messages.find(m=>m.role==="visitor").sourceTitle,data.title);
  const home=await json(await owner.get("/api/admin/homepage"));assert.equal(home.hasAudio,true);
  pass("post consultation and single automatic reply remain compatible; homepage audio metadata unchanged");
}catch(error){console.error(String(error.message).split("Call log:")[0].slice(0,900));process.exitCode=1}
finally{
  await owner.post("/api/auth/sign-out",{data:{}}).catch(()=>{});await expect(await owner.get("/api/admin/me"),401);
  await writeFile(directory+"/api-report.json",JSON.stringify({success:!process.exitCode,checks,savedPost},null,2));await owner.dispose();await guest.dispose();
}

import {readFile,writeFile,mkdir,access,copyFile,stat} from "node:fs/promises";
import {spawnSync} from "node:child_process";
import {createHash} from "node:crypto";
import path from "node:path";
import assert from "node:assert/strict";
import sharp from "sharp";

// This release only appends media and binds missing covers. It never resets data.
const mode=process.argv[2],root=process.cwd(),dir=path.join(root,".private/lineage-release"),config="dist/server/wrangler.cloudflare.json";
assert.ok(["prepare","apply","verify"].includes(mode),"Use prepare, apply, or verify.");
const settings=JSON.parse(await readFile(".private/cloudflare-deployment.json","utf8"));
assert.equal(settings.workerName,"capone-private-studio");
assert.equal(settings.databaseId,"6f8b7880-4dd0-4947-8a03-9a28da3ae04c");
assert.equal(settings.accountId,"a5f1ad0774d30f1553e1a5fc3e2175ae");
assert.equal(settings.bucketName,"capone-private-studio-media");
const deployed=JSON.parse(await readFile(config,"utf8"));
assert.equal(deployed.d1_databases[0].database_id,settings.databaseId);
assert.equal(deployed.r2_buckets[0].bucket_name,settings.bucketName);
function wrangler(args,json=false){
  const r=spawnSync(process.execPath,["node_modules/wrangler/bin/wrangler.js",...args,"--config",config],{cwd:root,encoding:"utf8",maxBuffer:12*1024*1024,env:{...process.env,WRANGLER_SEND_METRICS:"false"}});
  if(r.status!==0)throw new Error((r.stderr||r.stdout||String(r.error)).slice(-1800));
  return json?JSON.parse(r.stdout):r.stdout;
}
const query=sql=>wrangler(["d1","execute",settings.databaseName,"--remote","--command",sql,"--json"],true);
const q=s=>s===null?"NULL":"'"+String(s).replaceAll("'","''")+"'";
const hash=buffer=>createHash("sha256").update(buffer).digest("hex");
const snapshot=()=>query("SELECT p.*,m.kind,m.storageKey,m.width,m.height,m.size FROM posts p JOIN media m ON m.id=p.mediaId ORDER BY p.id; SELECT * FROM homepage_settings; SELECT (SELECT COUNT(*) FROM user) AS users,(SELECT COUNT(*) FROM conversations) AS conversations,(SELECT COUNT(*) FROM messages) AS messages;").map(r=>r.results);
const manifestPath=path.join(dir,"release-manifest.json");
await mkdir(path.join(dir,"backfill"),{recursive:true});
if(mode==="prepare"){
  try{await access(manifestPath);throw new Error("A prepared release exists; inspect it before preparing again.")}catch(e){if(e.code!=="ENOENT")throw e}
  const baseline=snapshot(),versions=wrangler(["deployments","list","--json"],true);
  const items=[],links=[];
  for(const p of baseline[0].filter(p=>p.kind==="video"&&!p.posterId)){
    const existing=items.find(i=>i.sourceMediaId===p.mediaId);
    if(existing){links.push({postId:p.id,mediaId:p.mediaId,posterId:existing.id});continue}
    const source=path.join(dir,"backfill",p.mediaId+".mp4"),frame=path.join(dir,"backfill",p.mediaId+".png");
    try{await access(source)}catch{
      if(p.storageKey==="@hero")await copyFile("public/hero.mp4",source);
      else wrangler(["r2","object","get",settings.bucketName+"/"+p.storageKey,"--remote","--file",source]);
    }
    assert.equal((await stat(source)).size,p.size,"Source byte length differs for "+p.mediaId);
    const ffmpeg=path.join(root,".private/tools/ffmpeg/package/ffmpeg.exe");
    let r=spawnSync(ffmpeg,["-hide_banner","-loglevel","error","-y","-ss","0.5","-i",source,"-frames:v","1",frame],{encoding:"utf8"});
    if(r.status!==0)throw new Error(r.stderr);
    try{await access(frame)}catch{r=spawnSync(ffmpeg,["-hide_banner","-loglevel","error","-y","-i",source,"-frames:v","1",frame],{encoding:"utf8"});if(r.status!==0)throw new Error(r.stderr)}
    let bytes;
    for(const quality of [82,72,60,45,30]){bytes=await sharp(frame).rotate().resize({width:960,height:960,fit:"inside",withoutEnlargement:true}).webp({quality}).toBuffer();if(bytes.length<=250000)break}
    assert.ok(bytes.length<=250000,"Poster exceeds limit");
    const info=await sharp(bytes).metadata();assert.ok(Math.abs((info.width/info.height)/(p.width/p.height)-1)<=.01,"Cover ratio differs");
    const id="poster-"+p.mediaId+"-"+hash(bytes).slice(0,10),file=path.join(dir,"backfill",id+".webp");
    await writeFile(file,bytes);
    items.push({id,file,sourceMediaId:p.mediaId,kind:"image",mime:"image/webp",width:info.width,height:info.height,size:bytes.length,sha256:hash(bytes),purpose:"post-poster"});
    links.push({postId:p.id,mediaId:p.mediaId,posterId:id});
    console.log("Prepared cover "+links.length+" / "+baseline[0].filter(p=>p.kind==="video"&&!p.posterId).length);
  }
  for(const [name,kind,mime,width,height,purpose] of [["ritual-v1.mp4","video","video/mp4",720,1280,"post"],["ritual-poster.webp","image","image/webp",540,960,"post-poster"]]){
    const file=path.join(dir,name),bytes=await readFile(file),sha256=hash(bytes),id="ritual-"+(kind==="video"?"video":"poster")+"-"+sha256.slice(0,20);
    items.push({id,file,kind,mime,width,height,purpose,size:bytes.length,sha256,...kind==="video"?{durationMs:2300,frameRateMilli:30000,hasAudio:1}:{}});
  }
  const newVideo=items.find(i=>i.kind==="video"),newPoster=items.find(i=>i.id.startsWith("ritual-poster-"));
  const manifest={createdAt:Date.now(),baseline,versions,items,links,newPost:{id:"ritual-journal-"+newVideo.sha256.slice(0,16),title:"团队影像 · 仪式片段",body:"一段供奉与行仪的影像记录。心有所寄，行有所守。私人定制先了解，再评估。",mediaId:newVideo.id,posterId:newPoster.id}};
  await writeFile(manifestPath,JSON.stringify(manifest,null,2));
  const tiles=await sharp({create:{width:240*4,height:450*2,channels:3,background:"#eee6e9"}}).composite(await Promise.all(items.filter(i=>i.sourceMediaId).slice(0,8).map(async(i,index)=>({input:await sharp(i.file).resize(220,410,{fit:"contain",background:"#eee6e9"}).toBuffer(),left:(index%4)*240+10,top:Math.floor(index/4)*450+10})))).jpeg().toBuffer();
  await writeFile(path.join(dir,"backfill-contact-sheet.jpg"),tiles);
  console.log("Prepared release locally. No remote data was modified.");
}else{
  const m=JSON.parse(await readFile(manifestPath,"utf8"));
  if(mode==="apply"){
    assert.equal(JSON.parse(await readFile("test-results/media-qa/api-report.json","utf8")).success,true);
    const columns=query("PRAGMA table_info(posts)")[0].results.map(c=>c.name);assert.ok(columns.includes("posterId")&&columns.includes("loop"),"Apply the incremental migration first.");
    assert.deepEqual(snapshot()[1],m.baseline[1],"Homepage selection changed; review release before continuing.");
    for(const item of m.items){
      assert.equal(hash(await readFile(item.file)),item.sha256,"Prepared file changed");
      const existing=query("SELECT * FROM media WHERE id="+q(item.id))[0].results[0];
      if(existing){assert.equal(existing.size,item.size);assert.equal(existing.storageKey,"uploads/"+item.id);continue}
      wrangler(["r2","object","put",settings.bucketName+"/uploads/"+item.id,"--remote","--file",item.file,"--content-type",item.mime]);
      console.log("Uploaded prepared "+item.kind);
    }
    const sql=m.items.map(i=>`INSERT OR IGNORE INTO media(id,storageKey,mime,kind,width,height,size,createdAt,purpose,durationMs,frameRateMilli,hasAudio) VALUES(${[i.id,"uploads/"+i.id,i.mime,i.kind,i.width,i.height,i.size,m.createdAt,i.purpose,i.durationMs??null,i.frameRateMilli??null,i.hasAudio??0].map(q).join(",")});`);
    for(const link of m.links)sql.push(`UPDATE posts SET posterId=${q(link.posterId)} WHERE id=${q(link.postId)} AND mediaId=${q(link.mediaId)} AND posterId IS NULL;`);
    const p=m.newPost;
    sql.push(`INSERT OR IGNORE INTO posts(id,title,body,mediaId,posterId,loop,status,createdAt,updatedAt) VALUES(${[p.id,p.title,p.body,p.mediaId,p.posterId,1,"published",m.createdAt,m.createdAt].map(q).join(",")});`);
    const sqlPath=path.join(dir,"apply-media.sql");await writeFile(sqlPath,sql.join("\n")+"\n");
    wrangler(["d1","execute",settings.databaseName,"--remote","--file",sqlPath,"--json"]);
    console.log("Bound missing covers and added the new short film. Existing post text and timestamps were not changed.");
  }
  const current=snapshot();
  for(const old of m.baseline[0]){
    const now=current[0].find(p=>p.id===old.id);assert.ok(now,"Existing post missing");
    for(const key of ["title","body","mediaId","status","createdAt","updatedAt"])assert.equal(now[key],old[key],"Existing post changed: "+key);
    if(old.posterId)assert.equal(now.posterId,old.posterId,"Manual poster overwritten");
  }
  assert.deepEqual(current[1],m.baseline[1],"Homepage selection changed");
  assert.equal(current[2][0].users,m.baseline[2][0].users);
  for(const key of ["conversations","messages"])assert.ok(current[2][0][key]>=m.baseline[2][0][key]);
  assert.ok(current[0].filter(p=>p.kind==="video").every(p=>p.posterId),"Some videos still lack covers");
  const added=current[0].find(p=>p.id===m.newPost.id);assert.ok(added?.loop===1&&added.status==="published");
  await writeFile(path.join(dir,"verified.json"),JSON.stringify({time:new Date().toISOString(),posts:current[0].length,videoPosts:current[0].filter(p=>p.kind==="video").length,homepageUnchanged:true,existingPostsPreserved:true,counts:current[2][0]},null,2));
  console.log("Verified: all video covers present; original posts and homepage unchanged.");
}

import {createRequire} from "node:module";
import {readFileSync,writeFileSync,mkdirSync,existsSync} from "node:fs";
import {execFileSync} from "node:child_process";
import ts from "typescript";
import {Input,BufferSource,ALL_FORMATS,Output,Mp4OutputFormat,BufferTarget,EncodedPacketSink,EncodedVideoPacketSource,EncodedAudioPacketSource} from "mediabunny";
const {chromium,request}=createRequire(import.meta.url)("playwright");
const origin="http://127.0.0.1:5173",mode=process.argv[2]||"before";
mkdirSync("test-results",{recursive:true});
if(mode==="before")writeFileSync("test-results/optimizer-before.js",ts.transpileModule(readFileSync("lib/optimize-video.ts","utf8"),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace('"mediabunny"',JSON.stringify(origin+"/node_modules/mediabunny/dist/modules/src/index.js")));
if(!existsSync("test-results/upload-large.mp4")){
 const input=new Input({source:new BufferSource(readFileSync("public/hero.mp4")),formats:ALL_FORMATS});
 const vt=await input.getPrimaryVideoTrack(),at=await input.getPrimaryAudioTrack(),vp=[],ap=[];
 for await(const p of new EncodedPacketSink(vt).packets())vp.push(p);
 for await(const p of new EncodedPacketSink(at).packets())ap.push(p);
 const target=new BufferTarget(),out=new Output({format:new Mp4OutputFormat({fastStart:"in-memory"}),target}),vs=new EncodedVideoPacketSource("avc"),as=new EncodedAudioPacketSource("aac");
 out.addVideoTrack(vs);out.addAudioTrack(as);await out.start();
 const step=Math.ceil(Math.max(await vt.computeDuration(),await at.computeDuration())*30)/30,vc=await vt.getDecoderConfig(),ac=await at.getDecoderConfig();
 for(let n=0;n<15;n++){
  for(let i=0;i<vp.length;i++)await vs.add(vp[i].clone({timestamp:vp[i].timestamp+n*step,sequenceNumber:n*vp.length+i}),{decoderConfig:vc});
  for(let i=0;i<ap.length;i++)await as.add(ap[i].clone({timestamp:ap[i].timestamp+n*step,sequenceNumber:n*ap.length+i}),{decoderConfig:ac});
 }
 vs.close();as.close();await out.finalize();input.dispose();writeFileSync("test-results/upload-large.mp4",Buffer.from(target.buffer));
}
const sql=q=>execFileSync(process.execPath,["--import","./scripts/sites-env.mjs","./node_modules/wrangler/bin/wrangler.js","d1","execute","DB","--local","--config","dist/server/wrangler.json","--persist-to",".wrangler/state","--command",q],{stdio:"pipe"});
const owner=await request.newContext({baseURL:origin,extraHTTPHeaders:{Origin:origin}});
sql("DELETE FROM rate_limits");const password=JSON.parse(readFileSync(".private/qa-password.json","utf8")).password;
const login=await owner.post("/api/auth/sign-in/username",{data:{username:"capone",password}});if(!login.ok())throw new Error("Local QA sign-in failed");
const browser=await chromium.launch({headless:true,executablePath:"C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"}),context=await browser.newContext({storageState:await owner.storageState()});
await context.routeWebSocket("**/*",socket=>socket.close());
const page=await context.newPage(),results=[];
await page.route("**/qa-upload-bench",route=>route.fulfill({contentType:"text/html",body:"<!doctype html><html><body>Local upload benchmark</body></html>"}));
await page.route("**/qa-before.js",route=>route.fulfill({contentType:"text/javascript",body:readFileSync("test-results/optimizer-before.js","utf8")}));
await page.goto(origin+"/qa-upload-bench");
try{
 for(const [name,path] of [["small","public/hero.mp4"],["large","test-results/upload-large.mp4"]]){
  const bytes=readFileSync(path);console.log(name+" fixture: "+bytes.length+" bytes");
  await page.route("**/qa-fixture.mp4",route=>route.fulfill({contentType:"video/mp4",body:bytes}));
  for(let run=1;run<=3;run++){
   sql("DELETE FROM rate_limits");
   const cdp=await context.newCDPSession(page);
   await cdp.send("Network.enable");
   await cdp.send("Network.emulateNetworkConditions",{offline:false,latency:100,downloadThroughput:1250000,uploadThroughput:625000});
   const result=await page.evaluate(async({mode,run,name})=>{
    const file=new File([await(await fetch("/qa-fixture.mp4")).blob()],name+".mp4",{type:"video/mp4"});
    const signal=new AbortController().signal,ids=[];let taskId=null;
    const req=async(path,options={})=>{const r=await fetch(path,options);const d=await r.json();if(!r.ok)throw new Error(d.error||"request failed");return d};
    const upload=async(blob,purpose)=>{const r=await req("/api/admin/homepage/media?purpose="+purpose+(taskId?"&taskId="+taskId:""),{method:"POST",headers:{"Content-Type":blob.type},body:blob});ids.push(r.id);return r.id};
    const module=await import(mode==="before"?"/qa-before.js":"/lib/optimize-video.ts");
    const start=performance.now();let originalPromise,processStart=start,inspected;
    if(mode!=="before"){
     inspected=await module.inspectVideo(file,signal);
     taskId=(await req("/api/admin/homepage/tasks",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({})})).id;
     originalPromise=upload(file,"hero-original");originalPromise.catch(()=>{});processStart=performance.now();
    }
    try{
     const optimized=await module.optimizeVideo(file,()=>{},signal,inspected),processed=performance.now();let uploads;
     if(mode==="before"){await upload(file,"hero-original");await upload(optimized.video,"hero-video");await upload(optimized.poster,"hero-poster");uploads=performance.now()-processed;}
     else{await Promise.all([originalPromise,(async()=>{await upload(optimized.video,"hero-video");await upload(optimized.poster,"hero-poster")})()]);uploads=performance.now()-processStart;}
     return {name,run,inputBytes:file.size,outputBytes:optimized.video.size,processingMs:Math.round(processed-processStart),uploadSpanMs:Math.round(uploads),totalMs:Math.round(performance.now()-start)};
    }finally{
     if(taskId)await req("/api/admin/homepage/tasks/"+taskId,{method:"DELETE"}).catch(()=>{});
     else for(const id of ids)await req("/api/admin/media/"+id,{method:"DELETE"}).catch(()=>{});
    }
   },{mode,name,run});
   results.push(result);console.log(JSON.stringify(result));writeFileSync("test-results/upload-performance-"+mode+".json",JSON.stringify({mode,uploadMbps:5,downloadMbps:10,latencyMs:100,fixture:"Original source repeated 15 times for a real, playable near-limit MP4",results},null,2));await cdp.detach();
  }
  await page.unroute("**/qa-fixture.mp4");
 }
}finally{await context.close();await browser.close();await owner.dispose()}

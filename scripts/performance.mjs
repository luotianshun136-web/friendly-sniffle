import {createRequire} from "node:module";
import {mkdirSync,writeFileSync} from "node:fs";
const {chromium}=createRequire(import.meta.url)("playwright");
const [url,label="measurement"]=process.argv.slice(2);
if(!url)throw new Error("Pass a site URL and measurement label.");
const browser=await chromium.launch({headless:true,executablePath:"C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"});
const results=[];
try{
 for(let i=0;i<3;i++){
  const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true});
  const page=await context.newPage(),cdp=await context.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions",{offline:false,latency:100,downloadThroughput:1250000,uploadThroughput:625000});
  await cdp.send("Emulation.setCPUThrottlingRate",{rate:4});
  await page.addInitScript(()=>{window.__lcp=0;new PerformanceObserver(l=>{for(const e of l.getEntries())window.__lcp=e.startTime}).observe({type:"largest-contentful-paint",buffered:true})});
  let started=0,bytes=0;const media=new Set();
  cdp.on("Network.dataReceived",e=>{if(started&&performance.now()-started<5000)bytes+=e.encodedDataLength});
  page.on("request",r=>{if(r.resourceType()==="media")media.add(new URL(r.url()).pathname)});
  for(const visit of ["cold","repeat"]){
   bytes=0;media.clear();started=performance.now();
   const response=await page.goto(url,{waitUntil:"domcontentloaded",timeout:60000});
   if(response.status()!==200)throw new Error("Navigation status "+response.status());
   await page.waitForTimeout(Math.max(0,10000-(performance.now()-started)));
   const values=await page.evaluate(()=>{const n=performance.getEntriesByType("navigation")[0];return {ttfb:Math.round(n.responseStart),fcp:Math.round(performance.getEntriesByName("first-contentful-paint")[0]?.startTime||0),lcp:Math.round(window.__lcp),completedResourceBytes:performance.getEntriesByType("resource").reduce((sum,r)=>sum+r.transferSize,0),videoReady:document.querySelector(".hero-film video")?.readyState||0}});
   const result={run:i+1,visit,...values,first5sBytes:bytes,mediaRequests:[...media]};results.push(result);console.log(JSON.stringify(result));
  }
  await context.close();
 }
 mkdirSync("test-results",{recursive:true});writeFileSync("test-results/performance-"+label+".json",JSON.stringify({url,conditions:{latencyMs:100,downstreamMbps:10,cpuSlowdown:4},results},null,2));
}finally{await browser.close()}

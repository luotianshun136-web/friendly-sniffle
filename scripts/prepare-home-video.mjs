import {createRequire} from "node:module";
import {mkdirSync,writeFileSync} from "node:fs";
const {chromium}=createRequire(import.meta.url)("playwright");
const browser=await chromium.launch({headless:true,executablePath:"C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"});
try{
 const page=await browser.newPage();await page.goto("http://127.0.0.1:5173/admin",{waitUntil:"domcontentloaded",timeout:60000});
 const result=await page.evaluate(async()=>{
  const {optimizeVideo}=await import("/lib/optimize-video.ts");
  const source=await (await fetch("/hero.mp4")).blob();
  const result=await optimizeVideo(new File([source],"hero.mp4",{type:"video/mp4"}),()=>{},new AbortController().signal);
  const encode=blob=>new Promise(resolve=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(",")[1]);reader.readAsDataURL(blob)});
  return {video:await encode(result.video),poster:await encode(result.poster),width:result.width,height:result.height,duration:result.duration};
 });
 mkdirSync("public/media",{recursive:true});const video=Buffer.from(result.video,"base64"),poster=Buffer.from(result.poster,"base64");
 writeFileSync("public/media/hero-v3.mp4",video);writeFileSync("public/media/hero-v2.webp",poster);
 console.log(JSON.stringify({width:result.width,height:result.height,duration:result.duration,videoBytes:video.length,posterBytes:poster.length}));
}finally{await browser.close()}

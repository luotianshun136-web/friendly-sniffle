import {createRequire} from "node:module";
import {mkdir,readFile,copyFile,writeFile,stat} from "node:fs/promises";
import {constants} from "node:fs";
import {spawnSync} from "node:child_process";
import {parseArgs} from "node:util";
import path from "node:path";
import {Input,BufferSource,ALL_FORMATS} from "mediabunny";

const {values}=parseArgs({options:{ancestor:{type:"string"},ritual:{type:"string"},video:{type:"string"},ffmpeg:{type:"string"}}});
for(const name of ["ancestor","ritual","video","ffmpeg"])if(!values[name])throw new Error("Missing --"+name);
const sharp=createRequire(import.meta.url)("sharp"),publicDir=path.resolve("public/media"),privateDir=path.resolve(".private/lineage-release");
await mkdir(publicDir,{recursive:true});await mkdir(privateDir,{recursive:true});
const info={images:[]};
for(const [key,stem,widths] of [["ancestor","lineage-altar-v1",[480,940]],["ritual","lineage-ritual-v1",[640,1280]]]){
  const source=values[key],original=path.join(privateDir,key+path.extname(source));
  try{await copyFile(source,original,constants.COPYFILE_EXCL)}catch(error){if(error.code!=="EEXIST")throw error}
  const metadata=await sharp(source).metadata();
  for(const width of widths){const file=path.join(publicDir,`${stem}-${width}.webp`);await sharp(source).rotate().resize({width,withoutEnlargement:true}).webp({quality:82}).toFile(file);info.images.push({file:path.basename(file),bytes:(await stat(file)).size,width,height:Math.round(metadata.height*width/metadata.width)})}
}
const original=path.join(privateDir,"ritual-original.mp4");
try{await copyFile(values.video,original,constants.COPYFILE_EXCL)}catch(error){if(error.code!=="EEXIST")throw error}
const input=new Input({source:new BufferSource(await readFile(original)),formats:ALL_FORMATS});
let before;
try{const v=await input.getPrimaryVideoTrack();before={width:v.displayWidth,height:v.displayHeight,duration:await v.computeDuration(),hasAudio:!!await input.getPrimaryAudioTrack()}}finally{input.dispose()}
const scale=Math.min(720/before.width,1280/before.height,1),w=Math.floor(before.width*scale/2)*2,h=Math.floor(before.height*scale/2)*2;
const movie=path.join(privateDir,"ritual-v1.mp4"),frame=path.join(privateDir,"ritual-frame.png"),poster=path.join(privateDir,"ritual-poster.webp");
function ffmpeg(args){const result=spawnSync(values.ffmpeg,["-hide_banner","-loglevel","error","-y",...args],{encoding:"utf8",windowsHide:true});if(result.status!==0)throw new Error(result.stderr||"FFmpeg failed")}
ffmpeg(["-i",original,"-map","0:v:0","-map","0:a:0?","-vf",`scale=${w}:${h}:flags=lanczos,pad=720:1280:(ow-iw)/2:(oh-ih)/2:color=0x262026,setsar=1`,"-c:v","libx264","-crf","23","-maxrate","1500k","-bufsize","3M","-pix_fmt","yuv420p","-r","30","-c:a","aac","-b:a","96k","-map_metadata","-1","-movflags","+faststart",movie]);
ffmpeg(["-ss","0.5","-i",movie,"-frames:v","1",frame]);
await sharp(frame).resize({height:960,withoutEnlargement:true}).webp({quality:82}).toFile(poster);
const check=new Input({source:new BufferSource(await readFile(movie)),formats:ALL_FORMATS});
try{const v=await check.getPrimaryVideoTrack(),duration=await v.computeDuration(),hasAudio=!!await check.getPrimaryAudioTrack();if(Math.abs(duration-before.duration)>.1||hasAudio!==before.hasAudio)throw new Error("Duration or audio changed unexpectedly");info.video={width:v.displayWidth,height:v.displayHeight,duration,hasAudio,bytes:(await stat(movie)).size,posterBytes:(await stat(poster)).size}}finally{check.dispose()}
await writeFile(path.join(privateDir,"assets.json"),JSON.stringify(info,null,2));
console.log(JSON.stringify(info,null,2));

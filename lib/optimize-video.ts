import {Input,BlobSource,ALL_FORMATS,Output,Mp4OutputFormat,BufferTarget,Conversion,CanvasSink,canEncodeVideo,canEncodeAudio} from "mediabunny";
export type VideoInspection={width:number;height:number;duration:number;frameRate:number;hasAudio:boolean;copyVideo:boolean;copyAudio:boolean};
export type OptimizedVideo=VideoInspection&{original:File;video:Blob;poster:Blob};
export async function inspectVideo(file:File,signal:AbortSignal):Promise<VideoInspection>{
 if(file.size>50*1024*1024||!file.size)throw new Error("原视频不能超过50 MB。");
 signal.throwIfAborted();const header=new Uint8Array(await file.slice(0,16).arrayBuffer());
 if(String.fromCharCode(...header.slice(4,8))!=="ftyp")throw new Error("请选择有效的 H.264 MP4 视频。");
 const input=new Input({source:new BlobSource(file),formats:ALL_FORMATS});
 try{
  const track=await input.getPrimaryVideoTrack(),audio=await input.getPrimaryAudioTrack();
  if(!track||track.codec!=="avc")throw new Error("请选择 H.264 MP4 视频。");
  const w=track.displayWidth,h=track.displayHeight,ratio=w/h;
  if(Math.min(Math.abs(ratio/(16/9)-1),Math.abs(ratio/(9/16)-1))>.01)throw new Error("首页视频画幅必须为16:9或9:16。");
  const duration=await track.computeDuration(),stats=await track.computePacketStats(undefined,{metadataOnly:true});
  if(!Number.isFinite(duration)||duration<=0)throw new Error("无法读取视频时长。");
  const scale=Math.min(1,960/Math.max(w,h)),width=Math.max(2,Math.floor(w*scale/2)*2),height=Math.max(2,Math.floor(h*scale/2)*2),frameRate=Math.min(30,stats.averagePacketRate||30);
  const copyVideo=scale===1&&track.rotation===0&&stats.averagePacketRate<=30.01&&file.size*8/duration<=1400000;
  if(!globalThis.VideoDecoder||!await track.canDecode()||(!copyVideo&&(!globalThis.VideoEncoder||!await canEncodeVideo("avc",{width,height,bitrate:1000000}))))throw new Error("此浏览器不支持视频优化，请使用最新版 Chrome 或 Edge。原首页未改动。");
  const audioStats=audio?await audio.computePacketStats(undefined,{metadataOnly:true}):null;
  const copyAudio=!!audio&&audio.codec==="aac"&&audio.numberOfChannels<=2&&audio.sampleRate<=48000&&(audioStats?.averageBitrate||0)<=132000;
  if(audio&&!copyAudio&&(!await audio.canDecode()||!await canEncodeAudio("aac",{numberOfChannels:Math.min(2,audio.numberOfChannels),sampleRate:48000,bitrate:96000})))throw new Error("此浏览器无法保留原声，请使用最新版 Chrome 或 Edge。不会替换为无声视频。");
  signal.throwIfAborted();return {width,height,duration,frameRate,hasAudio:!!audio,copyVideo,copyAudio};
 }finally{input.dispose()}
}
export async function optimizeVideo(file:File,onProgress:(progress:number)=>void,signal:AbortSignal,inspection?:VideoInspection):Promise<OptimizedVideo>{
 const info=inspection||await inspectVideo(file,signal),{width,height,duration,frameRate}=info;
 const input=new Input({source:new BlobSource(file),formats:ALL_FORMATS});let conversion:Conversion|undefined;
 const cancel=()=>{void conversion?.cancel().catch(()=>{})};signal.addEventListener("abort",cancel,{once:true});
 try{
  signal.throwIfAborted();const track=(await input.getPrimaryVideoTrack())!,audio=await input.getPrimaryAudioTrack();
  const wrapped=await new CanvasSink(track,{width,height,fit:"contain"}).getCanvas(Math.min(.5,duration/2));
  if(!wrapped)throw new Error("无法生成封面，请检查视频内容。");
  const canvas=document.createElement("canvas");canvas.width=width;canvas.height=height;canvas.getContext("2d")!.drawImage(wrapped.canvas,0,0);
  const poster=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error("封面生成失败。")),"image/webp",.76));
  signal.throwIfAborted();const target=new BufferTarget(),output=new Output({format:new Mp4OutputFormat({fastStart:"in-memory"}),target});
  conversion=await Conversion.init({input,output,tracks:"primary",video:info.copyVideo?{}:{codec:"avc",width,height,fit:"contain",frameRate,bitrate:1000000,keyFrameInterval:2,forceTranscode:true,allowRotationMetadata:false},audio:!audio?{discard:true}:info.copyAudio?{}:{codec:"aac",bitrate:96000,sampleRate:48000,numberOfChannels:Math.min(2,audio.numberOfChannels),forceTranscode:true},showWarnings:false});
  if(!conversion.isValid||conversion.discardedTracks.some(t=>t.track===track||(info.hasAudio&&t.track===audio)))throw new Error("此浏览器无法完整保留画面和原声，请更换兼容的浏览器后重试。");
  conversion.onProgress=p=>onProgress(Math.min(99,Math.round(p*100)));
  signal.throwIfAborted();await conversion.execute();signal.throwIfAborted();
  if(!target.buffer)throw new Error("视频优化未完成。");
  const video=new Blob([target.buffer],{type:"video/mp4"}),check=new Input({source:new BlobSource(video),formats:ALL_FORMATS});
  try{if(info.hasAudio&&!await check.getPrimaryAudioTrack())throw new Error("原声音轨未能保留，首页未更改。")}finally{check.dispose()}
  onProgress(100);return {...info,original:file,video,poster};
 }finally{signal.removeEventListener("abort",cancel);input.dispose()}
}

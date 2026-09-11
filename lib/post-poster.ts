import {Input,BlobSource,ALL_FORMATS,CanvasSink} from "mediabunny";
import {matchingFrame} from "./post-validation";

export async function inspectPostFile(file:File,signal:AbortSignal){
  let width=0,height=0;
  if(file.type==="video/mp4"){
    const input=new Input({source:new BlobSource(file),formats:ALL_FORMATS});
    try{const track=await input.getPrimaryVideoTrack();if(!track||track.codec!=="avc")throw new Error("视频请使用 H.264 MP4 格式。");width=track.displayWidth;height=track.displayHeight}finally{input.dispose()}
  }else{
    const url=URL.createObjectURL(file),image=new Image();
    try{image.src=url;await image.decode();width=image.naturalWidth;height=image.naturalHeight}finally{URL.revokeObjectURL(url)}
  }
  signal.throwIfAborted();
  if(width<90||height<90||width>8192||height>8192||(!matchingFrame(width,height,16,9)&&!matchingFrame(width,height,9,16)))throw new Error("画幅必须为16:9或9:16，请调整后上传。");
}

async function webp(source:CanvasImageSource,width:number,height:number,signal:AbortSignal){
  signal.throwIfAborted();
  const scale=Math.min(1,960/Math.max(width,height)),canvas=document.createElement("canvas");
  canvas.width=Math.max(1,Math.round(width*scale));canvas.height=Math.max(1,Math.round(height*scale));
  const context=canvas.getContext("2d");if(!context)throw new Error("此浏览器无法生成封面。");
  context.drawImage(source,0,0,canvas.width,canvas.height);
  for(const quality of [.82,.72,.6,.45,.3]){
    const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,"image/webp",quality));signal.throwIfAborted();
    if(!blob||blob.type!=="image/webp")throw new Error("此浏览器无法生成 WebP 封面，请使用最新版 Chrome 或 Edge。");
    if(blob.size<=250000)return blob;
  }
  throw new Error("封面细节过多，请换一张图片或选择其他画面。");
}
export async function extractPostPoster(file:Blob,seconds:number,signal:AbortSignal){
  if(!Number.isFinite(seconds)||seconds<0)throw new Error("请输入有效的取帧时间。");
  const input=new Input({source:new BlobSource(file),formats:ALL_FORMATS});
  try{
    const track=await input.getPrimaryVideoTrack();
    if(!track||!await track.canDecode())throw new Error("此浏览器无法抽帧，请手动上传封面或使用最新版 Chrome / Edge。");
    const duration=await track.computeDuration();
    if(!Number.isFinite(duration)||duration<=0)throw new Error("无法读取视频时长。");
    const scale=Math.min(1,960/Math.max(track.displayWidth,track.displayHeight));
    const frame=await new CanvasSink(track,{width:Math.round(track.displayWidth*scale),height:Math.round(track.displayHeight*scale),fit:"contain"}).getCanvas(Math.min(seconds,Math.max(0,duration-.05)));
    if(!frame)throw new Error("未能取得视频画面，请更换取帧时间或手动上传封面。");
    return await webp(frame.canvas,frame.canvas.width,frame.canvas.height,signal);
  }finally{input.dispose()}
}
export async function preparePostPoster(file:File,width:number,height:number,signal:AbortSignal){
  if(!["image/jpeg","image/png","image/webp"].includes(file.type)||file.size>10*1024*1024||!file.size)throw new Error("请选择10 MB以内的 JPG、PNG 或 WebP 图片。");
  const url=URL.createObjectURL(file),image=new Image();
  try{
    image.src=url;await image.decode();signal.throwIfAborted();
    if(!matchingFrame(image.naturalWidth,image.naturalHeight,width,height))throw new Error("封面画幅须与视频一致，不会自动裁切图片。");
    return await webp(image,image.naturalWidth,image.naturalHeight,signal);
  }finally{URL.revokeObjectURL(url)}
}

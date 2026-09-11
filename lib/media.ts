import {runtime,database,HttpError} from "./server";
import type {HeroMediaPurpose} from "./homepage-types";
async function openStoredVideo(key:string,size:number){
  const {Input,CustomSource,ALL_FORMATS}=await import("mediabunny"),{BUCKET}=runtime();
  const source=new CustomSource({getSize:()=>size,maxCacheSize:1024*1024,read:async(start,end)=>{
    if(end-start>4*1024*1024)throw new Error("metadata too large");
    const part=await BUCKET.get(key,{range:{offset:start,length:end-start}});
    if(!part)throw new Error("missing");return new Uint8Array(await part.arrayBuffer());
  }});
  return new Input({source,formats:ALL_FORMATS});
}
export async function mediaHasAudio(id:string):Promise<boolean>{
  const m=await database().prepare("SELECT storageKey,size,hasAudio FROM media WHERE id=? AND kind='video'").bind(id).first<{storageKey:string;size:number;hasAudio:number|null}>();
  if(!m)throw new HttpError(400,"视频不存在。");
  if(m.hasAudio!==null)return !!m.hasAudio;
  if(m.storageKey==="@hero")return true;
  const input=await openStoredVideo(m.storageKey,m.size);
  try{return !!await input.getPrimaryAudioTrack()}finally{input.dispose()}
}
export async function uploadMedia(req:Request,purpose:HeroMediaPurpose|"post"="post"){
  const {BUCKET}=runtime();const mime=req.headers.get("content-type")?.split(";")[0]||"";
  if(!["image/jpeg","image/png","image/webp","video/mp4"].includes(mime))throw new HttpError(400,"仅支持 JPG、PNG、WebP 图片或 H.264 MP4 视频。");
  const kind=mime.startsWith("video")?"video":"image",max=(kind==="video"?50:10)*1024*1024;
  if(purpose!=="post"&&((purpose==="hero-poster")!==(kind==="image")))throw new HttpError(400,"首页素材类型不正确。");
  const size=Number(req.headers.get("content-length"));if(!Number.isSafeInteger(size)||size<=0||size>max)throw new HttpError(413,"图片不能超过10 MB，视频不能超过50 MB。");
  const id=crypto.randomUUID(),key="uploads/"+id;
  try{
    const stored=await BUCKET.put(key,req.body,{httpMetadata:{contentType:mime}});
    if(!stored||stored.size!==size)throw new HttpError(400,"上传未完成，请重试。");
    let width=0,height=0,durationMs:number|null=null,frameRateMilli:number|null=null,hasAudio=false;
    if(kind==="image"){
      const {imageSize}=await import("image-size");
      const object=await BUCKET.get(key);if(!object)throw new Error("missing");
      const info=imageSize(new Uint8Array(await object.arrayBuffer()));
      if((mime==="image/jpeg"&&info.type!=="jpg")||(mime==="image/png"&&info.type!=="png")||(mime==="image/webp"&&info.type!=="webp"))throw new HttpError(400,"文件内容与类型不一致。");
      width=info.width;height=info.height;
      if(info.orientation&&info.orientation>=5)[width,height]=[height,width];
    }else{
      const header=await BUCKET.get(key,{range:{offset:0,length:16}});
      const bytes=new Uint8Array(await header!.arrayBuffer());
      if(String.fromCharCode(...bytes.slice(4,8))!=="ftyp")throw new HttpError(400,"请上传有效的 MP4 文件。");
      const input=await openStoredVideo(key,size);
      try{const track=await input.getPrimaryVideoTrack();if(!track||track.codec!=="avc")throw new HttpError(400,"视频请使用兼容手机播放的 H.264 MP4 格式。");width=track.displayWidth;height=track.displayHeight;const audio=await input.getPrimaryAudioTrack();if(audio&&audio.codec!=="aac"&&audio.codec!=="mp3")throw new HttpError(400,"视频音轨请使用 AAC 格式。");
        hasAudio=!!audio;
        if(purpose!=="post"){durationMs=Math.round(await track.computeDuration()*1000);if(!durationMs||!Number.isFinite(durationMs))throw new HttpError(400,"无法读取视频时长。");}
        if(purpose==="hero-video"){frameRateMilli=Math.round((await track.computePacketStats(undefined,{metadataOnly:true})).averagePacketRate*1000);if((audio&&audio.codec!=="aac")||Math.max(width,height)>960||frameRateMilli>31000||size*8000/(durationMs||1)>1800000)throw new HttpError(400,"首页视频尚未完成轻量化处理，请重新优化。");}
      }finally{input.dispose()}
    }
    const ratio=width/height;
    if(!Number.isFinite(ratio)||width<90||height<90||width>8192||height>8192||Math.min(Math.abs(ratio/(16/9)-1),Math.abs(ratio/(9/16)-1))>.01)throw new HttpError(400,"媒体画幅必须为16:9或9:16，请调整后上传。");
    if(purpose==="hero-poster"&&(Math.max(width,height)>960||size>250000))throw new HttpError(400,"首页封面过大，请重新生成。");
    await database().prepare("INSERT INTO media (id,storageKey,mime,kind,width,height,size,createdAt,purpose,durationMs,frameRateMilli,hasAudio) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)").bind(id,key,mime,kind,width,height,size,Date.now(),purpose,durationMs,frameRateMilli,hasAudio?1:0).run();
    return {id,kind,width,height,size,hasAudio};
  }catch(error){await BUCKET.delete(key);if(error instanceof HttpError)throw error;throw new HttpError(400,"无法读取媒体文件，请检查格式后重试。")}
}
export async function serveMedia(req:Request,id:string){
  const m=await database().prepare("SELECT m.*, (EXISTS (SELECT 1 FROM posts p WHERE p.mediaId=m.id AND p.status='published' AND m.purpose='post') OR EXISTS (SELECT 1 FROM homepage_settings h WHERE h.videoId=m.id OR h.posterId=m.id)) AS isPublic FROM media m WHERE m.id=?").bind(id).first<{storageKey:string;mime:string;size:number;isPublic:number}>();
  if(!m)throw new HttpError(404,"内容不存在。");
  if(!m.isPublic){try{const {admin}=await import("./auth");await admin(req)}catch{throw new HttpError(404,"内容不存在。");}}
  if(m.storageKey==="@hero")return Response.redirect(new URL("/hero.mp4",req.url),302);
  let range: {offset:number;length:number}|undefined;
  const etag='"'+id+'"';
  const h=new Headers({"Content-Type":m.mime,"Cache-Control":m.isPublic?"private, no-cache":"no-store","X-Content-Type-Options":"nosniff","Accept-Ranges":"bytes","ETag":etag});
  if(m.isPublic&&req.headers.get("if-none-match")?.split(",").some(t=>t.trim()===etag))return new Response(null,{status:304,headers:h});
  const raw=req.headers.get("range");
  if(raw){const match=/^bytes=(\d*)-(\d*)$/.exec(raw);if(!match||(!match[1]&&!match[2]))return new Response(null,{status:416,headers:{"Content-Range":"bytes */"+m.size}});
    const start=match[1]?Number(match[1]):Math.max(0,m.size-Number(match[2])),end=match[1]?(match[2]?Math.min(Number(match[2]),m.size-1):m.size-1):m.size-1;
    if(start>=m.size||end<start)return new Response(null,{status:416,headers:{"Content-Range":"bytes */"+m.size}});
    range={offset:start,length:end-start+1};h.set("Content-Range","bytes "+start+"-"+end+"/"+m.size);
  }
  const object=await runtime().BUCKET.get(m.storageKey,range?{range}:undefined);if(!object)throw new HttpError(404,"文件不存在。");
  h.set("Content-Length",String(range?.length||object.size));return new Response(object.body,{status:range?206:200,headers:h});
}

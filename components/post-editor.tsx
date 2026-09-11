"use client";
import {useEffect,useRef,useState} from "react";
import {Upload,RefreshCw,LoaderCircle} from "lucide-react";
import {Sheet,SheetContent,SheetHeader,SheetTitle,SheetDescription} from "./ui/sheet";
import {Select,SelectTrigger,SelectContent,SelectItem,SelectValue} from "./ui/select";
import {api,write} from "@/lib/client";
import type {Post} from "@/lib/types";

type Draft=Pick<Post,"title"|"body"|"mediaId"|"posterId"|"loop"|"status">&Partial<Pick<Post,"kind"|"width"|"height">>;
type Media={id:string;kind:"image"|"video";width:number;height:number};
export default function PostEditor({post,onClose,onSaved}:{post:Post|null;onClose:()=>void;onSaved:()=>Promise<void>}){
  const [draft,setDraft]=useState<Draft>(post?{...post}:{title:"",body:"",mediaId:"",posterId:null,loop:false,status:"draft"});
  const [busy,setBusy]=useState(false),[phase,setPhase]=useState(""),[error,setError]=useState(""),[frameTime,setFrameTime]=useState(.5),[duration,setDuration]=useState<number>();
  const created=useRef(new Set<string>()),controller=useRef<AbortController|null>(null),cachedVideo=useRef<{id:string;blob:Blob}|null>(null);
  useEffect(()=>()=>controller.current?.abort(),[]);
  async function cleanup(){for(const id of [...created.current]){await api("/api/admin/media/"+id,{method:"DELETE"}).catch(()=>{});created.current.delete(id)}}
  async function close(){if(busy)return;await cleanup();onClose()}
  async function run(task:(signal:AbortSignal)=>Promise<void>){
    if(controller.current)return;
    const c=new AbortController();controller.current=c;setBusy(true);setError("");
    try{await task(c.signal)}catch(e){setError(c.signal.aborted?"操作已取消，已发布内容没有改变。":(e as Error).message)}
    finally{controller.current=null;setBusy(false);setPhase("")}
  }
  async function uploadBlob(blob:Blob,purpose:"post"|"post-poster",signal:AbortSignal){
    const m=await api<Media>("/api/admin/media?purpose="+purpose,{method:"POST",headers:{"Content-Type":blob.type},body:blob,signal});
    created.current.add(m.id);signal.throwIfAborted();return m;
  }
  async function source(signal:AbortSignal){
    if(cachedVideo.current?.id===draft.mediaId)return cachedVideo.current.blob;
    const r=await fetch("/api/media/"+draft.mediaId,{cache:"no-store",signal});
    if(!r.ok)throw new Error("无法读取原视频，请刷新后重试。");
    const blob=await r.blob();if(blob.size>50*1024*1024)throw new Error("视频超过50 MB。");
    cachedVideo.current={id:draft.mediaId,blob};return blob;
  }
  async function upload(file:File){await run(async signal=>{
    const video=file.type==="video/mp4";
    if(!["image/jpeg","image/png","image/webp","video/mp4"].includes(file.type)||file.size>(video?50:10)*1024*1024||!file.size)throw new Error("请选择有效文件：图片≤10 MB，H.264 MP4视频≤50 MB。");
    setPhase("检查媒体");const {inspectPostFile}=await import("@/lib/post-poster");await inspectPostFile(file,signal);
    setPhase("上传并校验媒体");const m=await uploadBlob(file,"post",signal);
    cachedVideo.current=video?{id:m.id,blob:file}:null;setDuration(undefined);setFrameTime(.5);
    setDraft(d=>({...d,mediaId:m.id,kind:m.kind,width:m.width,height:m.height,posterId:null,loop:false}));
    if(video){
      setPhase("生成视频封面");const {extractPostPoster}=await import("@/lib/post-poster");
      const blob=await extractPostPoster(file,.5,signal);setPhase("保存封面");const cover=await uploadBlob(blob,"post-poster",signal);
      setDraft(d=>({...d,posterId:cover.id}));
    }
  })}
  async function extract(){await run(async signal=>{
    setPhase("读取视频并抽帧");const blob=await source(signal),{extractPostPoster}=await import("@/lib/post-poster");
    const cover=await extractPostPoster(blob,frameTime,signal);setPhase("保存封面");const m=await uploadBlob(cover,"post-poster",signal);setDraft(d=>({...d,posterId:m.id}));
  })}
  async function manual(file:File){await run(async signal=>{
    setPhase("检查并处理封面");const {preparePostPoster}=await import("@/lib/post-poster");
    const cover=await preparePostPoster(file,draft.width!,draft.height!,signal);setPhase("保存封面");const m=await uploadBlob(cover,"post-poster",signal);setDraft(d=>({...d,posterId:m.id}));
  })}
  async function save(e:React.FormEvent){e.preventDefault();await run(async signal=>{
    if(draft.kind==="video"&&draft.status==="published"&&!draft.posterId)throw new Error("发布视频前请先生成或上传封面。");
    setPhase("保存帖子");await api("/api/admin/posts"+(post?"/"+post.id:""),{...write(post?"PATCH":"POST",draft),signal});
    created.current.delete(draft.mediaId);if(draft.posterId)created.current.delete(draft.posterId);await cleanup();await onSaved();onClose();
  })}
  return <Sheet open onOpenChange={open=>{if(!open)void close()}}><SheetContent className="editor-panel"><SheetHeader><SheetTitle>{post?"编辑帖子":"新建帖子"}</SheetTitle><SheetDescription>每条帖子包含一张图片或一段视频。</SheetDescription></SheetHeader>
    <form className="editor-form" onSubmit={save}>
      <label>标题<input required maxLength={100} disabled={busy} value={draft.title} onChange={e=>setDraft({...draft,title:e.target.value})}/></label>
      <label>内容<textarea rows={5} maxLength={3000} disabled={busy} value={draft.body} onChange={e=>setDraft({...draft,body:e.target.value})}/></label>
      <label className="upload-control"><Upload size={20}/>{draft.mediaId?"更换图片 / 视频":"选择图片 / 视频"}<input aria-label="动态图片或视频" type="file" accept="image/jpeg,image/png,image/webp,video/mp4" disabled={busy} onChange={e=>{const f=e.target.files?.[0];e.target.value="";if(f)void upload(f)}}/></label>
      <p className="micro">仅16:9或9:16。图片≤10 MB，H.264 MP4视频≤50 MB。</p>
      {draft.mediaId&&<div className="editor-media">{draft.kind==="video"?<video key={draft.mediaId} src={"/api/media/"+draft.mediaId} poster={draft.posterId?"/api/media/"+draft.posterId:undefined} controls playsInline preload="metadata" onLoadedMetadata={e=>setDuration(e.currentTarget.duration)}/>:<img src={"/api/media/"+draft.mediaId} alt="帖子图片预览"/>}</div>}
      {draft.kind==="video"&&<fieldset className="poster-editor" disabled={busy}><legend>视频封面</legend>
        {draft.posterId?<img className="poster-preview" src={"/api/media/"+draft.posterId} alt="视频封面预览"/>:<p className="micro">尚未选择封面</p>}
        <div className="poster-frame-controls"><label>取帧时间（秒）<input aria-label="取帧时间（秒）" type="number" min={0} max={Number.isFinite(duration)?Math.max(0,duration!-.05):undefined} step={.1} value={frameTime} onChange={e=>setFrameTime(Number(e.target.value))}/></label><button className="icon-button" type="button" title="重新取帧" aria-label="重新取帧" onClick={()=>void extract()}><RefreshCw size={18}/></button></div>
        <label className="upload-control poster-upload"><Upload size={18}/>更换封面图片<input aria-label="更换封面图片" type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>{const f=e.target.files?.[0];e.target.value="";if(f)void manual(f)}}/></label>
        <p className="micro">图片≤10 MB，画幅须与视频一致。</p>
        <label className="loop-control"><input type="checkbox" checked={draft.loop} onChange={e=>setDraft({...draft,loop:e.target.checked})}/>循环播放</label>
      </fieldset>}
      <label>发布状态<Select disabled={busy} value={draft.status} onValueChange={v=>setDraft({...draft,status:v as Draft["status"]})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="draft">保存为草稿</SelectItem><SelectItem value="published">公开发布</SelectItem></SelectContent></Select></label>
      {phase&&<p className="poster-progress" role="status"><LoaderCircle className="spin" size={16}/>{phase}…</p>}{error&&<p className="error-message" role="alert">{error}</p>}
      <div className="poster-actions"><button className="primary-button" disabled={busy||!draft.mediaId}>保存帖子</button>{busy&&phase!=="保存帖子"?<button type="button" className="text-link" onClick={()=>controller.current?.abort()}>取消操作</button>:<button type="button" className="text-link" disabled={busy} onClick={()=>void close()}>取消编辑</button>}</div>
    </form>
  </SheetContent></Sheet>;
}

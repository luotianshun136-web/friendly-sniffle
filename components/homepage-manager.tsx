"use client";
import {useEffect,useRef,useState} from "react";
import {Upload,Check,LoaderCircle,X,RefreshCw,Volume2} from "lucide-react";
import {api} from "@/lib/client";
import type {HomepageVideo,HeroMediaPurpose} from "@/lib/homepage-types";
import {HomepageTransfer,type TransferState} from "@/lib/homepage-transfer";
const names:Record<HeroMediaPurpose,string>={"hero-original":"原片私密保存","hero-video":"首页播放版","hero-poster":"视频封面"};
const mb=(value:number)=>(value/1048576).toFixed(2)+" MB";
export default function HomepageManager(){
 const [current,setCurrent]=useState<HomepageVideo|null>(null),[state,setState]=useState<TransferState|null>(null),[error,setError]=useState(""),[notice,setNotice]=useState(""),[restoring,setRestoring]=useState(false),[preview,setPreview]=useState<{videoUrl:string;posterUrl:string}|null>(null);
 const transfer=useRef<HomepageTransfer|null>(null),mounted=useRef(true),input=useRef<HTMLInputElement>(null),restoreController=useRef<AbortController|null>(null);
 const busy=!!state?.busy||restoring;
 async function refresh(){setError("");try{setCurrent(await api<HomepageVideo>("/api/admin/homepage"))}catch(e){setError((e as Error).message)}}
 useEffect(()=>{mounted.current=true;refresh();return()=>{mounted.current=false;restoreController.current?.abort();void transfer.current?.cancel().catch(()=>{})}},[]);
 useEffect(()=>{
  if(!state?.result){setPreview(null);return}
  const next={videoUrl:URL.createObjectURL(state.result.video),posterUrl:URL.createObjectURL(state.result.poster)};
  setPreview(next);return()=>{URL.revokeObjectURL(next.videoUrl);URL.revokeObjectURL(next.posterUrl)};
 },[state?.result]);
 async function cancel(){
  restoreController.current?.abort();setRestoring(false);const old=transfer.current;transfer.current=null;setState(null);if(input.current)input.current.value="";
  try{await old?.cancel();if(mounted.current)setNotice("已取消，首页视频未更改。")}catch{if(mounted.current)setError("取消请求暂未确认，候选文件不会自动发布，将在过期后清理。")}
 }
 async function choose(file:File,originalId?:string){
  const old=transfer.current;transfer.current=null;await old?.cancel().catch(()=>{});
  if(!mounted.current)return;setError("");setNotice("");setState(null);
  const next=new HomepageTransfer(file,s=>{if(mounted.current&&transfer.current===next)setState(s)},originalId);transfer.current=next;await next.run();
 }
 async function restore(){
  if(!current?.originalId)return;setError("");setNotice("");setRestoring(true);const c=new AbortController();restoreController.current=c;
  try{const r=await fetch("/api/media/"+current.originalId,{cache:"no-store",signal:c.signal});if(!r.ok)throw new Error("无法读取已保存的原片，请刷新后重试。");const blob=await r.blob();c.signal.throwIfAborted();await choose(new File([blob],"saved-original.mp4",{type:"video/mp4"}),current.originalId)}
  catch(e){if(!c.signal.aborted)setError((e as Error).message)}finally{if(mounted.current)setRestoring(false);restoreController.current=null}
 }
 async function save(){
  if(!transfer.current||!current)return;setError("");setNotice("");
  try{const updated=await transfer.current.confirm(current.updatedAt);if(mounted.current){setCurrent(updated);transfer.current=null;setState(null);if(input.current)input.current.value="";setNotice("首页视频已更换，团队动态未改动。")}}
  catch(e){if(mounted.current)setError((e as Error).message)}
 }
 const result=state?.result,shownError=error||state?.error;
 return <section className="homepage-manager"><div className="admin-section-heading"><h1>首页视频</h1><button className="icon-button" title="刷新首页设置" aria-label="刷新首页设置" disabled={busy} onClick={refresh}><RefreshCw size={18}/></button></div>
 {shownError&&<p role="alert" className="error-message">{shownError}</p>}{notice&&<p role="status" className="success-message">{notice}</p>}
 {!current?<p className="empty-state">正在读取首页视频…</p>:<div className="homepage-workspace"><div className="homepage-preview"><p className="eyebrow">{preview?"待确认的新视频":"当前首页视频"}</p><video key={preview?.videoUrl||current.videoUrl} src={preview?.videoUrl||current.videoUrl} poster={preview?.posterUrl||current.posterUrl} controls muted playsInline loop preload="metadata" style={{aspectRatio:result?result.width+"/"+result.height:current.width+"/"+current.height}}/>{result&&!result.hasAudio&&<p className="micro">原视频没有音轨，播放时将保持无声。</p>}</div><div className="homepage-controls"><h2>{preview?"确认后，才会替换。":"更换首页影像"}</h2><p className="muted">保留完整画面、字幕与原声。上传的原片和待确认素材仅管理员可见。</p><label className="upload-control"><Upload size={20}/>{preview?"重新选择视频":"选择首页视频"}<input ref={input} aria-label="选择首页视频" type="file" accept="video/mp4" disabled={busy} onChange={e=>{const file=e.target.files?.[0];if(file)void choose(file)}}/></label><p className="micro">H.264 MP4 · 16:9或9:16 · 原文件≤50 MB</p>
 {!state&&current.originalId&&!current.hasAudio&&current.originalHasAudio&&<button className="text-link restore-audio" disabled={busy} onClick={restore}><Volume2 size={17}/>从已保存原片恢复声音</button>}
 {restoring&&!state&&<div className="video-progress" role="status"><span><LoaderCircle className="spin" size={16}/>正在读取已保存原片</span><button className="text-link" onClick={cancel}><X size={16}/>取消</button></div>}
 {state&&<div className="transfer-progress" aria-live="polite"><p className="transfer-phase">{state.busy&&<LoaderCircle className="spin" size={16}/>}<span>{state.phase}</span></p><div className="transfer-row"><div><span>视频处理</span><span>{state.processing}%</span></div><progress value={state.processing} max={100} aria-label="视频处理进度"/></div>
 {(Object.keys(names) as HeroMediaPurpose[]).map(p=>{const f=state.files[p];return <div className="transfer-row" key={p}><div><span>{names[p]}</span><span>{f.state==="done"?"已完成":f.state==="checking"?"检查中":!state.busy&&f.state==="uploading"?"等待重试":f.total?mb(f.loaded)+" / "+mb(f.total):"等待处理"}</span></div><progress value={f.state==="done"?100:f.total?f.loaded/f.total*100:0} max={100} aria-label={names[p]+"上传进度"}/></div>})}</div>}
 {result&&<dl className="video-sizes"><div><dt>原文件</dt><dd>{mb(result.original.size)}</dd></div><div><dt>首页播放版</dt><dd>{mb(result.video.size)}</dd></div><div><dt>完整时长</dt><dd>{result.duration.toFixed(1)} 秒</dd></div></dl>}
 {state&&<div className="homepage-actions">{preview&&<button className="primary-button" disabled={busy||!state.ready} onClick={save}><Check size={17}/>确认替换</button>}{state.error&&!busy&&<button className="text-link" onClick={()=>{setError("");void transfer.current?.run()}}><RefreshCw size={16}/>重试未完成步骤</button>}<button className="text-link" disabled={state.phase==="正在确认替换"} onClick={cancel}><X size={16}/>取消</button></div>}
 </div></div>}
 </section>;
}

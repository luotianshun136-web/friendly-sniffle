import {api,write} from "./client";
import type {HomepageUploadTask,HomepageVideo,HeroMediaPurpose} from "./homepage-types";
import type {OptimizedVideo,VideoInspection} from "./optimize-video";
type FileProgress={loaded:number;total:number;state:"waiting"|"uploading"|"checking"|"done"};
export type TransferState={phase:string;processing:number;busy:boolean;ready:boolean;error:string;files:Record<HeroMediaPurpose,FileProgress>;result:OptimizedVideo|null};
const fields={"hero-original":"originalId","hero-video":"videoId","hero-poster":"posterId"} as const;
export class HomepageTransfer{
 readonly id=crypto.randomUUID();
 private controller=new AbortController();
 private task:HomepageUploadTask|null=null;
 private info:VideoInspection|undefined;
 private cancelled=false;
 private committed=false;
 state:TransferState={phase:"检查视频",processing:0,busy:false,ready:false,error:"",files:{"hero-original":{loaded:0,total:0,state:"waiting"},"hero-video":{loaded:0,total:0,state:"waiting"},"hero-poster":{loaded:0,total:0,state:"waiting"}},result:null};
 constructor(readonly file:File,private changed:(state:TransferState)=>void,private originalId?:string){this.state.files["hero-original"].total=originalId?0:file.size}
 private emit(){this.changed({...this.state,files:{...this.state.files}})}
 private progress(purpose:HeroMediaPurpose,value:Partial<FileProgress>){this.state.files[purpose]={...this.state.files[purpose],...value};this.emit()}
 private async upload(blob:Blob,purpose:HeroMediaPurpose){
  const task=this.task!,key=fields[purpose];
  if(task[key]){this.progress(purpose,{loaded:this.state.files[purpose].total,state:"done"});return}
  this.progress(purpose,{loaded:0,total:blob.size,state:"uploading"});
  const signal=this.controller.signal;
  try{
   const result=await new Promise<{id:string}>((resolve,reject)=>{
    const xhr=new XMLHttpRequest();
    const abort=()=>xhr.abort();
    xhr.open("POST","/api/admin/homepage/media?purpose="+purpose+"&taskId="+task.id);xhr.setRequestHeader("Content-Type",blob.type||"video/mp4");xhr.responseType="json";
    const finish=()=>signal.removeEventListener("abort",abort);
    xhr.upload.onprogress=e=>this.progress(purpose,{loaded:Math.min(e.loaded,blob.size),state:e.loaded>=blob.size?"checking":"uploading"});
    xhr.upload.onload=()=>this.progress(purpose,{loaded:blob.size,state:"checking"});
    xhr.onload=()=>{finish();if(xhr.status>=200&&xhr.status<300&&xhr.response?.id)resolve(xhr.response);else reject(new Error(xhr.response?.error||"上传响应未完成，请重试。"))};
    xhr.onerror=()=>{finish();reject(new Error("上传连接中断，可重试未完成的文件。"))};
    xhr.onabort=()=>{finish();reject(new DOMException("上传已取消","AbortError"))};
    signal.addEventListener("abort",abort,{once:true});if(signal.aborted){finish();reject(signal.reason);return}xhr.send(blob);
   });
   task[key]=result.id;this.progress(purpose,{loaded:blob.size,state:"done"});
  }catch(error){
   if(!signal.aborted){const latest=await api<HomepageUploadTask>("/api/admin/homepage/tasks/"+task.id).catch(()=>null);if(latest?.[key]){task[key]=latest[key];this.progress(purpose,{loaded:blob.size,state:"done"});return}}
   throw error;
  }
 }
 async run(){
  if(this.state.busy||this.cancelled||this.committed)return;
  this.controller=new AbortController();const signal=this.controller.signal;this.state.busy=true;this.state.ready=false;this.state.error="";this.emit();
  try{
   const {inspectVideo,optimizeVideo}=await import("./optimize-video");
   this.info||=await inspectVideo(this.file,signal);signal.throwIfAborted();
   this.task=this.task?await api<HomepageUploadTask>("/api/admin/homepage/tasks/"+this.task.id):await api<HomepageUploadTask>("/api/admin/homepage/tasks",write("POST",{requestId:this.id,originalId:this.originalId}));
   signal.throwIfAborted();if(this.task.status!=="pending"||this.task.expiresAt<=Date.now())throw new Error("上传任务已过期或取消，请重新选择视频。");
   this.state.phase=this.info.copyVideo?"快速处理与上传":"优化与上传";this.emit();
   const original=this.upload(this.file,"hero-original").then(()=>null,error=>error as Error);
   let processed:OptimizedVideo;
   try{processed=this.state.result||await optimizeVideo(this.file,p=>{this.state.processing=p;this.emit()},signal,this.info)}catch(error){this.controller.abort();await original;throw error}
   signal.throwIfAborted();this.state.result=processed;this.state.processing=100;
   this.state.files["hero-video"].total=processed.video.size;this.state.files["hero-poster"].total=processed.poster.size;this.state.phase="上传与检查";this.emit();
   // One output lane plus the original lane keeps concurrent transfers at two.
   const output=(async()=>{await this.upload(processed.video,"hero-video");await this.upload(processed.poster,"hero-poster")})().then(()=>null,error=>error as Error);
   const errors=await Promise.all([original,output]);signal.throwIfAborted();if(errors.some(Boolean))throw errors.find(Boolean);
   this.state.ready=true;this.state.phase="已准备好，等待确认";
  }catch(error){this.state.error=this.cancelled?"已取消，首页视频未更改。":(error as Error)?.message||"处理未完成，请重试。";this.state.phase="未完成"}
  finally{this.state.busy=false;this.emit();if(this.cancelled&&this.task)await api("/api/admin/homepage/tasks/"+this.task.id,{method:"DELETE"}).catch(()=>{})}
 }
 async confirm(updatedAt:number):Promise<HomepageVideo>{
  if(!this.task||!this.state.ready||this.cancelled||this.state.busy)throw new Error("请等待上传和检查完成。");
  const task=this.task;this.state.busy=true;this.state.phase="正在确认替换";this.state.error="";this.emit();
  try{
   let updated:HomepageVideo;
   try{updated=await api<HomepageVideo>("/api/admin/homepage",write("PATCH",{taskId:task.id,originalId:task.originalId,videoId:task.videoId,posterId:task.posterId,updatedAt}))}
   catch(error){const latest=await api<HomepageVideo>("/api/admin/homepage").catch(()=>null);if(latest?.videoId!==task.videoId||latest?.originalId!==task.originalId||latest?.posterId!==task.posterId)throw error;updated=latest}
   this.committed=true;this.state.ready=false;return updated;
  }catch(error){this.state.error=(error as Error).message;throw error}
  finally{this.state.busy=false;this.state.phase=this.committed?"已发布":"等待重新确认";this.emit()}
 }
 async cancel(){
  if(this.committed)return;
  this.cancelled=true;this.controller.abort();this.state.ready=false;
  if(this.task)await api("/api/admin/homepage/tasks/"+this.task.id,{method:"DELETE"});
 }
}

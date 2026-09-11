import {database,field,HttpError} from "./server";
import {DEFAULT_HOMEPAGE,type HomepageVideo} from "./homepage-types";
import {mediaHasAudio} from "./media";
import {getUploadTask} from "./homepage-uploads";
type Setting={originalId:string|null;videoId:string|null;posterId:string|null;updatedAt:number;width:number;height:number;hasAudio:number|null};
export async function getHomepage(details=false):Promise<HomepageVideo>{
 const row=await database().prepare("SELECT h.*,m.width,m.height,m.hasAudio FROM homepage_settings h LEFT JOIN media m ON h.videoId=m.id WHERE h.id='main'").first<Setting>();
 if(!row?.videoId)return {...DEFAULT_HOMEPAGE,updatedAt:row?.updatedAt||0};
 return {...row,hasAudio:!!row.hasAudio,...(details&&row.originalId?{originalHasAudio:await mediaHasAudio(row.originalId)}:{}),videoUrl:"/api/media/"+row.videoId,posterUrl:"/api/media/"+row.posterId};
}
export async function updateHomepage(body:Record<string,unknown>){
 const originalId=field(body.originalId,80,true),videoId=field(body.videoId,80,true),posterId=field(body.posterId,80,true);
 const db=database();
 const taskId=field(body.taskId,36);
 if(taskId){const task=await getUploadTask(taskId);if(task.originalId!==originalId||task.videoId!==videoId||task.posterId!==posterId||task.status!=="pending"||task.expiresAt<=Date.now())throw new HttpError(409,"上传任务尚未完成、已取消或已过期，请刷新检查。");}
 const r=await db.prepare("SELECT * FROM media WHERE id IN (?,?,?)").bind(originalId,videoId,posterId).all<{id:string;purpose:string;width:number;height:number;durationMs:number|null}>();
 const original=r.results.find(m=>m.id===originalId&&m.purpose==="hero-original"),video=r.results.find(m=>m.id===videoId&&m.purpose==="hero-video"),poster=r.results.find(m=>m.id===posterId&&m.purpose==="hero-poster");
 if(!original||!video||!poster)throw new HttpError(400,"请完成原视频、优化视频与封面的上传。");
 if(await mediaHasAudio(originalId)&&!await mediaHasAudio(videoId))throw new HttpError(400,"原视频有声音，但播放版丢失了音轨。请从原片重新处理，首页未更改。");
 if(Math.abs(original.width/original.height-video.width/video.height)>.01||poster.width!==video.width||poster.height!==video.height||!original.durationMs||!video.durationMs||Math.abs(original.durationMs-video.durationMs)>350)throw new HttpError(400,"视频与封面不匹配，请重新处理。");
 const previous=Number(body.updatedAt);if(!Number.isSafeInteger(previous)||previous<0)throw new HttpError(400,"请刷新当前首页设置。");
 // Optimistic concurrency keeps an older browser tab from replacing a newer edit.
 const now=Math.max(Date.now(),previous+1);
 const update=db.prepare("INSERT INTO homepage_settings (id,originalId,videoId,posterId,updatedAt) SELECT 'main',?,?,?,? WHERE (?=0 OR EXISTS (SELECT 1 FROM homepage_settings WHERE id='main')) AND (?='' OR EXISTS (SELECT 1 FROM homepage_upload_tasks WHERE id=? AND status='pending' AND expiresAt>?)) ON CONFLICT(id) DO UPDATE SET originalId=excluded.originalId,videoId=excluded.videoId,posterId=excluded.posterId,updatedAt=excluded.updatedAt WHERE homepage_settings.updatedAt=?").bind(originalId,videoId,posterId,now,previous,taskId,taskId,now,previous);
 const results=await db.batch(taskId?[update,db.prepare("UPDATE homepage_upload_tasks SET status='committed' WHERE id=? AND status='pending' AND EXISTS (SELECT 1 FROM homepage_settings WHERE videoId=? AND updatedAt=?)").bind(taskId,videoId,now)]:[update]);
 if(!results[0].meta.changes)throw new HttpError(409,"首页视频或上传任务已变化，请刷新后再试。");
 return getHomepage(true);
}

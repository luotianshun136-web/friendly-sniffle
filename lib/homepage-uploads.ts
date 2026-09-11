import {database,runtime,field,HttpError} from "./server";
import {uploadMedia} from "./media";
import type {HomepageUploadTask,HeroMediaPurpose} from "./homepage-types";
const purposes:HeroMediaPurpose[]=["hero-original","hero-video","hero-poster"];
type TaskRow={id:string;status:HomepageUploadTask["status"];expiresAt:number};
export async function deleteUnusedMedia(id:string){
 const m=await database().prepare("DELETE FROM media WHERE id=? AND NOT EXISTS (SELECT 1 FROM homepage_settings WHERE originalId=media.id OR videoId=media.id OR posterId=media.id) AND NOT EXISTS (SELECT 1 FROM posts WHERE mediaId=media.id) RETURNING storageKey").bind(id).first<{storageKey:string}>();
 if(m&&m.storageKey!=="@hero")await runtime().BUCKET.delete(m.storageKey);
}
async function cleanupTask(id:string){
 const items=await database().prepare("SELECT i.mediaId FROM homepage_upload_items i JOIN homepage_upload_tasks t ON t.id=i.taskId WHERE t.id=? AND t.status='cancelled' AND i.owned=1 AND i.mediaId IS NOT NULL").bind(id).all<{mediaId:string}>();
 for(const item of items.results)await deleteUnusedMedia(item.mediaId);
}
export async function cleanupExpiredUploads(){
 const db=database(),rows=await db.prepare("SELECT id FROM homepage_upload_tasks WHERE status='pending' AND expiresAt<=? LIMIT 5").bind(Date.now()).all<{id:string}>();
 for(const row of rows.results)await cancelUploadTask(row.id);
 const cancelled=await db.prepare("SELECT DISTINCT t.id FROM homepage_upload_tasks t JOIN homepage_upload_items i ON i.taskId=t.id WHERE t.status='cancelled' AND i.owned=1 AND i.mediaId IS NOT NULL LIMIT 5").all<{id:string}>();
 for(const row of cancelled.results)await cleanupTask(row.id);
}
export async function getUploadTask(id:string):Promise<HomepageUploadTask>{
 const db=database(),t=await db.prepare("SELECT id,status,expiresAt FROM homepage_upload_tasks WHERE id=?").bind(id).first<TaskRow>();
 if(!t)throw new HttpError(404,"上传任务不存在，请重新选择视频。");
 const items=await db.prepare("SELECT purpose,mediaId FROM homepage_upload_items WHERE taskId=?").bind(id).all<{purpose:HeroMediaPurpose;mediaId:string|null}>();
 const value=(purpose:HeroMediaPurpose)=>items.results.find(i=>i.purpose===purpose)?.mediaId||null;
 return {...t,originalId:value("hero-original"),videoId:value("hero-video"),posterId:value("hero-poster")};
}
export async function createUploadTask(body:Record<string,unknown>){
 const id=body.requestId?field(body.requestId,36,true):crypto.randomUUID();
 if(!/^[0-9a-f-]{36}$/.test(id))throw new HttpError(400,"上传任务标识无效。");
 const db=database();if(await db.prepare("SELECT id FROM homepage_upload_tasks WHERE id=?").bind(id).first())return getUploadTask(id);
 const originalId=field(body.originalId,80);
 if(originalId&&!await db.prepare("SELECT m.id FROM media m JOIN homepage_settings h ON h.originalId=m.id WHERE m.id=? AND m.purpose='hero-original'").bind(originalId).first())throw new HttpError(400,"已保存原片已变化，请刷新后重试。");
 const now=Date.now();
 await db.batch([db.prepare("INSERT INTO homepage_upload_tasks (id,status,createdAt,expiresAt) VALUES (?,'pending',?,?)").bind(id,now,now+86400000),...purposes.map(p=>db.prepare("INSERT INTO homepage_upload_items (id,taskId,purpose,mediaId,owned,leaseUntil) VALUES (?,?,?,?,?,0)").bind(crypto.randomUUID(),id,p,p==="hero-original"&&originalId?originalId:null,p==="hero-original"&&originalId?0:1))]);
 return getUploadTask(id);
}
export async function cancelUploadTask(id:string){
 const db=database();await db.prepare("UPDATE homepage_upload_tasks SET status='cancelled' WHERE id=? AND status='pending'").bind(id).run();
 const t=await getUploadTask(id);if(t.status==="committed")throw new HttpError(409,"此视频已确认发布，不会取消正在使用的首页。");
 await cleanupTask(id);return {ok:true};
}
export async function uploadTaskMedia(req:Request,purpose:HeroMediaPurpose,taskId:string){
 const t=await getUploadTask(taskId);if(t.status!=="pending"||t.expiresAt<=Date.now())throw new HttpError(409,"上传任务已取消或过期，请重新选择视频。");
 const db=database(),item=await db.prepare("SELECT id,mediaId FROM homepage_upload_items WHERE taskId=? AND purpose=?").bind(taskId,purpose).first<{id:string;mediaId:string|null}>();
 if(!item)throw new HttpError(400,"上传素材类型无效。");
 if(item.mediaId)return {id:item.mediaId};
 const lease=crypto.randomUUID(),now=Date.now();
 const claim=await db.prepare("UPDATE homepage_upload_items SET leaseToken=?,leaseUntil=? WHERE id=? AND mediaId IS NULL AND leaseUntil<=? AND EXISTS (SELECT 1 FROM homepage_upload_tasks WHERE id=? AND status='pending' AND expiresAt>?)").bind(lease,now+1800000,item.id,now,taskId,now).run();
 if(!claim.meta.changes)throw new HttpError(409,"文件仍在上传或检查中，请稍后重试；已完成的文件不会重复上传。");
 let mediaId:string|undefined;
 try{
  const media=await uploadMedia(req,purpose);mediaId=media.id;
  const link=await db.prepare("UPDATE homepage_upload_items SET mediaId=?,leaseToken=NULL,leaseUntil=0 WHERE id=? AND leaseToken=? AND EXISTS (SELECT 1 FROM homepage_upload_tasks WHERE id=? AND status='pending' AND expiresAt>?)").bind(media.id,item.id,lease,taskId,Date.now()).run();
  if(!link.meta.changes)throw new HttpError(409,"上传已取消，首页未更改。");
  return media;
 }catch(error){if(mediaId)await deleteUnusedMedia(mediaId);throw error}
 finally{await db.prepare("UPDATE homepage_upload_items SET leaseToken=NULL,leaseUntil=0 WHERE id=? AND leaseToken=?").bind(item.id,lease).run()}
}

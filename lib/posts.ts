import {database,field,HttpError} from "./server";
import {matchingFrame,postOptions} from "./post-validation";

export const POST_SELECT="SELECT p.*,m.kind,m.width,m.height FROM posts p JOIN media m ON p.mediaId=m.id ";
export function presentPost(p:Record<string,unknown>){return {...p,loop:!!p.loop,posterUrl:p.posterId?"/api/media/"+p.posterId:null}}
export async function savePost(id:string,body:Record<string,unknown>,creating:boolean){
  const db=database(),previous=creating?null:await db.prepare("SELECT mediaId,posterId,loop,status FROM posts WHERE id=?").bind(id).first<{mediaId:string;posterId:string|null;loop:number;status:string}>();
  if(!creating&&!previous)throw new HttpError(404,"帖子不存在。");
  const title=field(body.title,100,true),text=field(body.body,3000),mediaId=field(body.mediaId,80,true),status=body.status==="published"?"published":"draft";
  const media=await db.prepare("SELECT kind,width,height FROM media WHERE id=? AND purpose='post'").bind(mediaId).first<{kind:string;width:number;height:number}>();
  if(!media)throw new HttpError(400,"请先上传动态媒体；首页原文件不能发布为帖子。");
  const same=previous?.mediaId===mediaId;
  let options:ReturnType<typeof postOptions>;
  try{options=postOptions(body,same,previous||undefined)}catch(error){throw new HttpError(400,(error as Error).message)}
  const {posterId,loop}=options;
  if(media.kind!=="video"&&(posterId||loop))throw new HttpError(400,"图片动态不需要视频封面或循环播放。");
  if(posterId){
    const poster=await db.prepare("SELECT kind,mime,width,height,size FROM media WHERE id=? AND purpose='post-poster'").bind(posterId).first<{kind:string;mime:string;width:number;height:number;size:number}>();
    if(!poster||poster.kind!=="image"||poster.mime!=="image/webp"||Math.max(poster.width,poster.height)>960||poster.size>250000||!matchingFrame(poster.width,poster.height,media.width,media.height))throw new HttpError(400,"封面与视频不匹配，请重新生成或选择相同画幅的封面。");
  }
  if(status==="published"&&media.kind==="video"&&!posterId&&(!same||previous?.status!=="published"))throw new HttpError(400,"发布视频前请先生成或上传封面。");
  const now=Date.now();
  if(creating)await db.prepare("INSERT INTO posts (id,title,body,mediaId,posterId,loop,status,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?)").bind(id,title,text,mediaId,posterId,loop?1:0,status,now,now).run();
  else await db.prepare("UPDATE posts SET title=?,body=?,mediaId=?,posterId=?,loop=?,status=?,updatedAt=? WHERE id=?").bind(title,text,mediaId,posterId,loop?1:0,status,now,id).run();
  return {ok:true,id};
}

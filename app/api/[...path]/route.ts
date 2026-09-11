import {database,runtime,json,HttpError,checkOrigin,payload,field,passwordField,throttle,visitor,digest} from "@/lib/server";
import {uploadMedia,serveMedia} from "@/lib/media";
import {AUTO_REPLY,type Conversation} from "@/lib/types";
import {getHomepage,updateHomepage} from "@/lib/homepage";
import {createUploadTask,getUploadTask,cancelUploadTask,cleanupExpiredUploads,uploadTaskMedia} from "@/lib/homepage-uploads";
import {findConsultationTopic} from "@/lib/consultation-topics";
export const dynamic="force-dynamic";
const POST_SELECT="SELECT p.*,m.kind,m.width,m.height FROM posts p JOIN media m ON p.mediaId=m.id ";
async function handle(req:Request):Promise<Response>{
 try{
  const url=new URL(req.url),path=url.pathname.slice(5),method=req.method,db=database();
  if(method!=="GET"&&method!=="HEAD")checkOrigin(req);
  if(path.startsWith("auth/")){
    const {auth}=await import("@/lib/auth");
    const endpoint=path.slice(5);
    if(!["sign-in/username","sign-out","get-session"].includes(endpoint))throw new HttpError(404,"入口不存在。");
    if(method==="POST")await throttle("auth:"+req.headers.get("cf-connecting-ip")+":"+endpoint,10,600);
    const response=await auth().handler(req);const headers=new Headers(response.headers);headers.set("Cache-Control","no-store");return new Response(response.body,{status:response.status,headers});
  }
  if(path==="setup"&&method==="POST"){
    const token=runtime().BOOTSTRAP_TOKEN;if(!token||await digest(req.headers.get("x-setup-key")||"")!==await digest(token))throw new HttpError(403,"无权初始化。");
    if(await db.prepare("SELECT id FROM user LIMIT 1").first())throw new HttpError(409,"管理员已初始化。");
    const body=await payload(req),password=field(body.password,128,true);if(password.length<16)throw new HttpError(400,"初始密码过短。");
    const {hashPassword}=await import("better-auth/crypto"),{OWNER_ID}=await import("@/lib/auth");
    const now=Date.now(),hash=await hashPassword(password);
    await db.batch([
      db.prepare("INSERT INTO user (id,name,email,emailVerified,createdAt,updatedAt,username,displayUsername,mustChangePassword) VALUES (?,?,?,0,?,?,?,?,1)").bind(OWNER_ID,"卡彭","owner@capone.invalid",now,now,"capone","capone"),
      db.prepare("INSERT INTO account (id,accountId,providerId,userId,password,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?)").bind(crypto.randomUUID(),OWNER_ID,"credential",OWNER_ID,hash,now,now),
      db.prepare("INSERT INTO media (id,storageKey,mime,kind,width,height,size,createdAt) VALUES ('team-film','@hero','video/mp4','video',720,1280,3368662,?)").bind(now),
      db.prepare("INSERT INTO posts (id,title,body,mediaId,status,createdAt,updatedAt) VALUES ('team-film',?,?, 'team-film','published',?,?)").bind("团队影像 · 女性吸睛私人定制","每一份委托，始于认真了解。仅接待成年女性，先评估，后承接。",now,now)
    ]);return json({ok:true});
  }
  if(path==="posts"&&method==="GET"){
    const offset=Math.max(0,Math.min(100000,Number(url.searchParams.get("offset"))||0));
    const r=await db.prepare(POST_SELECT+"WHERE p.status='published' ORDER BY p.createdAt DESC,p.id DESC LIMIT 13 OFFSET ?").bind(offset).all();
    return json({posts:r.results.slice(0,12),hasMore:r.results.length>12});
  }
  if(path.startsWith("media/")&&method==="GET"){
    return await serveMedia(req,path.slice(6));
  }
  if(path==="chat"){
    const v=await visitor(req,method==="GET");if(!v)throw new HttpError(401,"请重新打开咨询窗口。");
    const headers:HeadersInit=v.cookie?{"Set-Cookie":v.cookie}:{};
    if(method==="GET"){
      const before=Number(url.searchParams.get("before"))||Number.MAX_SAFE_INTEGER;
      const conversation=await db.prepare("SELECT nickname,contact FROM conversations WHERE id=?").bind(v.id).first();
      const rows=await db.prepare("SELECT id,role,body,sourceTitle,createdAt FROM messages WHERE conversationId=? AND createdAt<? ORDER BY createdAt DESC,id DESC LIMIT 101").bind(v.id,before).all();
      return json({conversation,messages:rows.results.slice(0,100).reverse(),hasMore:rows.results.length>100},200,headers);
    }
    if(method==="POST"){
      await throttle("chat:"+v.id,20);await throttle("chat-ip:"+req.headers.get("cf-connecting-ip"),80);
      const body=await payload(req),message=field(body.message,2000,true),requestId=field(body.requestId,80,true);
      if(!/^[a-zA-Z0-9-]{16,80}$/.test(requestId))throw new HttpError(400,"消息标识无效。");
      const nickname=field(body.nickname,80),contact=field(body.contact,200),sourceId=field(body.sourceId,80),topicId=field(body.topicId,80);
      if(sourceId&&topicId)throw new HttpError(400,"一次留言只能选择一个咨询来源。");
      const topic=topicId?findConsultationTopic(topicId):null;
      if(topicId&&!topic)throw new HttpError(400,"所选咨询情境不存在，请重新选择。");
      const source=topic?{title:topic.title}:sourceId?await db.prepare("SELECT title FROM posts WHERE id=? AND status='published'").bind(sourceId).first<{title:string}>():null;
      const old=await db.prepare("SELECT id FROM messages WHERE conversationId=? AND requestId=?").bind(v.id,requestId).first();
      if(old)return json({ok:true});
      const now=Date.now();
      // A stable conversation key and unique request IDs make retries safe.
      await db.batch([
        db.prepare("INSERT INTO conversations (id,nickname,contact,sourceTitle,status,unread,createdAt,updatedAt) VALUES (?,?,?,?,'open',0,?,?) ON CONFLICT(id) DO UPDATE SET nickname=CASE WHEN excluded.nickname<>'' THEN excluded.nickname ELSE nickname END,contact=CASE WHEN excluded.contact<>'' THEN excluded.contact ELSE contact END,status='open'").bind(v.id,nickname,contact,source?.title||null,now,now),
        db.prepare("INSERT OR IGNORE INTO messages (id,conversationId,requestId,role,body,sourceTitle,createdAt) VALUES (?,?,?,'visitor',?,?,?)").bind(crypto.randomUUID(),v.id,requestId,message,source?.title||null,now),
        db.prepare("UPDATE conversations SET unread=unread+changes(),updatedAt=? WHERE id=?").bind(now+1,v.id),
        db.prepare("INSERT OR IGNORE INTO messages (id,conversationId,requestId,role,body,createdAt) VALUES (?,?,'auto-reply','auto',?,?)").bind("auto-"+v.id,v.id,AUTO_REPLY,now+1)
      ]);return json({ok:true});
    }
  }
  if(path.startsWith("admin/")){
    const {admin,auth,OWNER_ID}=await import("@/lib/auth");
    const endpoint=path.slice(6),s=await admin(req,endpoint==="me"||endpoint==="password");
    if(endpoint==="homepage"||endpoint==="homepage/tasks")await cleanupExpiredUploads();
    if(endpoint==="me"&&method==="GET")return json({username:s.user.username,mustChangePassword:s.user.mustChangePassword});
    if(endpoint==="password"&&method==="POST"){
      await throttle("change-password",5,600);const b=await payload(req),currentPassword=passwordField(b.currentPassword),newPassword=passwordField(b.newPassword);
      if(newPassword.length<5||newPassword===currentPassword)throw new HttpError(400,"新密码至少5位，且不能与旧密码相同。");
      const response=await auth().api.changePassword({headers:req.headers,body:{currentPassword,newPassword,revokeOtherSessions:true},asResponse:true});
      if(!response.ok)return response;
      await db.prepare("UPDATE user SET mustChangePassword=0,updatedAt=? WHERE id=?").bind(Date.now(),OWNER_ID).run();
      return response;
    }
    if(endpoint==="conversations"&&method==="GET"){
      const status=url.searchParams.get("status")==="archived"?"archived":"open",offset=Math.max(0,Number(url.searchParams.get("offset"))||0);
      const r=await db.prepare("SELECT * FROM conversations WHERE status=? ORDER BY updatedAt DESC LIMIT 51 OFFSET ?").bind(status,offset).all();return json({conversations:r.results.slice(0,50),hasMore:r.results.length>50});
    }
    if(endpoint.startsWith("conversations/")){
      const id=endpoint.slice(14),c=await db.prepare("SELECT * FROM conversations WHERE id=?").bind(id).first<Conversation>();
      if(!c)throw new HttpError(404,"会话不存在。");
      if(method==="GET"){const before=Number(url.searchParams.get("before"))||Number.MAX_SAFE_INTEGER;const r=await db.prepare("SELECT id,role,body,sourceTitle,createdAt FROM messages WHERE conversationId=? AND createdAt<? ORDER BY createdAt DESC,id DESC LIMIT 101").bind(id,before).all();return json({conversation:c,messages:r.results.slice(0,100).reverse(),hasMore:r.results.length>100})}
      if(method==="DELETE"){await db.batch([db.prepare("DELETE FROM messages WHERE conversationId=?").bind(id),db.prepare("DELETE FROM conversations WHERE id=?").bind(id)]);return json({ok:true})}
      const b=await payload(req);
      if(method==="PATCH"){
        if(b.action==="read"){await db.prepare("UPDATE conversations SET unread=0 WHERE id=? AND updatedAt<=?").bind(id,Number(b.seenAt)||0).run();}
        else{const status=b.status==="archived"?"archived":"open";await db.prepare("UPDATE conversations SET status=? WHERE id=?").bind(status,id).run();}
        return json({ok:true});
      }
      if(method==="POST"){
        const message=field(b.message,2000,true),rid=field(b.requestId,80,true),now=Date.now();
        await db.batch([db.prepare("INSERT OR IGNORE INTO messages (id,conversationId,requestId,role,body,createdAt) VALUES (?,?,?,'admin',?,?)").bind(crypto.randomUUID(),id,rid,message,now),db.prepare("UPDATE conversations SET updatedAt=?,status='open' WHERE id=?").bind(now,id)]);
        return json({ok:true});
      }
    }
    if(endpoint==="homepage"&&method==="GET")return json(await getHomepage(true));
    if(endpoint==="homepage"&&method==="PATCH")return json(await updateHomepage(await payload(req)));
    if(endpoint==="homepage/tasks"&&method==="POST"){await throttle("homepage-task",20,600);return json(await createUploadTask(await payload(req)),201)}
    if(endpoint.startsWith("homepage/tasks/")){
      const taskId=endpoint.slice("homepage/tasks/".length);
      if(method==="GET")return json(await getUploadTask(taskId));
      if(method==="DELETE")return json(await cancelUploadTask(taskId));
    }
    if(endpoint==="homepage/media"&&method==="POST"){
      await throttle("upload",15,600);const purpose=url.searchParams.get("purpose");
      if(purpose!=="hero-original"&&purpose!=="hero-video"&&purpose!=="hero-poster")throw new HttpError(400,"素材用途不正确。");
      const taskId=url.searchParams.get("taskId");
      return json(taskId?await uploadTaskMedia(req,purpose,taskId):await uploadMedia(req,purpose),201);
    }
    if(endpoint==="media"&&method==="POST"){await throttle("upload",15,600);return json(await uploadMedia(req),201)}
    if(endpoint.startsWith("media/")&&method==="DELETE"){
      const id=endpoint.slice(6);if(await db.prepare("SELECT id FROM posts WHERE mediaId=?").bind(id).first())throw new HttpError(409,"此媒体仍被帖子使用。");
      if(await db.prepare("SELECT id FROM homepage_settings WHERE originalId=? OR videoId=? OR posterId=?").bind(id,id,id).first())throw new HttpError(409,"此素材正在用于首页，不能删除。");
      let m:{storageKey:string}|null;
      try{m=await db.prepare("DELETE FROM media WHERE id=? RETURNING storageKey").bind(id).first<{storageKey:string}>()}catch{throw new HttpError(409,"此素材正在使用，请刷新后重试。");}
      if(m&&m.storageKey!=="@hero")await runtime().BUCKET.delete(m.storageKey);return json({ok:true});
    }
    if(endpoint==="posts"&&method==="GET"){
      const offset=Math.max(0,Number(url.searchParams.get("offset"))||0),r=await db.prepare(POST_SELECT+"ORDER BY p.createdAt DESC,p.id DESC LIMIT 25 OFFSET ?").bind(offset).all();
      return json({posts:r.results.slice(0,24),hasMore:r.results.length>24});
    }
    if((endpoint==="posts"&&method==="POST")||(endpoint.startsWith("posts/")&&method==="PATCH")){
      const id=method==="POST"?crypto.randomUUID():endpoint.slice(6),b=await payload(req),title=field(b.title,100,true),body=field(b.body,3000),mediaId=field(b.mediaId,80,true),status=b.status==="published"?"published":"draft",now=Date.now();
      if(!await db.prepare("SELECT id FROM media WHERE id=? AND purpose='post'").bind(mediaId).first())throw new HttpError(400,"请先上传动态媒体；首页原文件不能发布为帖子。");
      if(method==="POST")await db.prepare("INSERT INTO posts (id,title,body,mediaId,status,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?)").bind(id,title,body,mediaId,status,now,now).run();
      else{const previous=await db.prepare("SELECT mediaId FROM posts WHERE id=?").bind(id).first();if(!previous)throw new HttpError(404,"帖子不存在。");await db.prepare("UPDATE posts SET title=?,body=?,mediaId=?,status=?,updatedAt=? WHERE id=?").bind(title,body,mediaId,status,now,id).run();}
      return json({ok:true,id});
    }
    if(endpoint.startsWith("posts/")&&method==="DELETE"){await db.prepare("DELETE FROM posts WHERE id=?").bind(endpoint.slice(6)).run();return json({ok:true})}
  }
  throw new HttpError(404,"入口不存在。");
 }catch(error){if(error instanceof HttpError)return json({error:error.message},error.status);console.error("capone_api_failure",error instanceof Error?error.name:"UnknownError");return json({error:"暂时无法完成操作，请稍后重试。"},503)}
}
export const GET=handle;export const POST=handle;export const PATCH=handle;export const DELETE=handle;

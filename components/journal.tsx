"use client";
import {useEffect,useState} from "react";
import {ArrowUpRight,ArrowDown,RefreshCw} from "lucide-react";
import type {Post} from "@/lib/types";
import {api} from "@/lib/client";
import {JournalVideo} from "./journal-video";
export function Journal({onConsult}:{onConsult:(p:Post)=>void}){
 const [posts,setPosts]=useState<Post[]>([]),[more,setMore]=useState(false),[error,setError]=useState(""),[busy,setBusy]=useState(true);
 async function load(offset=0){setBusy(true);setError("");try{const d=await api<{posts:Post[];hasMore:boolean}>("/api/posts?offset="+offset);setPosts(p=>offset?[...p,...d.posts]:d.posts);setMore(d.hasMore)}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 useEffect(()=>{load()},[]);
 return <section className="section journal-section"><div className="section-heading"><div><p className="eyebrow">THE JOURNAL</p><h2>团队动态</h2></div><p>一些影像，一些记录。<br/>让了解，从这里发生。</p></div>
 {error?<div className="empty-state"><p>{error}</p><button className="text-link" onClick={()=>load()}><RefreshCw size={16}/>重新加载</button></div>:!posts.length?<p className="empty-state">{busy?"正在载入团队动态…":"新的记录，正在准备。"}</p>:<div className="journal-grid">{posts.map((p,index)=><article className={"journal-post "+(p.height>p.width?"portrait":"landscape")} key={p.id}><div className="post-media" style={{aspectRatio:p.width+"/"+p.height}}>{p.kind==="video"?<JournalVideo key={p.mediaId+":"+p.posterId} post={p}/>:<img src={"/api/media/"+p.mediaId} width={p.width} height={p.height} loading="lazy" alt={p.title}/>}</div><div className="post-caption"><span className="post-meta">{String(index+1).padStart(2,"0")} / {new Date(p.createdAt).toLocaleDateString("zh-CN")}</span><h3>{p.title}</h3><p>{p.body}</p><button className="text-link" onClick={()=>onConsult(p)}>私信咨询 <ArrowUpRight size={16}/></button></div></article>)}</div>}
 {more&&<button className="text-link load-more" onClick={()=>load(posts.length)} disabled={busy}>更多动态 <ArrowDown size={16}/></button>}</section>
}

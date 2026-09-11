"use client";
import {useLayoutEffect,useRef,useState} from "react";
import {Play,ImageOff} from "lucide-react";
import type {Post} from "@/lib/types";
import {useBackgroundPlayback} from "./playback-context";

export function JournalVideo({post}:{post:Post}){
  const {suspended,register}=useBackgroundPlayback(),video=useRef<HTMLVideoElement>(null),position=useRef(0);
  const [active,setActive]=useState(false),[error,setError]=useState(false),[coverError,setCoverError]=useState(false);
  useLayoutEffect(()=>register(()=>{
    const v=video.current;
    if(v){position.current=v.currentTime;v.muted=true;v.pause();v.style.display="none";v.removeAttribute("src");v.load()}
    setActive(false);
  }),[register]);
  return <div className="journal-video" style={{aspectRatio:post.width+"/"+post.height}}>
    {post.posterUrl&&!coverError?<img src={post.posterUrl} width={post.width} height={post.height} alt={post.title+" · 视频封面"} loading="lazy" onError={()=>setCoverError(true)}/>:<div className="post-cover-fallback"><ImageOff size={24}/><span>卡彭团队 · 影像记录</span></div>}
    {active&&!suspended?<video ref={video} src={"/api/media/"+post.mediaId} poster={post.posterUrl||undefined} controls autoPlay loop={post.loop} playsInline disablePictureInPicture disableRemotePlayback controlsList="nodownload noremoteplayback" preload="none" onLoadedMetadata={e=>{e.currentTarget.currentTime=Math.min(position.current,Math.max(0,e.currentTarget.duration-.05))}} onError={()=>{setActive(false);setError(true)}}/>:
      <button type="button" className="post-play" aria-label={(error?"重试播放":"播放")+post.title} title={error?"重试播放":"播放视频"} disabled={suspended} onClick={()=>{setError(false);setActive(true)}}><Play size={25}/></button>}
    {error&&<span className="post-video-error" role="status">视频暂时无法播放，请重试</span>}
  </div>;
}

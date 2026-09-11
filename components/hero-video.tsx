"use client";
import {useEffect,useLayoutEffect,useRef,useState} from "react";
import {Pause,Play,Volume2,VolumeX} from "lucide-react";
import type {HomepageVideo} from "@/lib/homepage-types";
import {useBackgroundPlayback} from "./playback-context";
export function HeroVideo({config}:{config:Pick<HomepageVideo,"videoUrl"|"posterUrl"|"width"|"height"|"hasAudio">}){
 const video=useRef<HTMLVideoElement>(null),poster=useRef<HTMLImageElement>(null),resume=useRef({time:0,play:true,detached:false});
 const {suspended,register}=useBackgroundPlayback();
 const [start,setStart]=useState(false),[playing,setPlaying]=useState(false),[failed,setFailed]=useState(false),[muted,setMuted]=useState(true);
 useLayoutEffect(()=>register(()=>{
  const v=video.current;if(!v||resume.current.detached)return;
  resume.current={time:v.currentTime,play:!v.paused,detached:true};
  // Release native Android video surfaces before the consultation is opened.
  v.muted=true;v.pause();v.style.display="none";v.removeAttribute("src");v.load();setMuted(true);setPlaying(false);
 }),[register]);
 useEffect(()=>{
  resume.current={time:0,play:!matchMedia("(prefers-reduced-motion: reduce)").matches,detached:false};
  let a=0,b=0,cancelled=false;
  const ready=()=>{a=requestAnimationFrame(()=>{b=requestAnimationFrame(()=>{if(!cancelled)setStart(true)})})};
  const img=poster.current;if(img?.complete)ready();else{img?.addEventListener("load",ready,{once:true});img?.addEventListener("error",ready,{once:true})}
  const fallback=setTimeout(ready,1800);
  return()=>{cancelled=true;clearTimeout(fallback);cancelAnimationFrame(a);cancelAnimationFrame(b);img?.removeEventListener("load",ready);img?.removeEventListener("error",ready)};
 },[config.videoUrl]);
 useEffect(()=>{
  if(suspended||!start)return;
  const v=video.current;if(!v)return;
  if(resume.current.play)v.play().catch(()=>setPlaying(false));
 },[start,suspended]);
 function ready(){
  const v=video.current;if(!v||suspended)return;
  if(resume.current.detached){v.currentTime=Math.min(resume.current.time,Math.max(0,v.duration-.05));resume.current.detached=false;if(resume.current.play)v.play().catch(()=>setPlaying(false))}
 }
 async function toggle(){const v=video.current;if(!v||suspended)return;if(!v.paused){resume.current.play=false;v.pause();return}resume.current.play=true;if(!start){setStart(true);return}try{if(v.error)v.load();await v.play()}catch{setPlaying(false)}}
 async function sound(){const v=video.current;if(!v||suspended||!config.hasAudio)return;const next=!v.muted;if(!start){v.src=config.videoUrl;setStart(true)}v.muted=next;setMuted(next);if(!next){resume.current.play=true;try{if(v.error)v.load();await v.play()}catch{v.muted=true;setMuted(true);setPlaying(false)}}}
 return <div className={"hero-film "+(config.width>config.height?"is-landscape":"")} style={{aspectRatio:config.width+"/"+config.height}}>
  <img ref={poster} className="hero-cover" src={config.posterUrl} width={config.width} height={config.height} alt="卡彭团队 · 女性吸睛私人定制" fetchPriority="high" loading="eager"/>
  {!suspended&&<><video ref={video} src={start?config.videoUrl:undefined} poster={config.posterUrl} width={config.width} height={config.height} muted={muted} loop playsInline disablePictureInPicture disableRemotePlayback controlsList="nodownload noremoteplayback" preload={resume.current.detached?"metadata":"none"} style={{opacity:failed?0:1}} onLoadedMetadata={ready} onPlaying={()=>{setPlaying(true);setFailed(false)}} onPause={()=>setPlaying(false)} onVolumeChange={e=>setMuted(e.currentTarget.muted)} onError={()=>{setPlaying(false);setFailed(true)}}/>
  <div className="film-controls"><button className="film-sound" aria-label={config.hasAudio?(muted?"开启首页视频声音":"关闭首页视频声音"):"原视频无声音"} title={config.hasAudio?(muted?"开启声音":"关闭声音"):"原视频无声音"} aria-pressed={!muted} disabled={!config.hasAudio} onClick={sound}>{muted?<VolumeX size={17}/>:<Volume2 size={17}/>}</button><button className="film-toggle" aria-label={playing?"暂停首页视频":"播放首页视频"} title={playing?"暂停":"播放"} onClick={toggle}>{playing?<Pause size={17}/>:<Play size={17}/>}</button></div></>}
 </div>;
}

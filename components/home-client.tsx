"use client";
import {createContext,lazy,Suspense,useCallback,useContext,useEffect,useRef,useState,type ReactNode} from "react";
import {PlaybackContext} from "./playback-context";
import {Check,Copy,MessageCircle} from "lucide-react";
import type {ConsultSource} from "@/lib/types";
const Consultation=lazy(()=>import("./consultation").then(m=>({default:m.Consultation})));
const Journal=lazy(()=>import("./journal").then(m=>({default:m.Journal})));
const Privacy=lazy(()=>import("./privacy"));
type Source=ConsultSource;
const ConsultContext=createContext<(source?:Source)=>void>(()=>{});
export function HomeProvider({children}:{children:ReactNode}){
 const [open,setOpen]=useState(false),[loaded,setLoaded]=useState(false),[source,setSource]=useState<Source|null>(null);
 const [suspended,setSuspended]=useState(false),openRef=useRef(false),stoppers=useRef(new Set<()=>void>());
 const register=useCallback((stop:()=>void)=>{stoppers.current.add(stop);return()=>{stoppers.current.delete(stop)}},[]);
 function consult(s?:Source){for(const stop of stoppers.current)stop();openRef.current=true;setSuspended(true);setSource(s||null);setLoaded(true);setOpen(true)}
 function changeOpen(value:boolean){if(value){consult(source||undefined);return}openRef.current=false;setOpen(false)}
 const afterClose=useCallback(()=>{if(!openRef.current)setSuspended(false)},[]);
 useEffect(()=>{if(open||!suspended)return;const timer=setTimeout(afterClose,650);return()=>clearTimeout(timer)},[open,suspended,afterClose]);
 useEffect(()=>{
  const context=(document as Document&{modelContext?:{registerTool:(tool:unknown,options:unknown)=>Promise<void>|void}}).modelContext;if(!context)return;
  const controller=new AbortController();Promise.resolve(context.registerTool({name:"open_private_consultation",description:"打开卡彭团队私密咨询窗口；不会发送消息。",inputSchema:{type:"object",properties:{},additionalProperties:false},annotations:{readOnlyHint:false},execute(input:unknown){if(!input||typeof input!=="object"||Object.keys(input).length)throw new Error("无需输入参数");consult();return {opened:true}}},{signal:controller.signal})).catch(()=>{});return()=>controller.abort();
 },[]);
 return <ConsultContext.Provider value={consult}><PlaybackContext.Provider value={{suspended,register}}>{children}<button className="floating-consult" onClick={()=>consult()}><MessageCircle size={19}/><span>私密咨询</span></button>{loaded&&<Suspense fallback={open?<div className="consult-loading" role="status">正在打开私密咨询…<button onClick={()=>changeOpen(false)}>取消</button></div>:null}><Consultation open={open} onOpenChange={changeOpen} onAfterClose={afterClose} source={source}/></Suspense>}</PlaybackContext.Provider></ConsultContext.Provider>;
}
export function ConsultButton({children,className,source}:{children:ReactNode;className?:string;source?:Source}){const consult=useContext(ConsultContext);return <button className={className} onClick={()=>consult(source)}>{children}</button>}
export function CopyContact({value,label}:{value:string;label:string}){const [copied,setCopied]=useState(false),[error,setError]=useState(false);return <><button aria-label={label} title="复制微信号" onClick={async()=>{try{await navigator.clipboard.writeText(value);setCopied(true);setError(false);setTimeout(()=>setCopied(false),2500)}catch{setError(true)}}}>{copied?<Check size={16}/>:<Copy size={16}/>}</button><span className="sr-only" aria-live="polite">{copied?"已复制 "+value:error?"复制未完成，请长按号码复制":""}</span></>}
export function PrivacyButton(){const [open,setOpen]=useState(false),[loaded,setLoaded]=useState(false);return <><button onClick={()=>{setLoaded(true);setOpen(true)}}>隐私与服务说明</button>{loaded&&<Suspense fallback={<span role="status">正在打开…</span>}><Privacy open={open} onOpenChange={setOpen}/></Suspense>}</>}
export function LazyJournal(){
 const ref=useRef<HTMLDivElement>(null),[visible,setVisible]=useState(false),consult=useContext(ConsultContext);
 useEffect(()=>{const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){setVisible(true);observer.disconnect()}},{rootMargin:"250px"});if(ref.current)observer.observe(ref.current);return()=>observer.disconnect()},[]);
 const placeholder=<section className="section journal-section"><div className="section-heading"><div><p className="eyebrow">THE JOURNAL</p><h2>团队动态</h2></div><p>一些影像，一些记录。<br/>让了解，从这里发生。</p></div><p className="empty-state">正在载入团队动态…</p></section>;
 return <div ref={ref} id="journal">{visible?<Suspense fallback={placeholder}><Journal onConsult={p=>consult({kind:"post",id:p.id,title:p.title})}/></Suspense>:placeholder}</div>;
}

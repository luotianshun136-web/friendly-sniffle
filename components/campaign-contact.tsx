"use client";
import {useEffect,useRef,useState} from "react";
import {ArrowUpRight,Clock3,RefreshCw,ShieldCheck} from "lucide-react";
import {CopyContact} from "./home-client";
import {AssistantContact} from "./assistant-contact";
import {advanceCampaign,campaignSnapshot,countdownParts,unavailableCampaign,CAMPAIGN_ID,type CampaignSnapshot} from "@/lib/campaign-state";

const beijing=(value:number)=>new Intl.DateTimeFormat("zh-CN",{timeZone:"Asia/Shanghai",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hour12:false}).format(value);
export function CampaignContact({initial}:{initial:CampaignSnapshot}){
  const [current,setCurrent]=useState(initial),[retry,setRetry]=useState(0);
  const clock=useRef({snapshot:initial,at:0});
  useEffect(()=>{
    let request:AbortController|null=null,disposed=false;
    clock.current={snapshot:initial,at:performance.now()};
    async function sync(){
      if(request||document.hidden)return;const controller=new AbortController();request=controller;
      const timeout=setTimeout(()=>controller.abort(),15000);
      try{
        const response=await fetch("/api/campaign",{cache:"no-store",signal:controller.signal});
        if(!response.ok)throw new Error("Campaign unavailable");
        const data=await response.json() as CampaignSnapshot;
        if(data.id!==CAMPAIGN_ID||!Number.isSafeInteger(data.serverNow)||data.serverNow<=0||((data.startsAt===null)!==(data.endsAt===null)))throw new Error("Invalid campaign response");
        const snapshot=campaignSnapshot(data.startsAt===null?null:{startsAt:data.startsAt,endsAt:data.endsAt!},data.serverNow);
        if(!disposed){clock.current={snapshot,at:performance.now()};setCurrent(snapshot)}
      }catch{if(!disposed){const snapshot=unavailableCampaign();clock.current={snapshot,at:performance.now()};setCurrent(snapshot)}}
      finally{clearTimeout(timeout);request=null}
    }
    const tick=setInterval(()=>{if(!document.hidden)setCurrent(advanceCampaign(clock.current.snapshot,performance.now()-clock.current.at))},1000);
    const poll=setInterval(()=>void sync(),60000);
    const visible=()=>{if(!document.hidden)void sync()};
    document.addEventListener("visibilitychange",visible);void sync();
    return()=>{disposed=true;request?.abort();clearInterval(tick);clearInterval(poll);document.removeEventListener("visibilitychange",visible)};
  },[initial,retry]);
  const active=current.status==="active",ended=current.status==="ended",upcoming=current.status==="upcoming",unavailable=current.status==="unavailable";
  const title=active?"福利日 · 免费测算":ended?"本次福利活动已结束":upcoming?"福利日 · 即将开始":"一对一 · 私人评估";
  const parts=countdownParts(current);
  return <section className="campaign-contact" id="official-contact" aria-labelledby="campaign-title">
    <div className="campaign-main"><p className="campaign-brand">卡彭团队 <span>Mr. Capone</span></p><h2 id="campaign-title">{title}</h2><p className="campaign-intro">别再一个人反复猜。<br/>把你最想问的一件事说清楚。</p>
      <div className="campaign-clock" data-campaign-status={current.status}>
        {active||ended?<><span className="clock-label"><Clock3 size={16}/>{ended?"活动已截止":"距离本次活动结束"}</span><div className="clock-digits" role="timer" aria-label={ended?"活动已结束":`剩余${parts[0]}小时${parts[1]}分${parts[2]}秒`}>{parts.map((part,index)=><span className="clock-part" key={index}><strong>{part}</strong><small>{["时","分","秒"][index]}</small></span>)}</div><p className="clock-deadline">截止：{beijing(current.endsAt!)}（北京时间）</p></>:<div className="campaign-notice">{upcoming?`开始：${beijing(current.startsAt!)}（北京时间）`:unavailable?"活动状态暂时无法确认，可直接联系助理。":"欢迎联系助理，先了解，再评估。"}{unavailable&&<button type="button" className="text-link" onClick={()=>setRetry(n=>n+1)}><RefreshCw size={15}/>重新查询活动</button>}</div>}
      </div>
    </div>
    <div className="campaign-contacts"><AssistantContact remark={active?"福利测算":"私人评估"}/><div className="front-contact-grid"><div><span>师傅微信</span><p><strong>Jw512527</strong><CopyContact value="Jw512527" label="复制首屏师傅微信"/></p></div><div><span>WhatsApp</span><a href="https://wa.me/8619805071031" target="_blank" rel="noreferrer">+86 198 0507 1031 <ArrowUpRight size={16}/></a></div></div><p className="front-contact-note">师傅：卡彭｜Mr. Capone · 可文字或语音沟通</p></div>
    <div className="campaign-terms">{active?<><p><strong>每人一次 · 一个主要问题</strong>：传统测算解读与具体行动建议。请在倒计时结束前向助理发送申请或留言，备注“福利测算”，由助理核对报名时间。</p><p>后续定制或仪式服务不包含在免费权益内，另行说明，自愿选择。</p></>:ended?<p>本次免费报名已截止。已在截止前申请或留言的客户，由助理继续核对；普通咨询仍可联系。</p>:null}<p>传统测算仅供参考，结合实际情况给出建议；不作为疾病诊疗服务，不保证具体结果。仅接待成年女性。</p><p className="front-identity"><ShieldCheck size={15}/>仅认准以上官方联系方式，警惕冒名主动私信。</p></div>
  </section>;
}

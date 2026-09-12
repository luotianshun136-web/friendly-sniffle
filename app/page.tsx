import {ArrowDown,ArrowUpRight,MessageCircle,ShieldCheck} from "lucide-react";
import {HomeProvider,ConsultButton,CopyContact,PrivacyButton,LazyJournal} from "@/components/home-client";
import {HeroVideo} from "@/components/hero-video";
import {getHomepage} from "@/lib/homepage";
import {DEFAULT_HOMEPAGE} from "@/lib/homepage-types";
import {Concerns} from "@/components/concerns";
import {Lineage} from "@/components/lineage";
import {CampaignContact} from "@/components/campaign-contact";
import {SecondaryConsultations} from "@/components/secondary-consultations";
import {getCampaign} from "@/lib/campaign";
import {unavailableCampaign} from "@/lib/campaign-state";
export const dynamic="force-dynamic";
export default async function Home(){
  const config=await getHomepage().catch(()=>{console.error("homepage_settings_unavailable");return DEFAULT_HOMEPAGE});
  const campaign=await getCampaign().catch(()=>{console.error("campaign_unavailable");return unavailableCampaign()});
  return <HomeProvider><main>
    <header className="site-header"><a className="wordmark" href="/">CAPONE<span>卡彭团队</span></a><nav><a href="#official-contact">官方联系</a><a href="#lineage">关于传承</a><a href="#concerns">女性情感</a><a href="#journal">团队动态</a></nav><ConsultButton className="text-link">网站私密留言 <ArrowUpRight size={16}/></ConsultButton></header>
    <CampaignContact initial={campaign}/>
    <section className="hero">
      <div className="hero-top"><span>FOR WOMEN, WITH INTENTION</span><span>PRIVATE RITUAL STUDIO</span></div>
      <div className="hero-stage">
        <div className="hero-copy"><p className="eyebrow">女性吸睛 · 私人定制</p><h1>卡彭团队</h1><p className="hero-statement">你的价值，<br/>不必靠低姿态证明。</p><ConsultButton className="primary-button">开始私人评估 <ArrowUpRight size={18}/></ConsultButton><p className="micro">仅接待成年女性 · 先评估，后承接</p></div>
        <HeroVideo config={{videoUrl:config.videoUrl,posterUrl:config.posterUrl,width:config.width,height:config.height,hasAudio:config.hasAudio}}/>
        <div className="hero-note"><span className="note-number">01 /</span><p>真正的偏爱，<br/>经得起行动。</p><div className="fine-rule"/><span className="signature">Mr. Capone</span><span>守规矩 · 重隐私 · 不妄言</span></div>
      </div>
      <div className="hero-bottom"><span>每一份委托，始于认真了解。</span><a href="#concerns">向下探索 <ArrowDown size={16}/></a><span>卡彭｜Mr. Capone</span></div>
    </section>
    <Lineage/>
    <Concerns/>
    <section className="section introduction" id="approach"><div className="section-heading"><div><p className="eyebrow">A PERSONAL APPROACH</p><h2>私人定制，<br/>从认真了解你开始。</h2></div><p>先把经历与期待说清楚。<br/>团队会说明传统文化服务能承接什么、不能承接什么，<br/>在你了解方案与约定后，再决定是否继续。</p></div><ol className="process-list">{[["了解经历与诉求","倾听关系经过、关键转折和你的真实期待，不急于下结论。"],["判断是否承接","结合实际情况说明服务范围与边界，不适合的委托不勉强承接。"],["确认方案与约定","评估通过后，一对一确认定制方案、交付内容及事先书面约定。"],["全流程视频交付","按确认的方案执行，以视频记录服务过程，向本人私密交付。"],["阶段回访","了解后续情况，核对约定内容，安排跟进并回应你的疑问。"]].map(([title,body],i)=><li key={title}><span>0{i+1}</span><h3>{title}</h3><p>{body}</p></li>)}</ol><p className="service-note">建议观察15–30天；未达到事先书面约定标准，按约处理退款。</p></section>
    <section className="section boundaries"><div><p className="eyebrow">OUR BOUNDARIES</p><h2>有些规矩，<br/>比一份委托更重要。</h2><p className="muted">并非每一种需求，我们都会承接。</p></div><div className="boundary-list"><article><span>01</span><div><h3>先评估，再决定。</h3><p>仅接待成年女性。每一份委托都需要了解真实情况，不以付款代替评估。</p></div></article><article><span>02</span><div><h3>有所为，也有所不为。</h3><p>陈述不实、动机不当、涉及伤害他人或需求不合理的委托，给钱也不承接。</p></div></article><article><span>03</span><div><h3>你的故事，留在这里。</h3><p>咨询与交付资料仅用于服务沟通，未经同意，不作为公开案例展示。</p></div></article></div></section>
    <SecondaryConsultations/>
    <LazyJournal/>
    <section className="section contact-band" id="contact"><p className="eyebrow">LET’S BEGIN</p><h2>把你的故事，<br/>留给认真倾听的人。</h2><ConsultButton className="primary-button"><MessageCircle size={18}/> 开始私密咨询</ConsultButton><div className="contact-grid"><div><span>师傅微信</span><p>Jw512527 <CopyContact value="Jw512527" label="复制师傅微信"/></p><small>添加请注明来意 · 可文字或语音沟通</small></div><div><span>WHATSAPP</span><a href="https://wa.me/8619805071031" target="_blank" rel="noreferrer">+86 198 0507 1031 <ArrowUpRight size={16}/></a><small>卡彭｜Mr. Capone · 一对一咨询</small></div><div><span>助理微信</span><p>wasd562482 <CopyContact value="wasd562482" label="复制助理微信"/></p><small>接待与流程协助</small></div></div><p className="identity-notice"><ShieldCheck size={16}/> 请核对本站列出的联系方式，警惕冒名主动私信。</p></section>
    <footer className="site-footer"><a className="wordmark" href="/">CAPONE<span>卡彭团队</span></a><p>私人定制 · 守规矩，重隐私，不妄言</p><div><PrivacyButton/><a href="/admin">管理入口</a></div></footer>
  </main></HomeProvider>;
}

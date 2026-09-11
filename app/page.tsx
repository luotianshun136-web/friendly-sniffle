import {ArrowDown,ArrowUpRight,MessageCircle,ShieldCheck} from "lucide-react";
import {HomeProvider,ConsultButton,CopyContact,PrivacyButton,LazyJournal} from "@/components/home-client";
import {HeroVideo} from "@/components/hero-video";
import {getHomepage} from "@/lib/homepage";
import {DEFAULT_HOMEPAGE} from "@/lib/homepage-types";
export const dynamic="force-dynamic";
export default async function Home(){
  const config=await getHomepage().catch(()=>{console.error("homepage_settings_unavailable");return DEFAULT_HOMEPAGE});
  return <HomeProvider><main>
    <header className="site-header"><a className="wordmark" href="/">CAPONE<span>卡彭团队</span></a><nav><a href="#approach">私人定制</a><a href="#lineage">关于传承</a><a href="#journal">团队动态</a></nav><ConsultButton className="text-link">预约评估 <ArrowUpRight size={16}/></ConsultButton></header>
    <section className="hero">
      <div className="hero-top"><span>FOR WOMEN, WITH INTENTION</span><span>PRIVATE RITUAL STUDIO</span></div>
      <div className="hero-stage">
        <div className="hero-copy"><p className="eyebrow">女性吸睛 · 私人定制</p><h1>卡彭团队</h1><p className="hero-statement">你的价值，<br/>不必靠低姿态证明。</p><ConsultButton className="primary-button">开始私人评估 <ArrowUpRight size={18}/></ConsultButton><p className="micro">仅接待成年女性 · 先评估，后承接</p></div>
        <HeroVideo config={{videoUrl:config.videoUrl,posterUrl:config.posterUrl,width:config.width,height:config.height,hasAudio:config.hasAudio}}/>
        <div className="hero-note"><span className="note-number">01 /</span><p>真正的偏爱，<br/>经得起行动。</p><div className="fine-rule"/><span className="signature">Mr. Capone</span><span>守规矩 · 重隐私 · 不妄言</span></div>
      </div>
      <div className="hero-bottom"><span>每一份委托，始于认真了解。</span><a href="#approach">向下探索 <ArrowDown size={16}/></a><span>卡彭｜Mr. Capone</span></div>
    </section>
    <section className="section introduction" id="approach"><div className="section-heading"><div><p className="eyebrow">A PERSONAL APPROACH</p><h2>私人定制，<br/>从认真了解你开始。</h2></div><p>一段关系的处境，需要被完整倾听。<br/>我们先了解实际情况，再评估是否适合承接，<br/>与你确认边界与约定。</p></div><ol className="process-list">{[["了解情况","倾听你的处境、诉求与期待。"],["评估承接","核对实际情况，明确适配与边界。"],["一对一定制","确认方案与事先约定的标准。"],["视频交付","全流程视频记录，私密交付。"],["阶段回访","观察变化，按约定安排跟进。"]].map(([title,body],i)=><li key={title}><span>0{i+1}</span><h3>{title}</h3><p>{body}</p></li>)}</ol><p className="service-note">建议观察15–30天；未达到事先书面约定标准，按约处理退款。</p></section>
    <section className="section boundaries"><div><p className="eyebrow">OUR BOUNDARIES</p><h2>有些规矩，<br/>比一份委托更重要。</h2><p className="muted">并非每一种需求，我们都会承接。</p></div><div className="boundary-list"><article><span>01</span><div><h3>先评估，再决定。</h3><p>仅接待成年女性。每一份委托都需要了解真实情况，不以付款代替评估。</p></div></article><article><span>02</span><div><h3>有所为，也有所不为。</h3><p>陈述不实、动机不当、涉及伤害他人或需求不合理的委托，给钱也不承接。</p></div></article><article><span>03</span><div><h3>你的故事，留在这里。</h3><p>咨询与交付资料仅用于服务沟通，未经同意，不作为公开案例展示。</p></div></article></div></section>
    <LazyJournal/>
    <section className="section lineage" id="lineage"><div className="lineage-title"><p className="eyebrow">THE LINEAGE</p><h2>尊重传统，<br/>更尊重边界。</h2><span className="signature">Mr. Capone</span><p>团队首席师傅<br/>卡彭｜Mr. Capone</p><div className="case-count"><strong>3,600</strong><span>累计服务案例 · 团队自述</span></div></div><div className="lineage-copy"><h3>暹茅，亦称仙茅。</h3><p>依团队传承自述，我们承习中国茅山下茅一脉。传统分为上、中、下三支：上茅偏重测算，中茅以文科仪与调和为主，下茅属于武系法脉。</p><p>所承习的暹茅派下茅，主要传承飞降科、魂魄调和、血脉祈安等传统科仪。我们不靠恐吓取信于人，也不以夸大承诺换取信任。</p><p>真正的传承讲究规矩、因由和边界。任何事情，都要先了解实际情况，再判断是否适合介入。</p><blockquote>守规矩、重隐私、不妄言。<br/>信任，来自每一次有分寸的承接。</blockquote></div></section>
    <section className="section directions"><div className="section-heading"><div><p className="eyebrow">OTHER CONSULTATIONS</p><h2>其他咨询方向</h2></div><p>不同处境，同样认真。<br/>每一项，均从评估开始。</p></div><div className="direction-grid">{["人际困扰 · 破小人","情感边界 · 斩桃花","姻缘和合","个人测算","风水咨询","财运与事业","健康祈福"].map((item,i)=><ConsultButton key={item}><span>0{i+1}</span>{item}<ArrowUpRight size={18}/></ConsultButton>)}</div><p className="service-note">健康祈福属于传统文化服务，不替代医疗诊断或治疗。</p></section>
    <section className="section contact-band" id="contact"><p className="eyebrow">LET’S BEGIN</p><h2>把你的故事，<br/>留给认真倾听的人。</h2><ConsultButton className="primary-button"><MessageCircle size={18}/> 开始私密咨询</ConsultButton><div className="contact-grid"><div><span>师傅微信</span><p>Jw512527 <CopyContact value="Jw512527" label="复制师傅微信"/></p><small>添加请注明来意 · 可文字或语音沟通</small></div><div><span>WHATSAPP</span><a href="https://wa.me/8619805071031" target="_blank" rel="noreferrer">+86 198 0507 1031 <ArrowUpRight size={16}/></a><small>卡彭｜Mr. Capone · 一对一咨询</small></div><div><span>助理微信</span><p>wasd562482 <CopyContact value="wasd562482" label="复制助理微信"/></p><small>接待与流程协助</small></div></div><p className="identity-notice"><ShieldCheck size={16}/> 请核对本站列出的联系方式，警惕冒名主动私信。</p></section>
    <footer className="site-footer"><a className="wordmark" href="/">CAPONE<span>卡彭团队</span></a><p>私人定制 · 守规矩，重隐私，不妄言</p><div><PrivacyButton/><a href="/admin">管理入口</a></div></footer>
  </main></HomeProvider>;
}

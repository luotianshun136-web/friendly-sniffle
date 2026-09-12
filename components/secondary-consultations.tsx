import {ArrowUpRight} from "lucide-react";
import {SECONDARY_CONSULTATION_TOPICS} from "@/lib/consultation-topics";
import {AssistantContact} from "./assistant-contact";
import {ConsultButton} from "./home-client";
export function SecondaryConsultations(){
  return <section className="section directions" id="directions"><div className="section-heading"><div><p className="eyebrow">OTHER CONSULTATIONS</p><h2>其他咨询方向</h2></div><p>情感之外的难处，也可以说。<br/>先了解实际情况，再评估是否承接。</p></div><div className="secondary-direction-grid">{SECONDARY_CONSULTATION_TOPICS.map((topic,index)=><article key={topic.id}><span className="direction-number">0{index+1}</span><h3>{topic.title}</h3><p className="direction-description">{topic.description}</p><AssistantContact remark={topic.title}/><ConsultButton className="text-link secondary-message" source={{kind:"topic",id:topic.id,title:topic.title}}>网站私密留言 <ArrowUpRight size={16}/></ConsultButton></article>)}</div></section>;
}

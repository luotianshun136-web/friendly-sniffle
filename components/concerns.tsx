import { ArrowUpRight } from "lucide-react";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { ConsultButton } from "@/components/home-client";
import { CONSULTATION_TOPICS } from "@/lib/consultation-topics";
import { AssistantContact } from "./assistant-contact";

export function Concerns() {
  return <section className="section concerns" id="concerns" aria-labelledby="concerns-title">
    <div className="section-heading concerns-heading">
      <div><p className="eyebrow">女性吸金 · 女性吸睛 · 女性崛起</p><h2 id="concerns-title">别再拿懂事，<br/>替他的敷衍买单。</h2></div>
      <p>想被认真对待，就别把自己的需求一再往后放。<br/>说说你的处境，先了解，再判断是否承接。</p>
    </div>
    <Accordion type="single" collapsible defaultValue={CONSULTATION_TOPICS[0].id} className="concern-list">
      {CONSULTATION_TOPICS.map((topic, index) => <AccordionItem key={topic.id} value={topic.id} className="concern-item">
        <AccordionTrigger className="concern-trigger">
          <span className="concern-number" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
          <span className="concern-summary"><span className="concern-title">{topic.title}</span><span className="concern-empathy">{topic.empathy}</span></span>
        </AccordionTrigger>
        <AccordionContent forceMount className="concern-body">
          <div className="concern-details"><div><h4>你的处境</h4><p>{topic.situation}</p></div><div><h4>我们会先了解什么</h4><p>{topic.assessment}</p></div></div>
          <div className="concern-next"><div><h4>可咨询方向</h4><p>{topic.direction}</p></div><div className="concern-actions"><AssistantContact remark={topic.title}/><ConsultButton className="text-link concern-consult" source={{kind:"topic",id:topic.id,title:topic.title}}>网站私密留言 <ArrowUpRight size={16}/></ConsultButton></div></div>
        </AccordionContent>
      </AccordionItem>)}
    </Accordion>
    <p className="concern-note">仅接待成年女性。先了解，再评估；是否继续，由你决定。不保证改变他人意愿、金钱付出或关系结果。</p>
  </section>;
}

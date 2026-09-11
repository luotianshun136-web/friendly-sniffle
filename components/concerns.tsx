import { ArrowUpRight } from "lucide-react";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { ConsultButton } from "@/components/home-client";
import { CONSULTATION_TOPICS } from "@/lib/consultation-topics";

export function Concerns() {
  return <section className="section concerns" id="concerns" aria-labelledby="concerns-title">
    <div className="section-heading concerns-heading">
      <div><p className="eyebrow">你正在经历什么</p><h2 id="concerns-title">你想要的，不只是回应，<br/>而是被认真对待。</h2></div>
      <p>有些难处，不必等到撑不住才说。<br/>从最接近你的一种处境开始，让我们认真了解。</p>
    </div>
    <Accordion type="single" collapsible defaultValue={CONSULTATION_TOPICS[0].id} className="concern-list">
      {CONSULTATION_TOPICS.map((topic, index) => <AccordionItem key={topic.id} value={topic.id} className="concern-item">
        <AccordionTrigger className="concern-trigger">
          <span className="concern-number" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
          <span className="concern-summary"><span className="concern-title">{topic.title}</span><span className="concern-empathy">{topic.empathy}</span></span>
        </AccordionTrigger>
        <AccordionContent forceMount className="concern-body">
          <div className="concern-details"><div><h4>你的处境</h4><p>{topic.situation}</p></div><div><h4>我们会先了解什么</h4><p>{topic.assessment}</p></div></div>
          <div className="concern-next"><div><h4>可咨询方向</h4><p>{topic.direction}</p></div><ConsultButton className="text-link concern-consult" source={{kind:"topic",id:topic.id,title:topic.title}}>就这个问题私密咨询 <ArrowUpRight size={18}/></ConsultButton></div>
        </AccordionContent>
      </AccordionItem>)}
    </Accordion>
    <p className="concern-note">仅接待成年女性。先了解，再评估；是否继续，由你决定。不保证改变他人意愿或关系结果。</p>
  </section>;
}

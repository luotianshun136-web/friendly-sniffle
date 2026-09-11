export const CONSULTATION_TOPICS = [
  {
    id: "inconsistent-relationship",
    title: "关系忽冷忽热",
    empathy: "最累的不是等待，而是每一次都要猜自己是否重要。",
    situation: "有时亲近，有时疏远。你在对方的回应里反复寻找答案，却很难安心表达自己的需要。",
    assessment: "你们目前的关系、联系发生变化的时间，以及你最希望确认的事情。先听清经过，再判断是否适合承接。",
    direction: "情感关系情况评估",
  },
  {
    id: "unequal-effort",
    title: "付出与回应失衡",
    empathy: "你可以主动，但不必独自撑起两个人的关系。",
    situation: "主动联系、迁就安排、照顾情绪，常常都是你。你想要的不是计较得失，而是自己的认真也被珍惜。",
    assessment: "你感到失衡的具体经历、已经表达过的期待，以及你愿意接受和不愿继续承担的部分。",
    direction: "女性吸睛私人定制评估",
  },
  {
    id: "uncertain-future",
    title: "关系迟迟没有方向",
    empathy: "相处了很久，你仍不知道自己在对方未来的位置。",
    situation: "相处并不算少，谈到关系和以后却总被搁置。你不想一直猜，也不想在没有共识的等待里消耗自己。",
    assessment: "双方对关系的实际约定、迟迟未明确的原因，以及你希望继续或作出选择的依据。",
    direction: "关系诉求与姻缘和合咨询",
  },
  {
    id: "trust-and-boundaries",
    title: "信任受损、反复拉扯",
    empathy: "想继续，却放不下旧事；想离开，又舍不得投入。",
    situation: "争执之后和好，熟悉的问题又再次出现。你希望被理解，也需要弄清什么值得继续、什么不能再让步。",
    assessment: "造成信任变化的事实、双方目前的态度和你的边界。不替对方作出承诺，也不以既有投入催促你继续。",
    direction: "情感关系与边界咨询",
  },
  {
    id: "draining-connections",
    title: "人际关系持续消耗",
    empathy: "总是顾全别人，自己的感受却一次次被放到最后。",
    situation: "面对熟人、合作伙伴或身边的关系，你常常不好拒绝。被误解、被越界之后，又担心说清楚会破坏相处。",
    assessment: "具体发生了什么、涉及怎样的关系，以及你希望守住的界限。以事实为基础，不凭猜测认定他人的动机。",
    direction: "人际困扰咨询",
  },
  {
    id: "career-and-life",
    title: "事业与生活陷入停滞",
    empathy: "明明一直努力，却不知道下一步该往哪里走。",
    situation: "工作、合作或生活阶段发生变化，熟悉的节奏不再适用。你有很多顾虑，却缺少一个能把情况完整说清楚的机会。",
    assessment: "当前处境、正在面对的选择和现实限制，再说明团队传统文化服务的适用范围，不作收入或健康结果保证。",
    direction: "事业及生活阶段困扰咨询",
  },
] as const;

export function findConsultationTopic(id: string) {
  return CONSULTATION_TOPICS.find((topic) => topic.id === id);
}

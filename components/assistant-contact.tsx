"use client";
import {useState} from "react";
import {Check,Copy} from "lucide-react";
export const ASSISTANT_WECHAT="wasd562482";
export function AssistantContact({remark="私人评估"}:{remark?:string}){
  const [feedback,setFeedback]=useState<{remark:string;state:"copied"|"failed"}|null>(null);
  const state=feedback?.remark===remark?feedback.state:null;
  async function copy(){try{await navigator.clipboard.writeText(ASSISTANT_WECHAT);setFeedback({remark,state:"copied"})}catch{setFeedback({remark,state:"failed"})}}
  return <div className="assistant-contact"><div className="assistant-contact-row"><p><span>助理微信</span><strong>{ASSISTANT_WECHAT}</strong></p><button type="button" className="primary-button" onClick={copy}>{state==="copied"?<Check size={17}/>:<Copy size={17}/>}加助理微信</button></div><p className="assistant-feedback" role="status">{state==="copied"?`微信号已复制，请到微信添加，备注“${remark}”。`:state==="failed"?`复制未完成，请长按上方微信号复制，备注“${remark}”。`:`添加请备注“${remark}”`}</p></div>;
}

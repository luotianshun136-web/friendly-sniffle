"use client";
import {LockKeyhole} from "lucide-react";
import {Dialog,DialogContent,DialogTitle,DialogDescription} from "@/components/ui/dialog";
export default function Privacy({open,onOpenChange}:{open:boolean;onOpenChange:(v:boolean)=>void}){
 return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="privacy-dialog"><DialogTitle>隐私与服务说明</DialogTitle><DialogDescription>认真对待每一份信任。</DialogDescription><div className="privacy-copy"><h3><LockKeyhole size={17}/> 咨询资料</h3><p>本站保存你主动提交的留言、选填称呼和联系方式，仅用于评估、沟通与跟进。资料由获授权的团队管理员访问，不自动发布为公开案例。</p><h3>会话与删除</h3><p>匿名会话凭据保存在本浏览器的安全 Cookie 中，有效期30天。清除 Cookie 或更换设备后，不会自动恢复旧会话。你可以在会话中，或通过本站官方联系方式申请删除咨询记录；我们会核对请求后处理。</p><h3>私人委托</h3><p>仅接待成年女性，先了解情况，再决定是否承接。具体方案、交付内容、观察标准与退款安排，以双方事先书面约定为准。建议观察15–30天；未达到事先书面约定标准，按约处理退款。</p><h3>公开内容与传统服务</h3><p>团队介绍及累计案例数量由卡彭团队提供，不代表对个人结果的承诺。健康祈福不替代专业医疗服务。本站不提供在线支付，请通过官方联系方式核实委托安排。</p></div></DialogContent></Dialog>;
}

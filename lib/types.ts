export type Post = {id:string; title:string; body:string; mediaId:string; kind:"image"|"video"; width:number; height:number; status:"draft"|"published"; createdAt:number; updatedAt:number};
export type Message = {id:string; role:"visitor"|"auto"|"admin"; body:string; createdAt:number; sourceTitle:string|null};
export type Conversation = {id:string; nickname:string; contact:string; sourceTitle:string|null; status:"open"|"archived"; unread:number; createdAt:number; updatedAt:number};
export type ConsultSource = {kind:"post"|"topic";id:string;title:string};
export const AUTO_REPLY = "已收到你的留言。私人定制需先评估实际情况，再确认是否承接。\n仪式师父：卡彭｜Mr. Capone\n微信：Jw512527（添加请注明来意）\n一对一咨询，可文字、可高效语音沟通。\nWhatsApp：+8619805071031\n助理微信：wasd562482";

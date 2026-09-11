export async function api<T=Record<string,unknown>>(path:string,options:RequestInit={}):Promise<T>{
 const r=await fetch(path,{...options,headers:{...(options.body&&typeof options.body==="string"?{"Content-Type":"application/json"}:{}),...options.headers},cache:"no-store"}).catch(()=>{throw new Error("连接暂时中断，请稍后重试。")});
 const data=await r.json().catch(()=>({error:"响应未完成，请重试。"})) as Record<string,unknown>;
 if(!r.ok)throw Object.assign(new Error(typeof data.error==="string"?data.error:typeof data.message==="string"?data.message:"操作未完成，请重试。"),{status:r.status});
 return data as T;
}
export const write=(method:string,body:unknown)=>({method,body:JSON.stringify(body)});
export function time(value:number){return new Date(value).toLocaleString("zh-CN",{month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"})}

import {env} from "cloudflare:workers";
export type RuntimeEnv={DB:D1Database;BUCKET:R2Bucket;BETTER_AUTH_SECRET:string;SITE_ORIGIN:string;BOOTSTRAP_TOKEN:string};
export const runtime=()=>env as unknown as RuntimeEnv;
export const database=()=>runtime().DB;
export class HttpError extends Error {constructor(public status:number,message:string){super(message)}}
export function json(value:unknown,status=200,headers?:HeadersInit){const h=new Headers(headers);h.set("Content-Type","application/json; charset=utf-8");h.set("Cache-Control","no-store");h.set("X-Content-Type-Options","nosniff");return new Response(JSON.stringify(value),{status,headers:h})}
export function checkOrigin(req:Request){const origin=req.headers.get("origin");if(!origin||origin!==new URL(req.url).origin)throw new HttpError(403,"请求来源无效，请刷新页面后重试。")}
export async function payload(req:Request){if(Number(req.headers.get("content-length")||0)>16384)throw new HttpError(413,"文字内容过长。");const raw=await req.text();if(raw.length>16384)throw new HttpError(413,"文字内容过长。");try{const v=JSON.parse(raw);if(!v||Array.isArray(v)||typeof v!=="object")throw new Error();return v as Record<string,unknown>}catch{throw new HttpError(400,"请求内容无效。")}}
export function field(v:unknown,max:number,required=false){if(v===undefined&&!required)return "";if(typeof v!=="string"||v.length>max||(required&&!v.trim()))throw new HttpError(400,"请检查填写的内容与字数。");return v.trim()}
export function passwordField(v:unknown){if(typeof v!=="string"||!v.length||v.length>128)throw new HttpError(400,"请检查密码，最长128位。");return v}
export async function digest(s:string){return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(s)))).map(x=>x.toString(16).padStart(2,"0")).join("")}
export function randomToken(){return Array.from(crypto.getRandomValues(new Uint8Array(32))).map(x=>x.toString(16).padStart(2,"0")).join("")}
export async function throttle(key:string,max=30,seconds=60){const now=Date.now(),k=await digest(key);const row=await database().prepare("INSERT INTO rate_limits (key,count,expiresAt) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN expiresAt<=? THEN 1 ELSE count+1 END, expiresAt=CASE WHEN expiresAt<=? THEN excluded.expiresAt ELSE expiresAt END RETURNING count").bind(k,now+seconds*1000,now,now).first<{count:number}>();if((row?.count||0)>max)throw new HttpError(429,"操作较频繁，请稍后再试。")}
export async function visitor(req:Request,create=false){const match=req.headers.get("cookie")?.match(/(?:^|;\s*)capone_visitor=([a-f0-9]{64})(?:;|$)/);const token=match?.[1]||(create?randomToken():null);return token?{id:await digest(token),cookie:match?null:"capone_visitor="+token+"; HttpOnly; SameSite=Strict; Path=/; Max-Age=2592000"+(new URL(req.url).protocol==="https:"?"; Secure":"")}:null}

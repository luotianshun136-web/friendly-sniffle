import {betterAuth} from "better-auth";
import {username} from "better-auth/plugins";
import {drizzleAdapter} from "@better-auth/drizzle-adapter";
import {drizzle} from "drizzle-orm/d1";
import * as schema from "@/db/schema";
import {runtime,HttpError} from "./server";
export const OWNER_ID="capone-owner";
export function auth(){const e=runtime();return betterAuth({secret:e.BETTER_AUTH_SECRET,baseURL:e.SITE_ORIGIN,basePath:"/api/auth",database:drizzleAdapter(drizzle(e.DB,{schema}),{provider:"sqlite",schema}),emailAndPassword:{enabled:true,disableSignUp:true,minPasswordLength:5,maxPasswordLength:128},plugins:[username()],user:{additionalFields:{mustChangePassword:{type:"boolean",defaultValue:true,input:false}}},session:{expiresIn:60*60*12,updateAge:60*60},rateLimit:{enabled:false},disabledPaths:["/sign-up/email","/is-username-available","/update-user","/change-email","/delete-user","/request-password-reset"]})}
export async function admin(req:Request,allowPasswordChange=false){const session=await auth().api.getSession({headers:req.headers});if(!session||session.user.id!==OWNER_ID)throw new HttpError(401,"请先登录管理后台。");if(session.user.mustChangePassword&&!allowPasswordChange)throw new HttpError(403,"请先修改初始密码。");return session}

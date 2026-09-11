import type {Metadata} from "next";
import Admin from "./studio";
export const metadata:Metadata={title:"管理后台｜卡彭团队",robots:{index:false,follow:false}};
export default function Page(){return <Admin/>}

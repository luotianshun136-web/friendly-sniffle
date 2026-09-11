export type HomepageVideo={videoUrl:string;posterUrl:string;width:number;height:number;hasAudio:boolean;originalHasAudio?:boolean|null;originalId:string|null;videoId:string|null;posterId:string|null;updatedAt:number};
export const DEFAULT_HOMEPAGE:HomepageVideo={videoUrl:"/media/hero-v3.mp4",posterUrl:"/media/hero-v2.webp",width:540,height:960,hasAudio:true,originalId:null,videoId:null,posterId:null,updatedAt:0};
export type HeroMediaPurpose="hero-original"|"hero-video"|"hero-poster";
export type HomepageUploadTask={id:string;status:"pending"|"committed"|"cancelled";expiresAt:number;originalId:string|null;videoId:string|null;posterId:string|null};

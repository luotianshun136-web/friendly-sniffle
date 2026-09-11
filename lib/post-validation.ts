export function matchingFrame(width:number,height:number,videoWidth:number,videoHeight:number){
  return [width,height,videoWidth,videoHeight].every(n=>Number.isFinite(n)&&n>0)&&Math.abs((width/height)/(videoWidth/videoHeight)-1)<=.01;
}
export function postOptions(body:{posterId?:unknown;loop?:unknown},sameMedia:boolean,previous?:{posterId:string|null;loop:boolean|number}){
  const posterId=body.posterId===undefined?(sameMedia?previous?.posterId||null:null):body.posterId===null||body.posterId===""?null:typeof body.posterId==="string"&&body.posterId.length<=80?body.posterId.trim()||null:undefined;
  if(posterId===undefined)throw new Error("封面标识无效。");
  if(body.loop!==undefined&&typeof body.loop!=="boolean")throw new Error("循环播放设置无效。");
  return {posterId,loop:body.loop===undefined?(sameMedia?!!previous?.loop:false):body.loop};
}

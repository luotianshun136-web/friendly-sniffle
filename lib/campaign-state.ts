export const CAMPAIGN_ID="welfare-day-v1";
export const CAMPAIGN_DURATION=24*60*60*1000;
export type CampaignStatus="inactive"|"upcoming"|"active"|"ended"|"unavailable";
export type CampaignSnapshot={id:string;startsAt:number|null;endsAt:number|null;serverNow:number;status:CampaignStatus};
export function campaignSnapshot(row:{startsAt:number;endsAt:number}|null,serverNow:number):CampaignSnapshot{
  if(!row)return {id:CAMPAIGN_ID,startsAt:null,endsAt:null,serverNow,status:"inactive"};
  if(!Number.isSafeInteger(row.startsAt)||!Number.isSafeInteger(row.endsAt)||row.startsAt<=0||row.endsAt-row.startsAt!==CAMPAIGN_DURATION)throw new Error("Invalid campaign timing");
  return {id:CAMPAIGN_ID,...row,serverNow,status:serverNow<row.startsAt?"upcoming":serverNow>=row.endsAt?"ended":"active"};
}
export function unavailableCampaign():CampaignSnapshot{return {id:CAMPAIGN_ID,startsAt:null,endsAt:null,serverNow:0,status:"unavailable"}}
export function advanceCampaign(snapshot:CampaignSnapshot,elapsed:number){
  if(snapshot.startsAt===null||snapshot.endsAt===null)return snapshot;
  return campaignSnapshot({startsAt:snapshot.startsAt,endsAt:snapshot.endsAt},snapshot.serverNow+Math.max(0,elapsed));
}
export function countdownParts(snapshot:CampaignSnapshot){
  const seconds=snapshot.status==="active"?Math.max(0,Math.ceil((snapshot.endsAt!-snapshot.serverNow)/1000)):0;
  return [Math.floor(seconds/3600),Math.floor(seconds%3600/60),seconds%60].map(n=>String(n).padStart(2,"0"));
}

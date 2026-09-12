import {database} from "./server";
import {CAMPAIGN_ID,campaignSnapshot} from "./campaign-state";
export async function getCampaign(){
  const row=await database().prepare("SELECT startsAt,endsAt FROM campaigns WHERE id=?").bind(CAMPAIGN_ID).first<{startsAt:number;endsAt:number}>();
  return campaignSnapshot(row,Date.now());
}

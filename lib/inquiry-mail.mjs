import {createTripBrief,tripFilename,briefFields} from './trip-brief.mjs';
export const INQUIRY_RECIPIENT='sandeepjoseph4@gmail.com';
export const mailConfigured=env=>!!(env.RESEND_API_KEY&&env.JUNE_LINKS_MAIL_FROM);
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function base64(bytes){let result='';for(let i=0;i<bytes.length;i+=12288)result+=btoa(String.fromCharCode(...bytes.subarray(i,i+12288)));return result;}
export async function queueInquiryNotification(env,id,data,now=Date.now()){
 await env.DB.prepare('INSERT INTO inquiry_notifications (inquiry_id,recipient,filename,next_attempt_at,created_at,updated_at) VALUES (?,?,?,?,?,?) ON CONFLICT(inquiry_id) DO NOTHING').bind(id,INQUIRY_RECIPIENT,tripFilename(data),now,now,now).run();
 const row=await env.DB.prepare('SELECT status FROM inquiry_notifications WHERE inquiry_id = ?').bind(id).first();
 return row?.status==='sent'?'sent':mailConfigured(env)?'queued':'pending-setup';
}
// No public trigger or caller-specified recipient. One durable attachment is
// reused on retries so the provider idempotency key sees an identical message.
export async function drainInquiryMail(env,{loadAsset,fetcher=fetch,now=()=>Date.now(),max=5}={}){
 if(!env.DB||!mailConfigured(env))return {processed:0,configured:false};
 let processed=0;
 for(let i=0;i<max;i++){
  const time=now();
  const claimed=await env.DB.prepare("UPDATE inquiry_notifications SET status='sending',lease_until=?,attempts=attempts+1,updated_at=? WHERE inquiry_id=(SELECT inquiry_id FROM inquiry_notifications WHERE (status='pending' AND next_attempt_at<=?) OR (status='sending' AND lease_until<?) ORDER BY created_at LIMIT 1) RETURNING inquiry_id").bind(time+120000,time,time,time).first();
  if(!claimed)break;
  const record=await env.DB.prepare('SELECT n.*,i.reference,i.payload_json,i.created_at AS inquiry_created_at FROM inquiry_notifications n JOIN inquiries i ON i.id=n.inquiry_id WHERE n.inquiry_id=?').bind(claimed.inquiry_id).first();
  if(!record)break;
  try{
   const data={...JSON.parse(record.payload_json),reference:record.reference};
   let content=record.attachment_base64;
   if(!content){content=base64(await createTripBrief(data,{loadAsset,createdAt:new Date(record.inquiry_created_at)}));await env.DB.prepare('UPDATE inquiry_notifications SET attachment_base64=? WHERE inquiry_id=?').bind(content,record.inquiry_id).run();}
   const f=briefFields(data);
   const response=await fetcher('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+env.RESEND_API_KEY,'Content-Type':'application/json','Idempotency-Key':'june-links/'+record.inquiry_id},signal:AbortSignal.timeout(12000),body:JSON.stringify({from:env.JUNE_LINKS_MAIL_FROM,to:[INQUIRY_RECIPIENT],reply_to:data.email,subject:`June Links inquiry | ${f.destination} | ${f.date} | ${record.reference}`,html:`<div style="font-family:Arial,sans-serif;color:#1f4d3a"><h2 style="font-family:Georgia,serif;font-weight:normal">A new June Links journey</h2><p><strong>${escape(f.destination)}</strong><br>Preferred arrival: ${escape(f.date)}<br>Reference: ${escape(record.reference)}</p><p>${escape(data.name)}<br>${escape(data.email)}</p><p>The complete branded trip brief is attached. Reply to this email to contact the traveler.</p><p style="font-size:12px;color:#677168">Inquiry only. No booking or payment commitment.</p></div>`,attachments:[{filename:record.filename,content,content_type:'application/pdf'}]})});
   if(!response.ok)throw Object.assign(Error('Mail provider rejected the request'),{code:'provider-'+response.status});
   const result=await response.json();if(typeof result.id!=='string'||!result.id)throw Object.assign(Error('Missing mail receipt'),{code:'invalid-receipt'});
   await env.DB.prepare("UPDATE inquiry_notifications SET status='sent',provider_id=?,error_code=NULL,lease_until=0,updated_at=? WHERE inquiry_id=?").bind(result.id,now(),record.inquiry_id).run();
  }catch(error){const delay=Math.min(3600000,60000*2**Math.min(record.attempts-1,6));await env.DB.prepare("UPDATE inquiry_notifications SET status='pending',next_attempt_at=?,lease_until=0,error_code=?,updated_at=? WHERE inquiry_id=?").bind(now()+delay,/^provider-\d{3}$/.test(error.code||'')?error.code:error.code==='invalid-receipt'?'invalid-receipt':'delivery-unavailable',now(),record.inquiry_id).run();}
  processed++;
 }
 return {processed,configured:true};
}

import {queueInquiryNotification,drainInquiryMail} from '../lib/inquiry-mail.mjs';
const securityHeaders = {
  'X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin',
  'Permissions-Policy':'camera=(), microphone=(), geolocation=(self)',
  'X-Robots-Tag':'noindex, nofollow',
  'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; worker-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'",
  'Strict-Transport-Security':'max-age=31536000'
};
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{...securityHeaders,'Content-Type':'application/json','Cache-Control':'no-store'}});
const enums={tier:['base','mid','premium'],destination:['undecided','algarve','maui','la-quinta','adare','andermatt','bernardus','brohof','standrews','pebble','cape','quinta','worldwide','other'],flexibility:['undecided','fixed','week','month','open'],pace:['balanced','relaxed','focused','intensive','advice'],budget:['undecided','under-1500','1500-3000','3000-5000','5000-8000','8000-plus'],currency:['USD','CAD','GBP','EUR'],transport:['undecided','advice','own','transfers','driver','rental'],accommodation:['undecided','advice','own','boutique','resort','luxury'],contactPreference:['email','phone']};
const lengths={departureCity:120,name:120,email:254,phone:40,otherDestination:160,travelWindow:120,courses:1000,notes:1500,timezone:120,bestTime:120,destinationText:240,requestedVenue:200,requestedCountry:120,requestedRegion:240};
const interests=['Sightseeing','Dining','Beaches','Spa and relaxation','Wine and local culture','Non-golfer activities'];
async function hash(value){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(v=>v.toString(16).padStart(2,'0')).join('');}
function validate(data){
  if(!data||typeof data!=='object'||Array.isArray(data))return {error:'Please send a valid trip inquiry.'};
  const clean={};
  for(const [field,max] of Object.entries(lengths)){const val=data[field]??'';if(typeof val!=='string'||val.length>max)return {error:`Please check the ${field} field.`};clean[field]=val.trim();}
  if(!clean.name||!clean.email||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean.email))return {error:'Please provide your name and a valid email address.'};
  clean.email=clean.email.toLowerCase();
  if(data.consent!==true)return {error:'Please confirm the inquiry privacy notice and age requirement.'};
  clean.consent=true;
  for(const [field,values] of Object.entries(enums)){if(!values.includes(data[field]))return {error:`Please choose a valid ${field} option.`};clean[field]=data[field];}
  if(data.budgetLevel!==undefined){if(!((typeof data.budgetLevel==='number'&&Number.isInteger(data.budgetLevel)&&data.budgetLevel>=0&&data.budgetLevel<=4)||(typeof data.budgetLevel==='string'&&/^[0-4]$/.test(data.budgetLevel))))return {error:'Please choose a valid spending comfort level.'};clean.budgetLevel=Number(data.budgetLevel);clean.budget='undecided';}
  for(const [field,min,max] of [['nights',1,60],['travelers',1,100],['golfers',1,100],['golfDays',0,61]]){if(data[field]===''||data[field]==null){clean[field]=null;continue;}const input=data[field];if(typeof input!=='number'&&!(typeof input==='string'&&/^\d+$/.test(input)))return {error:`Please check ${field}.`};const val=Number(input);if(!Number.isInteger(val)||val<min||val>max)return {error:`Please check ${field}.`};clean[field]=val;}
  if(clean.travelers&&clean.golfers>clean.travelers)return {error:'Golfers cannot exceed total travelers.'};
  if(clean.nights&&clean.golfDays>clean.nights+1)return {error:'Golf days cannot exceed nights away plus one.'};
  if(clean.contactPreference==='phone'&&!clean.phone)return {error:'Add your phone number or choose an email reply.'};
  clean.arrival=data.arrival??'';
  if(typeof clean.arrival!=='string'||(clean.arrival&&(!/^\d{4}-\d{2}-\d{2}$/.test(clean.arrival)||Number.isNaN(Date.parse(clean.arrival))||new Date(clean.arrival).toISOString().slice(0,10)!==clean.arrival)))return {error:'Please check your arrival date.'};
  if(!Array.isArray(data.interests)||data.interests.length>6||data.interests.some(v=>!interests.includes(v)))return {error:'Please check your selected interests.'};
  clean.interests=[...new Set(data.interests)];
  if(typeof data.submissionId!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(data.submissionId))return {error:'Please refresh this page before submitting your inquiry.'};
  return {clean,id:data.submissionId};
}
const mailAssets=async path=>{const asset=ASSETS[path];if(!asset)throw Error('PDF asset unavailable');return assetBytes(path,asset);};
export const sendPendingInquiryMail=env=>drainInquiryMail(env,{loadAsset:mailAssets});
function scheduleMail(env,ctx){if(ctx?.waitUntil)ctx.waitUntil(sendPendingInquiryMail(env).catch(()=>{}));}
async function inquiry(request,env,ctx){
  if(request.method!=='POST')return json({error:'Method not allowed.'},405);
  if(request.headers.get('Origin')!==new URL(request.url).origin)return json({error:'Please submit from the June Links website.'},403);
  if(request.headers.get('Content-Type')?.split(';',1)[0].trim().toLowerCase()!=='application/json')return json({error:'Please submit a valid inquiry.'},415);
  if(Number(request.headers.get('Content-Length'))>14000)return json({error:'Your inquiry is too long.'},413);
  let raw='';try{const reader=request.body?.getReader();if(!reader)return json({error:'An inquiry is required.'},400);const decoder=new TextDecoder();let size=0;while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>14000){await reader.cancel();return json({error:'Your inquiry is too long.'},413);}raw+=decoder.decode(value,{stream:true});}raw+=decoder.decode();}catch{return json({error:'We could not read your inquiry.'},400);}
  let data;try{data=JSON.parse(raw);}catch{return json({error:'Please submit a valid inquiry.'},400);}
  if(data&&data.website)return json({error:'We could not accept this inquiry.'},400);
  const result=validate(data);if(result.error)return json({error:result.error},400);
  if(!env.DB)return json({error:'Inquiry capture is temporarily unavailable. Your details have not been submitted; please try again later.'},503);
  const {clean,id}=result,payload=JSON.stringify(clean),payloadHash=await hash(payload),now=Date.now();
  const findExisting=()=>env.DB.prepare('SELECT reference, payload_hash FROM inquiries WHERE id = ?').bind(id).first();
  async function saved(reference,status){
    let emailStatus='unavailable';
    try{emailStatus=await queueInquiryNotification(env,id,clean,now);scheduleMail(env,ctx);}catch{
      // The inquiry is durable even if the notification table is temporarily unavailable.
    }
    return json({reference,emailStatus},status);
  }
  const replay=existing=>existing.payload_hash===payloadHash?saved(existing.reference,200):
    json({error:'An inquiry with different details was already saved for this attempt. Contact info@junelinks.com to correct it.'},409);
  try{
    const existing=await findExisting();
    if(existing)return replay(existing);
    // Accept today's date anywhere in the world. The form also checks local time.
    const earliest=new Date(now-12*3600000).toISOString().slice(0,10);
    if(clean.arrival&&clean.arrival<earliest)return json({error:'Choose an arrival date that has not passed.'},400);
    const bucket=Math.floor(now/3600000),network=request.headers.get('CF-Connecting-IP')||'local';
    const key=await hash(`${bucket}:${network}`);
    const limit=await env.DB.prepare('INSERT INTO inquiry_limits (key,count,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count').bind(key,(bucket+2)*3600000).first();
    if(limit.count>10){const completed=await findExisting();return completed?replay(completed):json({error:'Too many inquiries from this connection. Please try again in an hour.'},429);}
    const reference=`JL-${id.slice(0,8).toUpperCase()}`;
    const inserted=await env.DB.prepare('INSERT INTO inquiries (id,reference,created_at,name,email,tier,destination,payload_json,payload_hash,status,privacy_version) VALUES (?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING RETURNING reference').bind(id,reference,now,clean.name,clean.email,clean.tier,clean.destination,payload,payloadHash,'new','2026-11-05').first();
    if(!inserted)return replay(await findExisting());
    if(ctx?.waitUntil)ctx.waitUntil(env.DB.prepare('DELETE FROM inquiry_limits WHERE expires_at < ?').bind(now).run().catch(()=>{}));
    return saved(inserted.reference,201);
  }catch{return json({error:'We could not confirm receipt. Your details are still in the form. Select Send again to retry safely.'},503);}
}

// The browser requests only a venue ID. No visitor-supplied remote URL is fetched.
let venueMedia;
const photoCache=new Map();let photoCacheBytes=0;
function cachePhoto(id,bytes,type){while(photoCache.size>=24||photoCacheBytes+bytes.byteLength>8*1024*1024){const oldest=photoCache.keys().next().value;if(!oldest)break;photoCacheBytes-=photoCache.get(oldest).bytes.byteLength;photoCache.delete(oldest);}photoCache.set(id,{bytes,type,expires:Date.now()+604800000});photoCacheBytes+=bytes.byteLength;}

async function venuePhoto(request,path){
  if(!['GET','HEAD'].includes(request.method))return new Response(null,{status:405,headers:securityHeaders});
  const id=path.slice('/api/venue-photo/'.length);
  if(!/^(Q[0-9]+|adare|andermatt|bernardus|brohof)$/.test(id))return new Response(null,{status:404,headers:securityHeaders});
  if(!venueMedia){try{venueMedia=JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(ASSETS['/assets/venue-media.json'].body),c=>c.charCodeAt(0)))).venues;}catch{return new Response(null,{status:503,headers:securityHeaders});}}
  const remote=venueMedia[id]?.remote;if(!remote)return new Response(null,{status:404,headers:securityHeaders});
  let url;try{url=new URL(remote);}catch{return new Response(null,{status:404,headers:securityHeaders});}
  if(url.protocol!=='https:'||!['upload.wikimedia.org','thumb.wikimedia.org'].includes(url.hostname)||!url.pathname.startsWith('/wikipedia/commons/'))return new Response(null,{status:404,headers:securityHeaders});
  if(request.method==='HEAD')return new Response(null,{headers:{...securityHeaders,'Cache-Control':'public, max-age=604800'}});
  const bypass=request.headers.get('Cache-Control')==='no-store',cached=photoCache.get(id);if(!bypass&&cached&&cached.expires>Date.now())return new Response(cached.bytes,{headers:{...securityHeaders,'Content-Type':cached.type,'Cache-Control':'public, max-age=604800'}});
  if(!url.pathname.includes('/commons/thumb/')){const file=url.pathname.split('/').at(-1);url.pathname=url.pathname.replace('/wikipedia/commons/','/wikipedia/commons/thumb/')+'/960px-'+file;}
  try{
    const response=await fetch(url.href,{redirect:'error',signal:AbortSignal.timeout(6000),headers:{'User-Agent':'JuneLinks/1.0 (attributed venue photographs)'},cf:{cacheTtl:604800,cacheEverything:true}});
    const type=response.headers.get('Content-Type')?.split(';')[0];
    if(!response.ok||!['image/jpeg','image/png','image/webp'].includes(type)||Number(response.headers.get('Content-Length'))>2097152){await response.body?.cancel();return new Response(null,{status:502,headers:securityHeaders});}
    const reader=response.body?.getReader();if(!reader)return new Response(null,{status:502,headers:securityHeaders});
    const chunks=[];let size=0;while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>2097152){await reader.cancel();return new Response(null,{status:502,headers:securityHeaders});}chunks.push(value);}
    if(!size)return new Response(null,{status:502,headers:securityHeaders});const bytes=new Uint8Array(size);let offset=0;for(const part of chunks){bytes.set(part,offset);offset+=part.length;}
    if(!bypass)cachePhoto(id,bytes,type);
    return new Response(bytes,{headers:{...securityHeaders,'Content-Type':type,'Content-Length':String(size),'Cache-Control':'public, max-age=604800'}});
  }catch{return new Response(null,{status:502,headers:securityHeaders});}
}
// Native base64 decoding, bounded hot-asset reuse and exact video-range decoding.
const decodedAssets=new Map();let decodedBytes=0;
function decode(body){if(typeof Uint8Array.fromBase64==='function')return Uint8Array.fromBase64(body);const raw=atob(body),bytes=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);return bytes;}
function assetBytes(key,asset){if(decodedAssets.has(key))return decodedAssets.get(key);const bytes=decode(asset.body);if(bytes.length<2*1024*1024){while(decodedBytes+bytes.length>12*1024*1024){const oldest=decodedAssets.keys().next().value;if(!oldest)break;decodedBytes-=decodedAssets.get(oldest).length;decodedAssets.delete(oldest);}decodedAssets.set(key,bytes);decodedBytes+=bytes.length;}return bytes;}
function byteRange(asset,start,end){const first=Math.floor(start/3),last=Math.ceil((end+1)/3);return decode(asset.body.slice(first*4,last*4)).slice(start-first*3,end-first*3+1);}
export default {scheduled(controller,env,ctx){ctx.waitUntil(sendPendingInquiryMail(env));},async fetch(request,env,ctx){
 const path=new URL(request.url).pathname;
 if(path==='/api/inquiries')return inquiry(request,env,ctx);
 if(path.startsWith('/api/venue-photo/'))return venuePhoto(request,path);
 if(request.method!=='GET'&&request.method!=='HEAD')return new Response('Method not allowed',{status:405,headers:securityHeaders});
 const key=path==='/'?'/index.html':['/privacy','/terms','/accessibility'].includes(path)?`${path}.html`:path,asset=ASSETS[key];
 if(!asset)return new Response('Page not found. Visit June Links at /',{status:404,headers:securityHeaders});
 const headers={...securityHeaders,'Content-Type':asset.type,'Cache-Control':path.startsWith('/assets/')?'public, max-age=86400':'no-cache',ETag:asset.etag};
 // Keep the published contact links readable without an edge-injected script.
 if(asset.type.startsWith('text/html'))headers['Cache-Control']+=', no-transform';
 if(request.headers.get('If-None-Match')===asset.etag)return new Response(null,{status:304,headers});
 if(asset.type==='video/mp4'){
  const length=asset.byteLength;headers['Accept-Ranges']='bytes';headers['Content-Length']=String(length);
  const range=request.headers.get('Range');
  if(range){const match=/^bytes=(\d*)-(\d*)$/.exec(range);if(!match||(!match[1]&&!match[2]))return new Response(null,{status:416,headers:{...headers,'Content-Range':`bytes */${length}`,'Content-Length':'0'}});
   const start=match[1]?Number(match[1]):Math.max(0,length-Number(match[2])),end=match[1]?(match[2]?Math.min(Number(match[2]),length-1):length-1):length-1;
   if(start>=length||start>end)return new Response(null,{status:416,headers:{...headers,'Content-Range':`bytes */${length}`,'Content-Length':'0'}});
   headers['Content-Range']=`bytes ${start}-${end}/${length}`;headers['Content-Length']=String(end-start+1);
   return new Response(request.method==='HEAD'?null:byteRange(asset,start,end),{status:206,headers});
  }
 }
 return new Response(request.method==='HEAD'?null:assetBytes(key,asset),{headers});
}};

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {DatabaseSync} from 'node:sqlite';
import {PDFDocument} from 'pdf-lib';
import {createTripBrief,tripFilename,briefFields} from '../lib/trip-brief.mjs';
import {queueInquiryNotification,drainInquiryMail,INQUIRY_RECIPIENT} from '../lib/inquiry-mail.mjs';
const data={reference:'JL-TEST0001',name:'QA <Traveler>',email:'test@example.com',phone:'',departureCity:'Toronto',requestedVenue:'The Golf Course at Adare Manor',requestedCountry:'Ireland',requestedRegion:'Adare, County Limerick',destination:'adare',arrival:'2026-11-25',nights:6,travelers:5,golfers:3,golfDays:4,tier:'base',flexibility:'week',budget:'3000-5000',currency:'USD',pace:'balanced',transport:'advice',accommodation:'advice',interests:['Dining'],timezone:'Africa/Accra',bestTime:'Weekday afternoons, noon–5 pm',contactPreference:'email'};
const loadAsset=async path=>new Uint8Array(await readFile('public'+path));
async function fixture(){const sql=new DatabaseSync(':memory:');for(const f of (await readdir('drizzle')).filter(f=>f.endsWith('.sql')).sort())sql.exec(await readFile('drizzle/'+f,'utf8'));const DB={prepare(q){let args=[];return {bind(...v){args=v;return this;},async first(){return sql.prepare(q).get(...args)||null;},async run(){return sql.prepare(q).run(...args);}};}};sql.prepare('INSERT INTO inquiries VALUES (?,?,?,?,?,?,?,?,?,?,?)').run('test-id',data.reference,Date.parse('2026-11-04T16:00:00Z'),data.name,data.email,data.tier,data.destination,JSON.stringify(data),'test-hash','new','test');return {sql,DB};}
test('PDF filenames use venue and desired date without contact details or path characters',()=>{
 assert.equal(tripFilename(data),'Adare-Manor_2026-11-25.pdf');
 assert.equal(tripFilename({...data,arrival:'',travelWindow:'Spring 2027'}),'Adare-Manor_Spring-2027.pdf');
 assert.equal(tripFilename({...data,destination:'worldwide',requestedVenue:'../../Royal & Ancient / Club',arrival:''}),'Royal-Ancient-Club_Dates-to-discuss.pdf');
});
test('the PDF keeps requested preferences and zero golf days instead of displaying raw option codes',()=>{
 const fields=briefFields({...data,golfDays:0});assert.equal(fields.golfDays,'0');assert.equal(fields.tier,'The Round - Golf only');assert.match(fields.party,/2 non-golfing companions/);assert.equal(fields.date,'25 November 2026');assert.equal(fields.location,'Adare, County Limerick, Ireland');
});
test('the branded PDF is valid and long preferences flow to additional pages',async()=>{
 const normal=await createTripBrief(data,{loadAsset});assert.equal(new TextDecoder().decode(normal.subarray(0,5)),'%PDF-');assert.equal((await PDFDocument.load(normal)).getPageCount(),1);
 const extended=await createTripBrief({...data,courses:'Course preference. '.repeat(50),notes:'Long planning request. '.repeat(70),name:'Long traveler name '.repeat(6),email:'long-contact-'.repeat(15)+'@example.com'},{loadAsset});assert.ok((await PDFDocument.load(extended)).getPageCount()>1);
});
test('unconfigured email stays durably pending and submission retries create only one notification',async()=>{
 const {DB,sql}=await fixture();assert.equal(await queueInquiryNotification({DB},'test-id',data,1000),'pending-setup');await queueInquiryNotification({DB},'test-id',data,1000);assert.equal(sql.prepare('SELECT count(*) AS n FROM inquiry_notifications').get().n,1);assert.deepEqual(await drainInquiryMail({DB},{loadAsset,fetcher:()=>assert.fail('Must not call a mail provider')}),{processed:0,configured:false});
});
test('automatic email attaches a real PDF, uses the fixed owner recipient and sends only once',async()=>{
 const {DB,sql}=await fixture(),env={DB,RESEND_API_KEY:'test-key',JUNE_LINKS_MAIL_FROM:'June Links <test@example.com>'};await queueInquiryNotification(env,'test-id',data,1000);let calls=0;
 const fetcher=async(url,request)=>{calls++;assert.equal(url,'https://api.resend.com/emails');assert.equal(request.headers['Idempotency-Key'],'june-links/test-id');const body=JSON.parse(request.body);assert.deepEqual(body.to,[INQUIRY_RECIPIENT]);assert.equal(body.reply_to,data.email);assert.match(body.html,/QA &lt;Traveler&gt;/);assert.equal(body.attachments[0].filename,'Adare-Manor_2026-11-25.pdf');assert.equal(Buffer.from(body.attachments[0].content,'base64').subarray(0,5).toString(),'%PDF-');return Response.json({id:'mail-receipt'});};
 await drainInquiryMail(env,{loadAsset,fetcher,now:()=>1001,max:1});await queueInquiryNotification(env,'test-id',data,1002);await drainInquiryMail(env,{loadAsset,fetcher,now:()=>1003,max:1});assert.equal(calls,1);assert.equal(sql.prepare('SELECT status FROM inquiry_notifications').get().status,'sent');
});
test('provider failure preserves the inquiry and retries the exact attachment with the same idempotency key',async()=>{
 const {DB,sql}=await fixture(),env={DB,RESEND_API_KEY:'test',JUNE_LINKS_MAIL_FROM:'test@example.com'};await queueInquiryNotification(env,'test-id',data,1000);const requests=[];let time=1001;
 const fetcher=async(url,request)=>{requests.push({body:request.body,key:request.headers['Idempotency-Key']});return requests.length===1?new Response('unavailable',{status:503}):Response.json({id:'retry-receipt'});};
 await drainInquiryMail(env,{loadAsset,fetcher,now:()=>time,max:1});assert.equal(sql.prepare('SELECT count(*) AS n FROM inquiries').get().n,1);let row=sql.prepare('SELECT * FROM inquiry_notifications').get();assert.equal(row.status,'pending');assert.ok(row.attachment_base64);assert.equal(row.error_code,'provider-503');
 time=row.next_attempt_at+1;await drainInquiryMail(env,{loadAsset,fetcher,now:()=>time,max:1});assert.equal(requests.length,2);assert.deepEqual(requests[0],requests[1]);assert.equal(sql.prepare('SELECT status FROM inquiry_notifications').get().status,'sent');
});
test('simultaneous queue drains cannot claim the same inquiry twice',async()=>{
 const {DB}=await fixture(),env={DB,RESEND_API_KEY:'test',JUNE_LINKS_MAIL_FROM:'test@example.com'};await queueInquiryNotification(env,'test-id',data,1000);let calls=0;const options={loadAsset,now:()=>1001,max:1,fetcher:async()=>{calls++;return Response.json({id:'single-receipt'});}};await Promise.all([drainInquiryMail(env,options),drainInquiryMail(env,options)]);assert.equal(calls,1);
});
test('new PDF briefs carry a spending preference while historical briefs retain the original budget',()=>{assert.equal(briefFields({...data,budgetLevel:3}).budget,'$$$ - Luxury');assert.equal(briefFields({...data,budgetLevel:0}).budget,'Open to guidance');assert.match(briefFields(data).budget,/3,000-5,000/);assert.equal(tripFilename({...data,destination:'other',requestedVenue:'',destinationText:'A destination beyond the directory'}),'A-destination-beyond-the-directory_2026-11-25.pdf');});

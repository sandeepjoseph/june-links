import {test,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFile,readdir} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import worker from '../worker/index.js';
let sql,DB;
beforeEach(async()=>{sql=new DatabaseSync(':memory:');for(const f of (await readdir('drizzle')).filter(f=>f.endsWith('.sql')))sql.exec(await readFile('drizzle/'+f,'utf8'));DB={prepare(q){let a=[];return {bind(...v){a=v;return this;},async first(){return sql.prepare(q).get(...a)||null;},async run(){return sql.prepare(q).run(...a);}};}};});
const payload=(change={})=>({name:'QA Traveler',email:'test@example.com',phone:'',tier:'premium',destination:'algarve',flexibility:'open',pace:'balanced',budget:'3000-5000',currency:'USD',transport:'transfers',accommodation:'resort',contactPreference:'email',nights:'6',travelers:'4',golfers:'3',golfDays:'4',arrival:'',interests:['Sightseeing'],consent:true,submissionId:randomUUID(),...change});
const submit=(data,headers={})=>worker.fetch(new Request('https://test.junelinks.com/api/inquiries',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://test.junelinks.com',...headers},body:JSON.stringify(data)}),{DB});
test('preserves the selected IANA time zone and preferred local contact window separately',async()=>{const res=await submit(payload({timezone:'Australia/Eucla',bestTime:'Weekday afternoons, noon–5 pm'}));assert.equal(res.status,201);const data=JSON.parse(sql.prepare('SELECT payload_json FROM inquiries').get().payload_json);assert.equal(data.timezone,'Australia/Eucla');assert.equal(data.bestTime,'Weekday afternoons, noon–5 pm');});
test('contact timing remains optional and rejects malformed or oversized values',async()=>{assert.equal((await submit(payload({timezone:'',bestTime:''}))).status,201);for(const value of [{timezone:'x'.repeat(121)},{bestTime:'x'.repeat(121)},{timezone:[]},{bestTime:{}}])assert.equal((await submit(payload(value))).status,400);});
test('preserves a chosen departure city without requiring device location',async()=>{const res=await submit(payload({departureCity:'Toronto'}));assert.equal(res.status,201);const record=JSON.parse(sql.prepare('SELECT payload_json FROM inquiries').get().payload_json);assert.equal(record.departureCity,'Toronto');assert.equal((await submit(payload({departureCity:'x'.repeat(121)}))).status,400);});
test('saves a real, complete lead and returns a reference',async()=>{const res=await submit(payload());assert.equal(res.status,201);assert.match((await res.json()).reference,/^JL-/);const row=sql.prepare('SELECT payload_json FROM inquiries').get();assert.equal(JSON.parse(row.payload_json).golfDays,4);assert.equal(JSON.parse(row.payload_json).interests[0],'Sightseeing');});
test('retrying the same submission does not duplicate the lead',async()=>{const data=payload();const first=await(await submit(data)).json();const second=await(await submit(data)).json();assert.equal(first.reference,second.reference);assert.equal(sql.prepare('SELECT count(*) AS n FROM inquiries').get().n,1);});
test('rejects a reused submission ID with changed information',async()=>{const data=payload();await submit(data);assert.equal((await submit({...data,name:'Another person'})).status,409);});
test('name, email and tier are mandatory; phone stays optional',async()=>{for(const v of [{name:''},{email:''},{tier:''},{email:'invalid'}])assert.equal((await submit(payload(v))).status,400);assert.equal((await submit(payload({phone:''}))).status,201);});
test('rejects impossible golfer and itinerary counts',async()=>{for(const v of [{golfers:5,travelers:4},{golfDays:8,nights:6},{golfDays:-1},{nights:2.5}])assert.equal((await submit(payload(v))).status,400);});
test('supports zero golf days and unspecified dates',async()=>{assert.equal((await submit(payload({golfDays:0,arrival:''}))).status,201);});
test('requires privacy acknowledgment and phone if a callback is requested',async()=>{for(const v of [{consent:false},{consent:'true'},{contactPreference:'phone',phone:''}])assert.equal((await submit(payload(v))).status,400);});
test('blocks cross-origin submission and automated honeypot submissions',async()=>{assert.equal((await submit(payload(),{Origin:'https://other.example'})).status,403);assert.equal((await submit(payload({website:'bot.example'}))).status,400);});
test('rejects null, unknown options, impossible dates and oversized notes',async()=>{for(const v of [null,payload({tier:'free'}),payload({arrival:'2027-02-30'}),payload({notes:'x'.repeat(1501)})])assert.equal((await submit(v)).status,400);});
test('rate limits submissions without exposing a public lead list',async()=>{for(let i=0;i<10;i++)assert.equal((await submit(payload())).status,201);assert.equal((await submit(payload())).status,429);const res=await worker.fetch(new Request('https://test.junelinks.com/api/inquiries'),{DB});assert.equal(res.status,405);});
test('reports an unavailable database honestly',async()=>{const res=await worker.fetch(new Request('https://test.junelinks.com/api/inquiries',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://test.junelinks.com'},body:JSON.stringify(payload())}),{});assert.equal(res.status,503);});
test('serves all policy routes and protects page content',async()=>{for(const path of ['/','/privacy','/terms','/accessibility']){const res=await worker.fetch(new Request('https://test.junelinks.com'+path),{DB});assert.equal(res.status,200);assert.match(res.headers.get('Content-Security-Policy'),/default-src 'self'/);}});

test('preserves a worldwide venue and its regional context',async()=>{const res=await submit(payload({destination:'worldwide',destinationText:'Pebble Beach Golf Links · Pebble Beach, California, United States',requestedVenue:'Pebble Beach Golf Links',requestedCountry:'United States',requestedRegion:'Pebble Beach, California'}));assert.equal(res.status,201);const data=JSON.parse(sql.prepare('SELECT payload_json FROM inquiries').get().payload_json);assert.equal(data.requestedRegion,'Pebble Beach, California');assert.equal(data.requestedVenue,'Pebble Beach Golf Links');});
test('supports byte-range loading for the real course film',async()=>{const res=await worker.fetch(new Request('https://test.junelinks.com/assets/brand/journeys-film-1080.mp4',{headers:{Range:'bytes=0-31'}}),{DB});assert.equal(res.status,206);assert.equal((await res.arrayBuffer()).byteLength,32);assert.match(res.headers.get('Content-Range'),/^bytes 0-31\//);});

test('video byte ranges preserve exact bytes across base64 boundaries',async()=>{
 const expected=await readFile('public/assets/brand/journeys-film-1080.mp4');
 for(const [start,end] of [[0,0],[1,7],[2,31],[1001,1129],[expected.length-19,expected.length-1]]){
  const res=await worker.fetch(new Request('https://test.junelinks.com/assets/brand/journeys-film-1080.mp4',{headers:{Range:`bytes=${start}-${end}`}}),{});
  assert.equal(res.status,206);assert.deepEqual(Buffer.from(await res.arrayBuffer()),expected.subarray(start,end+1));
 }
 const suffix=await worker.fetch(new Request('https://test.junelinks.com/assets/brand/journeys-film-1080.mp4',{headers:{Range:'bytes=-13'}}),{});assert.deepEqual(Buffer.from(await suffix.arrayBuffer()),expected.subarray(-13));
 for(const range of ['bytes=invalid','bytes=999999999999-','bytes=-0']){const res=await worker.fetch(new Request('https://test.junelinks.com/assets/brand/journeys-film-1080.mp4',{headers:{Range:range}}),{});assert.equal(res.status,416);assert.equal(res.headers.get('Content-Length'),'0');assert.equal((await res.arrayBuffer()).byteLength,0);}
});
test('static assets revalidate without resending a body',async()=>{
 const request=new Request('https://test.junelinks.com/collection.js'),first=await worker.fetch(request,{}),etag=first.headers.get('ETag');assert.ok(etag);
 const fresh=await worker.fetch(new Request(request,{headers:{'If-None-Match':etag}}),{});assert.equal(fresh.status,304);assert.equal((await fresh.arrayBuffer()).byteLength,0);
 const head=await worker.fetch(new Request(request,{method:'HEAD'}),{});assert.equal(head.status,200);assert.equal((await head.arrayBuffer()).byteLength,0);
});
test('preserves a destination typed outside the catalogue without requiring a venue ID',async()=>{const written='A private golf journey in a destination outside this directory';const res=await submit(payload({destination:'other',destinationText:written,otherDestination:written,requestedVenue:'',requestedCountry:'',requestedRegion:''}));assert.equal(res.status,201);const row=JSON.parse(sql.prepare('SELECT payload_json FROM inquiries').get().payload_json);assert.equal(row.destinationText,written);assert.equal(row.destination,'other');assert.equal(row.requestedVenue,'');});
test('saves relative spending comfort without assigning a dollar price band',async()=>{const res=await submit(payload({budgetLevel:'4'}));assert.equal(res.status,201);const row=JSON.parse(sql.prepare('SELECT payload_json FROM inquiries').get().payload_json);assert.equal(row.budgetLevel,4);assert.equal(row.budget,'undecided');});
test('rejects invalid relative spending levels while allowing guidance and all four levels',async()=>{for(const budgetLevel of [null,false,[],{},-1,5,2.5,'1.5','5000'])assert.equal((await submit(payload({budgetLevel}))).status,400);for(const budgetLevel of [0,1,2,3,4])assert.equal((await submit(payload({budgetLevel}))).status,201);});

test('concurrent retries return one saved inquiry and one queued notification',async()=>{
 const data=payload();
 const responses=await Promise.all([submit(data),submit(data)]);
 assert.deepEqual(responses.map(response=>response.status).sort(),[200,201]);
 const records=await Promise.all(responses.map(response=>response.json()));
 assert.equal(records[0].reference,records[1].reference);
 assert.equal(sql.prepare('SELECT count(*) AS n FROM inquiries').get().n,1);
 assert.equal(sql.prepare('SELECT count(*) AS n FROM inquiry_notifications').get().n,1);
});
test('rejects past dates, non-integer JSON types and disguised content types',async()=>{
 for(const invalid of [{arrival:'2000-01-01'},{arrival:[]},{golfers:true},{travelers:[4]},{travelers:-2},{travelers:2.5}]) assert.equal((await submit(payload(invalid))).status,400);
 assert.equal((await submit(payload(),{'Content-Type':'application/json-other'})).status,415);
 const valid=await submit(payload({name:'François Núñez',notes:'ゴルフ trip – no accommodation',arrival:''}));
 assert.equal(valid.status,201);
 assert.equal(sql.prepare('SELECT name FROM inquiries').get().name,'François Núñez');
});

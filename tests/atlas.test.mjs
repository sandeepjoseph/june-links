import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import worker from '../worker/index.js';
const media=JSON.parse(await readFile('public/assets/venue-media.json','utf8')).venues;
const photoId=Object.keys(media).find(id=>media[id].remote);
const imageRequest=id=>new Request('https://test.junelinks.com/api/venue-photo/'+id,{headers:{'Cache-Control':'no-store'}});
test('photo requests are limited to known venue IDs, never arbitrary URLs',async()=>{
 for(const id of ['https://example.com/image.jpg','Q0','Q1?url=https://example.com']){
  assert.equal((await worker.fetch(imageRequest(id),{})).status,404);
 }
});
test('known venue photography is served with a finite image body and no browser origin leakage',async t=>{
 let observed;t.mock.method(globalThis,'fetch',async(url,init)=>{observed={url,init};return new Response(new Uint8Array([255,216,255,217]),{headers:{'Content-Type':'image/jpeg'}});});
 const res=await worker.fetch(imageRequest(photoId),{});assert.equal(res.status,200);assert.equal((await res.arrayBuffer()).byteLength,4);assert.equal(new URL(observed.url).protocol,'https:');assert.ok(['upload.wikimedia.org','thumb.wikimedia.org'].includes(new URL(observed.url).hostname));assert.equal(observed.init.redirect,'error');assert.deepEqual(Object.keys(observed.init.headers),['User-Agent']);assert.match(res.headers.get('Cache-Control'),/604800/);
});
test('photo service refuses non-image responses, upstream failures and oversized bodies',async t=>{
 for(const response of [()=>new Response('<html>wrong</html>',{headers:{'Content-Type':'text/html'}}),()=>new Response(null,{status:429}),()=>new Response(new Uint8Array(2097153),{headers:{'Content-Type':'image/jpeg'}})]){
  const mock=t.mock.method(globalThis,'fetch',async()=>response());assert.equal((await worker.fetch(imageRequest(photoId),{})).status,502);mock.mock.restore();
 }
});
test('photo service preserves natural network failure and never follows a redirect',async t=>{
 t.mock.method(globalThis,'fetch',async()=>{throw new TypeError('redirect refused');});assert.equal((await worker.fetch(imageRequest(photoId),{})).status,502);
});
test('photo HEAD and unsupported methods never fetch the source',async t=>{
 const fetch=t.mock.method(globalThis,'fetch',async()=>{throw new Error('must not fetch');});
 assert.equal((await worker.fetch(new Request(imageRequest(photoId),{method:'HEAD'}),{})).status,200);assert.equal((await worker.fetch(new Request(imageRequest(photoId),{method:'POST'}),{})).status,405);assert.equal(fetch.mock.callCount(),0);
});

test('repeated public venue-photo requests reuse the bounded image cache',async t=>{
 const source=t.mock.method(globalThis,'fetch',async()=>new Response(new Uint8Array([255,216,255,217]),{headers:{'Content-Type':'image/jpeg'}}));
 const request=new Request('https://test.junelinks.com/api/venue-photo/'+photoId);
 assert.equal((await worker.fetch(request,{})).status,200);assert.equal((await worker.fetch(request,{})).status,200);assert.equal(source.mock.callCount(),1);
});

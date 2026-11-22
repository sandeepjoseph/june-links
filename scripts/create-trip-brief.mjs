import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createTripBrief,tripFilename} from '../lib/trip-brief.mjs';
const source=process.argv[2];if(!source)throw Error('Provide the trip-brief text or JSON path.');
const input=await readFile(source,'utf8');let data;
if(source.endsWith('.json'))data=JSON.parse(input);else{
 data={};for(const line of input.split('\n')){const match=/^([^:]+):\s*(.*)$/.exec(line);if(!match)continue;let key=match[1]==='Reference'?'reference':match[1].replace(/\s+([a-zA-Z])/g,(_,c)=>c.toUpperCase());if(key==='interests')data[key]=match[2].split(',').map(s=>s.trim());else data[key]=match[2];}
}
const bytes=await createTripBrief(data,{loadAsset:async path=>new Uint8Array(await readFile(resolve('public'+path)))});
const out=resolve(process.argv[3]||'output/pdf');await mkdir(out,{recursive:true});const file=out+'/'+tripFilename(data);await writeFile(file,bytes);console.log(JSON.stringify({file,bytes:bytes.length}));

import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createTripBriefTemplate} from '../lib/trip-brief-template.mjs';
const dir=resolve(process.argv[2]||'output/pdf');await mkdir(dir,{recursive:true});
const bytes=await createTripBriefTemplate({loadAsset:async path=>new Uint8Array(await readFile(resolve('public'+path)))});
const file=dir+'/June-Links-Trip-Brief-Template.pdf';await writeFile(file,bytes);console.log(JSON.stringify({file,bytes:bytes.length}));

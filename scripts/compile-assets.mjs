import {readdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {extname,join} from 'node:path';
import {build} from 'esbuild';
await build({entryPoints:['lib/browser-trip-pdf.mjs'],bundle:true,format:'esm',platform:'browser',target:'es2022',minify:true,outfile:'public/trip-pdf.js',legalComments:'eof'});
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.webp':'image/webp','.jpg':'image/jpeg','.jpeg':'image/jpeg','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon','.woff2':'font/woff2','.txt':'text/plain; charset=utf-8','.json':'application/json; charset=utf-8','.mp4':'video/mp4'};
types['.ttf']='font/ttf';
const assets={};
async function walk(dir,prefix=''){for(const entry of (await readdir(dir,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){const file=join(dir,entry.name),url=prefix+'/'+entry.name;if(entry.isDirectory())await walk(file,url);else if(types[extname(file)]){const bytes=await readFile(file);assets[url]={type:types[extname(file)],body:bytes.toString('base64'),byteLength:bytes.length,etag:'"'+createHash('sha256').update(bytes).digest('hex').slice(0,24)+'"'};}}}
await walk('public');
const compiled=await build({entryPoints:['worker/handler.js'],bundle:true,format:'esm',platform:'browser',target:'es2022',minify:true,write:false,legalComments:'eof'});
const runtime=compiled.outputFiles[0].text;
await writeFile('worker/index.js','// Generated from public/ and worker/handler.js by npm run build.\nconst ASSETS = '+JSON.stringify(assets)+';\n'+runtime);
console.log(`Embedded ${Object.keys(assets).length} local assets; no third-party browser requests.`);

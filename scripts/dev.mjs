import http from 'node:http';
import {existsSync} from 'node:fs';
import {readFile,readdir,mkdir} from 'node:fs/promises';
import {DatabaseSync} from 'node:sqlite';
import {pathToFileURL} from 'node:url';
await mkdir('.local',{recursive:true});
if(existsSync('.env.local'))process.loadEnvFile('.env.local');
const sql=new DatabaseSync('.local/inquiries.sqlite');
sql.exec('CREATE TABLE IF NOT EXISTS _dev_migrations (name TEXT PRIMARY KEY)');
for(const f of (await readdir('drizzle')).filter(f=>f.endsWith('.sql')).sort()){if(!sql.prepare('SELECT name FROM _dev_migrations WHERE name = ?').get(f)){sql.exec(await readFile('drizzle/'+f,'utf8'));sql.prepare('INSERT INTO _dev_migrations VALUES (?)').run(f);}}
const DB={prepare(query){let args=[];return {bind(...v){args=v;return this;},async first(){return sql.prepare(query).get(...args)||null;},async run(){return sql.prepare(query).run(...args);}};}};
const module=await import(pathToFileURL(process.cwd()+'/worker/index.js').href),worker=module.default;
const env={DB,RESEND_API_KEY:process.env.RESEND_API_KEY,JUNE_LINKS_MAIL_FROM:process.env.JUNE_LINKS_MAIL_FROM};
const background=new Set();const ctx={waitUntil(promise){background.add(promise);promise.finally(()=>background.delete(promise)).catch(()=>{});}};
ctx.waitUntil(module.sendPendingInquiryMail(env).catch(()=>{}));
setInterval(()=>ctx.waitUntil(module.sendPendingInquiryMail(env).catch(()=>{})),60000).unref();
http.createServer(async(req,res)=>{try{const chunks=[];let bytes=0;for await(const c of req){bytes+=c.length;if(bytes>14000){res.writeHead(413,{'Content-Type':'application/json','Cache-Control':'no-store','Connection':'close'});res.end(JSON.stringify({error:'Your inquiry is too long.'}));return;}chunks.push(c);}const opts={method:req.method,headers:req.headers};if(req.method!=='GET'&&req.method!=='HEAD'){opts.body=Buffer.concat(chunks);opts.duplex='half';}const host=String(req.headers.host||'127.0.0.1:4173');const origin=/^[a-z0-9-]+\.trycloudflare\.com$/i.test(host)?'https://'+host:((host==='localhost:4173'||host==='127.0.0.1:4173')?'http://'+host:'http://127.0.0.1:4173');const request=new Request(origin+req.url,opts);const result=await worker.fetch(request,env,ctx);res.writeHead(result.status,Object.fromEntries(result.headers));res.end(Buffer.from(await result.arrayBuffer()));}catch{res.writeHead(500);res.end('Local preview error');}}).listen(4173,'127.0.0.1',()=>console.log('Local: http://127.0.0.1:4173'));

// Rebuild the local index from the public-domain IANA source snapshot.
import {readFile,writeFile} from 'node:fs/promises';
const source='source-media/timezones/';
const files=Object.fromEntries(await Promise.all(['version','zone1970.tab','zone.tab','iso3166.tab'].map(async name=>[name,await readFile(source+name,'utf8')])));
const rows=name=>files[name].split('\n').filter(line=>line&&!line.startsWith('#')).map(line=>line.split('\t'));
const countries=Object.fromEntries(rows('iso3166.tab').map(row=>[row[0],row[1]]));
Object.assign(countries,{GB:'United Kingdom',US:'United States',KR:'South Korea',KP:'North Korea'});
const zones=new Map();
for(const table of ['zone1970.tab','zone.tab'])for(const row of rows(table)){
 if(zones.has(row[2]))continue;
 zones.set(row[2],{id:row[2],city:row[2].split('/').at(-1).replaceAll('_',' '),countries:row[0].split(',').map(code=>countries[code]||code),region:row[3]||''});
}
zones.set('UTC',{id:'UTC',city:'Coordinated Universal Time',countries:[],region:'UTC GMT universal time'});
for(const zone of zones.values()){
 const names=new Set();
 for(const timeZoneName of ['longGeneric','long','short'])for(const month of [0,6]){
  try{names.add(new Intl.DateTimeFormat('en',{timeZone:zone.id,timeZoneName,year:'numeric'}).formatToParts(new Date(Date.UTC(2026,month,15))).find(part=>part.type==='timeZoneName').value);}catch{}
 }
 zone.names=[...names];
}
const data={version:files.version.trim(),source:'https://www.iana.org/time-zones',zones:[...zones.values()].sort((a,b)=>a.city<b.city?-1:a.city>b.city?1:a.id.localeCompare(b.id))};
await writeFile('public/assets/timezones.json',JSON.stringify(data)+'\n');
console.log(`${data.zones.length} time-zone locations, IANA ${data.version}`);

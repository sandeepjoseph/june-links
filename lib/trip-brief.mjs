import {PDFDocument,rgb} from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

const places={adare:'Adare Manor',andermatt:'Andermatt',bernardus:'Bernardus',brohof:'Bro Hof Slott',standrews:'St Andrews',pebble:'Pebble Beach',cape:'Cape Kidnappers',quinta:'Quinta do Lago',algarve:'The Algarve',maui:'Maui','la-quinta':'La Quinta'};
const labels={
 tier:{base:'The Round - Golf only',mid:'The Journey - Golf and transfers',premium:'The Signature - Golf, stays and more'},
 flexibility:{fixed:'Fixed dates',week:'A week either way',month:'Within the same month',open:'Open to recommendations',undecided:'To discuss'},
 pace:{balanced:'A balance of golf and exploring',relaxed:'A few rounds, plenty of downtime',focused:'Golf most days',intensive:'Golf every day / possible 36 holes',advice:'Help me decide'},
 transport:{undecided:'To discuss',advice:'Recommend an option',own:'Arranged by the traveler',transfers:'Airport and course transfers',driver:'Private driver request',rental:'Rental vehicle advice'},
 accommodation:{undecided:'To discuss',advice:'Open to suggestions',own:'Already arranged / not needed',boutique:'Boutique hotel',resort:'Full-service resort',luxury:'Luxury hotel or villa'},
 budget:{undecided:'Guidance requested','under-1500':'Under 1,500','1500-3000':'1,500-3,000','3000-5000':'3,000-5,000','5000-8000':'5,000-8,000','8000-plus':'8,000+'}
};
const text=value=>String(value??'').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').replace(/[\u2010-\u2015\u2212]/g,'-').trim();
const value=(data,key)=>text(data[key])||'To discuss';
const mapped=(data,key)=>labels[key]?.[data[key]]||value(data,key);
const number=value=>value!==''&&value!==null&&value!==undefined&&Number.isFinite(Number(value))?Number(value):null;
export const destinationName=data=>places[data.destination]||text(data.requestedVenue)||text(data.otherDestination)||text(data.destinationText).split(' · ')[0]||text(data.requestedCountry)||'Destination to discuss';
function slug(value,fallback){return text(value).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,80)||fallback;}
export function tripFilename(data){const date=/^\d{4}-\d{2}-\d{2}$/.test(data.arrival||'')?data.arrival:slug(data.travelWindow,'Dates-to-discuss');return slug(destinationName(data),'Destination-to-discuss')+'_'+date+'.pdf';}
export function spendingComfort(data){const level=Number(data.budgetLevel);if(data.budgetLevel!==undefined&&Number.isInteger(level)&&level>=0&&level<=4)return ['Open to guidance','$ - Considered','$$ - Elevated','$$$ - Luxury','$$$$ - Exceptional'][level];return data.budget==='undecided'?'Guidance requested':`${text(data.currency)||'USD'} ${mapped(data,'budget')} per person, excluding flights`;}
export function briefFields(data){
 const travelers=number(data.travelers),golfers=number(data.golfers),days=number(data.golfDays),nights=number(data.nights);
 const party=[travelers===null?'Group size to discuss':`${travelers} traveler${travelers===1?'':'s'}`,golfers===null?'Golfers to discuss':`${golfers} golfer${golfers===1?'':'s'}`];
 if(travelers!==null&&golfers!==null&&travelers>=golfers)party.push(`${travelers-golfers} non-golfing companion${travelers-golfers===1?'':'s'}`);
 let date='Dates to discuss';if(/^\d{4}-\d{2}-\d{2}$/.test(data.arrival||'')){const d=new Date(data.arrival+'T00:00:00Z');if(!Number.isNaN(d.valueOf()))date=new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(d);}
 return {destination:destinationName(data),location:[text(data.requestedRegion),text(data.requestedCountry)].filter(Boolean).join(', ')||(text(data.destinationText)&&text(data.destinationText)!==destinationName(data)?text(data.destinationText):'Destination details to be confirmed'),date,nights:nights===null?'To discuss':String(nights),golfDays:days===null?'To discuss':String(days),party:party.join(' / '),tier:mapped(data,'tier'),budget:spendingComfort(data),pace:mapped(data,'pace'),transport:mapped(data,'transport'),accommodation:mapped(data,'accommodation'),flexibility:mapped(data,'flexibility'),interests:Array.isArray(data.interests)&&data.interests.length?data.interests.map(text).join(', '):'To discuss'};
}

// Shared browser/server renderer. Assets are local and supplied by the caller;
// no personal inquiry data is sent to a rendering service or a public URL.
export async function createTripBrief(data,{loadAsset,createdAt=new Date()}={}){
 if(typeof loadAsset!=='function')throw Error('A local asset loader is required.');
 const pdf=await PDFDocument.create();pdf.registerFontkit(fontkit);
 const [regular,bold,serif,logo]=await Promise.all([
  loadAsset('/assets/pdf/dm-regular.ttf').then(b=>pdf.embedFont(b,{subset:true})),
  loadAsset('/assets/pdf/dm-semibold.ttf').then(b=>pdf.embedFont(b,{subset:true})),
  loadAsset('/assets/pdf/cormorant-medium.ttf').then(b=>pdf.embedFont(b,{subset:true})),
  loadAsset('/assets/pdf/june-links-logo.png').then(b=>pdf.embedPng(b))
 ]);
 const f=briefFields(data),W=595.28,H=841.89,M=42,C=W-M*2;
 const color=hex=>rgb(parseInt(hex.slice(0,2),16)/255,parseInt(hex.slice(2,4),16)/255,parseInt(hex.slice(4),16)/255);
 const green=color('1f4d3a'),gold=color('b6985e'),ivory=color('f8f3e9'),ink=color('233c32'),muted=color('677168'),line=color('d9d1be');
 let page,y,pageNo=0;
 function draw(s,x,top,size=10.5,font=regular,tone=ink){page.drawText(text(s),{x,y:H-top-size,font,size,color:tone});}
 function rule(top){page.drawLine({start:{x:M,y:H-top},end:{x:W-M,y:H-top},color:line,thickness:.65});}
 function lines(s,width,size=10.5,font=regular){const result=[];for(const para of text(s).split('\n')){let current='';for(const word of para.split(/\s+/)){if(font.widthOfTextAtSize(word,size)>width){if(current){result.push(current);current='';}let part='';for(const c of word){if(font.widthOfTextAtSize(part+c,size)>width){result.push(part);part='';}part+=c;}current=part;continue;}const next=current?current+' '+word:word;if(font.widthOfTextAtSize(next,size)>width&&current){result.push(current);current=word;}else current=next;}result.push(current);}return result;}
 function paragraph(s,x,top,width,size=10.5,font=regular,tone=ink,leading=14){const wrapped=lines(s,width,size,font);wrapped.forEach((v,i)=>draw(v,x,top+i*leading,size,font,tone));return wrapped.length*leading;}
 function newPage(){page=pdf.addPage([W,H]);pageNo++;page.drawRectangle({x:0,y:0,width:W,height:H,color:ivory});page.drawRectangle({x:0,y:H-4,width:W,height:4,color:gold});page.drawImage(logo,{x:M,y:H-76,width:216,height:36});draw('TRIP INQUIRY',W-M-117,39,8,bold,muted);draw(value(data,'reference'),W-M-117,53,12,bold,green);rule(91);y=112;}
 function ensure(height){if(y+height>759){newPage();draw('Your trip brief / continued',M,y,22,serif,green);y+=40;}}
 function section(title){ensure(51);draw(title,M,y,18,serif,green);y+=29;}
 function row(items){const gap=26,width=(C-gap)/2;const rendered=items.map(([label,v])=>({label,v,body:lines(v,items.length===1?C:width)}));const height=Math.max(...rendered.map(o=>o.body.length))*14+18;ensure(height);rendered.forEach((o,i)=>{const x=M+i*(width+gap);draw(o.label,x,y,8.5,bold,muted);o.body.forEach((t,j)=>draw(t,x,y+15+j*14,10.5,regular,ink));});y+=height+6;}
 newPage();draw('YOUR JOURNEY BRIEF',M,y,8.5,bold,gold);y+=17;
 y+=paragraph(f.destination,M,y,C,31,serif,green,33)+7;
 y+=paragraph(f.location,M,y,C,10.5,regular,muted,14)+16;
 const band=y;page.drawRectangle({x:M,y:H-band-64,width:C,height:64,color:green});
 const stats=[['PREFERRED ARRIVAL',f.date],['NIGHTS AWAY',f.nights],['DAYS WITH GOLF',f.golfDays]];
 stats.forEach(([label,v],i)=>{const x=M+16+i*(C/3);draw(label,x,band+12,7.5,bold,color('d4c18f'));paragraph(v,x,band+29,C/3-25,i===0?12:17,i===0?regular:serif,ivory,15);});y+=84;
 section('The shape of your stay');
 row([['Departing from',value(data,'departureCity')],['Your group',f.party]]);
 row([['Level of care',f.tier],[data.budgetLevel!==undefined?'Spending comfort':'Land budget',f.budget]]);
 row([['Date flexibility',f.flexibility],...(text(data.travelWindow)?[['Preferred travel window',text(data.travelWindow)]]:[])]);
 section('On the course. Beyond the fairway.');
 row([['Your pace',f.pace],['Ground transport',f.transport]]);
 row([['Accommodation',f.accommodation],['Time beyond golf',f.interests]]);
 for(const [title,key] of [['Courses and golf preferences','courses'],['Additional requests','notes']])if(text(data[key])){
  // Long requests flow across pages without truncation or fixed-height clipping.
  const wrapped=lines(data[key],C);let offset=0;
  while(offset<wrapped.length){ensure(58);draw(offset?title+' / continued':title,M,y,8.5,bold,muted);y+=16;const count=Math.max(1,Math.floor((748-y)/14));const chunk=wrapped.slice(offset,offset+count);chunk.forEach((s,i)=>draw(s,M,y+i*14));y+=chunk.length*14+14;offset+=chunk.length;if(offset<wrapped.length){newPage();y=112;}}
 }
 const left=[value(data,'name'),value(data,'email'),value(data,'phone')==='To discuss'?'Phone not provided':value(data,'phone')];
 const right=[data.contactPreference==='phone'?'Preferred reply: phone':'Preferred reply: email',`Time zone: ${text(data.timezone)||'To discuss'}`,text(data.bestTime)||'Contact time: to discuss'];
 const contactHeight=Math.max(left.reduce((h,s,i)=>h+lines(s,C/2-13,i===0?11.5:10.5,i===0?bold:regular).length*15+3,0),right.reduce((h,s)=>h+lines(s,C/2-13,10,regular).length*14+3,0));
 ensure(contactHeight+44);section('Let the conversation begin.');
 let lh=0,rh=0;left.forEach((s,i)=>{lh+=paragraph(s,M,y+lh,C/2-13,i===0?11.5:10.5,i===0?bold:regular,ink,15)+3;});right.forEach(s=>{rh+=paragraph(s,M+C/2+13,y+rh,C/2-13,10,regular,muted,14)+3;});y+=Math.max(lh,rh)+15;
 ensure(55);rule(y);y+=12;y+=paragraph('June Links will review your preferences and check the options with independent courses and travel providers. Your itinerary, inclusions and pricing remain subject to a written proposal.',M,y,C,9,regular,muted,12);
 for(const [i,p] of pdf.getPages().entries()){page=p;rule(784);draw('June Links | Golf journeys, worldwide',M,797,8.5,regular,muted);draw('junelinks.com',W-M-112,797,8.5,bold,green);draw('Inquiry only. No booking or payment commitment.',M,811,7.5,regular,muted);draw(`${i+1} / ${pdf.getPageCount()}`,W-M-24,811,7.5,regular,muted);}
 pdf.setTitle(`${f.destination} - June Links trip brief`);pdf.setAuthor('June Links');pdf.setSubject(`Trip inquiry ${value(data,'reference')}`);pdf.setCreator('June Links');pdf.setCreationDate(new Date(createdAt));pdf.setModificationDate(new Date(createdAt));
 return pdf.save();
}

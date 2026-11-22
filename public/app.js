/* June Links: progressive enhancement, no runtime dependencies. */
const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const form = $('#inquiry-form');
const paper = form.closest('.form-panel');
const paperObserver = new IntersectionObserver(([entry], observer) => {
  if (!entry.isIntersecting) return;
  paper.classList.add('paper-settled');
  observer.disconnect();
});
paperObserver.observe(paper);

let step = 1, savedInquiry = null, submissionId = crypto.randomUUID();
const tierNames = {base:'The Round',mid:'The Journey',premium:'The Signature'};
const destinations = {
  "ireland": {
    "id": "Q1881861",
    "name": "Royal County Down Golf Club",
    "country": "United Kingdom",
    "region": "Newcastle",
    "state": "Northern Ireland",
    "label": "Ireland",
    "locality": "Newcastle, Northern Ireland",
    "copy": "Dunes, coastal light and links golf at the foot of the Mournes.",
    "website": "https://www.royalcountydown.org/",
    "alt": "Morning light across the dunes and fairways of Royal County Down",
    "image": "/assets/collection/ireland-1920.webp"
  },
  "scotland": {
    "id": "cabot-old-petty",
    "name": "Old Petty at Cabot Highlands",
    "country": "United Kingdom",
    "region": "Inverness",
    "state": "Scotland",
    "label": "Scotland",
    "locality": "Inverness, Scottish Highlands",
    "copy": "Rolling links on the Moray Firth, with the Highlands beyond the fairway.",
    "website": "https://cabothighlands.com/golf?lang=en",
    "alt": "Old Petty at Cabot Highlands beside the Moray Firth in golden light",
    "image": "/assets/collection/scotland-1920.webp"
  },
  "usa": {
    "id": "Q534974",
    "name": "Pebble Beach Golf Links",
    "country": "United States",
    "region": "Pebble Beach",
    "state": "California",
    "label": "USA",
    "locality": "Pebble Beach, California",
    "copy": "Golf on the Monterey Peninsula, with the Pacific just beyond the green.",
    "website": "https://www.pebblebeach.com/golf/pebble-beach-golf-links/",
    "alt": "Aerial view of a Pebble Beach green above the rocky Pacific shoreline",
    "image": "/assets/collection/usa-1920.webp"
  },
  "mexico": {
    "id": "cabo-del-sol",
    "name": "Cabo Del Sol",
    "country": "Mexico",
    "region": "Los Cabos",
    "state": "Baja California Sur",
    "label": "Mexico",
    "locality": "Los Cabos, Baja California Sur",
    "copy": "Coastal rounds, desert landscapes and time by the Sea of Cortez.",
    "website": "https://cabodelsol.com/golf/",
    "alt": "A coastal green at Cabo Del Sol with palms and the sea at sunset",
    "image": "/assets/collection/mexico-1320.webp"
  },
  "england": {
    "id": "Q1636565",
    "name": "Royal Lytham & St Annes Golf Club",
    "country": "United Kingdom",
    "region": "Lytham St Annes",
    "state": "England",
    "label": "England",
    "locality": "Lytham St Annes, Lancashire",
    "copy": "Traditional links golf on the Lancashire coast.",
    "website": "https://www.royallytham.org/",
    "alt": "The eighteenth green and red brick clubhouse at Royal Lytham and St Annes",
    "image": "/assets/collection/england-1920.webp"
  }
};
const menuButton=$('.menu-toggle'),nav=$('#nav');
function setMenu(open){nav.classList.toggle('open',open);menuButton.setAttribute('aria-expanded',String(open));}
menuButton.addEventListener('click',()=>setMenu(!nav.classList.contains('open')));
$$('#nav a, .page-shortcuts a').forEach(link=>link.addEventListener('click',()=>{
 if(!nav.classList.contains('open'))return;
 setMenu(false);
 const destination=document.getElementById(link.hash.slice(1));
 if(destination){destination.tabIndex=-1;destination.focus({preventScroll:true});}
}));
document.addEventListener('keydown',event=>{
 if(event.key==='Escape'&&nav.classList.contains('open')){setMenu(false);menuButton.focus();}
});
const dialog=$('#destination-dialog');
$$('[data-destination]').forEach(link => link.addEventListener('click', event => {
  event.preventDefault();
  const destination = destinations[link.dataset.destination];
  $('#destination-content').innerHTML = `
    <img class="dialog-course-image" src="${destination.image}" alt="${destination.alt}">
    <p class="kicker">${destination.locality}</p>
    <h2 id="dialog-title">${destination.label}</h2>
    <h3>${destination.name.replaceAll('&', '&amp;')}</h3>
    <p>${destination.copy}</p>
    <p><a href="${destination.website}" target="_blank" rel="noopener noreferrer">Official venue information ↗</a></p>
    <p class="fine-print">Course access, tee times and travel arrangements are subject to confirmation.</p>
    <button type="button" class="button green" id="choose-destination">Plan a trip here <span aria-hidden="true">↗</span></button>`;
  $('#choose-destination').addEventListener('click', () => {
    dialog.close();
    window.chooseJuneVenue(destination);
  });
  dialog.showModal();
}));
$('.dialog-close').addEventListener('click',()=>dialog.close());dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
function goToInquiry(focus=$('#tier')){if(savedInquiry)resetForm();showStep(1,false);(window.JuneControls?.focus||((el,options)=>el.focus(options)))(focus,{preventScroll:true});$('.form-panel').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth',block:'start'});}window.goToJuneInquiry=goToInquiry;
$$('[data-tier]').forEach(a=>a.addEventListener('click',()=>{if(savedInquiry)resetForm();$('#tier').value=a.dataset.tier;$('#tier').dispatchEvent(new Event('change'));showStep(1,false);}));
function updateDestination(){$('#other-destination-field').hidden=true;}
$('#destination').addEventListener('change',updateDestination);
const words=['Zero','One','Two','Three','Four','Five','Six','Seven'];
function updatePace(value){const n=Number(value);$('#pace-range').value=String(n);$('#pace-value').textContent=`${n} of 7`;$$('[data-pace]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.pace)===n)));const indices=[0,2,4,6,1,3,5].slice(0,n);$('#week-days').innerHTML=Array.from({length:7},(_,i)=>`<div class="day ${indices.includes(i)?'is-golf':''}"><span>Day ${i+1}</span><i role="img" aria-label="${indices.includes(i)?'Golf':'Explore or relax'}">${indices.includes(i)?'⚑':'—'}</i></div>`).join('');$('#pace-description').textContent=n===7?'A golf day, every day. We’ll check what fits around your arrival and departure.':n===0?'A little time away, with room to decide about the golf.':`${words[n]} ${n===1?'day':'days'} on the course. ${words[7-n]} ${7-n===1?'day':'days'} to see what’s beyond it.`;}
$('#pace-range').addEventListener('input',e=>updatePace(e.target.value));$$('[data-pace]').forEach(b=>b.addEventListener('click',()=>{updatePace(b.dataset.pace);}));
let puttAnimation;function playPutt(){if(matchMedia('(prefers-reduced-motion:reduce)').matches)return;const green=$('.putting-green'),ball=green.querySelector('.golf-ball');puttAnimation?.cancel();puttAnimation=ball.animate([{transform:'translateX(0)'},{transform:'translateX('+Math.max(0,green.clientWidth-78)+'px) scale(.65)'}],{duration:1250,easing:'cubic-bezier(.2,.7,.2,1)',fill:'forwards'});}
$('#replay-putt').addEventListener('click',()=>{$('.pace-planner').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth',block:'center'});playPutt();});
$('#use-pace').addEventListener('click',()=>{if(savedInquiry)resetForm();const n=Number($('#pace-range').value);if(!$('#nights').value)$('#nights').value='6';if(!$('#golfDays').value&&n<=Number($('#nights').value)+1)$('#golfDays').value=String(n);goToInquiry();});updatePace(4);
function showStep(n,focus=true){window.JuneControls?.refresh();step=n;$$('.form-step').forEach(el=>el.hidden=Number(el.dataset.step)!==n);$$('[data-step-label]').forEach(el=>{el.classList.toggle('current',Number(el.dataset.stepLabel)===n);if(Number(el.dataset.stepLabel)===n)el.setAttribute('aria-current','step');else el.removeAttribute('aria-current');});$('#form-status').textContent='';if(n===3)renderReview();if(focus){const h=$(`.form-step[data-step="${n}"] h3`);h.tabIndex=-1;h.focus({preventScroll:true});$('.form-panel').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth',block:'start'});}}
function validateStep(){const root=$(`.form-step[data-step="${step}"]`);$$('.invalid',root).forEach(el=>el.classList.remove('invalid'));for(const input of $$('input,select,textarea',root)){if(input.dataset.controlledSelect)continue;if(input.tagName==='SELECT'&&window.JuneControls){if(!window.JuneControls.validate(input))return false;continue;}input.setCustomValidity('');if(!input.checkValidity()){input.classList.add('invalid');input.reportValidity();return false;}}
 const travelers=Number($('#travelers').value),golfers=Number($('#golfers').value),nights=Number($('#nights').value),days=Number($('#golfDays').value);
 let error='',target=null;if(step===1&&travelers&&golfers>travelers){error='Golfers cannot exceed total travelers.';target=$('#golfers');}if(step===2&&$('#nights').value&&days>nights+1){error='Golf days cannot exceed nights away plus one. Put extra rounds in your golf preferences.';target=$('#golfDays');}if(step===3&&$('#contactPreference').value==='phone'&&!$('#phone').value.trim()){error='Add a phone number, or choose email as your preferred reply.';target=$('#phone');}
 if(error){$('#form-status').textContent=error;target.classList.add('invalid');target.focus();return false;}return true;}
$$('.next').forEach(b=>b.addEventListener('click',()=>{if(validateStep())showStep(step+1);}));$$('.back').forEach(b=>b.addEventListener('click',()=>showStep(step-1)));
const spendLevels=[{symbol:'Open',label:'Open to guidance'},{symbol:'$',label:'Considered'},{symbol:'$$',label:'Elevated'},{symbol:'$$$',label:'Luxury'},{symbol:'$$$$',label:'Exceptional'}];
function syncBudget(level=$('#budgetLevel').value){const n=Math.max(0,Math.min(4,Number(level)||0)),d=spendLevels[n];$('#budgetLevel').value=String(n);$('#budgetLevel').setAttribute('aria-valuetext',n?d.symbol+' - '+d.label:d.label);$('#budget-value').textContent=d.symbol;$('#budget-description').textContent=d.label;$$('[data-budget]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.budget)===n)));}
$('#budgetLevel').addEventListener('input',()=>syncBudget());$$('[data-budget]').forEach(b=>b.addEventListener('click',()=>syncBudget(b.dataset.budget)));syncBudget();
function collect(){const d=Object.fromEntries(new FormData(form));d.interests=new FormData(form).getAll('interests');d.consent=$('#consent').checked;d.submissionId=submissionId;return d;}
function labelFor(id){if(id==='destination')return $('#destinationSearch').value||'Help me choose';const el=$('#'+id);return el.selectedOptions?.[0]?.textContent||el.value;}
function renderReview(){
 const box=$('#trip-review');box.replaceChildren();
 const title=document.createElement('h4');title.textContent='Review your trip';box.append(title);
 const details=document.createElement('dl');
 const spend=spendLevels[Number($('#budgetLevel').value)];
 const rows=[
  ['Course or destination',labelFor('destination')],
  ['Planning service',tierNames[$('#tier').value]||'To discuss'],
  ['Timing',[$('#arrival').value||$('#travelWindow').value.trim(),$('#nights').value&&$('#nights').value+' nights'].filter(Boolean).join(' · ')||'Flexible'],
  ['Group',[$('#travelers').value&&$('#travelers').value+' travelers',$('#golfers').value&&$('#golfers').value+' golfers'].filter(Boolean).join(' · ')||'To discuss'],
  ['Trip preferences',[$('#golfDays').value!==''&&$('#golfDays').value+' golf days',spend.symbol==='Open'?spend.label:spend.symbol+' '+spend.label].filter(Boolean).join(' · ')]
 ];
 if($('#departureCity').value.trim())rows.push(['Departing from',$('#departureCity').value.trim()]);
 for(const [label,value] of rows){const term=document.createElement('dt'),description=document.createElement('dd');term.textContent=label;description.textContent=value;details.append(term,description);}
 box.append(details);
 for(const [label,stage] of [['Edit trip',1],['Edit preferences',2]]){const button=document.createElement('button');button.type='button';button.className='text-link';button.textContent=label;button.addEventListener('click',()=>showStep(stage));box.append(button);}
}
form.addEventListener('submit',async e=>{e.preventDefault();const button=$('#submit-inquiry');if(step!==3||button.disabled||!validateStep())return;const submitted=collect();button.disabled=true;button.textContent='Sending your inquiry…';$('#form-status').textContent='';try{const response=await fetch('/api/inquiries',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(submitted)});const data=await response.json().catch(()=>null);if(!response.ok||typeof data?.reference!=='string')throw new Error(data?.error||'We couldn’t confirm receipt. Your details are still here. Select Send again to retry safely.');savedInquiry={...submitted,reference:data.reference};form.hidden=true;$('.form-progress').hidden=true;$('#form-success').hidden=false;$('#reference').textContent=`Your reference: ${data.reference}`;$('#inquiry-email-status').textContent=data.emailStatus==='sent'?'Your PDF brief has been emailed to June Links.':data.emailStatus==='queued'?'Email delivery is pending. Your inquiry is saved.':data.emailStatus==='pending-setup'?'Email delivery is disabled in this preview. Your inquiry is saved.':'Your inquiry is saved. Email delivery could not be confirmed.';$('#form-success').focus({preventScroll:true});$('.form-panel').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth',block:'start'});}catch(error){$('#form-status').textContent=error instanceof TypeError?'We couldn’t confirm receipt. Your details are still here. Select Send again to retry safely.':error.message;}finally{button.disabled=false;button.innerHTML='Send my trip inquiry <span aria-hidden="true">↗</span>';}});
$('#download-inquiry').addEventListener('click',async()=>{if(!savedInquiry)return;const button=$('#download-inquiry');button.disabled=true;button.textContent='Preparing your PDF…';$('#pdf-status').textContent='';try{const {downloadTripBrief}=await import('/trip-pdf.js?v=focus-1');await downloadTripBrief(savedInquiry);}catch{$('#pdf-status').textContent='Your inquiry is saved. The PDF could not be prepared; please try the download again.';}finally{button.disabled=false;button.innerHTML='Download your trip brief (PDF) <span aria-hidden="true">↓</span>';}});
function resetForm(){form.reset();syncBudget(0);form.hidden=false;$('.form-progress').hidden=false;$('#form-success').hidden=true;savedInquiry=null;submissionId=crypto.randomUUID();updateDestination();showStep(1,false);}
$('#new-inquiry').addEventListener('click',()=>{resetForm();window.JuneControls?.focus($('#tier'));});
const now=new Date();$('#arrival').min=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;

window.chooseJuneVenue = function(venue,options={}){if(savedInquiry)resetForm();$('#destination').value=venue.featured?venue.id:'worldwide';$('#destinationSearch').value=`${venue.name} · ${[...(venue.places||[venue.region,venue.state]),venue.country].filter((v,i,a)=>v&&a.indexOf(v)===i).join(', ')}`.slice(0,240);$('#requestedVenue').value=venue.name.slice(0,200);$('#requestedCountry').value=venue.country.slice(0,120);$('#requestedRegion').value=[...new Set(venue.places||[venue.region,venue.state])].filter(Boolean).join(', ').slice(0,240);$('#otherDestination').value='';if(options.care)$('#tier').value=options.care;document.dispatchEvent(new CustomEvent('june:venue-selected',{detail:{id:venue.id,name:venue.name,care:$('#tier').value}}));if(options.navigate!==false)goToInquiry();};


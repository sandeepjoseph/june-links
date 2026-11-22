import {countryAliases, normalize, prepareVenue, searchVenues} from './directory-search.js';
(()=>{
const q=s=>document.querySelector(s),search=q('#world-search'),country=q('#world-country'),region=q('#world-region'),results=q('#world-results'),count=q('#world-count'),more=q('#world-more'),input=q('#destinationSearch');if(!search||!input)return;
const pageSize = 5;
const suggestionLimit = 5;
const collectionIds = [...document.querySelectorAll('.course-scene')].map(scene => scene.dataset.course);
const collectionOrder = new Map(collectionIds.map((id, index) => [id, index]));
const priority = venue => collectionOrder.get(venue.id) ?? collectionIds.length + Number(!venue.featured);
let promise=null,venues=[],countries=[],filtered=[],page=0,media={},care="",selectedId=null,selectedName="";
const retry = q('#world-retry');
const removeCourse = q('#atlas-remove-course');
let directoryState = 'idle';
async function fetchIndex(path) {
  const response = await fetch(path, {signal: AbortSignal.timeout(8000)});
  if (!response.ok) throw Error('Directory index unavailable');
  return response.json();
}
function load() {
  if (promise) return promise;
  directoryState = 'loading';
  results.setAttribute('aria-busy','true');
  retry.hidden = true;
  count.textContent = 'Loading courses…';
  promise = Promise.all([
    fetchIndex('/assets/courses.json?v=directory-4'),
    fetchIndex('/assets/venue-media.json?v=credits-20261105').catch(() => null)
  ]).then(([data, images]) => {
    media = images?.venues || {};
    venues = data.venues.map(prepareVenue)
      .sort((a, b) => priority(a) - priority(b));
    countries = [...new Set(venues.map(venue => venue.country))].sort();
    for (const name of countries) {
      const option = new Option(name, name);
      option.dataset.search = countryAliases(name).join(' ');
      country.append(option);
    }
    const photographed = venues.filter(hasPhoto).length;
    q('#directory-scope').textContent = `${venues.length.toLocaleString()} courses across ${countries.length} countries and territories. ${images ? photographed.toLocaleString() + ' have photos in the directory.' : 'Photos are temporarily unavailable.'}`;
    photoOnly.disabled = !images;
    if (!images) photoOnly.checked = false;
    directoryState = 'ready';
    results.removeAttribute('aria-busy');
    setRegions();
    ui.refresh(country);
    ui.refresh(region);
    render();
    return venues;
  }).catch(() => {
    directoryState = 'error';
    results.removeAttribute('aria-busy');
    count.textContent = 'The directory could not load. Try again or enter your destination in the inquiry.';
    retry.hidden = false;
    promise = null;
    throw Error('Directory unavailable');
  });
  return promise;
}
function setRegions() {
  const options = [...new Set(venues.filter(venue => venue.country === country.value)
    .flatMap(venue => venue.places))].sort();
  region.replaceChildren(new Option(country.value ? 'All states / regions' : 'Choose a country first', ''));
  for (const name of options) region.append(new Option(name, name));
  region.disabled = !country.value;
}
const careNames={base:'The Round',mid:'The Journey',premium:'The Signature'};
const photoOnly=q('#atlas-photo-only'),viewport=q('#atlas-scroll'),previous=q('#atlas-prev');
const hasPhoto=v=>!!(media[v.id]?.local||media[v.id]?.remote);
function text(tag,className,content){const el=document.createElement(tag);el.className=className;el.textContent=content;return el;}
function safeLink(url,label){const a=document.createElement('a');try{const u=new URL(url);if(!['https:','http:'].includes(u.protocol))return null;a.href=u.href;}catch{return null;}a.textContent=label;a.target='_blank';a.rel='noopener noreferrer';return a;}
function venueCard(venue){
 const image=media[venue.id],card=document.createElement('article');card.className='world-venue';card.dataset.venue=venue.id;card.classList.toggle('is-selected',selectedId===venue.id);
 if(hasPhoto(venue)){
  const figure=document.createElement('figure');figure.className='venue-photo';const img=document.createElement('img');img.src=image.local||'/api/venue-photo/'+encodeURIComponent(venue.id)+'?v=thumb-2';img.alt=image.alt||'Venue photograph: '+venue.name;img.width=800;img.height=500;img.loading='lazy';img.decoding='async';figure.append(img);
  img.addEventListener('error',()=>{figure.replaceChildren(text('div','venue-unpictured','Photo unavailable'));},{once:true});
  card.append(figure);
 }
 const copy=document.createElement('div');copy.className='venue-copy';copy.append(text('p','world-venue-country',venue.country),text('h3','',venue.name),text('p','world-venue-place',venue.places.join(', ')));
 const button=document.createElement('button');button.type='button';button.className='venue-select';button.setAttribute('aria-pressed',String(selectedId===venue.id));button.setAttribute('aria-label',(selectedId===venue.id?'Selected: ':'Add ')+venue.name+' to your inquiry');button.append(text('span','',selectedId===venue.id?'Selected for your inquiry':'Add to my inquiry'),text('span','venue-add-mark',selectedId===venue.id?'✓':'+'));
 button.addEventListener('click',()=>{if(selectedId===venue.id)return;selectedId=venue.id;window.chooseJuneVenue({...venue,coordinates:media[venue.id]?.coordinates},{care:q('#tier').value||undefined});syncCards();});copy.append(button);card.append(copy);
 const links=document.createElement('div');links.className='venue-links';const source=safeLink(venue.website||venue.source,venue.website||venue.featured?'Course website':'Venue reference');if(source)links.append(source);
 if(image&&(image.local||image.remote)){const credit=document.createElement('details');credit.className='venue-credit';credit.append(text('summary','','Photography'));const attribution=text('p','',(image.author||'Venue photography').replace(/ · concept preview$/,''));const photo=safeLink(image.source,'Photo source');if(photo)attribution.append(document.createTextNode(' · '),photo);if(image.licenseUrl){const license=safeLink(image.licenseUrl,image.license);if(license)attribution.append(document.createTextNode(' · '),license);}credit.append(attribution);links.append(credit);}card.append(links);return card;
}
function syncCards(){for(const card of results.querySelectorAll('.world-venue')){const selected=card.dataset.venue===selectedId;card.classList.toggle('is-selected',selected);const button=card.querySelector('.venue-select');button.setAttribute('aria-pressed',String(selected));button.firstElementChild.textContent=selected?'Selected for your inquiry':'Add to my inquiry';button.lastElementChild.textContent=selected?'✓':'+';const venue=venues.find(v=>v.id===card.dataset.venue);button.setAttribute('aria-label',(selectedId===venue.id?'Selected: ':'Add ')+venue.name+' to your inquiry');}}
function syncCare(next){care=careNames[next]?next:'';q('.atlas-care').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.care===care)));if(selectedName)q('#atlas-selection-label').textContent=care?selectedName+' · '+careNames[care]:selectedName;syncCards();}
document.addEventListener('june:venue-selected',event=>{selectedId=event.detail.id;selectedName=event.detail.name;removeCourse.hidden=false;syncCare(event.detail.care);});
document.addEventListener('june:venue-cleared',()=>{selectedId=null;selectedName='';removeCourse.hidden=true;q('#atlas-selection-label').textContent='Choose a starting course for your inquiry.';syncCards();});
q('#tier').addEventListener('change',()=>syncCare(q('#tier').value));q('#inquiry-form').addEventListener('reset',()=>{selectedId=null;selectedName='';removeCourse.hidden=true;q('#atlas-selection-label').textContent='Choose a starting course for your inquiry.';syncCare('');});
function clearSelection(){document.dispatchEvent(new CustomEvent('june:venue-cleared'));}
removeCourse.addEventListener('click',()=>{
  input.value='';
  q('#destination').value='undecided';
  for(const id of ['requestedVenue','requestedCountry','requestedRegion','otherDestination'])q('#'+id).value='';
  clearSelection();
  q('#atlas-selection a').focus();
});
function render(){
 if(directoryState!=='ready')return;
 const matching=searchVenues(venues,{query:search.value,country:country.value,region:region.value});
 filtered=matching.filter(v=>!photoOnly.checked||hasPhoto(v));page=Math.max(0,Math.min(page,Math.ceil(filtered.length/pageSize)-1));results.replaceChildren();const start=page*pageSize;
 for(const venue of filtered.slice(start,start+pageSize))results.append(venueCard(venue));
 if(!filtered.length){const empty=document.createElement('div');empty.className='world-empty';empty.append(text('h3','',matching.length?'No photos for these matches':'No courses match these filters'),text('p','',matching.length?'Turn off the photo filter to see the matching courses.':'Clear a filter, try a different spelling or enter the destination in your inquiry.'));const b=text('button','button green','Enter a destination');b.type='button';b.addEventListener('click',()=>custom(search.value||country.value));if(matching.length){const all=text('button','text-link','Show courses without photos');all.type='button';all.addEventListener('click',()=>{photoOnly.checked=false;resetPage();});empty.append(all);}empty.append(b);results.append(empty);}
 const end=Math.min(start+pageSize,filtered.length),scope=region.value||country.value;
 const category=photoOnly.checked?'photographed ':'';
 const position=start+1===end?end.toLocaleString():`${(start+1).toLocaleString()}–${end.toLocaleString()}`;
 const total=filtered.length===1?`1 ${category}course`:`${position} of ${filtered.length.toLocaleString()} ${category}courses`;
 count.textContent=filtered.length?total+(scope?' in '+scope:''):'No courses in this view';
 if(photoOnly.checked)count.textContent+=` · ${matching.length.toLocaleString()} courses without the photo filter`;
 more.hidden=false;more.disabled=start+pageSize>=filtered.length;previous.disabled=page===0;
}
function resetPage(){page=0;render();viewport.scrollTo({top:0,behavior:'instant'});}
photoOnly.addEventListener('change',resetPage);previous.addEventListener('click',()=>{if(page>0){page--;render();viewport.scrollTo({top:0,behavior:'instant'});}});
q('.atlas-care').addEventListener('click',event=>{const button=event.target.closest('[data-care]');if(!button)return;q('#tier').value=button.dataset.care;q('#tier').dispatchEvent(new Event('change'));});
function custom(text){clearSelection();input.value=text||'';q('#destination').value=text?'other':'undecided';q('#requestedVenue').value='';q('#requestedCountry').value='';q('#requestedRegion').value='';q('#otherDestination').value=(text||'').slice(0,160);window.goToJuneInquiry?.(input);}
retry.addEventListener('click',()=>load().catch(()=>{}));
search.addEventListener('input',resetPage);country.addEventListener('change',()=>{setRegions();resetPage();});region.addEventListener('change',()=>{resetPage();});q('#world-clear').addEventListener('click',()=>{search.value='';country.value='';photoOnly.checked=false;setRegions();ui.refresh(country);ui.refresh(region);resetPage();});more.addEventListener('click',()=>{page++;render();viewport.scrollTo({top:0,behavior:'instant'});});q('#world-custom').addEventListener('click',event=>{event.preventDefault();custom(search.value);});
new IntersectionObserver((entries,observer)=>{if(entries.some(e=>e.isIntersecting)){load().catch(()=>{});observer.disconnect();}},{rootMargin:'350px'}).observe(q('#world'));
const ui=window.JuneControls;let suggestionIndex;
function directorySuggestions(query){
 const text=query.trim();
 if(!suggestionIndex){
 const countryItems=countries.map(name=>({label:name,detail:'Country',country:name,keywords:countryAliases(name).join(' ')}));
 const regionItems=[...new Map(venues.flatMap(v=>v.places.map(place=>[v.country+'|'+place,{label:place,detail:v.country,region:place,country:v.country}]))).values()];
 const courseItems=venues.map(venue=>({label:venue.name,detail:[...venue.places,venue.country].join(', '),venue}));
 suggestionIndex={countryItems,regionItems,courseItems};
 }
 const {countryItems,regionItems,courseItems}=suggestionIndex;
 if(!text)return collectionIds.map(id=>courseItems.find(item=>item.venue.id===id)).filter(Boolean).slice(0,suggestionLimit);
 const courses=searchVenues(venues,{query:text}).slice(0,suggestionLimit).map(venue=>({label:venue.name,detail:[...venue.places,venue.country].join(', '),venue}));
 return [...ui.rank(countryItems,text).slice(0,1),...ui.rank(regionItems,text).slice(0,1),...courses].slice(0,suggestionLimit);
}
async function options(query){await load();return directorySuggestions(query);}
async function withBespoke(query){let items=[];try{items=await options(query);}catch{}const written=query.trim();if(written&&!items.some(item=>normalize(item.label)===normalize(written)))items=[{label:'Use “'+written+'”',detail:'Request this destination as written',custom:written},...items.slice(0,suggestionLimit-1)];return items;}

ui.create({input,label:'Suggested golf destinations',limit:suggestionLimit,items:withBespoke,emptyText:'Keep your destination as written. We can explore a bespoke request.',
 onInput(){clearSelection();q('#destination').value=input.value.trim()?'other':'undecided';q('#otherDestination').value=input.value.slice(0,160);q('#requestedVenue').value='';q('#requestedCountry').value='';q('#requestedRegion').value='';},
 onSelect(item){
  if(item.custom){clearSelection();input.value=item.custom;q('#destination').value='other';q('#otherDestination').value=item.custom.slice(0,160);q('#requestedVenue').value='';q('#requestedCountry').value='';q('#requestedRegion').value='';}
  else if(item.venue)window.chooseJuneVenue({...item.venue,coordinates:media[item.venue.id]?.coordinates},{navigate:false,preview:false});
  else{clearSelection();input.value=[item.region,item.country].filter(Boolean).join(', ');q('#destination').value='other';q('#requestedCountry').value=item.country;q('#requestedRegion').value=item.region||'';q('#requestedVenue').value='';q('#otherDestination').value=input.value;}
 }
});
ui.create({input:search,label:'Suggested courses, countries and regions',limit:suggestionLimit,items:withBespoke,emptyText:'No matching destinations. Try a wider search or request somewhere else.',
 onSelect(item){
  if(item.custom){custom(item.custom);return;}
  if(item.venue){country.value='';setRegions();search.value=item.venue.name;if(!hasPhoto(item.venue))photoOnly.checked=false;}
  else{country.value=item.country;setRegions();region.value=item.region||'';search.value='';}
  ui.refresh(country);ui.refresh(region);resetPage();
 }
});
})();

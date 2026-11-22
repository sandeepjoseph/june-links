/* Recorded full-frame footage. Native decoding owns motion; the poster is permanent. */
export function createHeroMotion(doc,view){
 const hero=doc.querySelector('.hero'),video=doc.querySelector('#hero-film'),button=doc.querySelector('#hero-motion-toggle');if(!hero||!video)return null;
 const reduce=view.matchMedia('(prefers-reduced-motion: reduce)'),connection=view.navigator.connection;
 let visible=false,paused=view.innerWidth<=767,loaded=false,pending=false,blocked=false,failed=false,attempt=0,timer=0;const cleanups=[];
 const listen=(target,type,handler,options)=>{if(!target?.addEventListener)return;target.addEventListener(type,handler,options);cleanups.push(()=>target.removeEventListener(type,handler,options));};
 const limited=()=>reduce.matches||!!connection?.saveData;
 const active=()=>visible&&!doc.hidden&&!paused&&!limited();
 const clearWatch=()=>{if(timer){view.clearTimeout(timer);timer=0;}};
 function note(state){
  hero.dataset.motionState=state;
  if(!button)return;
  const playing=visible&&!doc.hidden&&!paused&&!blocked&&!failed&&!limited();
  button.hidden=limited()||failed;
  button.setAttribute('data-playing',String(playing));
  button.setAttribute('aria-label',playing?'Pause background film':'Play background film');
 }
 function poster(state='blocked'){clearWatch();blocked=state==='blocked';pending=false;video.pause();video.hidden=true;note(state);}
 function watch(id,delay){clearWatch();const start=video.currentTime||0;timer=view.setTimeout(()=>{timer=0;if(id===attempt&&active()&&Math.abs((video.currentTime||0)-start)<.03)poster();},delay);}
 function play(){
  if(!active()||pending||failed)return;
  if(!loaded){loaded=true;video.setAttribute('src','/assets/brand/journeys-film-1080.mp4?v=lush-hd-3');video.preload='auto';video.load();}
  video.hidden=false;
  if(!video.paused&&video.readyState>=2){blocked=false;note('video');return;}
  const id=++attempt;pending=true;
  try{const result=video.play();watch(id,8000);if(result?.then)result.then(()=>{if(id!==attempt)return;pending=false;if(active()){blocked=false;video.hidden=false;note('video');watch(id,2500);}else video.pause();},()=>{if(id===attempt&&active())poster();});else{pending=false;blocked=false;note('video');watch(id,2500);}}
  catch{if(id===attempt)poster();}
 }
 function sync(){if(!active()){attempt++;pending=false;clearWatch();video.pause();video.hidden=true;note(limited()?'reduced':paused?'paused':'offscreen');}else if(!blocked)play();else note('blocked');}
 video.muted=true;video.defaultMuted=true;video.playsInline=true;video.autoplay=true;video.loop=true;video.controls=false;
 for(const attr of ['muted','autoplay','playsinline','webkit-playsinline'])video.setAttribute(attr,'');
 video.poster=view.innerWidth<=767?'/assets/brand/journeys-poster-portrait.webp?v=lush-hd-3':'/assets/brand/journeys-poster-1280.webp?v=lush-hd-3';
 listen(video,'playing',()=>{if(active()){blocked=false;video.hidden=false;note('video');}else video.pause();});
 listen(video,'error',()=>{failed=true;poster('still');});
 const retry=()=>{if(active()&&blocked&&!failed)play();};
 for(const type of ['touchend','click','keydown'])listen(doc,type,retry,{passive:true});
 listen(button,'click',()=>{if(blocked){play();return;}paused=!paused;sync();});
 listen(doc,'visibilitychange',sync);listen(reduce,'change',sync);listen(connection,'change',sync);
 const observer=new view.IntersectionObserver(entries=>{visible=entries.some(e=>e.isIntersecting);sync();},{threshold:.01});observer.observe(hero);sync();
 return{sync,state:()=>({visible,paused,loaded,blocked,failed,limited:limited()}),destroy(){attempt++;clearWatch();video.pause();video.hidden=true;observer.disconnect();cleanups.forEach(fn=>fn());}};
}
if(typeof window!=='undefined'&&typeof document!=='undefined')window.juneHeroMotion=createHeroMotion(document,window);

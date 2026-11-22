/* One native scroll owner; selection and pagination never move the page. */
(()=>{
const section=document.querySelector('.luxury-destinations'),rail=document.querySelector('#collection-rail');if(!section||!rail)return;
const scenes=[...rail.querySelectorAll('.course-scene')],buttons=[...section.querySelectorAll('[data-course-index]')],gallery=section.querySelector('.collection-gallery'),toggle=document.querySelector('#collection-toggle'),film=document.querySelector('#collection-film'),filmToggle=document.querySelector('#film-toggle'),reduce=matchMedia('(prefers-reduced-motion: reduce)'),status=document.querySelector('#collection-status');
const names=scenes.map(scene=>[scene.dataset.venue, scene.dataset.location].filter(Boolean).join(' · '));
let current=0,target=0,auto=false,motion=false,visible=false,hovered=false,timer,settleTimer,scrollFrame=0,filmEnabled=false,filmLoaded=false,positions=[];
function measure(){positions=scenes.map(scene=>scene.offsetLeft-scenes[0].offsetLeft);}
function update(index,announce=true){current=index;scenes.forEach((scene,n)=>{scene.classList.toggle('is-current',n===index);scene.querySelector('.course-slide-link').tabIndex=n===index?0:-1;});buttons.forEach((button,n)=>n===index?button.setAttribute('aria-current','true'):button.removeAttribute('aria-current'));if(announce&&status.textContent!==names[index])status.textContent=names[index];}
function updateFilmToggle(){
  const playing=!film.paused;
  filmToggle.dataset.playing=String(playing);
  filmToggle.setAttribute('aria-label',playing?'Pause film preview':'Play film preview');
}
function syncFilm(){
  if(!visible||!filmEnabled||document.hidden){film.pause();return;}
  if(!filmLoaded){
    const source=film.querySelector('source');
    source.src=source.dataset.src;
    film.load();
    filmLoaded=true;
  }
  film.play().catch(error=>{
    if(error.name!=='AbortError')filmEnabled=false;
    updateFilmToggle();
  });
}
function schedule(){clearTimeout(timer);gallery.dataset.motion=motion&&visible&&!document.hidden&&!reduce.matches?'on':'off';toggle.dataset.playing=String(motion);toggle.title=motion?'Pause gallery motion':'Play gallery motion';toggle.setAttribute('aria-label',toggle.title);if(auto&&motion&&visible&&!hovered&&!document.hidden&&!reduce.matches){timer=setTimeout(()=>go((current+1)%scenes.length,false),11000);}}
function go(index,manual=true){if(manual)auto=false;target=(index+scenes.length)%scenes.length;clearTimeout(timer);gallery.dataset.motion='off';rail.scrollTo({left:positions[target]||0,behavior:reduce.matches?'instant':'smooth'});if(reduce.matches){update(target);schedule();}}
function settle(){clearTimeout(settleTimer);const left=rail.scrollLeft,index=positions.reduce((best,value,n)=>Math.abs(value-left)<Math.abs(positions[best]-left)?n:best,0);target=index;update(index);schedule();}
buttons.forEach(button=>button.addEventListener('click',()=>go(Number(button.dataset.courseIndex))));document.querySelector('#collection-prev').addEventListener('click',()=>go(target-1));document.querySelector('#collection-next').addEventListener('click',()=>go(target+1));toggle.addEventListener('click',()=>{motion=!motion;auto=motion;schedule();});
rail.addEventListener('scroll',()=>{if(scrollFrame)return;scrollFrame=requestAnimationFrame(()=>{scrollFrame=0;clearTimeout(settleTimer);settleTimer=setTimeout(settle,140);});},{passive:true});rail.addEventListener('scrollend',settle);
rail.addEventListener('keydown',event=>{if(event.key==='ArrowRight'||event.key==='ArrowLeft'){event.preventDefault();go(target+(event.key==='ArrowRight'?1:-1));}});rail.addEventListener('pointerdown',()=>{auto=false;clearTimeout(timer);},{passive:true});
gallery.addEventListener('mouseenter',()=>{hovered=true;schedule();});gallery.addEventListener('mouseleave',()=>{hovered=false;schedule();});gallery.addEventListener('focusin',()=>{auto=false;schedule();});
filmToggle.addEventListener('click',()=>{filmEnabled=film.paused;syncFilm();});
film.addEventListener('play',updateFilmToggle);
film.addEventListener('pause',updateFilmToggle);
film.addEventListener('error',()=>{filmEnabled=false;updateFilmToggle();});
new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;schedule();syncFilm();},{threshold:.08}).observe(section);new ResizeObserver(measure).observe(rail);document.addEventListener('visibilitychange',()=>{schedule();syncFilm();});reduce.addEventListener('change',()=>{auto=false;motion=false;filmEnabled=false;schedule();syncFilm();});measure();update(0,false);schedule();
})();

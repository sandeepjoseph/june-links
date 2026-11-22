/* Mark the section currently visible in the fixed header. */
(()=>{
// A direct visit or reload of the homepage starts at the hero.
const homeEntry = !location.hash || location.hash === '#inquiry';
const navigation = performance.getEntriesByType('navigation')[0];
if (homeEntry && navigation?.type !== 'back_forward' && 'scrollRestoration' in history) {
  const restoration = history.scrollRestoration;
  history.scrollRestoration = 'manual';
  if (scrollY > 0) window.scrollTo({top: 0, behavior: 'instant'});
  window.addEventListener('pageshow', () => requestAnimationFrame(() => {
    history.scrollRestoration = restoration;
  }), {once: true});
}
const links=[...document.querySelectorAll('#nav a[href^="#"]')],sections=links.map(a=>document.getElementById(a.hash.slice(1))).filter(Boolean);let active='';
function current(id){if(active===id)return;active=id;links.forEach(a=>a.hash==='#'+id?a.setAttribute('aria-current','location'):a.removeAttribute('aria-current'));}
const observer=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting)current(entry.target.id);},{rootMargin:'-10% 0px -65% 0px',threshold:0});sections.forEach(section=>observer.observe(section));links.forEach(link=>link.addEventListener('click',()=>current(link.hash.slice(1))));
})();

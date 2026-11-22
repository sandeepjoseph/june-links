/* Native modal controls stay visible, keyboard-operable and easy to dismiss. */
(()=>{
const open=document.querySelector('#film-open'),dialog=document.querySelector('#film-dialog'),film=document.querySelector('#full-golf-film'),teaser=document.querySelector('#collection-film'),closeButton=dialog?.querySelector('.film-close');if(!open||!dialog||!film||!closeButton)return;let resume=false,backdropPressed=false;
const outside=event=>{const box=dialog.getBoundingClientRect();return event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom;};
function close(){film.pause();dialog.close();}
open.addEventListener('click',()=>{resume=!!teaser&&!teaser.paused;teaser?.pause();const source=film.querySelector('source');if(!source.src){source.src=source.dataset.src;film.load();}dialog.showModal();closeButton.focus({preventScroll:true});film.play().catch(()=>{});});
closeButton.addEventListener('click',close);dialog.addEventListener('cancel',()=>film.pause());dialog.addEventListener('close',()=>{film.pause();backdropPressed=false;if(resume&&!document.hidden)teaser?.play().catch(()=>{});open.focus({preventScroll:true});});
dialog.addEventListener('pointerdown',event=>{backdropPressed=event.target===dialog&&outside(event);},{passive:true});dialog.addEventListener('pointercancel',()=>{backdropPressed=false;},{passive:true});dialog.addEventListener('click',event=>{if(backdropPressed&&event.target===dialog&&outside(event))close();backdropPressed=false;});document.addEventListener('visibilitychange',()=>{if(document.hidden)film.pause();});
})();

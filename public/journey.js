/* A nonmodal route preview. Inquiry selection is immediate; navigation stays in the visitor’s hands. */
(()=>{
 const original=window.chooseJuneVenue;if(typeof original!=='function')return;
 const origins={'New York':[40.713,-74.006],Toronto:[43.653,-79.383],London:[51.507,-.128],Amsterdam:[52.368,4.904],Paris:[48.857,2.352],Dubai:[25.205,55.271],Singapore:[1.352,103.82],Sydney:[-33.869,151.209],'Los Angeles':[34.052,-118.244],Tokyo:[35.676,139.65],Dublin:[53.349,-6.26],Stockholm:[59.329,18.069]};
 const mediaReady=fetch('/assets/venue-media.json?v=credits-20261105',{signal:AbortSignal.timeout(2000)}).then(r=>r.ok?r.json():{}).then(d=>d.venues||{}).catch(()=>({}));
 const reduce=matchMedia('(prefers-reduced-motion: reduce)'),originInput=document.querySelector('#atlas-origin'),departure=document.querySelector('#departureCity');
 let locationOrigin=null;const locate=document.querySelector('#atlas-locate'),originNote=document.querySelector('#atlas-origin-note');originInput.addEventListener('change',()=>{locationOrigin=null;if(originNote)originNote.textContent='';departure.value=originInput.value;});
 locate?.addEventListener('click',()=>{if(!navigator.geolocation){originNote.textContent='Choose a departure city instead.';return;}locate.disabled=true;originNote.textContent='Finding your approximate location…';navigator.geolocation.getCurrentPosition(position=>{locationOrigin=[Math.round(position.coords.latitude*10)/10,Math.round(position.coords.longitude*10)/10];originInput.value='';window.JuneControls?.refresh(originInput);departure.value='';originNote.textContent='Approximate location selected';locate.disabled=false;},()=>{originNote.textContent='Choose a departure city instead.';locate.disabled=false;},{enableHighAccuracy:false,timeout:8000,maximumAge:600000});});
 departure.addEventListener('input',()=>{locationOrigin=null;if(originNote)originNote.textContent='';originInput.value=origins[departure.value]?departure.value:'';window.JuneControls?.refresh(originInput);});
 const dialog=document.createElement('aside');dialog.hidden=true;dialog.className='journey-preview';dialog.setAttribute('aria-labelledby','journey-title');dialog.setAttribute('role','region');dialog.innerHTML='<button class="journey-close" type="button" aria-label="Dismiss journey preview">×</button><div class="journey-stage"><div><p class="journey-confirmation" role="status">Added to your inquiry</p><h2 id="journey-title"></h2><p id="journey-route-label"></p></div><div class="journey-globe-wrap"><canvas class="journey-globe" aria-hidden="true"></canvas><div class="journey-orbit" aria-hidden="true"></div><canvas class="journey-route" aria-hidden="true"></canvas></div><div><button type="button" class="journey-continue">Continue to your inquiry ↗</button></div></div>';document.body.append(dialog);
 const globe=dialog.querySelector('.journey-globe'),route=dialog.querySelector('.journey-route'),ctx=route.getContext('2d');
 let lastControl=null;let selectionRevision=0,pending=null,frame=0,draw=()=>{},clear=()=>{},ready=false;
 let globeWorker=null,globeSize=330;const radians=Math.PI/180;
 function vector([lat,lon]){return [Math.cos(lat*radians)*Math.sin(lon*radians),Math.sin(lat*radians),Math.cos(lat*radians)*Math.cos(lon*radians)];}
 function mix(a,b,t){const dot=Math.min(1,Math.max(-1,a.reduce((s,v,i)=>s+v*b[i],0))),angle=Math.acos(dot);if(angle<.001)return a;const sin=Math.sin(angle)||1;return a.map((v,i)=>(Math.sin((1-t)*angle)*v+Math.sin(t*angle)*b[i])/sin);}
 function project(p,lon,lat,scale=1){const a=lon*radians,b=lat*radians,x=p[0]*Math.cos(a)-p[2]*Math.sin(a),z=p[0]*Math.sin(a)+p[2]*Math.cos(a),y=p[1]*Math.cos(b)-z*Math.sin(b),depth=p[1]*Math.sin(b)+z*Math.cos(b);return [210+x*161.5*scale,210-y*161.5*scale,depth];}
 function routeDraw(from,to,lon,lat,progress){
  if(!ctx)return;ctx.clearRect(0,0,420,420);const destination=project(vector(to),lon,lat);if(destination[2]>.03){ctx.fillStyle='#ffe4a8';ctx.beginPath();ctx.arc(destination[0],destination[1],3.2,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#e4c58188';ctx.lineWidth=1;ctx.beginPath();ctx.arc(destination[0],destination[1],8,0,Math.PI*2);ctx.stroke();}
  if(!from)return;const a=vector(from),b=vector(to);ctx.strokeStyle='#ead19b';ctx.lineWidth=1.5;ctx.shadowColor='#c4a05b';ctx.shadowBlur=5;ctx.beginPath();let open=false;const count=Math.round(80*progress);
  for(let i=0;i<=count;i++){const t=i/80,p=project(mix(a,b,t),lon,lat,1+.17*Math.sin(t*Math.PI));if(p[2]>.015){open?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]);open=true;}else open=false;}ctx.stroke();ctx.shadowBlur=0;
  const point=project(mix(a,b,progress),lon,lat,1+.17*Math.sin(progress*Math.PI));if(point[2]>.02){ctx.save();ctx.translate(point[0],point[1]);const next=project(mix(a,b,Math.min(1,progress+.015)),lon,lat,1+.17*Math.sin(progress*Math.PI));ctx.rotate(Math.atan2(next[1]-point[1],next[0]-point[0]));ctx.fillStyle='#fff0cb';ctx.beginPath();[[8,0],[-2,-1],[-6,-6],[-8,-6],[-5,-1],[-9,-1],[-11,-4],[-12,-4],[-10,0],[-12,4],[-11,4],[-9,1],[-5,1],[-8,6],[-6,6],[-2,1]].forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fill();ctx.restore();}
 }
 function setup(){
  if(typeof Worker==='function'&&typeof globe.transferControlToOffscreen==='function'){
   try{globeWorker=new Worker('/globe-worker.js');const surface=globe.transferControlToOffscreen();globe.dataset.renderer='worker';
    globeWorker.onmessage=event=>{if(event.data.type==='ready'){ready=true;globe.dataset.ready='true';}else if(event.data.type==='unsupported'){globe.dataset.unsupported='true';dialog.classList.remove('has-globe');}};
    globeWorker.onerror=()=>{globe.dataset.unsupported='true';dialog.classList.remove('has-globe');};
    globeWorker.postMessage({type:'init',canvas:surface},[surface]);draw=(lon,lat)=>globeWorker.postMessage({type:'draw',lon:lon*radians,lat:lat*radians,size:globeSize});clear=()=>globeWorker.postMessage({type:'clear'});return;
   }catch{globeWorker?.terminate();globeWorker=null;}
  }
  globe.dataset.renderer='main-fallback';
  const gl=globe.getContext('webgl',{alpha:true,antialias:true,powerPreference:'low-power'});if(!gl){globe.dataset.unsupported='true';return;}
  function shader(type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){gl.deleteShader(s);return null;}return s;}
  const vs=shader(gl.VERTEX_SHADER,'attribute vec2 p;varying vec2 uv;void main(){uv=p;gl_Position=vec4(p,0.,1.);}');
  const fs=shader(gl.FRAGMENT_SHADER,`precision mediump float;varying vec2 uv;uniform sampler2D earth;uniform float longitude;uniform float latitude;
  void main(){vec2 p=uv*1.075;float r=dot(p,p);if(r>1.)discard;vec3 n=vec3(p,sqrt(1.-r));float c=cos(latitude),s=sin(latitude);vec3 v=vec3(n.x,n.y*c+n.z*s,-n.y*s+n.z*c);float lon=atan(v.x,v.z)+longitude;vec2 map=vec2(fract(.5+lon/6.2831853),.5-asin(v.y)/3.14159265);vec3 color=texture2D(earth,map).rgb;float light=max(0.,dot(n,normalize(vec3(-.6,.4,1.))));color*=.24+.85*light;float rim=pow(1.-n.z,3.);color+=vec3(.57,.45,.25)*rim*.42;gl_FragColor=vec4(color,1.);}`);
  if(!vs||!fs){globe.dataset.unsupported='true';return;}const program=gl.createProgram();gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS)){globe.dataset.unsupported='true';return;}gl.useProgram(program);const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);const location=gl.getAttribLocation(program,'p');gl.enableVertexAttribArray(location);gl.vertexAttribPointer(location,2,gl.FLOAT,false,0,0);const longitude=gl.getUniformLocation(program,'longitude'),latitude=gl.getUniformLocation(program,'latitude');
  const texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  const img=new Image();img.onload=()=>{gl.bindTexture(gl.TEXTURE_2D,texture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB,gl.RGB,gl.UNSIGNED_BYTE,img);ready=true;globe.dataset.ready='true';};img.onerror=()=>{globe.dataset.unsupported='true';};img.src='/assets/earth-blue-marble-1024.webp';
  draw=(lon,lat)=>{if(!ready)return;gl.viewport(0,0,globe.width,globe.height);gl.uniform1f(longitude,lon*radians);gl.uniform1f(latitude,lat*radians);gl.drawArrays(gl.TRIANGLES,0,6);};clear=()=>{gl.clear(gl.COLOR_BUFFER_BIT);};
 }
 let initialized=false;const anticipate=new IntersectionObserver((entries,observer)=>{if(entries.some(e=>e.isIntersecting)){if(!reduce.matches&&!navigator.connection?.saveData&&!initialized){setup();initialized=true;}observer.disconnect();}},{rootMargin:'500px'});anticipate.observe(document.querySelector('#world'));

 document.querySelector('#inquiry-form').addEventListener('reset',()=>{locationOrigin=null;originInput.value='';if(originNote)originNote.textContent='';dismiss();});
 function dismiss(){const returnFocus=dialog.contains(document.activeElement);pending=null;cancelAnimationFrame(frame);dialog.hidden=true;clear();if(returnFocus)lastControl?.focus({preventScroll:true});}
 dialog.querySelector('.journey-close').addEventListener('click',dismiss);
 dialog.querySelector('.journey-continue').addEventListener('click',()=>{dismiss();window.goToJuneInquiry?.();});
 document.addEventListener('june:venue-cleared',dismiss);document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!dialog.hidden)dismiss();});document.addEventListener('click',event=>{if(event.target.closest('a[href="#plan-your-trip"]'))dismiss();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)cancelAnimationFrame(frame);});
 reduce.addEventListener('change',()=>{if(reduce.matches)cancelAnimationFrame(frame);});
 window.chooseJuneVenue=function(venue,careOrOptions){
  const options=typeof careOrOptions==='string'?{care:careOrOptions}:careOrOptions||{};
  dismiss();original(venue,{...options,navigate:false});
  if(options.preview===false)return;
  lastControl=document.activeElement;const revision=++selectionRevision;
  cancelAnimationFrame(frame);pending=venue;dialog.hidden=false;
  dialog.querySelector('#journey-title').textContent=venue.name.replace(/^The Golf Course at /,'');
  const origin=departure.value.trim()||originInput.value;
  dialog.querySelector('#journey-route-label').textContent=(locationOrigin?'Your location':origin||'June Links')+' → '+venue.country;
  if(!initialized&&!reduce.matches&&!navigator.connection?.saveData){setup();initialized=true;}
  mediaReady.then(index=>{
   if(revision!==selectionRevision||!pending)return;
   const to=venue.coordinates||index[venue.id]?.coordinates;
   const hasCoordinates=Array.isArray(to)&&to.length===2&&to.every(Number.isFinite);
   const from=locationOrigin||origins[origin]||null;
   dialog.classList.toggle('has-globe',hasCoordinates&&initialized&&globe.dataset.unsupported!=='true');
   if(!hasCoordinates)return;
   const size=Math.min(devicePixelRatio||1,1.5);globeSize=Math.round(220*size);if(!globeWorker)globe.width=globe.height=globeSize;route.width=route.height=630;ctx?.setTransform(1.5,0,0,1.5,0,0);
   const endLon=to[1],startLon=from?from[1]:endLon-55,delta=((endLon-startLon+540)%360)-180,requested=performance.now();let last=0,start=null;
   function tick(now){if(!pending||revision!==selectionRevision||dialog.hidden||document.hidden)return;
    if(!ready&&globe.dataset.unsupported!=='true'&&now-requested<1800){frame=requestAnimationFrame(tick);return;}
    if(start===null)start=now;const t=reduce.matches?1:Math.min(1,(now-start)/1800),ease=1-Math.pow(1-t,3),lon=startLon+delta*ease,lat=(from?from[0]*.2:10)+(to[0]*.55-(from?from[0]*.2:10))*ease;
    if(now-last>=1000/30||t===1){draw(lon,lat);routeDraw(from,to,lon,lat,Math.min(1,t*1.15));last=now;}
    if(t<1)frame=requestAnimationFrame(tick);
   }
   frame=requestAnimationFrame(tick);
  });
 };
})();

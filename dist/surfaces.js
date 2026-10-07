(function(root){'use strict';
if(typeof document!=='undefined'){document.addEventListener('keydown',e=>{if(e.key==='Tab')document.body.classList.add('keyboard-navigation');});document.addEventListener('pointerdown',()=>document.body.classList.remove('keyboard-navigation'),{passive:true});}

const pages=new Set(['object-dialog','photo-dialog','wait-history-dialog']);
function kind(id){return pages.has(id)?'page':'sheet';}
function gesture(type,start,end){const rtl=root.document?.documentElement?.dir==='rtl',edge=rtl?start.x>=root.innerWidth-32:start.x<=32,dx=(end.x-start.x)*(rtl?-1:1),dy=end.y-start.y;return type==='page'?edge&&dx>=90&&Math.abs(dy)<dx*.5:dy>=80&&Math.abs(dx)<dy*.5&&start.atTop;}
function sheetAction(full,start,end){const dx=end.x-start.x,dy=end.y-start.y;if(full&&gesture('page',start,end))return 'collapse';if(!start.atTop||Math.abs(dx)>=Math.abs(dy)*.5)return null;if(dy<=-60)return 'expand';if(dy>=80)return full?'collapse':'close';return null;}
const detents=['minimum','normal','large','fullscreen'],detentLabels=['Minimum','Normal','Größer','Vollbild'];
const compactFrames=new WeakMap(),activeMotions=new WeakMap();
function sheetState(el,fullClass='surface-fullscreen'){return el.classList.contains(fullClass)?'fullscreen':el.dataset.sheetState||'normal';}
function setDetent(el,state,win,fullClass='surface-fullscreen'){
 if(!detents.includes(state))state='normal';
 el.dataset.sheetState=state;el.classList.toggle(fullClass,state==='fullscreen');el.classList.toggle('sheet-large',state==='large');
 if(fullClass==='player-fullscreen')el.classList.toggle('mini-player',state==='minimum');
 const handle=el.querySelector(fullClass==='player-fullscreen'?'.nav-resize':'.ios-sheet-handle');
 if(handle){handle.setAttribute('aria-expanded',state!=='minimum');handle.setAttribute('aria-label',(typeof DisneyI18n==='undefined'?String:DisneyI18n.text)(`Sheet: ${detentLabels[detents.indexOf(state)]}. Zum Ändern ziehen oder tippen.`));}
 el.scrollTop=0;const content=el.querySelector('.sheet-scroll');if(content)content.scrollTop=0;el.dispatchEvent(new win.CustomEvent('surfacechange',{detail:{state,expanded:state==='large'||state==='fullscreen'}}));
}
function snapDetent(state,frames,dy){
 const index=detents.indexOf(state);if(Math.abs(dy)<28)return state;
 const top=frames[index].top+dy;let nearest=index;
 for(let i=0;i<frames.length;i++)if(Math.abs(frames[i].top-top)<Math.abs(frames[nearest].top-top))nearest=i;
 if(nearest===index)nearest=Math.max(0,Math.min(3,index+(dy<0?1:-1)));
 return detents[nearest];
}
function mixFrame(from,to,progress){const p=Math.max(0,Math.min(1,progress));return Object.fromEntries(['top','left','width','height'].map(k=>[k,from[k]+(to[k]-from[k])*p]));}
const rectFrame=el=>{const r=el.getBoundingClientRect();return {top:r.top,left:r.left,width:r.width,height:r.height,bottom:r.bottom};};
function beginMotion(el,win,fullClass='surface-fullscreen',detented=false){
 // Cancel the preceding settle BEFORE measuring: otherwise its target frame becomes the next origin.
 activeMotions.get(el)?.stop();
 // An opening animation must not offset the first drag's measured geometry.
 el.classList.add('surface-interacted');
 const from=rectFrame(el),state=detented?sheetState(el,fullClass):null;
 const full=el.classList.contains(fullClass),root=win.getComputedStyle(el.ownerDocument.documentElement),viewportTop=parseFloat(root.getPropertyValue('--app-viewport-top'))||0,viewportHeight=(root.getPropertyValue('--app-viewport-height').endsWith('px')?parseFloat(root.getPropertyValue('--app-viewport-height')):0)||win.visualViewport?.height||win.innerHeight,viewportWidth=win.innerWidth;
 if(!full&&(!detented||state==='normal'))compactFrames.set(el,{height:from.height,bottomGap:viewportTop+viewportHeight-from.bottom});
 const saved=compactFrames.get(el)||{height:Math.min(320,viewportHeight-110),bottomGap:88},width=Math.min(520,viewportWidth-24);
 const compact={top:viewportTop+viewportHeight-saved.bottomGap-saved.height,left:(viewportWidth-width)/2,width,height:saved.height},screen={top:viewportTop,left:0,width:viewportWidth,height:viewportHeight};
 const minimumHeight=fullClass==='player-fullscreen'?128:124,available=viewportHeight-saved.bottomGap;
 const normalHeight=detented?Math.min(Math.max(saved.height,fullClass==='player-fullscreen'?180:200),available*.55):saved.height;
 if(detented){compact.height=normalHeight;compact.top=viewportTop+available-normalHeight;el.style.setProperty('--sheet-bottom-gap',saved.bottomGap+'px');}
 const atHeight=height=>({...compact,height,top:viewportTop+available-height});
 const frames=[atHeight(Math.min(minimumHeight,normalHeight-32)),compact,atHeight(Math.min(available-32,Math.max(normalHeight+64,available*.75))),screen];
 const properties=['top','left','right','bottom','width','height','max-height','transform','margin','border-radius'],previous=properties.map(k=>[k,el.style.getPropertyValue(k),el.style.getPropertyPriority(k)]);
 let timer=null,done=false;
 const restore=()=>{for(const [k,v,p] of previous)v?el.style.setProperty(k,v,p):el.style.removeProperty(k);el.classList.remove('surface-grabbing','surface-settling');};
 const frame=(rect,radius)=>{for(const k of ['top','left','width','height'])el.style.setProperty(k,rect[k]+'px','important');el.style.setProperty('max-height',rect.height+'px','important');for(const [k,v] of [['transform','none'],['margin','0'],['right','auto'],['bottom','auto']])el.style.setProperty(k,v,'important');if(radius!==undefined)el.style.setProperty('border-radius',radius+'px','important');};
 const stop=()=>{if(done)return;done=true;if(timer!==null)win.clearTimeout(timer);restore();activeMotions.delete(el);};
 const animate=(target,after)=>{void el.offsetHeight;el.classList.remove('surface-grabbing');el.classList.add('surface-settling');frame(target);timer=win.setTimeout(()=>{stop();after?.();},220);};
 const motion={stop,state,frames,
  destination(dy){return snapDetent(state,frames,dy);},
  move(dy){if(done)return;el.classList.add('surface-grabbing');
   if(detented){const top=from.top+dy;let rect;
    if(top>frames[0].top)rect={...frames[0],top:frames[0].top+(top-frames[0].top)*.3};
    else if(top<screen.top)rect={...screen,top:screen.top+(top-screen.top)*.2};
    else for(let i=0;i<3;i++)if(top<=frames[i].top&&top>=frames[i+1].top){rect=mixFrame(frames[i],frames[i+1],(frames[i].top-top)/Math.max(1,frames[i].top-frames[i+1].top));break;}
    if(rect)frame(rect,24*Math.max(0,Math.min(1,(rect.top-viewportTop)/Math.max(1,frames[2].top-viewportTop))));return;
   }
   const to=full?compact:screen,p=full?dy/Math.max(1,compact.top-from.top):-dy/Math.max(1,from.top-screen.top);if(full&&dy>=0||!full&&dy<=0)frame(mixFrame(from,to,p),24*(full?Math.max(0,Math.min(1,p)):1-Math.max(0,Math.min(1,p))));else frame({...from,top:from.top+(full?dy*.2:dy)},full?0:24);},
  settle(commit){if(done)return;const current=rectFrame(el);restore();commit?.();const target=rectFrame(el);frame(current);el.classList.add('surface-grabbing');animate(target);},
  dismiss(close){if(done)return;const current=rectFrame(el);frame(current);animate({...current,top:viewportTop+viewportHeight+24},close);}
 };
 activeMotions.set(el,motion);return motion;
}
function bindSheetHandle(el,handle,win,{fullClass='surface-fullscreen',close=null}={}){
 let drag=null,suppressClick=false;
 handle.addEventListener('pointerdown',e=>{
  if(e.isPrimary===false||e.button>0)return;
  e.preventDefault();suppressClick=false;
  drag={id:e.pointerId,y:e.clientY,motion:beginMotion(el,win,fullClass,true)};
  handle.setPointerCapture(e.pointerId);
 });
 handle.addEventListener('pointermove',e=>{if(drag&&e.pointerId===drag.id){e.preventDefault();drag.motion.move(e.clientY-drag.y);}});
 handle.addEventListener('pointerup',e=>{
  if(!drag||e.pointerId!==drag.id)return;
  const {motion,y}=drag,dy=e.clientY-y;drag=null;suppressClick=Math.abs(dy)>8;
  if(close&&motion.state==='minimum'&&dy>=90)motion.dismiss(close);
  else motion.settle(()=>setDetent(el,motion.destination(dy),win,fullClass));
 });
 const cancel=()=>{if(drag){drag.motion.settle();drag=null;}suppressClick=false;};
 handle.addEventListener('pointercancel',cancel);handle.addEventListener('lostpointercapture',()=>{if(drag)cancel();});
 handle.onclick=e=>{if(suppressClick){suppressClick=false;e.preventDefault();return;}const state=sheetState(el,fullClass),next=detents[(detents.indexOf(state)+1)%4];beginMotion(el,win,fullClass,true).settle(()=>setDetent(el,next,win,fullClass));};
 return ()=>{drag=null;suppressClick=false;activeMotions.get(el)?.stop();};
}
// Chrome stays on the surface; only this inner region can scroll.
function wrapSheetContent(el,doc,chrome){
 const content=doc.createElement('div');content.className='sheet-scroll';
 for(const child of Array.from(el.childNodes))if(!chrome.includes(child))content.append(child);
 el.append(content);return content;
}
function installZoomGuard(doc){
 const onMap=target=>!!target?.closest?.('#map,#original-map,#three-map');
 let mapGesture=false;
 const touches=e=>{
  mapGesture=e.touches.length>0&&Array.from(e.touches).every(t=>onMap(t.target));
  if(e.touches.length>1&&!mapGesture&&e.cancelable)e.preventDefault();
 };
 doc.addEventListener('touchstart',touches,{capture:true,passive:false});
 doc.addEventListener('touchmove',touches,{capture:true,passive:false});
 doc.addEventListener('touchend',e=>{if(!e.touches.length)mapGesture=false;},{capture:true,passive:true});
 doc.addEventListener('touchcancel',()=>{mapGesture=false;},{capture:true,passive:true});
 // Safari's gesture events need a separate guard; keep WebGL/Leaflet gestures.
 for(const name of ['gesturestart','gesturechange'])doc.addEventListener(name,e=>{if(!mapGesture&&!onMap(e.target)&&e.cancelable)e.preventDefault();},{capture:true,passive:false});
}
function init(doc,win){
 installZoomGuard(doc);
 const contact=(el,event,handler,opts)=>{el.addEventListener(event,handler,opts);const name={touchstart:'pointerdown',touchmove:'pointermove',touchend:'pointerup',touchcancel:'pointercancel'}[event];(event==='touchstart'?el:doc).addEventListener(name,e=>{if(e.pointerType!=='mouse'||event==='touchstart'&&e.button!==0||event==='touchmove'&&!e.buttons)return;const point={clientX:e.clientX,clientY:e.clientY};handler({target:e.target,touches:event==='touchend'||event==='touchcancel'?[]:[point],changedTouches:[point],preventDefault:()=>e.preventDefault()});},opts);};
 const stack=doc.createElement('div');stack.id='top-notices';doc.body.append(stack);for(const id of ['toast','queue-bubble','nearby-shows']){const el=doc.getElementById(id);if(el)stack.append(el);}const sync=()=>doc.documentElement.style.setProperty('--notification-height',stack.getBoundingClientRect().height?stack.getBoundingClientRect().height+8+'px':'0px');if(win.ResizeObserver)new win.ResizeObserver(sync).observe(stack);new win.MutationObserver(sync).observe(stack,{attributes:true,childList:true,subtree:true,attributeFilter:['hidden']});sync();
 for(const dialog of doc.querySelectorAll('dialog')){
  const type=kind(dialog.id);dialog.classList.add('ios-'+type);
  let close=dialog.querySelector('[id$="-close"],[id^="close-"]');
  if(!close){close=doc.createElement('button');close.type='button';close.onclick=()=>dialog.close();dialog.prepend(close);}
  close.classList.add(type==='page'?'ios-back':'ios-sheet-close');close.textContent=(typeof DisneyI18n==='undefined'?String:DisneyI18n.text)(type==='page'?'‹ Zurück':'×');close.setAttribute('aria-label',(typeof DisneyI18n==='undefined'?String:DisneyI18n.text)(type==='page'?'Zurück':'Fenster schließen'));
  let resetHandle=null;if(type==='sheet'){dialog.prepend(close);const handle=doc.createElement('button');handle.type='button';handle.className='ios-sheet-handle';dialog.prepend(handle);wrapSheetContent(dialog,doc,[handle,close]);resetHandle=bindSheetHandle(dialog,handle,win,{close:()=>close.click()});setDetent(dialog,'normal',win);}
  let start=null,motion=null;dialog.addEventListener('close',()=>{resetHandle?.();activeMotions.get(dialog)?.stop();motion=null;start=null;dialog.classList.remove('surface-interacted');if(type==='sheet')setDetent(dialog,'normal',win);});
  if(dialog.id!=='object-dialog'){
   contact(dialog,'touchstart',e=>{if(e.target.closest?.('.ios-sheet-handle'))return;if(e.touches.length!==1){motion?.settle();motion=null;start=null;return;}const t=e.touches[0],rect=dialog.getBoundingClientRect();let scrolling=false;for(let p=e.target;p&&p!==dialog;p=p.parentElement)if(p.scrollTop>0)scrolling=true;start={x:t.clientX,y:t.clientY,atTop:e.target.classList?.contains('ios-sheet-handle')||!scrolling&&dialog.scrollTop<=0&&t.clientY<=rect.top+80};},{passive:true});
   contact(dialog,'touchmove',e=>{if(type!=='sheet'||!start?.atTop||e.touches.length!==1)return;const dy=e.touches[0].clientY-start.y,dx=e.touches[0].clientX-start.x;if(Math.abs(dy)>8&&Math.abs(dx)<Math.abs(dy)*.5){e.preventDefault();motion??=beginMotion(dialog,win,'surface-fullscreen',true);motion.move(dy);}},{passive:false});
   contact(dialog,'touchend',e=>{if(start&&e.changedTouches.length){const end={x:e.changedTouches[0].clientX,y:e.changedTouches[0].clientY};if(type==='sheet'){const dy=end.y-start.y,vertical=start.atTop&&Math.abs(end.x-start.x)<Math.abs(dy)*.5,back=sheetState(dialog)==='fullscreen'&&gesture('page',start,end);if(vertical||back){motion??=beginMotion(dialog,win,'surface-fullscreen',true);if(motion.state==='minimum'&&dy>=90)motion.dismiss(()=>close.click());else motion.settle(()=>setDetent(dialog,back?'large':motion.destination(dy),win));}else motion?.settle();}else if(gesture(type,start,end))close.click();}start=null;motion=null;},{passive:true});
   contact(dialog,'touchcancel',()=>{start=null;motion?.settle();motion=null;},{passive:true});
  }
  if(type==='page'&&dialog.id!=='object-dialog'){
   new win.MutationObserver(()=>{if(dialog.open&&(!dialog.dataset.surfaceToken||win.history.state?.disneySurface!==dialog.dataset.surfaceToken)){const token=dialog.id+':'+Date.now()+Math.random();dialog.dataset.surfaceToken=token;win.history.pushState({...win.history.state,disneySurface:token},'');}else if(!dialog.open&&dialog.dataset.surfaceToken){if(typeof objectParentDialog!=='undefined'&&objectParentDialog===dialog.id)return;const token=dialog.dataset.surfaceToken;delete dialog.dataset.surfaceToken;if(win.history.state?.disneySurface===token)win.history.back();}}).observe(dialog,{attributes:true,attributeFilter:['open']});
  }
 }
 win.addEventListener('popstate',()=>{for(const d of doc.querySelectorAll('.ios-page[open]'))if(d.id!=='object-dialog'&&d.dataset.surfaceToken&&d.dataset.surfaceToken!==win.history.state?.disneySurface){delete d.dataset.surfaceToken;d.close();}});
 const navigation=doc.getElementById('navigation'),navHandle=doc.getElementById('nav-size-toggle');if(navigation&&navHandle){wrapSheetContent(navigation,doc,[navHandle]);bindSheetHandle(navigation,navHandle,win,{fullClass:'player-fullscreen'});setDetent(navigation,'normal',win,'player-fullscreen');}
 const setup=doc.getElementById('setup-dialog');if(setup){setup.classList.add('ios-page');const back=doc.createElement('button');back.className='ios-back';back.textContent=(typeof DisneyI18n==='undefined'?String:DisneyI18n.text)('‹ Zurück');back.onclick=()=>doc.getElementById('setup-done').click();setup.prepend(back);let start=null;setup.addEventListener('touchstart',e=>{start=e.touches.length===1?{x:e.touches[0].clientX,y:e.touches[0].clientY}:null;},{passive:true});setup.addEventListener('touchend',e=>{if(start&&e.changedTouches.length&&gesture('page',start,{x:e.changedTouches[0].clientX,y:e.changedTouches[0].clientY}))back.click();start=null;},{passive:true});setup.addEventListener('touchcancel',()=>{start=null;},{passive:true});}
}
root.DisneySurfaces={kind,gesture,sheetAction,detents,sheetState,setDetent,snapDetent,mixFrame,beginMotion,bindSheetHandle,installZoomGuard,wrapSheetContent,init};if(typeof module!=='undefined')module.exports=root.DisneySurfaces;
if(typeof document!=='undefined')init(document,window);
})(typeof globalThis!=='undefined'?globalThis:this);

(function(root){'use strict';
const REVEAL_DISTANCE=36;
function labels(state){return [{action:'favorite',text:state.favorite?'Fav entfernen':'Favorit',icon:state.favorite?'♡':'♥'},{action:'hidden',text:state.hidden?'Einblenden':'Ausblenden',icon:state.hidden?'◉':'◌'},{action:'visited',text:state.visited?'Besucht entfernen':'Besucht',icon:state.visited?'×':'✓'}];}
function offset(dx,initial,width){return Math.max(-width,Math.min(0,initial+dx));}
function reveal(dx,dy){return dx<=-REVEAL_DISTANCE&&Math.abs(dy)<Math.abs(dx)*.6;}
function init(doc,api){
 const contact=(event,handler,opts)=>{doc.addEventListener(event,handler,opts);const name={touchstart:'pointerdown',touchmove:'pointermove',touchend:'pointerup',touchcancel:'pointercancel'}[event];doc.addEventListener(name,e=>{if(e.pointerType!=='mouse'||event==='touchstart'&&e.button!==0||event==='touchmove'&&!e.buttons)return;const point={clientX:e.clientX,clientY:e.clientY};handler({target:e.target,touches:event==='touchend'||event==='touchcancel'?[]:[point],changedTouches:[point],preventDefault:()=>e.preventDefault()});},opts);};
 let drag=null,opened=null,suppressUntil=0;
 const paint=(row,x)=>{
  row.style.setProperty('--swipe-x',x+'px');
  row.style.setProperty('--swipe-reveal',Math.abs(x)+'px');
  const visible=x<=-REVEAL_DISTANCE,tray=row.querySelector('.swipe-actions');
  row.classList.toggle('swipe-revealed',visible);
  if(tray){tray.inert=!visible;tray.setAttribute('aria-hidden',String(!visible));}
 };
 const close=()=>{if(opened){opened.classList.remove('swipe-open','swiping');paint(opened,0);opened=null;}};
 const prepare=row=>{
  let tray=row.querySelector('.swipe-actions');
  if(!tray){
   // Move the whole row as one opaque surface, including its gaps and heart.
   const content=doc.createElement('div');content.className='swipe-content';
   content.append(...row.childNodes);row.append(content);
   tray=doc.createElement('div');tray.className='swipe-actions';row.append(tray);row.classList.add('swipe-row');paint(row,0);
  }
  tray.replaceChildren();
  for(const item of labels(api.state(row.dataset.objectRow))){const b=doc.createElement('button');b.type='button';b.className='swipe-'+item.action;b.dataset.swipeAction=item.action;b.setAttribute('aria-label',(typeof DisneyI18n==='undefined'?String:DisneyI18n.text)(item.text));const icon=doc.createElement('span');icon.setAttribute('aria-hidden','true');icon.textContent=(typeof DisneyI18n==='undefined'?String:DisneyI18n.text)(item.icon);b.append(icon,doc.createTextNode((typeof DisneyI18n==='undefined'?String:DisneyI18n.text)(item.text)));tray.append(b);}
  return Math.min(252,row.getBoundingClientRect().width*.8);
 };
 contact('touchstart',e=>{
  if(e.touches.length!==1){if(drag){drag.row.classList.remove('swiping');paint(drag.row,drag.initial);drag=null;}return;}
  const row=e.target.closest?.('.ride-row,.playlist-stop,.show-list-item,.stop,#hidden-targets-list li[data-object-row]');
  if(!row||!row.dataset.objectRow?.startsWith('ride-')){close();return;}if(e.target.closest('.swipe-actions'))return;
  if(opened&&opened!==row)close();const width=Math.min(252,row.getBoundingClientRect().width*.8),initial=row===opened?-width:0,t=e.touches[0];
  drag={row,x:t.clientX,y:t.clientY,initial,width,horizontal:false};
 },{passive:true});
 contact('touchmove',e=>{if(!drag||e.touches.length!==1)return;const dx=e.touches[0].clientX-drag.x,dy=e.touches[0].clientY-drag.y;if(!drag.horizontal){if(Math.abs(dy)>12&&Math.abs(dy)>Math.abs(dx)){drag=null;return;}if(Math.abs(dx)<12||Math.abs(dx)<Math.abs(dy)*1.5)return;prepare(drag.row);drag.horizontal=true;drag.row.classList.add('swiping');}e.preventDefault();paint(drag.row,offset(dx,drag.initial,drag.width));},{passive:false});
 contact('touchend',e=>{if(!drag)return;const d=drag;drag=null;if(!d.horizontal)return;const t=e.changedTouches[0],dx=t.clientX-d.x,dy=t.clientY-d.y,show=d.initial?dx<REVEAL_DISTANCE:reveal(dx,dy);d.row.classList.remove('swiping');d.row.classList.toggle('swipe-open',show);paint(d.row,show?-d.width:0);opened=show?d.row:null;suppressUntil=Date.now()+400;},{passive:true});
 contact('touchcancel',()=>{if(drag){drag.row.classList.remove('swiping');paint(drag.row,drag.initial);drag=null;}},{passive:true});
 doc.addEventListener('click',e=>{const action=e.target.closest?.('[data-swipe-action]');if(action){e.preventDefault();e.stopImmediatePropagation();const row=action.closest('[data-object-row]');close();api.action(row.dataset.objectRow,action.dataset.swipeAction);return;}if(Date.now()<suppressUntil&&e.target.closest?.('.swipe-row')){e.preventDefault();e.stopImmediatePropagation();return;}if(opened){const onRow=opened.contains(e.target);close();if(onRow){e.preventDefault();e.stopImmediatePropagation();}}},true);
}
root.DisneySwipeList={labels,offset,reveal,init};if(typeof module!=='undefined')module.exports=root.DisneySwipeList;
if(typeof document!=='undefined')init(document,{state:id=>({favorite:favorites.has(id),hidden:uninterested.has(id),visited:visited.has(id)}),action:(id,action)=>applyListAction(id,action)});
})(typeof globalThis!=='undefined'?globalThis:this);

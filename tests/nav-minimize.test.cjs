const assert=require('node:assert/strict'),fs=require('node:fs');
const {bindSheetHandle,setDetent,sheetState}=require('../dist/surfaces.js');
function fixture(fullClass='player-fullscreen'){
 const styles=new Map(),classes=new Set(),timers=new Map(),events={},attrs={},changes=[];let serial=0;
 const win={innerWidth:390,innerHeight:844,CustomEvent:class{constructor(type,{detail}){this.type=type;this.detail=detail;}},getComputedStyle:()=>({getPropertyValue:()=>''}),setTimeout(fn){timers.set(++serial,fn);return serial;},clearTimeout:id=>timers.delete(id)};
 const content={scrollTop:0};
 const handle={addEventListener(k,fn){events[k]=fn;},setAttribute(k,v){attrs[k]=v;},setPointerCapture(id){this.captured=id;}};
 const el={dataset:{sheetState:'normal'},scrollTop:0,ownerDocument:{documentElement:{}},querySelector:selector=>selector==='.sheet-scroll'?content:handle,dispatchEvent:e=>changes.push(e.detail),classList:{contains:k=>classes.has(k),add:(...ks)=>ks.forEach(k=>classes.add(k)),remove:(...ks)=>ks.forEach(k=>classes.delete(k)),toggle(k,v){v?classes.add(k):classes.delete(k);}},style:{getPropertyValue:k=>styles.get(k)||'',getPropertyPriority:()=>'',setProperty(k,v){styles.set(k,v);},removeProperty:k=>styles.delete(k)},getBoundingClientRect(){const state=sheetState(el,fullClass),height={minimum:fullClass==='player-fullscreen'?128:124,normal:220,large:562.5,fullscreen:844}[state],base={top:(state==='fullscreen'?0:750-height)+(classes.has('surface-interacted')?0:24),left:state==='fullscreen'?0:12,width:state==='fullscreen'?390:366,height},r=Object.fromEntries(Object.entries(base).map(([k,v])=>[k,styles.has(k)?parseFloat(styles.get(k)):v]));return {...r,bottom:r.top+r.height};},get offsetHeight(){return this.getBoundingClientRect().height;}};
 const flush=()=>{for(const [id,fn] of [...timers]){timers.delete(id);fn();}};
 const pointer=(type,y,id=1)=>{let prevented=false;events[type]({pointerId:id,clientY:y,button:0,isPrimary:true,preventDefault(){prevented=true;}});return prevented;};
 return {el,handle,content,win,events,attrs,changes,classes,styles,flush,pointer};
}
for(const fullClass of ['player-fullscreen','surface-fullscreen']){
 const f=fixture(fullClass),{el,handle,win,pointer,flush,classes}=f;let closed=false;
 bindSheetHandle(el,handle,win,{fullClass,close:fullClass==='surface-fullscreen'?()=>closed=true:null});
 assert(pointer('pointerdown',500),'Claim the very first upward gesture immediately');assert.equal(handle.captured,1);assert(classes.has('surface-interacted'),'Interrupt the entrance animation before measuring the first drag');
 pointer('pointermove',440);assert.equal(el.getBoundingClientRect().top,470,'Live sheet follows the finger before release');assert.equal(el.dataset.sheetState,'normal');
 pointer('pointerup',440);assert.equal(el.dataset.sheetState,'large','First upward swipe opens larger directly, with no preceding downward swipe');flush();
 handle.onclick({preventDefault(){}});assert.equal(el.dataset.sheetState,'large','Trailing click cannot change the snapped detent');
 // Start again during the preceding animation; it must measure the resting detent, not stale inline geometry.
 pointer('pointerdown',200);pointer('pointerup',140);assert.equal(el.dataset.sheetState,'fullscreen');
 pointer('pointerdown',20);pointer('pointermove',80);assert(Math.abs(el.getBoundingClientRect().top-60)<.01);pointer('pointerup',80);flush();assert.equal(el.dataset.sheetState,'large');
 pointer('pointerdown',200);pointer('pointerup',260);flush();assert.equal(el.dataset.sheetState,'normal');
 pointer('pointerdown',500);pointer('pointerup',560);flush();assert.equal(el.dataset.sheetState,'minimum');
 if(fullClass==='player-fullscreen')assert(classes.has('mini-player'));
 pointer('pointerdown',600);pointer('pointerup',540);flush();assert.equal(el.dataset.sheetState,'normal','Minimum also expands directly');
 pointer('pointerdown',500);pointer('pointermove',470);pointer('pointercancel',470);flush();assert.equal(el.dataset.sheetState,'normal','Interrupted gestures restore the original detent');
 assert(!classes.has('surface-grabbing'));assert(!classes.has('surface-settling'));assert(!f.styles.has('top'));
 pointer('pointerdown',500);pointer('pointerup',498);flush();handle.onclick({preventDefault(){}});flush();assert.equal(el.dataset.sheetState,'large','A tap advances one detent');
 f.content.scrollTop=280;setDetent(el,'minimum',win,fullClass);assert.equal(f.content.scrollTop,0,'Detent changes reset the inner scroller so the title stays visible');pointer('pointerdown',500);pointer('pointerup',620);flush();assert.equal(closed,fullClass==='surface-fullscreen','Only a further downward pull from minimum dismisses a dialog, never the navigation');
 assert(f.attrs['aria-label'].includes('Minimum'));assert.equal(f.changes.at(-1).state,'minimum');
}
const css=fs.readFileSync(__dirname+'/../dist/style.css','utf8');assert.match(css,/\.navigation \.nav-resize[^}]*touch-action:none/);assert.match(css,/height:44px;min-height:44px/);assert.match(css,/surface-interacted\{animation:none!important;translate:none!important/);
console.log('Passed: first upward pointer gesture, live motion, all four detents both ways, pointer capture/cancel, rapid successive drags, trailing click suppression, accessible tap and minimum dismissal.');

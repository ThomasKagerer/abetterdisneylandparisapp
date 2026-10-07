const assert=require('node:assert/strict'),{init}=require('../dist/swipe-list.js');
class Node{
 constructor(className=''){this.className=className;this.childNodes=[];this.dataset={};this.attrs=new Map();this.css=new Map();this.style={setProperty:(k,v)=>this.css.set(k,v)};this.classList={add:(...ks)=>ks.forEach(k=>{if(!this.className.split(' ').includes(k))this.className+=' '+k;}),remove:(...ks)=>{this.className=this.className.split(' ').filter(k=>!ks.includes(k)).join(' ');},toggle:(k,v)=>v?this.classList.add(k):this.classList.remove(k),contains:k=>this.className.split(' ').includes(k)};}
 append(...nodes){for(const n of nodes){if(n.parentElement)n.parentElement.childNodes=n.parentElement.childNodes.filter(x=>x!==n);n.parentElement=this;this.childNodes.push(n);}}
 setAttribute(k,v){this.attrs.set(k,v);}replaceChildren(){this.childNodes=[];}
 matches(selector){if(selector==='[data-object-row]')return !!this.dataset.objectRow;if(selector==='[data-swipe-action]')return !!this.dataset.swipeAction;return selector.split(',').some(s=>s.trim().startsWith('.')&&this.classList.contains(s.trim().slice(1)));}
 closest(s){for(let p=this;p;p=p.parentElement)if(p.matches(s))return p;return null;}
 querySelector(s){for(const n of this.childNodes){if(n.matches(s))return n;const found=n.querySelector(s);if(found)return found;}return null;}
 contains(n){for(let p=n;p;p=p.parentElement)if(p===this)return true;return false;}
 getBoundingClientRect(){return {width:390};}
}
const listeners=new Map(),calls=[],doc={addEventListener:(k,fn)=>{if(!listeners.has(k))listeners.set(k,[]);listeners.get(k).push(fn);},createElement:()=>new Node(),createTextNode:()=>new Node()};
const row=new Node('ride-row'),info=new Node('ride-info'),heart=new Node('heart'),title=new Node('ride-name');row.dataset.objectRow='ride-a';info.append(title);row.append(info,heart);
init(doc,{state:()=>({favorite:true,hidden:false,visited:true}),action:(...args)=>calls.push(args)});
const emit=(kind,x,y=0,target=title)=>{let prevented=false;const p={clientX:x,clientY:y},e={target,touches:kind==='touchend'||kind==='touchcancel'?[]:[p],changedTouches:[p],preventDefault:()=>prevented=true,stopImmediatePropagation(){}};for(const fn of listeners.get(kind)||[])fn(e);return prevented;};
emit('touchstart',300);emit('touchend',300);assert.equal(row.querySelector('.swipe-content'),null,'A normal tap must not reparent the pressed button and swallow its click');emit('touchstart',300);emit('touchmove',280);const tray=row.querySelector('.swipe-actions'),content=row.querySelector('.swipe-content');assert(content.contains(info)&&content.contains(heart),'Whole foreground shares one covering surface');assert.equal(row.childNodes.length,2);assert.equal(tray.inert,true);assert.equal(tray.attrs.get('aria-hidden'),'true');
emit('touchmove',280);assert.equal(row.css.get('--swipe-x'),'-20px');assert(!row.classList.contains('swipe-revealed'));assert(tray.inert,'Small horizontal movement does not expose or enable actions');
emit('touchmove',265);assert(tray.inert);emit('touchmove',264);assert(!tray.inert);assert(row.classList.contains('swipe-revealed'));assert.equal(row.css.get('--swipe-reveal'),'36px');
emit('touchend',264);assert(row.classList.contains('swipe-open'));assert.equal(row.css.get('--swipe-x'),'-252px');
emit('touchstart',100);emit('touchmove',140);emit('touchend',140);assert(!row.classList.contains('swipe-open'));assert(tray.inert);assert.equal(row.css.get('--swipe-reveal'),'0px');assert.equal(calls.length,0);
emit('touchstart',300);assert(!emit('touchmove',295,80));emit('touchend',295,80);assert(tray.inert,'Vertical list scrolling leaves actions hidden');
emit('touchstart',300);emit('touchmove',220);emit('touchcancel',220);assert(tray.inert);assert.equal(row.css.get('--swipe-x'),'0px','Cancellation restores closed state');
emit('touchstart',300);emit('touchmove',200);emit('touchend',200);const visit=tray.childNodes.find(x=>x.dataset.swipeAction==='visited');emit('click',0,0,visit);assert.deepEqual(calls,[['ride-a','visited']]);assert(tray.inert,'Action closes the row');
console.log('Passed: one opaque foreground, hidden and inert until 36px, reveal width follows drag, close/reopen, vertical scroll, cancellation and reversible action dispatch.');

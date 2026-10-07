const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(__dirname+'/../dist/app.js','utf8');
function item(){const state={};return {state,marker:{getElement:()=>({querySelector:()=>({classList:{toggle:(_,on)=>state.highlight=on}})}),setZIndexOffset:z=>state.z=z,unbindTooltip:()=>{state.label=null;},bindTooltip:(label,options)=>{state.label=label;state.permanent=options.permanent;}}};}
const a=item(),b=item(),ride=item();
const ctx={targetAvailable:()=>true,popupWaits:new Map([['a',a],['b',b],['ride',ride]]),pointById:new Map([['a',{category:'show',name:'Show A'}],['b',{category:'show',name:'Show B'}],['ride',{category:'ride',name:'Ride'}]]),focusedRideId:'a',route:{order:['b']},esc:s=>s};
vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('function markShowTargets('),source.indexOf('function focusRideOnMap(')),ctx);
ctx.markShowTargets();assert.equal(a.state.highlight,true);assert.equal(a.state.label,'AUSGEWÄHLTE SHOW · Show A');assert.equal(b.state.label,'NÄCHSTE SHOW · Show B');assert.equal(b.state.z,2000);assert.equal(b.state.permanent,true);assert.equal(ride.state.highlight,false);
ctx.focusedRideId='b';ctx.route.order=['ride'];ctx.markShowTargets();assert.equal(a.state.highlight,false);assert.equal(a.state.label,null);assert.equal(a.state.z,0);assert.equal(b.state.label,'AUSGEWÄHLTE SHOW · Show B');assert.equal(ride.state.highlight,false);
ctx.targetAvailable=()=>false;ctx.markShowTargets();assert.equal(b.state.highlight,false);assert.equal(b.state.label,null);assert.equal(b.state.z,-500);
console.log('Passed: selected and next shows remain labelled, old selection clears, rides do not receive show labels.');

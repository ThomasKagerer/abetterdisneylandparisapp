'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),s=fs.readFileSync(__dirname+'/../dist/app.js','utf8'),els=new Map(),storage=new Map();let options,opened=0;
const $=id=>{if(!els.has(id))els.set(id,{hidden:true,attrs:{},setAttribute(k,v){this.attrs[k]=v;},addEventListener(){}});return els.get(id);};
const ctx={console:{error(){}},$ ,mapMode:'geo',original:false,threeMap:null,originalMap:null,Disney3D:{create:(m,o)=>{options=o;return{open(){opened++;},close(){},getBearing:()=>0};}},map:{invalidateSize(){}},userKey:'test',localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},document:{body:{classList:{toggle(){}}},querySelector:()=>({classList:{toggle(){}}})},threeMapState(){},openMapObjectSheet(){},renderFollow(){},updateNorth(){},updateOrientation(){}};
vm.createContext(ctx);vm.runInContext(s.slice(s.indexOf('let mapDiagnostics=null;'),s.indexOf('function renderOrientation(')),ctx);
ctx.showMap('3d');assert.equal(storage.get('test:map-type'),'3d');ctx.showNavigationMap();assert.equal(ctx.mapMode,'3d');assert.equal($('three-tab').attrs['aria-pressed'],true);assert(opened>=2);
options.onError();assert.equal(ctx.mapMode,'3d');assert.equal(storage.get('test:map-type'),'3d');assert.equal($('three-error').hidden,false,'Loading failure is visible and cannot silently reset preference');ctx.mapMode='geo';ctx.loadMapMode();assert.equal(ctx.mapMode,'3d');
ctx.showMap('geo');options.onError();assert.equal(ctx.mapMode,'geo');assert.equal($('three-error').hidden,true,'Old 3D load must not override an explicit later choice');
const html=fs.readFileSync(__dirname+'/../dist/index.html','utf8');assert(!html.includes('id="map-pitch"'));assert(!s.includes("showMap('geo');toast('3D"));
console.log('Passed: 3D persists through navigation/reload, error preserves selection with retry, explicit 2D wins late error; tilt is a map gesture, no settings slider.');

// The real initializer must open the renderer, rather than just change a flag.
storage.clear();ctx.mapMode='geo';const before=opened;ctx.loadMapMode();assert.equal(ctx.mapMode,'3d');assert.equal(opened,before+1);assert.equal(storage.get('test:map-type'),'3d');
storage.set('test:map-type','invalid');ctx.loadMapMode();assert.equal(ctx.mapMode,'3d');
ctx.localStorage.getItem=()=>{throw Error('unavailable storage');};ctx.mapMode='geo';ctx.loadMapMode();assert.equal(ctx.mapMode,'3d');ctx.localStorage.getItem=k=>storage.get(k);
storage.set('test:map-type','geo');ctx.loadMapMode();assert.equal(ctx.mapMode,'geo','Explicit 2D choice survives the new default');
ctx.originalMap={invalidateSize(){},fitBounds(){}};storage.set('test:map-type','original');ctx.loadMapMode();assert.equal(ctx.mapMode,'original','Explicit Disney plan survives the new default');
console.log('Passed: fresh, invalid and unavailable storage actively open 3D; saved 2D/Disney/3D choices remain honored.');

(async()=>{storage.set('test:map-type','3d');ctx.mapMode='geo';ctx.threeMap=null;ctx.Disney3D=undefined;ctx.loadMapMode();assert.equal(ctx.mapMode,'3d');assert.equal($('three-error').hidden,false,'Missing 3D module leaves retry visible without throwing out of startup');ctx.Disney3D={create(){throw Error('create failed');}};await ctx.loadMapMode();assert.equal($('three-error').hidden,false);ctx.Disney3D={create:()=>({open:()=>Promise.reject(Error('open failed'))})};await ctx.loadMapMode();assert.equal($('three-error').hidden,false);assert.equal(storage.get('test:map-type'),'3d');console.log('Passed: missing module, constructor failure and rejected renderer open cannot abort app startup.');})().catch(error=>{console.error(error);process.exitCode=1;});

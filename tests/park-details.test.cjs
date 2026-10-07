'use strict';
const assert=require('node:assert/strict'),M=require('../dist/park-models.js'),C=require('../dist/map-3d.js'),scene=require('../dist/park-scene.json'),park=require('../dist/park-data.json');
const byKind=kind=>scene.landmarks.find(l=>l.kind===kind),entry=byKind('entry'),water=byKind('waterTower'),station=byKind('station'),chessy=byKind('chessy'),tower=byKind('tower');
for(const l of [entry,water,station,chessy,tower]){assert(l&&l.sourceId&&l.latlng.every(Number.isFinite));const mesh=M.build({landmarks:[l],trees:[]},park.rides),compact=M.build({landmarks:[l],trees:[],modelDetail:'compact'},park.rides);assert(mesh.every(Number.isFinite));assert(compact.every(Number.isFinite));for(let i=3;i<mesh.length;i+=6)for(let c=0;c<3;c++)assert(mesh[i+c]>=0&&mesh[i+c]<=1);}
assert.equal(water.sourceId,'way49734660');assert.equal(water.height,33);assert.equal(station.sourceId,'way289661415');assert.equal(chessy.sourceId,'way1165411503');assert.equal(station.rideId,'ride-disneyland-railroad-main-street-station');
for(const l of [entry,water,station,chessy])for(const id of l.sourceIds)assert.equal(scene.features.features.find(f=>f.id===id).properties.customModel,true,'Old solid extrusion must not hide open architecture');
// Under the tank, a vertical ray at its centre must remain unobstructed by solid walls.
const center=M.ORIGIN,sx=111195*Math.cos(center[1]*Math.PI/180),mesh=M.build({landmarks:[water],trees:[]},[]),cx=(water.latlng[1]-center[0])*sx,cy=(water.latlng[0]-center[1])*111195;
for(let i=0;i<mesh.length;i+=18){const a=[mesh[i]-cx,mesh[i+1]-cy,mesh[i+2]],b=[mesh[i+6]-cx,mesh[i+7]-cy,mesh[i+8]],c=[mesh[i+12]-cx,mesh[i+13]-cy,mesh[i+14]],den=(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);if(Math.abs(den)<1e-7)continue;const u=(-a[0]*(c[1]-a[1])+a[1]*(c[0]-a[0]))/den,v=(-(b[0]-a[0])*a[1]+(b[1]-a[1])*a[0])/den;if(u>=0&&v>=0&&u+v<=1){const z=a[2]+u*(b[2]-a[2])+v*(c[2]-a[2]);assert(z>22,'Tank must stand on open steel legs');}}
const tank=scene.facadeSigns.find(s=>s.rideId===water.rideId);assert.equal(tank.plaque,false);assert(tank.vertices&&tank.lines.includes('ADVENTURE'));
for(let i=0;i<tank.vertices.length;i+=5){const dx=tank.vertices[i]-cx,dy=tank.vertices[i+1]-cy;assert(Math.abs(Math.hypot(dx,dy)-3.47)<.001,'Logo follows the cylinder, not a floating rectangle');}
assert(!scene.roofLettering.labels.some(l=>[water.sourceId,entry.sourceId,station.sourceId,chessy.sourceId,tower.sourceId].includes(l.sourceId)));
assert(scene.railways.length>30&&scene.fences.length>0);for(const rail of scene.railways){assert(rail.sourceId&&rail.points.length>1);assert(rail.gauge>0&&rail.gauge<2);assert(rail.points.flat().every(Number.isFinite));if(rail.type==='narrow_gauge')assert.equal(rail.gauge,.914);}
assert(scene.railways.some(r=>r.coveredStation&&r.points.some(p=>p[2]>4)),'Tracks follow the elevated station bridge');
assert(scene.railways.some(r=>r.type==='rail')&&scene.railways.some(r=>r.type==='tram'));
for(const count of [600,180]){const mesh=M.build(C.modelScene(scene,count),park.rides);assert(mesh.byteLength<(count===600?5.3:4)*1048576,'Handheld static geometry stays bounded');}
assert(M.build({trees:[],landmarks:[],fences:[{points:[[2.78,48.87],[2.78,48.87]]}]},[]).every(Number.isFinite),'Degenerate fence segments cannot poison the GPU buffer');
assert.equal(park.rides.length,95);assert.equal(scene.features.features.filter(f=>f.properties.kind==='path').length,park.paths.length);
console.log('Passed: source anchors, open water tower, curved painted logo, detailed stations, authentic gauge/elevated rails, render-only fences and mobile mesh budgets.');

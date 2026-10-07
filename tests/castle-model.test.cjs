'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),models=require('../dist/park-models.js');
const scene=require('../dist/park-scene.json'),park=require('../dist/park-data.json'),castle=scene.landmarks.find(l=>l.kind==='castle');
const mesh=models.build({landmarks:[castle],trees:[]},[]),plain=models.build({landmarks:[{...castle,dragon:null}],trees:[]},[]);
assert(mesh.every(Number.isFinite));assert(mesh.byteLength<1.3*1024*1024,'Detailed castle and dragon stay in a bounded static buffer');
let top=0;for(let i=2;i<mesh.length;i+=6)top=Math.max(top,mesh[i]);assert.equal(top,43,'Published castle height includes the gold tip');
const [lng,lat]=castle.latlng.slice().reverse(),sx=111195*Math.cos(models.ORIGIN[1]*Math.PI/180),cx=(lng-models.ORIGIN[0])*sx,cy=(lat-models.ORIGIN[1])*111195,ca=Math.cos(castle.modelAngle),sa=Math.sin(castle.modelAngle);
const local=i=>{const x=mesh[i]-cx,y=mesh[i+1]-cy;return [x*ca+y*sa,-x*sa+y*ca,mesh[i+2]];};
// A ray at walking height must pass through the front gate without a solid wall.
for(let i=0;i<plain.length;i+=18){const ps=[local(i),local(i+6),local(i+12)],a=ps[0],b=ps[1],c=ps[2],den=(b[0]-a[0])*(c[2]-a[2])-(b[2]-a[2])*(c[0]-a[0]);if(Math.abs(den)<1e-8)continue;const u=(-a[0]*(c[2]-a[2])-(2.7-a[2])*(c[0]-a[0]))/den,v=((b[0]-a[0])*(2.7-a[2])+(b[2]-a[2])*a[0])/den;if(u>=0&&v>=0&&u+v<=1){const y=a[1]+u*(b[1]-a[1])+v*(c[1]-a[1]);assert(y< -11||y> -2,'Castle gate is an open passage');}}
assert(mesh.length>plain.length,'Dragon adds actual 3D geometry');
const compact=models.build({landmarks:[castle],trees:[],modelDetail:'compact'},[]);assert(compact.byteLength<mesh.byteLength*.65,'Mobile castle keeps fewer facets');let compactTop=0;for(let i=2;i<compact.length;i+=6)compactTop=Math.max(compactTop,compact[i]);assert.equal(compactTop,43,'Mobile detail preserves the full silhouette');
let dragonTop=0;for(let i=plain.length;i<mesh.length;i+=6){const [x,y,z]=local(i);assert(x< -12&&x> -24&&Math.abs(y)<8,'Dragon sits low at the western castle foot');dragonTop=Math.max(dragonTop,z);}assert(dragonTop<5&&dragonTop>3,'Crouched dragon, not a flying billboard');
assert(!scene.roofLettering.labels.some(l=>l.sourceId===castle.sourceId));assert(!scene.roofLettering.rideIds.includes(castle.rideId));
assert(!scene.facadeSigns.some(s=>[castle.rideId,'ride-1359852391','ride-905816849'].includes(s.rideId)));
const parent=scene.features.features.find(f=>f.id==='way225604995');assert(parent.properties.castleCutout,'Shared Fantasyland footprint must not obscure the castle gate');
assert.deepEqual(park.rides.find(r=>r.id===castle.rideId).latlng,[48.8731026,2.7761195]);assert.deepEqual(park.rides.find(r=>r.id===castle.dragon.rideId).latlng,[48.8730992,2.7758162]);
assert.equal(scene.landmarks.find(l=>l.kind==='tower').height,59);assert.equal(scene.landmarks.find(l=>l.kind==='space').height,32);
console.log('Passed: 43m silhouette, finite bounded mesh, open gate, low western dragon, no castle lettering, render-only cutout and stable navigation entrances.');

'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const camera=require('../dist/map-3d.js'),models=require('../dist/park-models.js');
const park=JSON.parse(fs.readFileSync(__dirname+'/../dist/park-data.json')),scene=JSON.parse(fs.readFileSync(__dirname+'/../dist/park-scene.json'));
// Both park renderers use the exact walking geometry, including all entrance endpoints.
const paths=scene.features.features.filter(f=>f.properties.kind==='path');
assert.equal(paths.length,park.paths.length);
paths.forEach((f,i)=>assert.deepEqual(f.geometry.coordinates,park.paths[i].map(camera.ll)));
const {Router}=require('../dist/routing.js'),router=new Router(park),start=park.rides[0];
for(const ride of park.rides){const leg=router.leg(start.node,ride.node),route=camera.routeFeature(leg.path,false);if(leg.path.length>1){assert.deepEqual(route.features[0].geometry.coordinates.at(-1),camera.ll(park.nodes[ride.node]));assert.deepEqual(route.features[0].geometry.coordinates,leg.path.map(camera.ll));}assert.equal(camera.routeFeature(leg.path,true).features.length,0);}
const position=[48.87,2.78],circle=camera.accuracyCircle(position,10).features[0].geometry.coordinates[0];
assert.deepEqual(circle[0],circle.at(-1));for(const p of circle){const d=Math.hypot((p[0]-position[1])*111195*Math.cos(position[0]*Math.PI/180),(p[1]-position[0])*111195);assert(Math.abs(d-10)<.001);}
assert.equal(camera.accuracyCircle(null,10).features.length,0);assert.equal(camera.accuracyCircle(position,NaN).features.length,0);
// Geographic footprints are closed, retain courtyard holes and finite positive elevations.
let holes=0;for(const f of scene.features.features.filter(f=>f.properties.kind==='building')){assert(f.properties.height>0&&f.properties.height<=70);for(const poly of f.geometry.coordinates){holes+=poly.length-1;for(const ring of poly){assert.deepEqual(ring[0],ring.at(-1));assert(ring.length>=4);assert(ring.flat().every(Number.isFinite));}}}assert(holes>0,'Courtyards must remain open');
const vertices=models.build(scene,park.rides);assert(vertices.length>0&&vertices.length%18===0);assert(vertices.every(Number.isFinite));let raised=0;for(let i=0;i<vertices.length;i+=6){raised+=vertices[i+2]>0;for(let j=3;j<6;j++)assert(vertices[i+j]>=0&&vertices[i+j]<=1);}assert(raised>1000);
// Exercise the real v6 custom-layer calling convention and its Mercator projection.
const mesh=models.layer({},scene,park.rides),identity=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];let rendered,matrix,vao,program,culling=true;
Object.assign(mesh,{origin:{x:.5,y:.3,z:0},scale:2,vao:'mesh-vao',program:'mesh-program',uniform:'matrix'});
const gl={VERTEX_ARRAY_BINDING:1,CURRENT_PROGRAM:2,CULL_FACE:3,TRIANGLES:4,getParameter:key=>key===1?'old-vao':'old-program',isEnabled:()=>culling,disable:()=>culling=false,enable:()=>culling=true,useProgram:p=>program=p,bindVertexArray:v=>vao=v,uniformMatrix4fv:(u,t,m)=>matrix=m,drawArrays:(type,first,count)=>rendered=count};
mesh.render(gl,{defaultProjectionData:{mainMatrix:identity},modelViewProjectionMatrix:new Array(16).fill(NaN)});
assert.equal(rendered,vertices.length/6);assert.deepEqual([...matrix],[2,0,0,0,-0,-2,-0,-0,0,0,2,0,.5,Math.fround(.3),0,1]);assert.equal(vao,'old-vao');assert.equal(program,'old-program');assert(culling);
mesh.map={getZoom:()=>3};rendered=null;mesh.render(gl,{defaultProjectionData:{mainMatrix:identity}});assert.equal(rendered,null,'Park models must not draw in globe projection');
// Shared view state preserves 3D during navigation, but the explicit 2D button exits it.
const app=fs.readFileSync(__dirname+'/../dist/app.js','utf8'),calls=[],ctx={mapMode:'3d',showMap:kind=>calls.push(kind)};vm.createContext(ctx);vm.runInContext(app.match(/function showNavigationMap\(\)\{[^\n]+/)[0],ctx);ctx.showNavigationMap();assert.equal(calls.at(-1),'3d');ctx.mapMode='original';ctx.showNavigationMap();assert.equal(calls.at(-1),'geo');assert(app.includes("$('geo-tab').onclick=()=>showMap('geo')"));
const css=fs.readFileSync(__dirname+'/../dist/style.css','utf8');assert(css.match(/\.map-3d-marker\{([^}]+)\}/)[1].includes('position:absolute'),'Geographic symbols must not take normal-flow offsets');
console.log('Passed: all walking paths/95 entrance endpoints shared, waiting hides route, GPS accuracy in metres, courtyard geometry, real elevated meshes, v6 Mercator/depth rendering and map-mode navigation.');

const roofScene={features:{features:[{properties:{kind:'building',height:12},geometry:{coordinates:[[[[2,48],[3,48],[3,49],[2,49],[2,48]],[[2.4,48.4],[2.6,48.4],[2.6,48.6],[2.4,48.6],[2.4,48.4]]]]}}]}};
assert.deepEqual(camera.roofLocation(roofScene,{latlng:[48.2,2.2]}),{lnglat:[2.2,48.2],height:16});assert.equal(camera.roofLocation(roofScene,{latlng:[48.5,2.5]}),null,'No floating brand over a courtyard');assert.equal(camera.roofLocation(roofScene,{latlng:[47,2]}),null,'Outdoor targets get no fabricated roof');
console.log('Passed: building branding uses roof footprints and elevation; courtyard/outdoor targets excluded.');

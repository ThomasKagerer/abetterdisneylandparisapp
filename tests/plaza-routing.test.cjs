const assert=require('node:assert/strict'),fs=require('node:fs'),{Router}=require('../dist/routing.js');
const data=JSON.parse(fs.readFileSync(__dirname+'/../dist/park-data.json')),meta=data.plazaGraph;
assert(meta&&meta.areas>0&&meta.links>0);
const before=new Router({...data,nodes:data.nodes.slice(0,meta.baseNodes),edges:data.edges.slice(0,meta.baseEdges)}),after=new Router(data);
const place=[48.8667448,2.7798002],target=data.rides.find(r=>r.name==='Spider-Man W.E.B. Adventure');
const old=before.leg(before.snap(place).node,target.node),current=after.leg(after.snap(place).node,target.node);
assert(old.distance>250);assert(current.distance<130);assert(current.distance<old.distance*.5);
for(const ride of data.rides)assert(Number.isFinite(after.tree(data.rides[0].node).ds[ride.node]),ride.name+' stays reachable');
console.log('Passed: Place des Stars to Spider-Man:',Math.round(old.distance),'→',Math.round(current.distance),'m; all entrances remain reachable.');
